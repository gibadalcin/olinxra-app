import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Animated, TouchableOpacity, Linking } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Componente BlurView animado para efeito glass
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

interface ContentBlocksProps {
    blocos: any[];
}

export function ContentBlocks({ blocos }: ContentBlocksProps) {
    if (!blocos || blocos.length === 0) {
        return null;
    }

    // ✅ SEPARAR BLOCOS POR TIPO PARA ORDEM CORRETA
    const imagemTopo = blocos.find((b) => {
        const tipo = b?.tipo?.toLowerCase() || '';
        const subtipo = b?.subtipo?.toLowerCase() || '';
        return tipo.includes('imagem') && (tipo.includes('topo') || subtipo === 'header');
    });

    const textBlocks = blocos.filter((b) => {
        const tipo = b?.tipo?.toLowerCase() || '';
        return tipo.includes('título') || tipo.includes('titulo') || tipo.includes('subtitulo') || tipo.includes('texto') || tipo.includes('text');
    });

    const otherBlocks = blocos.filter((b) => {
        const tipo = b?.tipo?.toLowerCase() || '';
        const subtipo = b?.subtipo?.toLowerCase() || '';
        const isImagemTopo = tipo.includes('imagem') && (tipo.includes('topo') || subtipo === 'header');
        const isText = tipo.includes('título') || tipo.includes('titulo') || tipo.includes('subtitulo') || tipo.includes('texto') || tipo.includes('text');
        return !isImagemTopo && !isText;
    });

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={true}
        >
            {/* 1️⃣ IMAGEM TOPO - Primeira, largura total */}
            {imagemTopo && <HeaderBlock bloco={imagemTopo} />}

            {/* 2️⃣ TÍTULO, SUBTÍTULO, TEXTO - Na sequência */}
            {textBlocks.map((bloco, index) => (
                <BlockRenderer key={`text-${index}`} bloco={bloco} index={index} />
            ))}

            {/* 3️⃣ OUTROS BLOCOS - Carrossel, Vídeo, Botões */}
            {otherBlocks.map((bloco, index) => (
                <BlockRenderer key={`other-${index}`} bloco={bloco} index={index} />
            ))}
        </ScrollView>
    );
}

function BlockRenderer({ bloco, index }: { bloco: any; index: number }) {
    const tipo = bloco?.tipo?.toLowerCase() || 'unknown';
    const subtipo = bloco?.subtipo?.toLowerCase() || '';

    // HEADER/TOPO - Geralmente contém imagem principal
    if (tipo.includes('header') || tipo.includes('topo') || tipo.includes('imagem') || subtipo === 'header') {
        return <HeaderBlock bloco={bloco} />;
    }

    // TEXTO/TÍTULO
    if (tipo.includes('texto') || tipo.includes('text') || tipo.includes('título') || tipo.includes('titulo')) {
        return <TextBlock bloco={bloco} />;
    }

    // CARROSSEL
    if (tipo.includes('carousel') || tipo.includes('carrossel') || tipo.includes('galeria')) {
        return <CarouselBlock bloco={bloco} />;
    }

    // VÍDEO
    if (tipo.includes('video') || tipo.includes('vídeo')) {
        return <VideoBlock bloco={bloco} />;
    }

    // BOTÃO
    if (tipo.includes('botao') || tipo === 'botao_destaque' || tipo === 'botao_default') {
        return <ButtonBlock bloco={bloco} />;
    }

    // FALLBACK: Bloco desconhecido
    return (
        <View style={styles.unknownBlock}>
            <Text style={styles.unknownText}>
                Bloco tipo "{tipo}" (índice {index})
            </Text>
        </View>
    );
}

// ========== COMPONENTES DE BLOCOS ==========

