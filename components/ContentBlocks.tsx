import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Animated, TouchableOpacity, Linking, Alert } from 'react-native';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system';
// Alguns métodos do legacy foram marcados como deprecated na nova API.
// Importamos o legacy se estiver disponível para manter compatibilidade e evitar que a
// chamada a getInfoAsync lance em runtime em algumas versões do SDK.
let FileSystemLegacy: any = null;
try {
    // require é usado para permitir que bundlers incluam o legacy apenas se existir
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    FileSystemLegacy = require('expo-file-system/legacy');
} catch (e) {
    FileSystemLegacy = null;
}
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useARPayload } from '@/context/ARPayloadContext';
import { dbg } from '../src/utils/debugLog';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 0; // manter em sincronia com CustomTabBar.tsx

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

    // cache local de headers (map filename -> uri)
    const [headerCache, setHeaderCache] = React.useState<Record<string, string>>({});
    const headerKey = imagemTopo
        ? (imagemTopo?.filename || imagemTopo?.nome || String((imagemTopo?.signed_url || imagemTopo?.url || imagemTopo?.previewDataUrl || '').split('/').pop()))
        : null;

    // ler mapa provido pelo ARPayloadContext (download antecipado realizado no contexto)
    const { headerLocalMap } = useARPayload();

    const textBlocks = blocos.filter((b) => {
        const tipo = b?.tipo?.toLowerCase() || '';
        return tipo.includes('título') || tipo.includes('titulo') || tipo.includes('subtitulo') || tipo.includes('texto') || tipo.includes('text');
    });

    // 🔍 DEBUG: Verificar se há blocos duplicados
    React.useEffect(() => {
        dbg('[ContentBlocks] 📊 Total de blocos recebidos:', blocos.length);
        dbg('[ContentBlocks] 📝 Total de textBlocks:', textBlocks.length);

        textBlocks.forEach((b, idx) => {
            dbg(`[ContentBlocks] 📄 textBlock[${idx}]:`, {
                tipo: b?.tipo,
                titulo: b?.titulo ? b.titulo.substring(0, 20) + '...' : 'NULL',
                conteudo: b?.conteudo ? b.conteudo.substring(0, 30) + '...' : 'NULL'
            });
        });
    }, [blocos, textBlocks]);

    const otherBlocks = blocos.filter((b) => {
        const tipo = b?.tipo?.toLowerCase() || '';
        const subtipo = b?.subtipo?.toLowerCase() || '';
        const isImagemTopo = tipo.includes('imagem') && (tipo.includes('topo') || subtipo === 'header');
        const isText = tipo.includes('título') || tipo.includes('titulo') || tipo.includes('subtitulo') || tipo.includes('texto') || tipo.includes('text');
        const isButton = tipo.includes('botao') || tipo === 'botao_destaque' || tipo === 'botao_default';
        const isCarousel = tipo.includes('carousel') || tipo.includes('carrossel') || tipo.includes('galeria');
        return !isImagemTopo && !isText && !isButton && !isCarousel;
    });

    // Separar botões para renderizar FORA do ScrollView, como overlay fixo
    const buttonBlocks = blocos.filter((b) => {
        const tipo = b?.tipo?.toLowerCase() || '';
        return tipo.includes('botao') || tipo === 'botao_destaque' || tipo === 'botao_default';
    });

    // Separar carrosseis para renderizar FORA do ScrollView, como overlay fixo
    const carouselBlocks = blocos.filter((b) => {
        const tipo = b?.tipo?.toLowerCase() || '';
        return tipo.includes('carousel') || tipo.includes('carrossel') || tipo.includes('galeria');
    });

    // ✅ SIMPLIFICADO: Prefetch delegado ao ARPayloadContext
    // Apenas garante que Image.prefetch seja chamado (cache nativo do React Native)
    React.useEffect(() => {
        try {
            const urls: string[] = [];

            // Coleta URLs para Image.prefetch (cache nativo)
            if (imagemTopo) {
                const u = imagemTopo?.signed_url || imagemTopo?.signedUrl || imagemTopo?.url;
                if (u && !String(u).startsWith('data:')) urls.push(u);
            }

            otherBlocks.forEach((b) => {
                if (b?.items && Array.isArray(b.items)) {
                    b.items.forEach((it: any) => {
                        const u = it?.signed_url || it?.signedUrl || it?.url;
                        if (u && !String(u).startsWith('data:')) urls.push(u);
                    });
                }
            });

            // Image.prefetch para cache nativo (rápido, não bloqueia)
            if (urls.length > 0 && Image?.prefetch) {
                dbg('[ContentBlocks] 🔁 Image.prefetch para', urls.length, 'URLs');
                urls.forEach((u) => {
                    Image.prefetch(u).catch(() => { }); // swallow errors
                });
            }

            // ✅ Contexto já está fazendo download para FileSystem em background
            // Apenas sincronizamos headerCache se contexto já tiver URI
            if (headerKey && headerLocalMap?.[headerKey]) {
                setHeaderCache((prev) => ({ ...prev, [headerKey]: headerLocalMap[headerKey] }));
            }
        } catch (e) {
            console.warn('[ContentBlocks] prefetch error', e);
        }
    }, [blocos, headerKey, headerLocalMap]);

    // preferir uri provida pelo contexto (headerLocalMap) quando disponível
    const externalLocalHeaderUri = headerKey ? (headerLocalMap?.[headerKey] || headerCache[headerKey]) : null;

    return (
        <View style={styles.container}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={true}
            >
                {/* 1️⃣ IMAGEM TOPO - Primeira, largura total */}
                {imagemTopo && <HeaderBlock bloco={imagemTopo} localHeaderUri={externalLocalHeaderUri} />}

                {/* 2️⃣ TÍTULO, SUBTÍTULO, TEXTO - Na sequência */}
                {textBlocks.map((bloco, index) => (
                    <BlockRenderer key={`text-${index}`} bloco={bloco} index={index} />
                ))}

                {/* 3️⃣ OUTROS BLOCOS - Carrossel, Vídeo, etc. (EXCETO botões) */}
                {otherBlocks.map((bloco, index) => (
                    <BlockRenderer key={`other-${index}`} bloco={bloco} index={index} />
                ))}
            </ScrollView>

            {/* 4️⃣ CAROUSEL (overlay fixo) */}
            {carouselBlocks.map((bloco, index) => (
                <CarouselBlock key={`carousel-overlay-${index}`} bloco={bloco} />
            ))}

            {/* 5️⃣ BOTÕES (overlay fixo acima do TabBar) */}
            {buttonBlocks.map((bloco, index) => (
                <ButtonBlock key={`button-${index}`} bloco={bloco} />
            ))}
        </View>
    );
}

