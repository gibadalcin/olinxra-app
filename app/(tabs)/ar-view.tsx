import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Linking, Alert, Platform, Dimensions, TouchableOpacity } from 'react-native';
import { API_CONFIG } from '../../config/api';
import { WebView } from 'react-native-webview';
import { consumeLastARContent } from '@/utils/lastARContent';

const { height: screenHeight } = Dimensions.get('window');

// Definição das mensagens de estado da UI
const UIMessages = {
    INITIAL: 'Carregando modelo 3D...',
    LAUNCHING: 'Iniciando AR Nativo...',
    ERROR: 'Falha ao iniciar o AR Nativo.',
    READY: 'Pronto para visualizar em AR.'
};

// Componente de View Principal
export default function ARViewScreen() {
    const [payload, setPayload] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState(UIMessages.INITIAL);
    const webRef = useRef<WebView | null>(null);

    // Função auxiliar para buscar a URL do modelo GLB no payload (mantida)
    const findModelUrl = useCallback((obj: any): string | null => {
        if (!obj || typeof obj !== 'object') return null;
        for (const k of Object.keys(obj)) {
            const v = obj[k];
            if (typeof v === 'string' && v.toLowerCase().includes('.glb')) return v;
            if (k.toLowerCase().includes('modelurl') && typeof v === 'string') return v;
            if (k.toLowerCase().includes('model_url') && typeof v === 'string') return v;
            if (typeof v === 'object') { const r = findModelUrl(v); if (r) return r; }
        }
        return null;
    }, []);

    // Função utilitária: busca recursiva por chaves de texto (case-insensitive)
    const findStringValue = useCallback((obj: any, keys: string[]): string | null => {
        if (!obj || typeof obj !== 'object') return null;
        const lowerKeys = keys.map(k => k.toLowerCase());

        // 1) busca direto nas chaves do objeto
        for (const k of Object.keys(obj)) {
            const lowerK = k.toLowerCase();
            if (lowerKeys.includes(lowerK) && typeof obj[k] === 'string' && String(obj[k]).trim() !== '') return String(obj[k]).trim();
        }

        // 2) busca recursiva em objetos filhos
        for (const k of Object.keys(obj)) {
            const v = obj[k];
            if (v && typeof v === 'object') {
                const r = findStringValue(v, keys);
                if (r) return r;
            }
        }
        return null;
    }, []);

    function safePreview(str?: string | null, max = 120) {
        if (!str) return 'nulo'
        try {
            const isData = str.startsWith && str.startsWith('data:')
            const len = str.length
            if (isData) {
                // don't include the whole base64 in Alerts — show type and length and a tiny prefix
                const prefix = str.slice(0, Math.min(64, str.length))
                return `${prefix}... (data: base64, length=${len})`
            }
            if (str.length > max) {
                return `${str.slice(0, max)}... (length=${len})`
            }
            return str
        } catch (e) {
            return 'nulo'
        }
    }

    // --- CARREGAMENTO INICIAL ---
    useEffect(() => {
        const p = consumeLastARContent();
        setPayload(p);
        setLoading(false); // Finaliza o loading inicial aqui
    }, []);

    // --- VARIÁVEL CHAVE: URL do Modelo Final (Totem ou Astronauta) ---
    const finalModelUrl: string | null = useMemo(() => {
        const payloadUrl = findModelUrl(payload);
        if (payloadUrl) return payloadUrl;
        return 'https://modelviewer.dev/shared-assets/models/Astronaut.glb';
    }, [payload, findModelUrl]);

    const openNativeARWithModel = useCallback(async (modelUrl?: string | null) => {
        if (!modelUrl) return false;

        setStatusMessage(UIMessages.LAUNCHING); // Atualiza o status

        const sceneViewerUrl = `https://arvr.google.com/scene-viewer/1.2?file=${encodeURIComponent(modelUrl)}&mode=ar_preferred`;

        let launched = false;

        // 1. Scene Viewer (HTTPS)
        try { if (await Linking.canOpenURL(sceneViewerUrl)) { await Linking.openURL(sceneViewerUrl); launched = true; } } catch (e) { console.debug("Scene Viewer via HTTPS falhou:", e); }

        // 2. Quick Look / Raw URL (iOS)
        if (!launched && Platform.OS === 'ios') { try { await Linking.openURL(modelUrl); launched = true; } catch (e) { console.debug("Quick Look falhou:", e); } }

        // 3. Intent URI (Android)
        if (!launched && Platform.OS === 'android') {
            const intentUrl = `intent://arvr.google.com/scene-viewer/1.2?file=${encodeURIComponent(modelUrl)}&mode=ar_preferred#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;end`;
            try { await Linking.openURL(intentUrl); launched = true; } catch (e) { console.debug("Intent URI falhou:", e); }
        }

        if (!launched) {
            setStatusMessage(UIMessages.ERROR); // AR Nativo Falhou
            Alert.alert('AR Indisponível', UIMessages.ERROR);
        } else {
            setStatusMessage(UIMessages.READY); // Volta para o estado "pronto" após o lançamento
        }
        return launched;
    }, []);

    // Removed in-WebView AR trigger; we now generate/launch GLB from backend when needed

    // --- LÓGICA DE INICIALIZAÇÃO DA MENSAGEM ---
    useEffect(() => {
        // Se o modelo final existe e não estamos mais carregando, o sistema está pronto para o clique
        if (!loading && finalModelUrl) {
            setStatusMessage(UIMessages.READY);
        }
    }, [loading, finalModelUrl]);

    // Payload para injeção (mantido)
    const embeddedPayloadForHtml = useMemo(() => {
        try {
            if (!payload) return 'null';
            return JSON.stringify({ type: 'payload', payload }).replace(/</g, '\\u003c');
        } catch (e) { return 'null'; }
    }, [payload]);

    // --- Geração do HTML (AGORA COM HOTSPOT ANCORADO) ---
    const html = useMemo(() => {
        const modelUrl = finalModelUrl || 'https://modelviewer.dev/shared-assets/models/Astronaut.glb';
        const poster = (payload && payload.previewImage && typeof payload.previewImage === 'string' && payload.previewImage.length < 150000) ? payload.previewImage : '';

        // Extração de Marca
        const nomeMarca = String((payload && payload.anchorData && payload.anchorData.titulo) || (payload && payload.nome_marca) || 'Marca Padrão');

        // Extração de localização com prioridade:
        // 1) se houver `nome_regiao` armazenado no conteúdo, usá-lo;
        // 2) se houver `tipo_regiao` e `endereco` (objeto do geocode), mapear para o campo apropriado (rua/bairro/cidade/estado/pais);
        // 3) fallback para `localizacao` (string construída) ou outras chaves encontradas recursivamente.
        const nomeRegiaoField = payload && (payload.nome_regiao || payload.nomeRegiao || payload['nome_região']) ? (payload.nome_regiao || payload.nomeRegiao || payload['nome_região']) : null;
        const tipoRegiaoField = payload && (payload.tipo_regiao || payload.tipoRegiao) ? (payload.tipo_regiao || payload.tipoRegiao) : null;
        const enderecoObj = payload && payload.endereco ? payload.endereco : null;

        let chosenLocation: string | null = null;
        if (nomeRegiaoField && String(nomeRegiaoField).trim() !== '') {
            chosenLocation = String(nomeRegiaoField).trim();
        } else if (tipoRegiaoField && enderecoObj && typeof enderecoObj === 'object') {
            const t = String(tipoRegiaoField).toLowerCase();
            // Mapear tipos comuns para chaves do Nominatim
            if (t.includes('rua') || t.includes('logradouro') || t.includes('address') || t.includes('street')) {
                chosenLocation = enderecoObj.road || enderecoObj.pedestrian || enderecoObj.footway || null;
            } else if (t.includes('bairro') || t.includes('neighbourhood') || t.includes('suburb')) {
                chosenLocation = enderecoObj.suburb || enderecoObj.neighbourhood || enderecoObj.hamlet || null;
            } else if (t.includes('cidade') || t.includes('town') || t.includes('village') || t.includes('city')) {
                chosenLocation = enderecoObj.city || enderecoObj.town || enderecoObj.village || null;
            } else if (t.includes('estado') || t.includes('state') || t.includes('province')) {
                chosenLocation = enderecoObj.state || null;
            } else if (t.includes('pais') || t.includes('country')) {
                chosenLocation = enderecoObj.country || null;
            }
            if (chosenLocation) chosenLocation = String(chosenLocation).trim();
        }

        // último recurso: procurar por chaves textuais no payload (nome_regiao, localizacao, address, city...)
        const locationKeys = ['nome_regiao', 'nome_região', 'nomeRegiao', 'localizacao', 'endereco', 'address', 'road', 'suburb', 'city', 'state', 'country'];
        const extractedLocation = findStringValue(payload, locationKeys);
        const localizacao = String(chosenLocation || extractedLocation || 'Localização Padrão');
        const tituloCompleto = `${nomeMarca} | ${localizacao}`;

        const bgStyle = 'background:black;'; // Fundo preto

        // HOTSPOT: marca + localização (não clicável)
        const hotspotHtml = `
            <div 
                slot="hotspot-marca" 
                data-position="0 1.8 0.5" 
                data-normal="0 0 1"
                style="color:white; font-size:16px; font-weight:bold; background:rgba(0,0,0,0.6); padding: 5px 10px; border-radius: 5px; transform: translate(0, -100%); pointer-events: none;">
                ${tituloCompleto}
            </div>`;

        return `
            <!doctype html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width,initial-scale=1" />
                <script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>
                <style>
                    html,body{height:100%;margin:0;${bgStyle}}
                    #mv{width:100%;height:100vh;position:fixed;top:0;left:0;z-index:1000; background: black;}
                    [slot^="hotspot-"] { z-index: 1000; }
                </style>
            </head>
            <body>
                <model-viewer
                    id="mv"
                    src="${modelUrl}"
                    poster="${poster}"
                    alt="Modelo 3D"
                    camera-controls
                    shadow-intensity="1"
                    style="width: 100%; height: 100vh;"
                >
                    ${hotspotHtml}
                </model-viewer>
            </body>
            </html>
        `;
    }, [payload, findModelUrl, finalModelUrl]);

    // Envio de Payload (mantido)
    useEffect(() => {
        const send = () => {
            try {
                if (webRef.current && payload) {
                    webRef.current.injectJavaScript && webRef.current.injectJavaScript(`(function(){window.__RN_MESSAGE__ = ${embeddedPayloadForHtml};})();true;`);
                }
            } catch (e) { }
        };
        send();
        const t1 = setTimeout(send, 300);
        const t2 = setTimeout(send, 900);
        return () => { try { clearTimeout(t1); clearTimeout(t2); } catch (e) { } };
    }, [payload, embeddedPayloadForHtml]);

    // Hotspot/message handling removed — não usamos mais hotspots clicáveis

    // Helper: prefere explicitamente a imagem header (subtipo 'header' ou tipo contendo 'topo'),
    // se não existir, cai para a primeira imagem disponível (signed_url > url)
    const findFirstImageUrl = useCallback((p: any): string | null => {
        if (!p) return null;
        const blocks = p.blocos || p.conteudo || [];
        if (!Array.isArray(blocks)) return null;

        // 1) procura por bloco com subtype/header explicitamente (prioridade)
        for (const b of blocks) {
            if (!b || typeof b !== 'object') continue;
            const subtipo = (b.subtipo || b.subType || '').toString().toLowerCase();
            const tipoLabel = (b.tipo || '').toString().toLowerCase();
            if (subtipo === 'header' || tipoLabel.includes('topo') || tipoLabel.includes('header')) {
                if (typeof b.signed_url === 'string' && b.signed_url) return b.signed_url;
                if (typeof b.url === 'string' && b.url) return b.url;
                // carousel/itens dentro do header
                if (Array.isArray(b.items)) {
                    for (const it of b.items) {
                        if (!it) continue;
                        if (typeof it.signed_url === 'string' && it.signed_url) return it.signed_url;
                        if (typeof it.url === 'string' && it.url) return it.url;
                    }
                }
            }
        }

        // 2) fallback: primeira imagem assinada ou url encontrada
        for (const b of blocks) {
            if (!b) continue;
            if (typeof b.signed_url === 'string' && b.signed_url) return b.signed_url;
            if (typeof b.url === 'string' && b.url) return b.url;
            if (Array.isArray(b.items)) {
                for (const it of b.items) {
                    if (!it) continue;
                    if (typeof it.signed_url === 'string' && it.signed_url) return it.signed_url;
                    if (typeof it.url === 'string' && it.url) return it.url;
                }
            }
        }

        return null;
    }, []);

    const handleVerEmRA = useCallback(async () => {
        // quick debug: quem está no payload agora?
        try {
            const blocks = (payload && (payload.blocos || payload.conteudo)) || [];
            const blocksCount = Array.isArray(blocks) ? blocks.length : 0;
            const payloadKeys = payload ? Object.keys(payload).slice(0, 10).join(',') : 'nenhum';
            const payloadModel = findModelUrl(payload);
            const imageCandidate = findFirstImageUrl(payload);
            console.log('[AR DEBUG] payloadKeys:', payloadKeys, 'blocksCount:', blocksCount);
            console.log('[AR DEBUG] modelCandidate:', payloadModel, 'imageCandidate:', imageCandidate);
            try { Alert.alert('AR Debug', `model: ${payloadModel || 'nulo'}\nimage: ${safePreview(imageCandidate)}\nblocks: ${blocksCount}`); } catch (e) { }
        } catch (e) { console.warn('[AR DEBUG] erro ao inspecionar payload', e); }

        // 1) se o payload já traz um modelo (.glb) use-o
        const payloadModel = findModelUrl(payload);
        if (payloadModel) {
            openNativeARWithModel(payloadModel);
            return;
        }

        // 2) tenta gerar um GLB a partir da primeira imagem do payload via backend
        let imageUrl = findFirstImageUrl(payload);

        // Se não encontrou blocos, tenta fallbacks: payload.previewImage (quando for URL)
        if (!imageUrl) {
            const preview = payload && typeof payload.previewImage === 'string' ? payload.previewImage : null;
            const anchorPreview = payload && payload.anchorData && typeof payload.anchorData.previewDataUrl === 'string' ? payload.anchorData.previewDataUrl : (payload && payload.anchorData && typeof payload.anchorData.previewImage === 'string' ? payload.anchorData.previewImage : null);

            if (preview && (preview.startsWith('http://') || preview.startsWith('https://'))) {
                imageUrl = preview;
                console.log('[AR] usando payload.previewImage como fallback:', safePreview(imageUrl));
                try { Alert.alert('AR Debug', `Usando previewImage como fallback\n${safePreview(imageUrl)}`); } catch (e) { }
            } else if (anchorPreview && (anchorPreview.startsWith('http://') || anchorPreview.startsWith('https://'))) {
                imageUrl = anchorPreview;
                console.log('[AR] usando anchorData.previewDataUrl como fallback:', safePreview(imageUrl));
                try { Alert.alert('AR Debug', `Usando anchor preview como fallback\n${safePreview(imageUrl)}`); } catch (e) { }
            } else if (preview && preview.startsWith('data:')) {
                // Temos uma preview em base64 (data URL). O backend agora aceita data URLs — usamos como imageUrl.
                imageUrl = preview;
                console.log('[AR] usando previewImage (data: base64) como fallback e enviando ao backend');
                try { Alert.alert('AR Debug', 'Usando preview embutido (base64) como imagem para gerar GLB.'); } catch (e) { }
                // continua o fluxo enviando imageUrl (data:) para o backend
            } else {
                Alert.alert('Conteúdo não disponível', 'Nenhuma mídia encontrada para abrir em AR.');
                // fallback para astronauta
                openNativeARWithModel(finalModelUrl);
                return;
            }
        }

        try {
            setStatusMessage('Gerando modelo AR...');

            // Mostra alert visível com a imageUrl para garantir feedback no dispositivo
            try {
                Alert.alert('AR Debug', `Enviando image_url: ${safePreview(imageUrl)}`);
            } catch (e) { /* não bloquear se Alert falhar */ }

            // Debug: qual URL estamos enviando para o backend (Metro)
            console.log('[AR] Gerar GLB para image_url:', safePreview(imageUrl));

            const res = await fetch(`${API_CONFIG.BASE_URL}/api/generate-glb-from-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_url: imageUrl, filename: `conteudo_${Date.now()}.glb` })
            });

            // Log do status e do corpo (text) para diagnóstico
            const respText = await res.text();
            console.log('[AR] resposta generate-glb-from-image status:', res.status, 'body:', respText.substring(0, 1000));

            if (!res.ok) {
                // se não OK, mostra o texto retornado para ajudar a diagnosticar
                console.warn('[AR] generate-glb-from-image failed', res.status, respText);
                try { Alert.alert('Erro ao gerar modelo AR', `Status ${res.status}\n${respText.substring(0, 200)}`); } catch (e) { }
                openNativeARWithModel(finalModelUrl);
                return;
            }

            // tenta parsear JSON seguro
            let j: any = null;
            try { j = respText ? JSON.parse(respText) : {}; } catch (e) { console.warn('[AR] parse JSON falhou', e); }

            const glbUrl = j && (j.glb_signed_url || j.glb_url || j.glbSignedUrl);
            if (glbUrl) {
                console.log('[AR] GLB gerado:', glbUrl);
                try { Alert.alert('GLB Gerado', `${glbUrl}`); } catch (e) { }
                openNativeARWithModel(glbUrl);
                return;
            }

            console.warn('[AR] generate-glb-from-image: sem glb na resposta', j || respText);
            try { Alert.alert('Erro', `Resposta inválida do servidor.\n${(respText || '').substring(0, 200)}`); } catch (e) { }
            openNativeARWithModel(finalModelUrl);
        } catch (e) {
            console.warn('Erro gerando GLB:', e);
            try { Alert.alert('Erro', 'Não foi possível gerar o modelo AR. Abrindo fallback.'); } catch (e) { }
            openNativeARWithModel(finalModelUrl);
        } finally {
            setStatusMessage(UIMessages.READY);
        }
    }, [payload, finalModelUrl, findModelUrl, findFirstImageUrl, openNativeARWithModel]);

    // --- Renderização ---

    // Estado 1: Carregamento Inicial
    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0000ff" /><Text style={styles.launchText}>Buscando conteúdo...</Text></View>;

    // Estado 2: Payload Ausente / Modelo não encontrado
    if (!payload || !finalModelUrl) {
        return <View style={styles.center}><Text style={styles.launchText}>Nenhum modelo 3D associado para AR.</Text></View>;
    }

    // Estado 3: Renderização do WebView + Overlays Nativos
    const isReady = statusMessage !== UIMessages.INITIAL && statusMessage !== UIMessages.LAUNCHING;

    return (
        <View style={styles.fullScreenContainer}>
            {/* 1. WebView com o Modelo 3D (ONDE O TÍTULO ESTÁ ANCORADO) */}
            <View style={{ flex: 1, height: screenHeight, position: 'absolute', top: 0, left: 0, right: 0 }}>
                <WebView
                    ref={webRef}
                    originWhitelist={["*"]}
                    source={{ html }}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    style={{ flex: 1, backgroundColor: 'transparent' }}
                />
            </View>


            {/* 2. OVERLAYS NATIVOS (Mensagem e Botão de Ação) */}
            <View style={styles.overlayNative}>
                {/* Mensagem de Status */}
                <Text style={styles.launchText}>{statusMessage}</Text>

                {/* BOTÃO "VER EM RA" (Posição Fixa) */}
                <View style={styles.bottomBar}>
                    <TouchableOpacity
                        style={[styles.mainActionButton, !isReady && { opacity: 0.5 }]}
                        onPress={() => isReady && handleVerEmRA()}
                        disabled={!isReady}
                    >
                        <Text style={styles.mainActionText}>VER EM RA</Text>
                    </TouchableOpacity>
                </View>

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'black' },
    fullScreenContainer: { flex: 1, backgroundColor: 'black' },
    launchText: { color: 'white', marginTop: 10 },
    bottomBar: {
        position: 'absolute',
        bottom: 50,
        zIndex: 10,
        width: '100%',
        alignItems: 'center',
    },
    mainActionButton: {
        backgroundColor: '#3498db',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 30,
    },
    mainActionText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    overlayNative: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2,
        alignItems: 'center',
        paddingTop: 50,
        pointerEvents: 'box-none',
    },
    contentOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 20,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    contentCard: {
        width: '94%',
        maxHeight: '78%',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
    },
    contentTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, color: '#111' },
    contentScroll: { maxHeight: 380 },
    blockRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'center' },
    blockImage: { width: 110, height: 80, marginRight: 10, borderRadius: 6, resizeMode: 'cover' },
    blockText: { flex: 1, color: '#222' },
    closeButton: { marginTop: 8, backgroundColor: '#3498db', padding: 10, borderRadius: 8, alignItems: 'center' },
    closeButtonText: { color: 'white', fontWeight: '700' },
});