function HeaderBlock({ bloco }: { bloco: any }) {
    const imageUrl = bloco?.signed_url || bloco?.url || bloco?.previewDataUrl;
    const titulo = bloco?.titulo || bloco?.label;
    const [imageAspectRatio, setImageAspectRatio] = React.useState<number>(16 / 9);

    if (!imageUrl) {
        return null;
    }

    return (
        <View style={styles.headerBlock}>
            {titulo && <Text style={styles.headerTitle}>{titulo}</Text>}
            <Image
                source={{ uri: imageUrl }}
                style={[styles.headerImage, { aspectRatio: imageAspectRatio }]}
                contentFit="contain"
                placeholder={require('../assets/images/adaptive-icon.png')}
                transition={200}
                onLoad={(event) => {
                    // Calcula aspect ratio da imagem real
                    const { width, height } = event.source;
                    if (width && height) {
                        setImageAspectRatio(width / height);
                    }
                }}
            />
        </View>
    );
}

function TextBlock({ bloco }: { bloco: any }) {
    const tipo = bloco?.tipo?.toLowerCase() || '';
    const conteudo = bloco?.conteudo || bloco?.texto || bloco?.text || '';
    const titulo = bloco?.titulo || bloco?.title;

    if (!conteudo && !titulo) {
        return null;
    }

    // Detectar se é título, subtítulo ou texto
    const isTitulo = tipo.includes('título') || tipo.includes('titulo');
    const isSubtitulo = tipo.includes('subtítulo') || tipo.includes('subtitulo');

    return (
        <View style={styles.textBlock}>
            {isTitulo && conteudo && (
                <Text style={styles.mainTitle}>{conteudo}</Text>
            )}
            {isSubtitulo && conteudo && (
                <Text style={styles.subtitle}>{conteudo}</Text>
            )}
            {!isTitulo && !isSubtitulo && (
                <>
                    {titulo && <Text style={styles.textTitle}>{titulo}</Text>}
                    {conteudo && <Text style={styles.textContent}>{conteudo}</Text>}
                </>
            )}
        </View>
    );
}

// ========== COMPONENTE AUXILIAR: CAROUSEL CARD ==========
function CarouselCard({ item, index }: { item: any; index: number }) {
    const imageUrl = item?.signed_url || item?.url || item?.previewDataUrl;

    if (!imageUrl) {
        return null;
    }

    return (
        <View key={`carousel-${index}`} style={styles.carouselCard}>
            <Image
                source={{ uri: imageUrl }}
                style={styles.carouselImage}
                contentFit="cover"
                placeholder={require('../assets/images/adaptive-icon.png')}
                transition={200}
            />
        </View>
    );
}

// ========== COMPONENTE: CAROUSEL BLOCK ==========
function CarouselBlock({ bloco }: { bloco: any }) {
    const items = bloco?.items || bloco?.imagens || [];
    const [isOpen, setIsOpen] = React.useState(false);
    const translateX = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;

    React.useEffect(() => {
        Animated.spring(translateX, {
            toValue: isOpen ? 0 : SCREEN_WIDTH, // 0 = totalmente visível, SCREEN_WIDTH = escondido à direita
            useNativeDriver: true,
            tension: 50,
            friction: 8,
        }).start();
    }, [isOpen]);

    if (items.length === 0) {
        return null;
    }

    return (
        <>
            {/* ABA FIXA (sempre visível) */}
            <TouchableOpacity
                style={styles.carouselTab}
                onPress={() => setIsOpen(!isOpen)}
                activeOpacity={0.8}
            >
                <View style={styles.carouselTabHandle}>
                    <Text style={styles.carouselTabIcon}>{isOpen ? '◀' : '▶'}</Text>
                    <Text style={styles.carouselTabCount}>({items.length})</Text>
                </View>
            </TouchableOpacity>

            {/* DRAWER COM CAROUSEL HORIZONTAL - EFEITO GLASS */}
            <AnimatedBlurView
                intensity={80}
                tint="light"
                style={[
                    styles.carouselDrawer,
                    {
                        transform: [{ translateX }],
                    },
                ]}
            >
                {/* Carousel Horizontal com Cards */}
                <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    style={styles.carouselScroll}
                    contentContainerStyle={styles.carouselScrollContent}
                    snapToInterval={SCREEN_WIDTH * 0.7 + 16} // 70% da tela + marginRight
                    decelerationRate="fast"
                >
                    {items.map((item: any, idx: number) => (
                        <CarouselCard key={`carousel-${idx}`} item={item} index={idx} />
                    ))}
                </ScrollView>
            </AnimatedBlurView>
        </>
    );
}