function BlockRenderer({ bloco, index }: { bloco: any; index: number }) {
    const tipo = bloco?.tipo?.toLowerCase() || 'unknown';
    const subtipo = bloco?.subtipo?.toLowerCase() || '';

    // 🔍 DEBUG: Log de cada renderização
    React.useEffect(() => {
        dbg(`[BlockRenderer ${index}] 🎬 Renderizando:`, {
            tipo: bloco?.tipo,
            isTitulo: tipo.includes('título') || tipo.includes('titulo'),
            isSubtitulo: tipo.includes('subtítulo') || tipo.includes('subtitulo'),
            isTexto: tipo.includes('texto') || tipo.includes('text')
        });
    }, [bloco, index, tipo]);

    // HEADER/TOPO - Geralmente contém imagem principal
    if (tipo.includes('header') || tipo.includes('topo') || tipo.includes('imagem') || subtipo === 'header') {
        return <HeaderBlock bloco={bloco} />;
    }

    // TEXTO/TÍTULO/SUBTÍTULO - Todos vão para TextBlock
    if (tipo.includes('texto') || tipo.includes('text') || tipo.includes('título') || tipo.includes('titulo') || tipo.includes('subtítulo') || tipo.includes('subtitulo')) {
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

function HeaderBlock({ bloco, localHeaderUri: externalLocalHeaderUri }: { bloco: any; localHeaderUri?: string | null }) {
    // Priorizar preview lightweight quando disponível (preview_signed_url compatível com backend)
    const imageUrl = bloco?.preview_signed_url || bloco?.previewSignedUrl || bloco?.signed_url || bloco?.signedUrl || bloco?.url || bloco?.previewDataUrl;
    const titulo = bloco?.titulo || bloco?.label;
    const glbUrl = bloco?.glb_signed_url || bloco?.glb_url;
    const [imageAspectRatio, setImageAspectRatio] = React.useState<number>(16 / 9);
    const [localUri, setLocalUri] = React.useState<string | null>(null);
    const [imageLoaded, setImageLoaded] = React.useState<boolean>(false);

    // Preferir mapa de URIs locais provido pelo contexto. Isso garante que
    // o Header passe a usar o arquivo local assim que o contexto o baixar,
    // sem tentar baixar novamente aqui (centralizamos o download no contexto).
    const { headerLocalMap } = useARPayload();

    const filename = bloco?.filename || bloco?.nome || String((imageUrl || '').split('/').pop());
    const ctxLocal = headerLocalMap?.[filename] || externalLocalHeaderUri || null;

    // para medir tempos: quando o HeaderBlock monta e quando encontra URI local
    const [mountedAt] = React.useState<number>(() => Date.now());
    const [foundAt, setFoundAt] = React.useState<number | null>(null);

    // DEBUG: checar e logar fontes e estado local
    React.useEffect(() => {
        dbg('[HeaderBlock] 🔍 filename:', filename);
        dbg('[HeaderBlock] 🔍 ctxLocal present?', !!ctxLocal, ctxLocal);
        dbg('[HeaderBlock] 🔍 externalLocalHeaderUri present?', !!externalLocalHeaderUri, externalLocalHeaderUri);
        dbg('[HeaderBlock] 🔍 previewDataUrl present?', !!bloco?.previewDataUrl);
        dbg('[HeaderBlock] 🔍 imageUrl (remote) present?', !!imageUrl && typeof imageUrl === 'string' && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')));
        // Logar explicitamente preview vs signed para diagnóstico de falhas
        dbg('[HeaderBlock] 🔍 bloco.preview_signed_url:', bloco?.preview_signed_url || bloco?.previewSignedUrl);
        dbg('[HeaderBlock] 🔍 bloco.signed_url:', bloco?.signed_url || bloco?.signedUrl);
    }, [filename, ctxLocal, externalLocalHeaderUri, bloco?.previewDataUrl, imageUrl]);

    // payload não é utilizado aqui; removido para evitar erro de variável não utilizada

    // ✅ ESTRATÉGIA: Mostrar algo IMEDIATAMENTE (preview ou URL remota), melhorar depois se houver cache local
    // Prioridade de renderização:
    // 1. Cache local (file://) - melhor performance
    // 2. Preview base64 (data:) - carregamento instantâneo
    // 3. URL remota (https://) - fallback final
    // Helper: valida se previewDataUrl é um data URI base64 utilizável
    const isValidBase64 = (url: string | null | undefined) => {
        if (!url || typeof url !== 'string') return false;
        if (!url.startsWith('data:image')) return false;
        // base64 válido tem vírgula separando header e payload
        return url.includes(',') && url.indexOf(',') < 150;
    };

    // Se o próprio bloco não tiver previewDataUrl, tentar aproveitar preview de items (carousel)
    let previewCandidate: string | null = null;
    if (isValidBase64(bloco?.previewDataUrl)) {
        previewCandidate = bloco.previewDataUrl;
    } else if (Array.isArray(bloco?.items)) {
        for (const it of bloco.items) {
            if (isValidBase64(it?.previewDataUrl)) {
                previewCandidate = it.previewDataUrl;
                break;
            }
        }
    }

    // Estado inicial: mostrar preview (base64) se válido, caso contrário usar URL remota
    const initialSrc = previewCandidate || bloco?.previewDataUrl || imageUrl;
    const [displayUri, setDisplayUri] = React.useState<string>(
        ctxLocal || localUri || initialSrc || ''
    );

    // ✅ UPGRADE PROGRESSIVO: Se cache local aparecer, upgradar para ele (melhor qualidade/performance)
    React.useEffect(() => {
        // Se já temos cache local, usar direto
        if (ctxLocal) {
            setDisplayUri(ctxLocal);
            setFoundAt(Date.now());
            return;
        }
        if (localUri) {
            setDisplayUri(localUri);
            setFoundAt(Date.now());
            return;
        }

        // Senão, aguardar cache aparecer no contexto (mas SEM bloquear renderização)
        let mounted = true;
        const checkInterval = setInterval(() => {
            if (!mounted) return;
            const candidate = headerLocalMap?.[filename];
            if (candidate) {
                dbg('[HeaderBlock] � Cache local disponível, fazendo upgrade:', filename);
                setFoundAt(Date.now());
                setDisplayUri(candidate);
                clearInterval(checkInterval);
            }
        }, 100);

        // Desiste depois de 2s (mas continua mostrando preview/URL remota)
        const timeout = setTimeout(() => {
            clearInterval(checkInterval);
        }, 2000);

        return () => {
            mounted = false;
            clearInterval(checkInterval);
            clearTimeout(timeout);
        };
    }, [filename, headerLocalMap, ctxLocal, localUri]);

    // ✅ REMOVIDO: Prefetch duplicado - ARPayloadContext já faz isso em background
    // Deixamos apenas o contexto gerenciar downloads para evitar redundância

    // ✅ SIMPLIFICADO: Apenas verifica se já existe em cache, não baixa novamente
    // ARPayloadContext já está fazendo download em background
    React.useEffect(() => {
        (async () => {
            try {
                // Se contexto já forneceu URI, usar direto
                if (ctxLocal) {
                    setLocalUri(ctxLocal);
                    return;
                }

                // Verifica SE JÁ EXISTE em cache (não baixa, só consulta)
                const getCacheDir = () => {
                    return (FileSystem as any).cacheDirectory || (FileSystem as any).cacheDirectoryUri || (FileSystem as any).documentDirectory || '';
                };

                const cacheDir = getCacheDir();
                if (!cacheDir) return;
                const dest = `${cacheDir}olx_header_${encodeURIComponent(String(filename))}`;

                const info = FileSystemLegacy?.getInfoAsync
                    ? await FileSystemLegacy.getInfoAsync(dest)
                    : await (FileSystem as any).getInfoAsync(dest);

                if (info && info.exists) {
                    dbg('[HeaderBlock] ✅ Cache já existe:', info.uri);
                    setLocalUri(info.uri);
                }
            } catch (e) {
                // swallow
            }
        })();
    }, [filename, ctxLocal]);

    // Log do src efetivo para debugging rápido
    React.useEffect(() => {
        dbg('[HeaderBlock] ℹ️ displayUri atual:', displayUri);
        dbg('[HeaderBlock] ℹ️ Tipo de fonte:',
            displayUri?.startsWith('file://') ? 'CACHE LOCAL (melhor)' :
                displayUri?.startsWith('data:') ? 'PREVIEW BASE64 (rápido)' :
                    displayUri?.startsWith('http') ? 'URL REMOTA (lento)' :
                        'DESCONHECIDO'
        );
    }, [displayUri]);

    const { payload } = useARPayload();

    const handleARPress = async () => {
        const brandKey = payload?.marca || payload?.nome_marca || payload?.nomeMarca || null;
        const brandEntry = brandKey && payload?.anchorData && payload.anchorData.totem && payload.anchorData.totem.brands ? payload.anchorData.totem.brands[brandKey] : null;
        const brandModel = brandEntry?.modelUrl || brandEntry?.model_url || null;
        const brandUrl = brandEntry?.url || null;

        const modelToOpen = glbUrl || brandModel;
        if (modelToOpen) {
            dbg('[HeaderBlock] 🎯 Abrindo AR nativo com GLB:', modelToOpen);
            try {
                const sceneViewerUrl = `https://arvr.google.com/scene-viewer/1.2?file=${encodeURIComponent(modelToOpen)}&mode=ar_preferred`;
                await Linking.openURL(sceneViewerUrl);
                dbg('[HeaderBlock] ✅ Scene Viewer aberto com sucesso!');
            } catch (error) {
                console.error('[HeaderBlock] ❌ Erro ao abrir Scene Viewer:', error);
            }
            return;
        }

        if (brandUrl) {
            dbg('[HeaderBlock] ℹ️ Sem GLB — abrindo URL da marca como fallback:', brandUrl);
            try { await Linking.openURL(brandUrl); } catch (e) { console.error('[HeaderBlock] ❌ Erro abrindo brand URL:', e); }
            return;
        }

        dbg('[HeaderBlock] ❌ Nenhum GLB ou modelo disponível para este header');
        Alert.alert('AR não disponível', 'Não há modelo 3D disponível para este item.');
    };

    if (!imageUrl) {
        return null;
    }

    return (
        <View style={styles.headerBlock}>
            {titulo && <Text style={styles.headerTitle}>{titulo}</Text>}
            <View style={styles.headerImageContainer}>
                <Image
                    source={{ uri: displayUri || imageUrl }}
                    style={[styles.headerImage, { aspectRatio: imageAspectRatio }]}
                    contentFit="contain"
                    // ✅ Placeholder inteligente: preview base64 se disponível
                    placeholder={previewCandidate || bloco?.previewDataUrl || require('../assets/images/adaptive-icon.png')}
                    placeholderContentFit="cover"
                    // ✅ Sem transição (renderização imediata)
                    transition={0}
                    // ✅ Cache agressivo
                    cachePolicy="memory-disk"
                    onError={(err) => {
                        console.warn('[HeaderBlock] ❌ Image onError:', filename, err);
                        // se está tentando carregar o preview e falha, tentar fallback para signed_url
                        const previewUrl = bloco?.preview_signed_url || bloco?.previewSignedUrl;
                        const signedUrl = bloco?.signed_url || bloco?.signedUrl || bloco?.url;
                        if (displayUri && previewUrl && displayUri === previewUrl && signedUrl) {
                            dbg('[HeaderBlock] ℹ️ Fallback: preview falhou, tentando signed_url para', filename);
                            setDisplayUri(signedUrl);
                        }
                    }}
                    onLoadEnd={() => {
                        dbg('[HeaderBlock] 🖼️ Image onLoadEnd:', filename, 'displayUri=', displayUri?.substring(0, 120));
                    }}
                    onLoad={(event) => {
                        const loadAt = Date.now();
                        const latency = loadAt - mountedAt;
                        dbg('[HeaderBlock] 🖼️ Image onLoad:', filename);
                        dbg('[HeaderBlock] ⏱️ Latência total:', latency, 'ms');
                        dbg('[HeaderBlock] 📊 Fonte:',
                            displayUri?.startsWith('file://') ? 'CACHE' :
                                displayUri?.startsWith('data:') ? 'PREVIEW' : 'REMOTA'
                        );

                        if (foundAt) {
                            dbg('[HeaderBlock] ⏱️ Tempo cache->render:', loadAt - foundAt, 'ms');
                        }

                        // Calcula aspect ratio da imagem real
                        const w = (event && (event as any).source && (event as any).source.width) || (event && (event as any).width) || null;
                        const h = (event && (event as any).source && (event as any).source.height) || (event && (event as any).height) || null;
                        if (w && h) {
                            setImageAspectRatio(w / h);
                        }
                        setImageLoaded(true);
                    }}
                />

                {/* Botão "Ver em AR" - só aparece se tiver GLB */}
                {glbUrl && imageLoaded && (
                    <TouchableOpacity
                        style={styles.headerARButton}
                        onPress={handleARPress}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="cube-outline" size={18} color="#fff" />
                        <Text style={styles.headerARButtonText}>Ver em AR</Text>
                    </TouchableOpacity>
                )}
            </View>
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

    // Detectar hierarquia: SUBTÍTULO primeiro (mais específico), depois TÍTULO
    // Importante: "Subtítulo" contém "titulo", então verificar subtítulo ANTES!
    const isSubtitulo = tipo.includes('subtítulo') || tipo.includes('subtitulo');
    const isTitulo = !isSubtitulo && (tipo.includes('título') || tipo.includes('titulo'));

    // 🔍 DEBUG: Log para entender estrutura
    React.useEffect(() => {
        if (isSubtitulo || isTitulo) {
            dbg('[TextBlock] 🔍 Bloco:', {
                tipo,
                isTitulo,
                isSubtitulo,
                titulo: titulo ? 'TEM' : 'NULL',
                conteudo: conteudo ? conteudo.substring(0, 30) + '...' : 'NULL'
            });
        }
    }, [tipo, isTitulo, isSubtitulo, titulo, conteudo]);

    return (
        <View style={styles.textBlock}>
            {/* TÍTULO PRINCIPAL - Renderiza APENAS conteudo */}
            {isTitulo && (
                <Text style={styles.mainTitle}>{conteudo}</Text>
            )}

            {/* SUBTÍTULO - Renderiza APENAS conteudo (NUNCA titulo) */}
            {isSubtitulo && (
                <Text style={styles.subtitle}>{conteudo}</Text>
            )}

            {/* TEXTO NORMAL - Renderiza titulo (opcional) + conteudo */}
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
    // Priorizar preview_signed_url para cards também
    const imageUrl = item?.preview_signed_url || item?.previewSignedUrl || item?.signed_url || item?.signedUrl || item?.url || item?.previewDataUrl;
    const action = item?.action;
    const glbUrl = item?.glb_signed_url || item?.glb_url;
    const { headerLocalMap, payload } = useARPayload();
    const [cardImageLoaded, setCardImageLoaded] = React.useState<boolean>(false);
    // src atual do card (pode trocar de preview_signed_url -> signed_url em fallback)
    const filenameForCard = item?.filename || item?.nome || String((imageUrl || '').split('/').pop());
    const initialCardSrc = headerLocalMap?.[filenameForCard] || item?.previewDataUrl || imageUrl;
    const [cardSrc, setCardSrc] = React.useState<string>(initialCardSrc);

    // 🔍 DEBUG: Verificar estrutura do item
    React.useEffect(() => {
        dbg(`[CarouselCard ${index}] 🔍 Item:`, {
            imageUrl: imageUrl ? 'EXISTE' : 'NULL',
            action: action?.href || 'SEM ACTION',
            glbUrl: glbUrl || 'SEM GLB',
            keys: Object.keys(item),
        });
    }, [item, index, imageUrl, glbUrl, action]);

    if (!imageUrl) {
        return null;
    }

    const handleImagePress = () => {
        dbg('[CarouselCard] 📌 Imagem clicada!');
        dbg('[CarouselCard] 🔍 action completo:', action);

        // action pode ser string direta ou objeto com href
        const href = typeof action === 'string' ? action : action?.href;

        dbg('[CarouselCard] 🔗 href extraído:', href);

        // Verificar se tem href válido
        if (
            href &&
            href !== '/' &&
            href !== '/#' &&
            href !== '#' &&
            href.length > 3 &&
            (href.startsWith('http://') ||
                href.startsWith('https://') ||
                href.startsWith('tel:') ||
                href.startsWith('mailto:'))
        ) {
            dbg('[CarouselCard] ✅ Abrindo link:', href);
            Linking.openURL(href).catch((err) => {
                console.error('[CarouselCard] ❌ Erro ao abrir link:', err);
            });
        } else {
            dbg('[CarouselCard] ⚠️ Sem link válido para abrir, href:', href);
        }
    };

    const handleARPress = async () => {
        // Prefer GLB do item; se não houver, tentar usar modelo sintetizado do payload (totem) ou abrir a URL da marca
        const brandKey = payload?.marca || payload?.nome_marca || payload?.nomeMarca || null;
        const brandEntry = brandKey && payload?.anchorData && payload.anchorData.totem && payload.anchorData.totem.brands ? payload.anchorData.totem.brands[brandKey] : null;
        const brandModel = brandEntry?.modelUrl || brandEntry?.model_url || null;
        const brandUrl = brandEntry?.url || null;

        const modelToOpen = glbUrl || brandModel;
        if (modelToOpen) {
            dbg('[CarouselCard] 🎯 Abrindo AR nativo com GLB:', modelToOpen);
            try {
                const sceneViewerUrl = `https://arvr.google.com/scene-viewer/1.2?file=${encodeURIComponent(modelToOpen)}&mode=ar_preferred`;
                await Linking.openURL(sceneViewerUrl);
                dbg('[CarouselCard] ✅ Scene Viewer aberto com sucesso!');
            } catch (error) {
                console.error('[CarouselCard] ❌ Erro ao abrir Scene Viewer:', error);
            }
            return;
        }

        if (brandUrl) {
            dbg('[CarouselCard] ℹ️ Sem GLB — abrindo URL da marca como fallback:', brandUrl);
            try { await Linking.openURL(brandUrl); } catch (e) { console.error('[CarouselCard] ❌ Erro abrindo brand URL:', e); }
            return;
        }

        dbg('[CarouselCard] ❌ Nenhum GLB ou modelo disponível para este item');
        Alert.alert('AR não disponível', 'Não há modelo 3D disponível para este item.');
    };

    return (
        <View style={styles.carouselCard}>
            <TouchableOpacity
                style={styles.carouselImageContainer}
                onPress={handleImagePress}
                activeOpacity={0.8}
            >
                {(() => {
                    const filename = item?.filename || item?.nome || String((imageUrl || '').split('/').pop());
                    const localUri = headerLocalMap?.[filename];
                    const src = localUri || item?.previewDataUrl || imageUrl;
                    const isRemoteImg = typeof src === 'string' && (src.startsWith('http://') || src.startsWith('https://'));
                    return (
                        <Image
                            source={{ uri: cardSrc }}
                            style={styles.carouselImage}
                            contentFit="cover"
                            placeholder={item?.previewDataUrl || require('../assets/images/adaptive-icon.png')}
                            transition={isRemoteImg ? 200 : 0}
                            onLoad={() => {
                                setCardImageLoaded(true);
                            }}
                            onError={(err) => {
                                console.warn('[CarouselCard] ❌ Image onError:', item?.filename || item?.nome, err);
                                // se estava tentando carregar preview_signed_url, tentar fallback para signed_url
                                const previewUrl = item?.preview_signed_url || item?.previewSignedUrl;
                                const signedUrl = item?.signed_url || item?.signedUrl || item?.url;
                                if (cardSrc && previewUrl && cardSrc === previewUrl && signedUrl) {
                                    dbg('[CarouselCard] ℹ️ Fallback: preview falhou, tentando signed_url para', filenameForCard);
                                    setCardSrc(signedUrl);
                                    return;
                                }
                                setCardImageLoaded(false);
                            }}
                        />
                    );
                })()}
            </TouchableOpacity>

            {/* Botão "Ver em AR" - só aparece se tiver GLB */}
            {glbUrl && cardImageLoaded && (
                <TouchableOpacity
                    style={styles.carouselARButton}
                    onPress={handleARPress}
                    activeOpacity={0.8}
                >
                    <Ionicons name="cube-outline" size={18} color="#fff" />
                    <Text style={styles.carouselARButtonText}>Ver em AR</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

// ========== COMPONENTE: CAROUSEL BLOCK ==========
function CarouselBlock({ bloco }: { bloco: any }) {
    const items = bloco?.items || bloco?.imagens || [];
    const [isOpen, setIsOpen] = React.useState(false);
    const translateX = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;

    // Resetar estado quando a tela ganhar foco (após voltar do navegador)
    useFocusEffect(
        React.useCallback(() => {
            return () => {
                // Cleanup: fechar o carousel quando sair da tela
                setIsOpen(false);
            };
        }, [])
    );

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
                    <Text style={styles.carouselTabIcon}>{isOpen ? '▶' : '◀'}</Text>
                    <Text style={styles.carouselTabCount}>({items.length})</Text>
                </View>
            </TouchableOpacity>

            {/* DRAWER COM CAROUSEL HORIZONTAL - só renderiza quando aberto */}
            {isOpen && (
                <Animated.View
                    style={[
                        styles.carouselDrawer,
                        {
                            transform: [{ translateX }],
                        },
                    ]}
                >
                    <BlurView
                        intensity={80}
                        tint="light"
                        style={StyleSheet.absoluteFill}
                        pointerEvents="none"
                    />
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
                </Animated.View>
            )}
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

function ButtonBlock({ bloco }: { bloco: any }) {
    const label = bloco?.label || bloco?.titulo || 'Ação';
    const action = bloco?.action;

    // 🔍 DEBUG: Verificar estrutura do bloco
    React.useEffect(() => {
        dbg('[ButtonBlock] 🔍 Bloco completo:', JSON.stringify(bloco, null, 2));
        dbg('[ButtonBlock] 📋 action:', action);
        dbg('[ButtonBlock] 🔗 action?.href:', action?.href);
        dbg('[ButtonBlock] 🔗 bloco?.href:', bloco?.href);
        dbg('[ButtonBlock] 🔗 bloco?.url:', bloco?.url);
        dbg('[ButtonBlock] 🔗 bloco?.link:', bloco?.link);
    }, [bloco, action]);

    // ✅ Suporta cor hexadecimal diretamente ou nomes de cores
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

    // Se bloco.color começa com #, usa direto; senão, busca no colorMap
    const backgroundColor = bloco?.color?.startsWith('#')
        ? bloco.color
        : (bloco?.backgroundColor || colorMap[bloco?.color?.toLowerCase()] || bloco?.cor || '#e74c3c');
    const textColor = bloco?.textColor || bloco?.corTexto || '#fff';

    // ✅ Resolução dinâmica de ícones usando @expo/vector-icons
    const iconName = bloco?.icon || bloco?.icone || '';
    const iconInvert = bloco?.icon_invert || false;

    // Renderizar ícone dinamicamente - VERSÃO SIMPLIFICADA E DIRETA
    const renderIcon = () => {
        if (!iconName) return null;

        // Mapeamento direto: nome do ícone → (família, nome-nativo)
        // Prioriza Ionicons que tem mais ícones disponíveis
        const iconMapping: Record<string, { family: any; name: string }> = {
            // Ionicons (tem mais variedade)
            'ticket': { family: Ionicons, name: 'ticket-outline' },
            'Ticket': { family: Ionicons, name: 'ticket-outline' },
            'calendar': { family: Ionicons, name: 'calendar-outline' },
            'Calendar': { family: Ionicons, name: 'calendar-outline' },
            'phone': { family: Ionicons, name: 'call-outline' },
            'Phone': { family: Ionicons, name: 'call-outline' },
            'mail': { family: Ionicons, name: 'mail-outline' },
            'Mail': { family: Ionicons, name: 'mail-outline' },
            'email': { family: Ionicons, name: 'mail-outline' },
            'Email': { family: Ionicons, name: 'mail-outline' },
            'location': { family: Ionicons, name: 'location-outline' },
            'Location': { family: Ionicons, name: 'location-outline' },
            'home': { family: Ionicons, name: 'home-outline' },
            'Home': { family: Ionicons, name: 'home-outline' },
            'user': { family: Ionicons, name: 'person-outline' },
            'User': { family: Ionicons, name: 'person-outline' },
            'person': { family: Ionicons, name: 'person-outline' },
            'Person': { family: Ionicons, name: 'person-outline' },
            'search': { family: Ionicons, name: 'search-outline' },
            'Search': { family: Ionicons, name: 'search-outline' },
            'cart': { family: Ionicons, name: 'cart-outline' },
            'Cart': { family: Ionicons, name: 'cart-outline' },
            'heart': { family: Ionicons, name: 'heart-outline' },
            'Heart': { family: Ionicons, name: 'heart-outline' },
            'star': { family: Ionicons, name: 'star-outline' },
            'Star': { family: Ionicons, name: 'star-outline' },
            'info': { family: Ionicons, name: 'information-circle-outline' },
            'Info': { family: Ionicons, name: 'information-circle-outline' },
            // Feather (fallback para ícones comuns)
            'chevron-right': { family: Feather, name: 'chevron-right' },
            'chevron-left': { family: Feather, name: 'chevron-left' },
            'check': { family: Feather, name: 'check' },
            'x': { family: Feather, name: 'x' },
            'close': { family: Feather, name: 'x' },
        };

        // Tentar mapeamento direto primeiro
        const mapped = iconMapping[iconName];
        if (mapped) {
            const IconComponent = mapped.family;
            return <IconComponent name={mapped.name} size={20} color={textColor} style={{ marginHorizontal: 4 }} />;
        }

        // Se não tiver mapeamento, tentar Ionicons com nome lowercase + "-outline"
        try {
            const ionName = `${iconName.toLowerCase()}-outline`;
            return <Ionicons name={ionName as any} size={20} color={textColor} style={{ marginHorizontal: 4 }} />;
        } catch (e) {
            // Se falhar, usar emoji como fallback
            const emojiMap: Record<string, string> = {
                'ticket': '🎫', 'calendar': '📅', 'phone': '📞',
                'mail': '✉️', 'email': '✉️', 'location': '📍',
                'home': '🏠', 'user': '👤', 'person': '👤',
                'search': '🔍', 'cart': '🛒', 'heart': '❤️',
                'star': '⭐', 'info': 'ℹ️',
            };
            const emoji = emojiMap[iconName.toLowerCase()] || '🎫';
            return <Text style={{ color: textColor, fontSize: 20, marginHorizontal: 4 }}>{emoji}</Text>;
        }
    };

    const [isOpen, setIsOpen] = React.useState(false); // Inicia FECHADO
    const translateY = React.useRef(new Animated.Value(300)).current; // Posição fechada
    const [isAnimating, setIsAnimating] = React.useState(false); // Controla se está animando
    const queuedToggleRef = React.useRef<boolean | null>(null);
    const queuedPressRef = React.useRef<boolean>(false);

    const performButtonAction = React.useCallback(() => {
        dbg('[ButtonBlock] ▶ Executando ação do botão (performButtonAction)');
        const url = action?.href;
        if (url && typeof Linking !== 'undefined') {
            Linking.openURL(url).catch((err) => {
                console.error('[ButtonBlock] ❌ Erro ao abrir link:', err);
            });
        }
    }, [action]);

    React.useEffect(() => {
        setIsAnimating(true);
        Animated.spring(translateY, {
            toValue: isOpen ? 0 : 300,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
        }).start(() => {
            dbg('[ButtonBlock] ✅ Animação concluída, isOpen:', isOpen);
            setIsAnimating(false);

            // Se houve um toggle enfileirado durante a animação, processa primeiro
            if (queuedToggleRef.current !== null) {
                const desired = queuedToggleRef.current;
                queuedToggleRef.current = null;
                dbg('[ButtonBlock] ▶ Processando toggle enfileirado ->', desired);
                // Executa o toggle agora (isso disparará nova animação)
                setIsOpen(desired);
                return; // aguarda próxima animação para possíveis queuedPress
            }

            // Se houve um clique no botão enfileirado, executa a ação
            if (queuedPressRef.current) {
                queuedPressRef.current = false;
                dbg('[ButtonBlock] ▶ Processando clique enfileirado');
                performButtonAction();
            }
        });
    }, [isOpen, performButtonAction]);

    return (
        <>
            {/* ABA FIXA NA BORDA INFERIOR */}
            <TouchableOpacity
                style={styles.buttonTab}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={() => {
                    if (isAnimating) {
                        dbg('[ButtonBlock] ⏳ Aba clicada DURANTE animação — enfileirando toggle');
                        // Enfileira o estado desejado para ser processado ao final da animação
                        queuedToggleRef.current = !isOpen;
                        return;
                    }
                    dbg('[ButtonBlock] 📌 Aba clicada, isOpen atual (toggle):', isOpen);
                    setIsOpen((prev) => !prev);
                }}
                activeOpacity={0.8}
            >
                <View style={styles.buttonTabHandle}>
                    <Text style={styles.buttonTabIcon}>{isOpen ? '▼' : '▲'}</Text>
                    <Text style={styles.buttonTabText}>Destaque</Text>
                </View>
            </TouchableOpacity>

            {/* BOTÃO ANIMADO - sempre renderiza, mas só recebe toques quando aberto */}
            <Animated.View
                pointerEvents={isOpen ? 'auto' : 'none'}
                style={{
                    position: 'absolute',
                    bottom: TAB_BAR_HEIGHT + 16,
                    left: 20,
                    right: 20,
                    transform: [{ translateY }],
                    zIndex: 1000,
                }}
            >
                <TouchableOpacity
                    style={[
                        styles.buttonDrawerContent,
                        { backgroundColor }
                    ]}
                    activeOpacity={0.8}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    onPressIn={() => {
                        if (isAnimating) {
                            dbg('[ButtonBlock] ⏳ onPressIn durante animação — executando ação imediatamente');
                            performButtonAction();
                        }
                    }}
                    onPress={() => {
                        // onPress roda após onPressIn; a ação já pode ter sido disparada aí.
                        if (isAnimating) {
                            dbg('[ButtonBlock] ⏳ onPress detectado durante animação - ação possivelmente já executada');
                            return;
                        }
                        dbg('[ButtonBlock] 🖱️ Botão PRESSIONADO!');
                        performButtonAction();
                    }}
                >
                    {!iconInvert && renderIcon()}
                    <Text style={[styles.buttonDrawerText, { color: textColor }]}>
                        {label}
                    </Text>
                    {iconInvert && renderIcon()}
                </TouchableOpacity>
            </Animated.View>
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
    headerImageContainer: {
        position: 'relative',
        width: '100%',
    },
    headerARButton: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3498db', // Azul padrão
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    headerARButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 4,
    },

    // ========================================
    // 📝 BLOCOS DE TEXTO - Hierarquia Visual
    // ========================================
    textBlock: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 8,     // Reduzido: 12 → 8 (menos espaço vertical interno)
        marginBottom: 0,
        borderRadius: 0,
    },

    // TÍTULO PRINCIPAL - Máxima hierarquia visual
    mainTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1a1a1a',
        lineHeight: 36,
        letterSpacing: -0.5,
        marginTop: 16,    // Reduzido: 24 → 16 (mais próximo do anterior)
        marginBottom: 12, // Reduzido: 16 → 12 (mais próximo do próximo)
    },

    // SUBTÍTULO - Segunda hierarquia
    subtitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#2c2c2c',
        lineHeight: 28,
        letterSpacing: -0.3,
        marginTop: 12,    // Reduzido: 16 → 12 (mais próximo do texto anterior)
        marginBottom: 6,  // Reduzido: 8 → 6 (mais próximo do próximo texto)
    },

    // TÍTULO DE SEÇÃO (dentro de texto normal) - Terceira hierarquia
    textTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#333',
        lineHeight: 24,
        marginTop: 12,    // Reduzido: 16 → 12 (mais próximo)
        marginBottom: 6,  // Reduzido: 8 → 6 (mais próximo)
    },

    // TEXTO NORMAL - Corpo de texto
    textContent: {
        fontSize: 16,
        lineHeight: 25,
        color: '#555',
        letterSpacing: 0.1,
        marginBottom: 4,
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
        bottom: TAB_BAR_HEIGHT,
        left: '25%', // Centralizado horizontalmente
        right: '25%', // 50% da largura da tela
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        zIndex: 1001, // Bem acima de tudo
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
        backgroundColor: 'rgba(0, 0, 0, 1)', // Semi-transparente para efeito glass
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
        borderRadius: 20,
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
        zIndex: 500, // Acima do drawer do carousel (499), abaixo do botão (1001)
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
        zIndex: 499, // Abaixo da aba do carousel (500), acima do conteúdo (0)
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
        position: 'relative', // Permite posicionar botão AR absolutamente
    },
    carouselImageContainer: {
        width: '100%',
        height: '100%',
    },
    carouselImage: {
        width: '100%',
        height: '100%', // Preenche todo o card
        backgroundColor: '#e0e0e0',
    },
    carouselARButton: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3498db', // Azul padrão (mesmo do carousel tab)
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    carouselARButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 4,
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
