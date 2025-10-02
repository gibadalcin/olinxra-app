import React, { useState } from 'react';
import { Modal, View, Image, StyleSheet, Pressable, Text, Alert } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { saveToGallery } from '@/hooks/useSaveToGallery';
import { LoadingCaptureModal } from './LoadingCaptureModal';
import { compareLogo } from '@/hooks/useLogoCompare';
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

    const handleCompare = React.useCallback(async () => {
        setLoading(true);
        let shouldCancel = true;
        try {
            const result = await compareLogo(imageUri);
            if ((result.status === 'cached' || result.status === 'recognized') && result.data?.name) {
                const confidence =
                    typeof result.data.confidence === 'number'
                        ? `\nSimilaridade: ${result.data.confidence.toFixed(2)}`
                        : '';
                const distance =
                    typeof result.data.distance === 'number'
                        ? `\nDistância: ${result.data.distance.toFixed(4)}`
                        : '';
                Alert.alert(
                    'Conteúdo reconhecido!',
                    `Nome: ${result.data.name}${confidence}${distance}`
                );
            } else if (result.status === 'not_found') {
                setShowNoContentModal(true);
                shouldCancel = false;
            } else if (result.status === 'error') {
                Alert.alert('Erro', result.error || 'Falha na comunicação com o servidor.');
            } else {
                Alert.alert('Erro', 'Resposta inesperada do servidor.');
            }
        } catch (error) {
            Alert.alert('Erro', 'Falha na comunicação com o servidor.');
        } finally {
            setLoading(false);
            if (shouldCancel) onCancel();
        }
    }, [imageUri, onCancel]);

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