import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Linking, Alert, Platform, AppState, AppStateStatus, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { API_CONFIG } from '../../config/api';
import { auth } from '../../firebaseConfig';
import { ARLauncher } from '@/components/ar';
import { consumeLastARContent, setRestartCaptureOnReturn } from '@/utils/lastARContent';
import useARSupport from '@/hooks/useARSupport';
import CustomHeader from '@/components/CustomHeader';



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
    const launchedRef = useRef(false);
    const launchedForContentRef = useRef(false);
    const actionInProgressRef = useRef(false);
    // evitar re-requests de fallback repetidos (marca nomes de arquivo já tentados)

    // NOTE: removed preview/transform variant handling — we open payload model or generate via backend when requested.

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
    // Nota: removido o fluxo automático que buscava um "default" signed URL
    // pelo nome (DEFAULT_MODEL_FILENAME) para evitar referências e lógica
    // residual. Agora a URL final é tomada exclusivamente do payload quando
    // presente; caso contrário usamos um fallback público (Astronaut).

    // Final model URL is taken only from payload. If no model is present the
    // UI will inform the user instead of attempting any demo/fallback model.
    const finalModelUrl: string | null = useMemo(() => {
        return findModelUrl(payload);
    }, [payload, findModelUrl]);

    // Log the final model URL for debugging
    useEffect(() => {
        try {
            console.log('[ARView] finalModelUrl:', finalModelUrl);
        } catch (e) { }
    }, [finalModelUrl]);

    // Read AR support from shared hook (uses cached probe run at app start).
    const supportsAR = useARSupport();

    // Removed preview diagnostics and URL normalization — not needed for native AR path.



    const openNativeARWithModel = useCallback(async (modelUrl?: string | null) => {
        if (!modelUrl) return false;

        setStatusMessage(UIMessages.LAUNCHING);

        const sceneViewerUrl = `https://arvr.google.com/scene-viewer/1.2?file=${encodeURIComponent(modelUrl)}&mode=ar_preferred`;

        let launched = false;
        try { if (await Linking.canOpenURL(sceneViewerUrl)) { await Linking.openURL(sceneViewerUrl); launched = true; } } catch (e) { console.debug("Scene Viewer via HTTPS falhou:", e); }

        if (!launched && Platform.OS === 'ios') { try { await Linking.openURL(modelUrl); launched = true; } catch (e) { console.debug("Quick Look falhou:", e); } }

        if (!launched && Platform.OS === 'android') {
            const intentUrl = `intent://arvr.google.com/scene-viewer/1.2?file=${encodeURIComponent(modelUrl)}&mode=ar_preferred#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;end`;
            try { await Linking.openURL(intentUrl); launched = true; } catch (e) { console.debug("Intent URI falhou:", e); }
        }

        if (!launched) {
            setStatusMessage(UIMessages.ERROR);
            Alert.alert('AR Indisponível', UIMessages.ERROR);
        } else {
            setStatusMessage(UIMessages.READY);
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

    // No remote fallback models: we only use payload-provided models. If
    // there's no model, UI will show an informational message and not offer
    // an AR button.
    // Auto-launch effect: quando tivermos uma URL final e não estivermos já lançando, abra o AR nativo.
    // Deve estar acima dos retornos condicionais para não alterar a ordem de Hooks entre renders.
    const router = useRouter();

    // Auto-launch AR only when payload includes a model
    useEffect(() => {
        if (loading) return;
        if (!finalModelUrl) return;
        if (launchedRef.current) return;
        launchedRef.current = true;
        launchedForContentRef.current = true;

        (async () => {
            try {
                const ok = await openNativeARWithModel(finalModelUrl);
                if (!ok) {
                    launchedRef.current = false;
                    launchedForContentRef.current = false;
                }
            } catch (e) {
                console.warn('[ARView] auto-launch failed', e);
                launchedRef.current = false;
                launchedForContentRef.current = false;
            }
        })();
    }, [loading, finalModelUrl, openNativeARWithModel]);

    // If there is no model associated with this AR view, mark that when the
    // user navigates back to the capture tab we should restart the capture
    // flow (open modal or let them pick another image). This flag will be
    // consumed by the capture screen when it gains focus.
    useEffect(() => {
        try {
            if (!finalModelUrl) {
                setRestartCaptureOnReturn(true);
            } else {
                setRestartCaptureOnReturn(false);
            }
        } catch (e) { }
    }, [finalModelUrl]);

    // When the app returns to foreground after launching AR for content,
    // close this flow and return to previous screen (capture).
    useEffect(() => {
        const onAppStateChange = (nextState: AppStateStatus) => {
            if (nextState === 'active' && launchedForContentRef.current) {
                // reset flags and navigate back to capture screen
                launchedForContentRef.current = false;
                launchedRef.current = false;
                try { router.back(); } catch (e) { console.warn('Failed to navigate back after AR close', e); }
            }
        };
        const sub = AppState.addEventListener ? AppState.addEventListener('change', onAppStateChange) : null;
        return () => { if (sub && sub.remove) sub.remove(); };
    }, [router]);

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
        // Prevent duplicate activations
        if (actionInProgressRef.current) return;
        actionInProgressRef.current = true;

        // 1) se o payload já traz um modelo (.glb) use-o
        const payloadModel = findModelUrl(payload);
        if (payloadModel) {
            launchedForContentRef.current = true;
            await openNativeARWithModel(payloadModel);
            actionInProgressRef.current = false;
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
                // No content to generate a GLB from — inform the user and do not
                // show or attempt to open AR. The UI already hides the button in
                // this case, but we keep this guard for manual invocations.
                try { Alert.alert('Conteúdo não disponível', 'Nenhuma mídia encontrada para abrir em RA.'); } catch (e) { }
                actionInProgressRef.current = false;
                return;
            }
        }

        try {
            setStatusMessage('Gerando modelo AR...');

            // Debug: qual URL estamos enviando para o backend (Metro)
            console.log('[AR] Gerar GLB para image_url:', safePreview(imageUrl));

            // Do not send a transient filename (e.g. with Date.now()) to the backend.
            // The backend generates a stable filename based on the SHA256 of the image_url
            // so we should omit `filename` here to allow cache hits (avoid duplicate GLBs).
            // include owner_uid when available so backend can place the GLB under the proper prefix
            const ownerUid = payload && (payload.owner_uid || payload.ownerUid || payload.owner || null);
            const bodyObj: any = { image_url: imageUrl };
            if (ownerUid) bodyObj.owner_uid = ownerUid;

            // attach idToken if available (anonymous auth) so backend can validate requests when enabled
            const headers: any = { 'Content-Type': 'application/json' };
            try {
                if (auth && auth.currentUser) {
                    const idToken = await auth.currentUser.getIdToken();
                    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
                }
            } catch (_e) {
                // ignore token errors silently
            }

            const res = await fetch(`${API_CONFIG.BASE_URL}/api/generate-glb-from-image`, {
                method: 'POST',
                headers,
                body: JSON.stringify(bodyObj)
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
                launchedForContentRef.current = true;
                await openNativeARWithModel(glbUrl);
                actionInProgressRef.current = false;
                return;
            }

            console.warn('[AR] generate-glb-from-image: sem glb na resposta', j || respText);
            try { Alert.alert('Erro', 'Não foi possível gerar o modelo AR.'); } catch (e) { }
        } catch (e) {
            console.warn('Erro gerando GLB:', e);
            try { Alert.alert('Erro', 'Não foi possível gerar o modelo AR.'); } catch (e) { }
        } finally {
            setStatusMessage(UIMessages.READY);
            actionInProgressRef.current = false;
        }
    }, [payload, finalModelUrl, findModelUrl, findFirstImageUrl, openNativeARWithModel]);

    // --- Renderização ---

    // Estado 1: Carregamento Inicial
    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0000ff" /><Text style={styles.launchText}>Buscando conteúdo...</Text></View>;

    // Estado 2+: Render overlay. If there's no model, show informational text
    // and hide the 'Ver em RA' button. If there is a model, button is shown
    // and auto-launch happens as implemented above.
    const isReady = Boolean(finalModelUrl) && statusMessage !== UIMessages.INITIAL && statusMessage !== UIMessages.LAUNCHING;

    return (
        <>
            <CustomHeader title="Visualizar em AR" />

            <View style={styles.fullScreenContainer}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    {/* When there's no model, show a centered adaptive icon above the message */}
                    {!finalModelUrl && (
                        <Image
                            source={require('../../assets/images/adaptive-icon-w.png')}
                            style={{ width: 120, height: 120, marginBottom: 12 }}
                            contentFit="contain"
                        />
                    )}

                    <Text style={{ color: 'white', fontSize: 16, marginBottom: 8 }}>{finalModelUrl ? statusMessage : 'Nenhum modelo 3D associado para RA.'}</Text>

                    {!finalModelUrl ? (
                        <>
                            <Text style={{ width: '80%', color: '#bbb', fontSize: 13, marginBottom: 12 }}>{'Não há conteúdo disponível para visualização em RA neste item.'}</Text>
                            {/* Button to allow accessing backend content when device does NOT support AR. Visible only when supportsAR is explicitly false. No navigation/action yet. */}
                        </>
                    ) : (
                        <Text style={{ color: '#bbb', fontSize: 13, marginBottom: 20 }}>{'Abrindo AR nativo — se nada acontecer, toque em "Ver em RA".'}</Text>
                    )}

                    {supportsAR === false && (
                        <Pressable style={[styles.mainActionButton, { paddingHorizontal: 20, paddingVertical: 12, marginTop: 20 }]} onPress={() => { /* intentional no-op for now */ }}>
                            <Text style={styles.mainActionText}>Acessar conteúdo (sem RA)</Text>
                        </Pressable>
                    )}
                </View>
                <ARLauncher isReady={isReady} statusMessage={statusMessage} onLaunch={handleVerEmRA} styles={styles} showButton={Boolean(finalModelUrl)} />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'black' },
    fullScreenContainer: {
        flex: 1,
        backgroundColor: 'black',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        marginTop: -18, // Adiciona sobreposição de 14px sobre o header
        justifyContent: 'center',
    },
    launchText: { color: 'white', marginTop: 10 },
    bottomBar: {
        position: 'absolute',
        bottom: 50,
        zIndex: 10,
        width: '100%',
    },
    mainActionButton: {
        backgroundColor: '#3498db',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 8,
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