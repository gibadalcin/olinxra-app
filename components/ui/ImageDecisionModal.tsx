import React, { useState } from 'react';
import { Modal, View, Image, StyleSheet, Pressable, Text, Alert } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSaveToGallery } from '@/hooks/useSaveToGallery';
import { LoadingCaptureModal } from './LoadingCaptureModal';
import { compareLogo } from '@/hooks/useLogoCompare';
import { NoContentToDisplayModal } from './NoContentToDisplay';

type Props = {
    visible: boolean;
    imageUri: string;
    onSave: () => void;
    onCancel: () => void;
    saveDisabled?: boolean;
};

export function ImageDecisionModal({
    visible,
    imageUri,
    onCancel,
    saveDisabled,
}: Props) {
    const { width } = useWindowDimensions();
    const imageWidth = width * 0.8;
    const { saveToGallery } = useSaveToGallery();
    const [loading, setLoading] = useState(false);
    const [showNoContentModal, setShowNoContentModal] = useState(false);

    async function handleCompare() {
        setLoading(true);
        try {
            const result = await compareLogo(imageUri);
            if ((result.status === 'cached' || result.status === 'recognized') && result.data?.name) {
                const confidence =
                    typeof result.data.confidence === 'number'
                        ? `\nSimilaridade: ${result.data.confidence.toFixed(2)}`
                        : '';
                Alert.alert(
                    'Conteúdo reconhecido!',
                    `Nome: ${result.data.name}${confidence}`
                );
                onCancel(); // Fecha o modal
            } else if (result.status === 'not_found') {
                setShowNoContentModal(true);
                onCancel(); // Fecha o modal
            } else if (result.status === 'error') {
                Alert.alert('Erro', result.error || 'Falha na comunicação com o servidor.');
                onCancel(); // Fecha o modal
            } else {
                Alert.alert('Erro', 'Resposta inesperada do servidor.');
                onCancel(); // Fecha o modal
            }
        } catch (error) {
            Alert.alert('Erro', 'Falha na comunicação com o servidor.');
            onCancel(); // Fecha o modal
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (saveDisabled) return;
        setLoading(true);
        await saveToGallery(imageUri);
        setLoading(false);
        onCancel();
    }

    function handleNoContentCancel() {
        setShowNoContentModal(false);
        onCancel();
    }

    return (
        <>
            <LoadingCaptureModal visible={loading} />
            <NoContentToDisplayModal visible={showNoContentModal} onCancel={handleNoContentCancel} />
            <Modal visible={visible} transparent>
                <View style={styles.overlay}>
                    <Image source={{ uri: imageUri }} style={{ width: imageWidth, height: imageWidth / 1.25, borderRadius: 12 }} />
                    <View style={styles.buttonContainer}>
                        <Pressable style={styles.fullButton} onPress={handleCompare}>
                            <MaterialIcons name="search" color={Colors.global.light} size={24} style={styles.icon} />
                            <Text style={styles.buttonText}>Buscar conteúdo associado</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.fullButton, saveDisabled && { opacity: 0.5 }]}
                            onPress={handleSave}
                            disabled={saveDisabled}
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