function VideoBlock({ bloco }: { bloco: any }) {
    const url = bloco?.signed_url || bloco?.url;
    const titulo = bloco?.titulo || bloco?.label;

    return (
        <View style={styles.videoBlock}>
            {titulo && <Text style={styles.videoTitle}>{titulo}</Text>}
            <View style={styles.videoPlaceholder}>
                <Text style={styles.videoPlaceholderText}>
                    🎥 Vídeo: {url ? 'Disponível' : 'Não disponível'}
                </Text>
                <Text style={styles.videoHint}>
                    (Implementação do player de vídeo em desenvolvimento)
                </Text>
            </View>
        </View>
    );
}

// Mapeamento de nomes de ícones para símbolos/emojis
const iconMap: Record<string, string> = {
    arrowRight: '→',
    arrowLeft: '←',
    arrowUp: '↑',
    arrowDown: '↓',
    check: '✓',
    cross: '✗',
    star: '★',
    heart: '♥',
    cart: '🛒',
    bag: '🛍️',
    search: '🔍',
    home: '🏠',
    user: '👤',
    settings: '⚙️',
    info: 'ℹ',
    warning: '⚠',
    plus: '+',
    minus: '-',
    menu: '☰',
    close: '✕',
};

function ButtonBlock({ bloco }: { bloco: any }) {
    const label = bloco?.label || bloco?.titulo || 'Ação';
    const action = bloco?.action;

    // Mapear cores do bloco
    const colorMap: Record<string, string> = {
        red: '#e74c3c',
        blue: '#3498db',
        green: '#2ecc71',
        yellow: '#f1c40f',
        orange: '#e67e22',
        purple: '#9b59b6',
        gray: '#95a5a6',
        black: '#2c3e50',
    };

    const backgroundColor = bloco?.backgroundColor || colorMap[bloco?.color?.toLowerCase()] || bloco?.cor || '#e74c3c';
    const textColor = bloco?.textColor || bloco?.corTexto || '#fff';

    // Mapear ícone
    const iconName = bloco?.icon || bloco?.icone || '';
    const iconSymbol = iconMap[iconName] || iconName; // Se não encontrar no mapa, usa o próprio valor
    const iconInvert = bloco?.icon_invert || false;

    const [isOpen, setIsOpen] = React.useState(false);
    const translateY = React.useRef(new Animated.Value(300)).current; // 300px escondido abaixo

    React.useEffect(() => {
        Animated.spring(translateY, {
            toValue: isOpen ? 0 : 300, // 0 = visível, 300 = escondido abaixo
            useNativeDriver: true,
            tension: 50,
            friction: 8,
        }).start();
    }, [isOpen]);

    return (
        <>
            {/* ABA FIXA NA BORDA INFERIOR (sempre visível) */}
            <TouchableOpacity
                style={styles.buttonTab}
                onPress={() => setIsOpen(!isOpen)}
                activeOpacity={0.8}
            >
                <View style={styles.buttonTabHandle}>
                    <Text style={styles.buttonTabIcon}>{isOpen ? '▼' : '▲'}</Text>
                    <Text style={styles.buttonTabText}>Destaque</Text>
                </View>
            </TouchableOpacity>

            {/* DRAWER COM BOTÃO - EFEITO GLASS */}
            <AnimatedBlurView
                intensity={80}
                tint="light"
                style={[
                    styles.buttonDrawer,
                    {
                        transform: [{ translateY }],
                    },
                ]}
            >
                <TouchableOpacity
                    style={[
                        styles.buttonDrawerContent,
                        { backgroundColor }
                    ]}
                    onPress={() => {
                        // Validar se a URL é válida antes de abrir
                        if (action?.href &&
                            action.href !== '/#' &&
                            action.href !== '#' &&
                            action.href.length > 3 &&
                            (action.href.startsWith('http://') ||
                                action.href.startsWith('https://') ||
                                action.href.startsWith('tel:') ||
                                action.href.startsWith('mailto:'))) {
                            Linking.openURL(action.href).catch(err => {
                                console.warn('Erro ao abrir URL:', err);
                            });
                        }
                        setIsOpen(false);
                    }}
                    activeOpacity={0.8}
                >
                    {!iconInvert && iconSymbol && (
                        <Text style={[styles.buttonDrawerIcon, { color: textColor }]}>
                            {iconSymbol}
                        </Text>
                    )}
                    <Text style={[styles.buttonDrawerText, { color: textColor }]}>
                        {label}
                    </Text>
                    {iconInvert && iconSymbol && (
                        <Text style={[styles.buttonDrawerIcon, { color: textColor, marginLeft: 8, marginRight: 0 }]}>
                            {iconSymbol}
                        </Text>
                    )}
                </TouchableOpacity>
            </AnimatedBlurView>
        </>
    );
}

