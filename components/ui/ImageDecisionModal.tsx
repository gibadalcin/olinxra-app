import React, { useState } from 'react';
import { Modal, View, Image, StyleSheet, Pressable, Text, Alert } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { saveToGallery } from '@/hooks/useSaveToGallery';
import { LoadingCaptureModal } from './LoadingCaptureModal';
import { compareLogo } from '@/hooks/useLogoCompare';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { setLastARContent } from '@/utils/lastARContent';
import { useARContent } from '@/hooks/useARContent';
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
    const [showNoContentModal, setShowNoContentModal] = useState(false);
    const canSave = !saveDisabled && imageSource === 'camera';
    const router = useRouter();
    const { fetchContentForRecognition } = useARContent();

    const handleCompare = React.useCallback(async () => {
        setLoading(true);
        let shouldCancel = true;
        try {
            const result = await compareLogo(imageUri);
            if ((result.status === 'cached' || result.status === 'recognized') && 'data' in result && result.data && typeof result.data.name === 'string') {
                // recognized -> now try fetch content by location
                try {
                    // request location
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status !== 'granted') {
                        Alert.alert('Permissão negada', 'Preciso da sua localização para buscar conteúdo próximo');
                    } else {
                        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
                        const lat = loc.coords.latitude;
                        const lon = loc.coords.longitude;
                        const conteudo = await fetchContentForRecognition(result.data.name, lat, lon);
                        if (conteudo) {
                            // convert up to N images inside conteudo.blocos to data:URLs to guarantee availability in WebView
                            async function convertBlockImagesToDataUrls(conteudoObj: any, maxImages = 3, maxBytes = 2_500_000) {
                                try {
                                    const blocks = conteudoObj && conteudoObj.blocos ? (Array.isArray(conteudoObj.blocos) ? conteudoObj.blocos : (conteudoObj.blocos.blocos || conteudoObj.blocos)) : [];
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
                            // run conversion but don't block too long — await it to ensure payload includes data urls
                            try { await convertBlockImagesToDataUrls(conteudo, 3, 2_500_000); } catch (e) { console.debug('[ImageDecisionModal] convert images top-level failed', e); }
                            // build a payload minimal
                            let preview = imageUri;
                            try {
                                if (preview && preview.startsWith && preview.startsWith('file://')) {
                                    // convert local file to base64 data URL for WebView
                                    const b64 = await FileSystem.readAsStringAsync(preview, { encoding: 'base64' });
                                    preview = `data:image/jpeg;base64,${b64}`;
                                }
                            } catch (e) {
                                console.debug('[ImageDecisionModal] preview conversion failed', e);
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

                            const payload = { nome_marca: result.data.name, previewImage: preview, blocos: conteudo, anchorMode, anchorData };
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
                            setLastARContent(payload);
                            router.push('/(tabs)/ar-view');
                            shouldCancel = false;
                        } else {
                            Alert.alert('Nenhum conteúdo próximo', 'Não foi encontrado conteúdo associado para essa localização.');
                        }
                    }
                } catch (e) {
                    console.error('Erro ao buscar conteúdo por localização', e);
                    Alert.alert('Erro', 'Falha ao buscar conteúdo por localização.');
                }
            } else if (result.status === 'low_similarity') {
                Alert.alert(
                    'Reconhecimento não confiável',
                    ('message' in result && typeof result.message === 'string') ? result.message : 'Nenhum logo reconhecido com confiança suficiente.'
                );
            } else if (result.status === 'not_found') {
                setShowNoContentModal(true);
                shouldCancel = false;
            } else if (result.status === 'error') {
                Alert.alert('Erro', ('error' in result && typeof result.error === 'string') ? result.error : 'Falha na comunicação com o servidor.');
            } else {
                Alert.alert('Erro', 'Resposta inesperada do servidor.');
            }
        } catch (error) {
            Alert.alert('Erro', 'Falha na comunicação com o servidor.');
        } finally {
            setLoading(false);
            if (shouldCancel) onCancel();
        }
    }, [imageUri, onCancel, router, fetchContentForRecognition]);

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
            {loading && <LoadingCaptureModal visible={loading} />}
            {showNoContentModal && <NoContentToDisplayModal visible={showNoContentModal} onCancel={handleNoContentCancel} />}
            <Modal visible={visible} transparent>
                <View style={styles.overlay}>
                    <Image source={{ uri: imageUri }} style={{ width: imageWidth, height: imageWidth / 1.25, borderRadius: 12 }} />
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