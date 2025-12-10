import React, { useState } from 'react';
import { Modal, View, Image, StyleSheet, Pressable, Text, Alert } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { saveToGallery } from '../../hooks/useSaveToGallery';
import LoadingWithTips from './LoadingWithTips';
import { compareLogo } from '../../hooks/useLogoCompare';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useARPayload } from '../../context/ARPayloadContext'; // ✅ Usar Context ao invés de módulo
import { useARContent } from '../../hooks/useARContent';
import { NoContentToDisplayModal } from './NoContentToDisplay';

type Props = {
    visible: boolean;
    imageUri: string;
    onSave?: () => void;
    onCancel: () => void;
    saveDisabled?: boolean;
    imageSource?: 'camera' | 'gallery' | null;
};

export function ImageDecisionModal({
    visible,
    imageUri,
    onCancel,
    saveDisabled,
    imageSource,
    onSave,
}: Props) {
    const { width } = useWindowDimensions();
    const imageWidth = width * 0.8;
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [showNoContentModal, setShowNoContentModal] = useState(false);
    const [noContentBrand, setNoContentBrand] = useState<string | null>(null);
    const [noContentLocation, setNoContentLocation] = useState<string | null>(null);
    const canSave = !saveDisabled && imageSource === 'camera';
    const router = useRouter();
    const { fetchContentForRecognition, loadingStage } = useARContent();
    const { setPayload: setARPayload, headerLocalMap, prefetchImagesForPayload } = useARPayload(); // ✅ Hook do Context

    const handleCompare = React.useCallback(async () => {
        const t0 = Date.now();
        console.log('[ImageDecisionModal] 🎬 Iniciando reconhecimento de logo... t0=', new Date(t0).toISOString());
        setLoading(true);
        setLoadingMessage('Reconhecendo logo...');
        let shouldCancel = true;
        try {
            console.log('[ImageDecisionModal] 📸 URI da imagem:', imageUri?.substring(0, 100) + '...');
            const result = await compareLogo(imageUri);
            const tRecognized = Date.now();
            console.log('[ImageDecisionModal] 📊 Resultado do compareLogo:', result?.status, 't_recognized=', new Date(tRecognized).toISOString(), 'elapsed_ms=', tRecognized - t0);

            if ((result.status === 'cached' || result.status === 'recognized') && 'data' in result && result.data && typeof result.data.name === 'string') {
                console.log('[ImageDecisionModal] ✅ Logo reconhecida:', result.data.name);
                setLoadingMessage('Logo reconhecida! Buscando conteúdo...');
                // recognized -> now try fetch content by location
                try {
                    // check location permission (do not request here; PermissionRequest handles requesting)
                    const { status } = await Location.getForegroundPermissionsAsync();
                    if (status !== 'granted') {
                        console.warn('[ImageDecisionModal] ⚠️ Permissão de localização não concedida');
                        Alert.alert('Permissão necessária', 'Preciso da sua localização para buscar conteúdo próximo. Vá até a tela de captura e conceda a permissão.');
                        setLoading(false);
                        onCancel();
                        router.push('/_tabs/recognizer');
                        return;
                    } else {
                        console.log('[ImageDecisionModal] 📍 Obtendo localização atual...');
                        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
                        const lat = loc.coords.latitude;
                        const lon = loc.coords.longitude;
                        const tLocation = Date.now();
                        console.log('[ImageDecisionModal] 📍 Localização obtida:', { lat, lon }, 't_location=', new Date(tLocation).toISOString(), 'elapsed_ms=', tLocation - tRecognized);

                        console.log('[ImageDecisionModal] 🔍 Buscando conteúdo para marca:', result.data.name);
                        const tFetchStart = Date.now();
                        console.log('[ImageDecisionModal] 🔔 fetchContentForRecognition START t_fetch_start=', new Date(tFetchStart).toISOString());
                        const resp = await fetchContentForRecognition(result.data.name, lat, lon);
                        const tFetchEnd = Date.now();
                        console.log('[ImageDecisionModal] 📦 Resposta fetchContent:', resp ? 'dados recebidos' : 'null', 't_fetch_end=', new Date(tFetchEnd).toISOString(), 'elapsed_ms=', tFetchEnd - tFetchStart);
                        // fetchContentForRecognition now returns the full backend response when available
                        // normalize to `conteudo` (array or object) and extract location metadata
                        let conteudo: any = null;
                        let respLocalizacao: any = null;
                        let respNomeRegiao: any = null;
                        let respTipoRegiao: any = null;
                        let respEndereco: any = null;
                        if (resp) {
                            if (Array.isArray(resp)) {
                                conteudo = resp;
                            } else if (resp.conteudo) {
                                conteudo = resp.conteudo;
                                respLocalizacao = resp.localizacao;
                                respNomeRegiao = resp.nome_regiao || resp.nomeRegiao;
                                respTipoRegiao = resp.tipo_regiao || resp.tipoRegiao;
                                respEndereco = resp.endereco || null;
                            } else if (resp.blocos) {
                                conteudo = resp.blocos;
                                respLocalizacao = resp.localizacao;
                                respNomeRegiao = resp.nome_regiao || resp.nomeRegiao;
                                respTipoRegiao = resp.tipo_regiao || resp.tipoRegiao;
                                respEndereco = resp.endereco || null;
                            } else {
                                // fallback: resp may already be the conteudo
                                conteudo = resp;
                                respLocalizacao = resp.localizacao || resp.localizacao;
                                respNomeRegiao = resp.nome_regiao || resp.nomeRegiao;
                            }
                        }
                        if (conteudo) {
                            console.log('[ImageDecisionModal] ✅ Conteúdo encontrado, processando blocos...');
                            // convert up to N images inside conteudo.blocos to data:URLs to guarantee availability in WebView
                            async function convertBlockImagesToDataUrls(conteudoObj: any, maxImages = 3, maxBytes = 2_500_000) {
                                try {
                                    const blocks = conteudoObj && conteudoObj.blocos ? (Array.isArray(conteudoObj.blocos) ? conteudoObj.blocos : (conteudoObj.blocos.blocos || conteudoObj.blocos)) : [];
                                    console.log('[ImageDecisionModal] 🖼️ Encontrados', blocks.length, 'blocos para processar');
                                    let converted = 0;
                                    for (const b of blocks) {
                                        if (converted >= maxImages) break;
                                        // candidate fields
                                        const candidates = [b.signed_url, b.url, b.conteudo];
                                        let chosen = null;
                                        for (const c of candidates) { if (c && typeof c === 'string' && (c.startsWith('http://') || c.startsWith('https://') || c.startsWith('data:'))) { chosen = c; break; } }
                                        if (chosen && chosen.startsWith('data:')) { /* already data */ continue; }
                                        if (chosen && (chosen.startsWith('http://') || chosen.startsWith('https://'))) {
                                            try {
                                                // download to temporary file
                                                const tmp = FileSystem.cacheDirectory + 'olinxra_img_' + Date.now() + '_' + Math.random().toString(36).slice(2);
                                                await FileSystem.downloadAsync(chosen, tmp);
                                                const info = await FileSystem.getInfoAsync(tmp);
                                                if (info && 'size' in info && typeof info.size === 'number' && info.size > maxBytes) { console.debug('[ImageDecisionModal] image too large, skipping convert', info.size); try { await FileSystem.deleteAsync(tmp); } catch (e) { }; continue; }
                                                const b64 = await FileSystem.readAsStringAsync(tmp, { encoding: 'base64' });
                                                const ext = (chosen.split('.').pop() || 'jpg').split(/\?|#/)[0];
                                                const dataUrl = `data:image/${ext};base64,${b64}`;
                                                // prefer storing to b.preview or b.data
                                                b.previewDataUrl = dataUrl;
                                                converted++;
                                                try { await FileSystem.deleteAsync(tmp); } catch (e) { }
                                            } catch (e) {
                                                console.debug('[ImageDecisionModal] convert image failed', e, chosen);
                                                continue;
                                            }
                                        }
                                        // convert items inside carousel
                                        if (Array.isArray(b.items)) {
                                            for (const it of b.items) {
                                                if (converted >= maxImages) break;
                                                const ic = it.signed_url || it.url || it.conteudo || null;
                                                if (ic && typeof ic === 'string' && (ic.startsWith('http://') || ic.startsWith('https://'))) {
                                                    try {
                                                        const tmp2 = FileSystem.cacheDirectory + 'olinxra_img_' + Date.now() + '_' + Math.random().toString(36).slice(2);
                                                        await FileSystem.downloadAsync(ic, tmp2);
                                                        const info2 = await FileSystem.getInfoAsync(tmp2);
                                                        if (info2 && 'size' in info2 && typeof info2.size === 'number' && info2.size > maxBytes) { console.debug('[ImageDecisionModal] carousel image too large, skip', info2.size); try { await FileSystem.deleteAsync(tmp2); } catch (e) { }; continue; }
                                                        const b642 = await FileSystem.readAsStringAsync(tmp2, { encoding: 'base64' });
                                                        const ext2 = (ic.split('.').pop() || 'jpg').split(/\?|#/)[0];
                                                        it.previewDataUrl = `data:image/${ext2};base64,${b642}`;
                                                        converted++;
                                                        try { await FileSystem.deleteAsync(tmp2); } catch (e) { }
                                                    } catch (e) { console.debug('[ImageDecisionModal] convert carousel image failed', e, ic); continue; }
                                                }
                                            }
                                        }
                                    }
                                } catch (e) { console.debug('[ImageDecisionModal] convertBlockImages error', e); }
                            }
                            // Start conversion in background (non-blocking) — do NOT await here to avoid blocking the critical path
                            try {
                                convertBlockImagesToDataUrls(conteudo, 3, 2_500_000)
                                    .then(() => console.log('[ImageDecisionModal] ✅ Conversão de imagens (background) concluída'))
                                    .catch((e) => console.debug('[ImageDecisionModal] ⚠️ convert images (background) failed', e));
                            } catch (e) {
                                console.debug('[ImageDecisionModal] ⚠️ iniciar conversão em background falhou', e);
                            }
                            // build a payload minimal
                            let preview = imageUri;
                            // Do not synchronously convert local preview file to base64 (can block). Keep file:// and let renderer handle it.
                            // Start a non-blocking conversion for later use if desired.
                            try {
                                if (preview && preview.startsWith && preview.startsWith('file://')) {
                                    (async () => {
                                        try {
                                            const b64 = await FileSystem.readAsStringAsync(preview, { encoding: 'base64' });
                                            console.log('[ImageDecisionModal] ℹ️ preview conversion (background) pronta (bytes=', b64.length, ')');
                                            // Optionally we could update a cache/context here, but keeping non-blocking for now.
                                        } catch (e) {
                                            console.debug('[ImageDecisionModal] preview conversion (background) failed', e);
                                        }
                                    })();
                                }
                            } catch (e) {
                                console.debug('[ImageDecisionModal] preview conversion scheduling failed', e);
                            }
                            // determine anchor metadata based on image source and recognition info
                            let anchorMode: string | undefined = 'auto';
                            let anchorData: any = undefined;
                            if (imageSource === 'gallery') {
                                // gallery images -> create a totem at user's location (if available)
                                anchorMode = 'totem';
                                if (typeof lat === 'number' && typeof lon === 'number') anchorData = { totem: { lat, lon } };
                            } else if (imageSource === 'camera') {
                                // camera captures prefer bbox anchoring when detection provides it
                                const bbox = (result.data && (result.data.bbox || result.data.bounding_box)) ? (result.data.bbox || result.data.bounding_box) : null;
                                if (bbox) {
                                    anchorMode = 'bbox';
                                    anchorData = { bbox };
                                } else {
                                    anchorMode = 'tap';
                                }
                            }

                            // ensure totem brands exists so AR view can render at least one hotspot
                            try {
                                if (anchorMode === 'totem') {
                                    anchorData = anchorData || { totem: {} };
                                    anchorData.totem = anchorData.totem || {};
                                    anchorData.totem.brands = anchorData.totem.brands || {};
                                    // if no brands provided, synthesize one from payload content
                                    if (Object.keys(anchorData.totem.brands).length === 0) {
                                        const brandKey = result.data.name || 'brand0';
                                        // try to find a URL inside blocos (first button or link)
                                        let brandUrl = null;
                                        try {
                                            const blocks = conteudo && (conteudo.blocos || conteudo) ? (Array.isArray(conteudo.blocos) ? conteudo.blocos : (conteudo.blocos && Array.isArray(conteudo.blocos.blocos) ? conteudo.blocos.blocos : (Array.isArray(conteudo) ? conteudo : []))) : [];
                                            for (const b of blocks) {
                                                if (!b) continue;
                                                // check common places for links
                                                if (b.action && b.action.href) { brandUrl = b.action.href; break; }
                                                if (b.href) { brandUrl = b.href; break; }
                                                if (b.items && Array.isArray(b.items)) {
                                                    for (const it of b.items) { if (it && (it.href || (it.action && it.action.href))) { brandUrl = it.href || it.action.href; break; } }
                                                    if (brandUrl) break;
                                                }
                                            }
                                        } catch (e) { console.debug('[ImageDecisionModal] extracting brand url failed', e); }
                                        anchorData.totem.brands[brandKey] = { modelUrl: undefined, url: brandUrl || '#', hotspotPosition: [0.25, 0.35, 0.1] };
                                        console.debug('[ImageDecisionModal] synthesized totem.brands for AR', Object.keys(anchorData.totem.brands));
                                    }
                                }
                            } catch (e) { console.debug('[ImageDecisionModal] ensure totem brands failed', e); }

                            const payload: any = { nome_marca: result.data.name, previewImage: preview, blocos: conteudo, anchorMode, anchorData };
                            // include backend-provided location metadata when available
                            if (respLocalizacao) payload.localizacao = respLocalizacao;
                            if (respNomeRegiao) payload.nome_regiao = respNomeRegiao;
                            if (respTipoRegiao) payload.tipo_regiao = respTipoRegiao;
                            if (respEndereco) payload.endereco = respEndereco;

                            console.log('[ImageDecisionModal] 📦 Payload montado:', {
                                marca: payload.nome_marca,
                                anchorMode: payload.anchorMode,
                                temBlocos: !!payload.blocos,
                                temLocalizacao: !!payload.localizacao,
                                nomeRegiao: payload.nome_regiao
                            });

                            // safe stringify (truncate long strings like base64)
                            try {
                                const seen = new WeakSet();
                                const s = JSON.stringify(payload, function (k, v) {
                                    if (typeof v === 'string' && v.length > 200) return v.slice(0, 200) + '...<truncated>';
                                    if (v && typeof v === 'object') {
                                        if (seen.has(v)) return '<cycle>'; seen.add(v);
                                    }
                                    return v;
                                }, 2);
                                console.debug('[ImageDecisionModal] setting lastAR payload ->', s);
                            } catch (e) { console.debug('[ImageDecisionModal] payload stringify failed', e); }

                            // Inicia prefetch explícito ANTES de setARPayload para dar mais headroom ao download do header
                            try {
                                const tPrefetchKick = Date.now();
                                console.log('[ImageDecisionModal] ▶️ Iniciando prefetchImagesForPayload ANTES de setARPayload t_prefetch_kick=', new Date(tPrefetchKick).toISOString());
                                // kick off prefetch (non-blocking) - context will also run its own prefetch em setPayload
                                try { prefetchImagesForPayload && prefetchImagesForPayload(payload); } catch (e) { /* swallow */ }
                                // tenta detectar filename do header (heurística similar ao contexto)
                                const findHeaderFilename = (p: any) => {
                                    try {
                                        const blocks = p && (p.blocos || p) ? (Array.isArray(p.blocos) ? p.blocos : (p.blocos && Array.isArray(p.blocos.blocos) ? p.blocos.blocos : (Array.isArray(p) ? p : []))) : [];
                                        for (const b of blocks) {
                                            if (!b) continue;
                                            const filename = b.filename || b.nome || (b.signed_url ? String(b.signed_url).split('/').pop() : null);
                                            const isHeader = (String(b?.subtipo || '').toLowerCase() === 'header') || (filename && String(filename).toLowerCase().includes('topo'));
                                            if (isHeader && filename) return filename;
                                            if (b.items && Array.isArray(b.items)) {
                                                for (const it of b.items) {
                                                    const ifname = it.filename || it.nome || (it.signed_url ? String(it.signed_url).split('/').pop() : null);
                                                    const iHeader = (String(it?.subtipo || '').toLowerCase() === 'header') || (ifname && String(ifname).toLowerCase().includes('topo'));
                                                    if (iHeader && ifname) return ifname;
                                                }
                                            }
                                        }
                                    } catch (e) { /* ignore */ }
                                    return null;
                                };

                                const headerFilename = findHeaderFilename(payload);
                                // kick off prefetch (non-blocking) - context will also run its own prefetch in setPayload
                                try { prefetchImagesForPayload && prefetchImagesForPayload(payload); } catch (e) { /* swallow */ }

                                const waitForHeader = async (filename: string | null, timeoutMs = 1200) => {
                                    if (!filename) return false;
                                    const start = Date.now();
                                    const poll = async () => {
                                        if (headerLocalMap && headerLocalMap[filename]) return true;
                                        if (Date.now() - start >= timeoutMs) return false;
                                        await new Promise((r) => setTimeout(r, 80));
                                        return poll();
                                    };
                                    try {
                                        return await poll();
                                    } catch (e) { return false; }
                                };

                                const cached = await waitForHeader(headerFilename, 1200);
                                if (cached) {
                                    const tCacheReady = Date.now();
                                    console.log('[ImageDecisionModal] ✅ Header cache pronto antes de setARPayload:', headerFilename, headerLocalMap && headerLocalMap[headerFilename], 't_cache_ready=', new Date(tCacheReady).toISOString(), 'elapsed_ms=', tCacheReady - tPrefetchKick);
                                } else {
                                    console.log('[ImageDecisionModal] ℹ️ Header cache não pronto em 1200ms, vai registrar payload e navegar de qualquer forma', headerFilename);
                                }
                            } catch (e) {
                                console.warn('[ImageDecisionModal] Erro ao aguardar cache do header', e);
                            }

                            // Agora que demos um headstart no download, registra o payload no contexto
                            const tSetPayload = Date.now();
                            console.log('[ImageDecisionModal] ✅ Registrando payload no contexto e navegando para ar-view... t_set_payload=', new Date(tSetPayload).toISOString(), 'elapsed_ms=', tSetPayload - tFetchEnd);
                            setARPayload(payload);
                            // Fecha o modal ANTES de navegar
                            shouldCancel = true; // vai executar onCancel no finally
                            const tNav = Date.now();
                            router.push('/_tabs/ar-view');
                            console.log('[ImageDecisionModal] ▶️ Navegação para /_tabs/ar-view triggered t_nav=', new Date(tNav).toISOString(), 'elapsed_ms=', tNav - tSetPayload);
                        } else {
                            // No content for recognized brand: show the no-content modal with brand and location
                            console.warn('[ImageDecisionModal] ⚠️ Marca reconhecida mas sem conteúdo disponível');
                            try { setNoContentBrand(result.data.name || 'Desconhecida'); } catch (e) { setNoContentBrand('Desconhecida'); }
                            try { setNoContentLocation(respLocalizacao || null); } catch (e) { setNoContentLocation(null); }
                            setShowNoContentModal(true);
                        }
                    }
                } catch (e) {
                    console.error('[ImageDecisionModal] ❌ Erro ao buscar conteúdo por localização:', e);
                    Alert.alert('Erro', 'Falha ao buscar conteúdo por localização.');
                }
            } else if (result.status === 'low_similarity') {
                console.warn('[ImageDecisionModal] ⚠️ Reconhecimento com baixa confiança');
                Alert.alert(
                    'Reconhecimento não confiável',
                    ('message' in result && typeof result.message === 'string') ? result.message : 'Nenhum logo reconhecido com confiança suficiente.'
                );
                shouldCancel = false;
            } else if (result.status === 'untrusted') {
                console.warn('[ImageDecisionModal] ⚠️ Reconhecimento marcado como não confiável pelo backend', result);
                // Mostrar razão amigável quando disponível, permitir retry
                // Use any to avoid strict TS type checks on the heterogeneous result object coming from the hook
                const rAny: any = result;
                const reason = (rAny && rAny.data && rAny.data.debug_reason) ? rAny.data.debug_reason : (rAny && rAny.message) ? rAny.message : 'O reconhecimento não foi confiável.';
                Alert.alert(
                    'Reconhecimento duvidoso',
                    reason,
                    [
                        { text: 'Tentar novamente', onPress: () => { try { handleCompare(); } catch (e) { console.debug('retry failed', e); } } },
                        { text: 'Cancelar', style: 'cancel' }
                    ]
                );
                shouldCancel = false;
            } else if (result.status === 'not_found') {
                console.warn('[ImageDecisionModal] ⚠️ Logo não encontrado no banco');
                // Not recognized at all: try to obtain location for display and show no-content modal
                try {
                    const { status } = await Location.getForegroundPermissionsAsync();
                    let locStr: string | null = null;
                    if (status === 'granted') {
                        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
                        locStr = `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`;
                    }
                    setNoContentBrand('Desconhecida');
                    setNoContentLocation(locStr);
                    setShowNoContentModal(true);
                } catch (e) {
                    setNoContentBrand('Desconhecida');
                    setNoContentLocation(null);
                    setShowNoContentModal(true);
                }
                shouldCancel = false;
            } else if (result.status === 'error') {
                console.error('[ImageDecisionModal] ❌ Erro no servidor:', result);
                Alert.alert('Erro', ('error' in result && typeof result.error === 'string') ? result.error : 'Falha na comunicação com o servidor.');
            } else {
                console.error('[ImageDecisionModal] ❌ Resposta inesperada:', result);
                Alert.alert('Erro', 'Resposta inesperada do servidor.');
            }
        } catch (error) {
            console.error('[ImageDecisionModal] ❌ Erro na comunicação:', error);
            Alert.alert('Erro', 'Falha na comunicação com o servidor.');
        } finally {
            console.log('[ImageDecisionModal] 🏁 Finalizando reconhecimento, shouldCancel:', shouldCancel);
            setLoading(false);
            setLoadingMessage('');
            if (shouldCancel) onCancel();
        }
    }, [imageUri, onCancel, router, fetchContentForRecognition, imageSource]);

    const handleSave = React.useCallback(async () => {
        if (!canSave) return;
        setLoading(true);
        await saveToGallery(imageUri);
        setLoading(false);
        onCancel();
    }, [canSave, imageUri, onCancel]);

    const handleNoContentCancel = React.useCallback(() => {
        setShowNoContentModal(false);
        onCancel();
    }, [onCancel]);

    return (
        <>
            {showNoContentModal && <NoContentToDisplayModal visible={showNoContentModal} onCancel={handleNoContentCancel} brand={noContentBrand} location={noContentLocation} />}
            <Modal visible={visible} transparent={false} animationType="slide" statusBarTranslucent={true}>
                <View style={styles.overlay}>
                    <Image
                        source={{ uri: imageUri }}
                        style={{
                            width: imageWidth,
                            height: imageWidth / 1.2,
                            borderRadius: 12
                        }}
                        resizeMode="cover"
                    />
                    <View style={styles.buttonContainer}>
                        <Pressable style={styles.fullButton} onPress={handleCompare}>
                            <MaterialIcons name="search" color={Colors.global.light} size={24} style={styles.icon} />
                            <Text style={styles.buttonText}>Buscar conteúdo associado</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.fullButton, !canSave ? { opacity: 0.5 } : {}]}
                            onPress={handleSave}
                            disabled={!canSave}
                        >
                            <MaterialIcons name="save" color={Colors.global.light} size={24} style={styles.icon} />
                            <Text style={styles.buttonText}>Salvar na galeria</Text>
                        </Pressable>
                        <Pressable style={[styles.fullButton, styles.fullButtonExit]} onPress={onCancel}>
                            <MaterialIcons name="cancel" color={Colors.global.light} size={24} style={styles.icon} />
                            <Text style={styles.buttonText}>Cancelar</Text>
                        </Pressable>
                    </View>
                    {/* ✅ Loader renderizado DENTRO do Modal para aparecer sobre os botões */}
                    <LoadingWithTips visible={loading} stage={loadingStage || loadingMessage} />
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonContainer: {
        marginTop: 32,
        width: '80%',
        flexDirection: 'column',
    },
    fullButton: {
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        paddingVertical: 16,
        borderRadius: 5,
        backgroundColor: Colors.global.blueLight,
        shadowColor: Colors.global.dark,
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
        marginBottom: 16,
    },
    fullButtonExit: {
        backgroundColor: Colors.global.blueDark,
        marginBottom: 0,
    },
    icon: {
        marginRight: 8,
        alignSelf: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
    },
});