// ========== ESTILOS ==========

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    contentContainer: {
        flexGrow: 1, // Garante que ocupe toda a altura disponível
    },

    // Header/Topo - SEM margem horizontal, largura total
    headerBlock: {
        marginBottom: 0, // Sem espaço embaixo para colar com texto
        backgroundColor: '#fff',
        width: '100%', // Largura total
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#111',
        padding: 16,
        paddingBottom: 8,
    },
    headerImage: {
        width: '100%', // Largura total da tela
        height: undefined, // Altura automática baseada na proporção da imagem
        aspectRatio: 16 / 9, // Proporção padrão (será ajustada pela imagem real)
        minHeight: 200, // Altura mínima para garantir visibilidade
        maxHeight: 500, // Altura máxima para evitar imagens muito grandes
        backgroundColor: '#e0e0e0',
    },

    // Texto
    textBlock: {
        backgroundColor: '#fff',
        padding: 16,
        marginBottom: 0, // Sem espaço entre blocos de texto
        marginHorizontal: 0, // Largura total
        borderRadius: 0, // Sem bordas arredondadas
    },
    mainTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#111',
        marginBottom: 8,
        lineHeight: 32,
        marginTop: 32,
    },
    subtitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#444',
        marginBottom: 12,
        lineHeight: 26,
    },
    textTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#222',
        marginBottom: 8,
    },
    textContent: {
        fontSize: 15,
        lineHeight: 22,
        color: '#444',
    },

    // Carrossel
    carouselBlock: {
        marginBottom: 4,
        backgroundColor: '#fff',
        paddingVertical: 16,
        height: 250,
    },
    carouselScroll: {
        paddingLeft: 16,
    },
    carouselItem: {
        width: SCREEN_WIDTH - 48, // Largura do card (tela - margens)
        marginRight: 16,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#f9f9f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },

    // Vídeo
    videoBlock: {
        backgroundColor: '#fff',
        padding: 16,
        marginBottom: 12,
        marginHorizontal: 8,
        borderRadius: 8,
    },
    videoTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#222',
        marginBottom: 12,
    },
    videoPlaceholder: {
        backgroundColor: '#f0f0f0',
        padding: 32,
        borderRadius: 8,
        alignItems: 'center',
    },
    videoPlaceholderText: {
        fontSize: 16,
        color: '#666',
        marginBottom: 8,
    },
    videoHint: {
        fontSize: 12,
        color: '#999',
        fontStyle: 'italic',
    },

    // Button Drawer - Aba (borda inferior da tela)
    buttonTab: {
        position: 'absolute',
        backgroundColor: '#3498db',
        bottom: 0,
        left: '25%', // Centralizado horizontalmente
        right: '25%', // 50% da largura da tela
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        zIndex: 101, // Acima do carousel overlay (98) e drawer (99, 100
    },
    buttonTabHandle: {
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    buttonTabIcon: {
        fontSize: 16,
        color: '#fff',
        marginRight: 8,
    },
    buttonTabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },

    // Button Drawer - Container (Glass Effect) - Escondido abaixo
    buttonDrawer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 140, // Altura fixa do drawer para acomodar o botão centralizado
        backgroundColor: 'rgba(255, 255, 255, 0.2)', // Semi-transparente para efeito glass
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
        zIndex: 99,
        overflow: 'hidden', // Importante para BlurView
        justifyContent: 'center', // Centraliza o conteúdo verticalmente
        alignItems: 'center', // Centraliza o conteúdo horizontalmente
        borderTopEndRadius: 12,
        borderTopStartRadius: 12,
    },
    buttonDrawerContent: {
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center', // Centraliza horizontalmente
        flexDirection: 'row', // Ícone e texto lado a lado
        width: '80%', // Máximo 80% da largura da tela
        maxWidth: 320, // Largura máxima absoluta
        height: 48, // Altura fixa do botão
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
        marginBottom: 20,
    },
    buttonDrawerIcon: {
        fontSize: 20,
        marginRight: 8, // Espaço entre ícone e texto
    },
    buttonDrawerText: {
        fontSize: 20,
        fontWeight: '700',
    },

    // Carousel Drawer - Aba
    carouselTab: {
        position: 'absolute',
        right: 0,
        top: '20%', // Posiciona no meio da tela verticalmente
        backgroundColor: '#3498db',
        paddingVertical: 20,
        paddingHorizontal: 8,
        borderTopLeftRadius: 12,
        borderBottomLeftRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: -2, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 100,
    },
    carouselTabHandle: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    carouselTabIcon: {
        fontSize: 16,
        color: '#fff',
        marginBottom: 4,
    },
    carouselTabText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
        writingDirection: 'ltr', // Texto horizontal
        textAlign: 'center',
        maxWidth: 80,
    },
    carouselTabCount: {
        fontSize: 10,
        color: '#e0e0e0',
        marginTop: 2,
    },

    // Carousel Drawer - Container (Glass Effect)
    carouselDrawer: {
        position: 'absolute',
        right: 0,
        bottom: '30%',
        width: '85%', // 85% da largura da tela
        backgroundColor: 'rgba(255, 255, 255, 0.2)', // Semi-transparente para efeito glass
        shadowColor: '#000',
        shadowOffset: { width: -4, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
        zIndex: 99,
        overflow: 'hidden', // Importante para BlurView
        borderTopStartRadius: 12,
        borderBottomStartRadius: 12,
    },
    carouselCloseButton: {
        padding: 8,
    },
    carouselCloseText: {
        fontSize: 24,
        color: '#333', // Cor mais escura para contrastar com glass
        fontWeight: '600',
    },

    // Carousel Drawer - ScrollView
    carouselScrollContent: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    carouselCard: {
        width: SCREEN_WIDTH * 0.7, // 70% da largura da tela
        marginRight: 16,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#f9f9f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
        height: SCREEN_WIDTH * 0.7, // Altura igual à largura (quadrado)
    },
    carouselImage: {
        width: '100%',
        height: '100%', // Preenche todo o card
        backgroundColor: '#e0e0e0',
    },

    // Bloco desconhecido
    unknownBlock: {
        backgroundColor: '#fff3cd',
        padding: 12,
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ffc107',
    },
    unknownText: {
        fontSize: 14,
        color: '#856404',
    },
});
