import React, { useEffect, useState } from 'react';
import { Modal, View, StyleSheet, ActivityIndicator, Text, Button } from 'react-native';
import { Colors } from '../../constants/Colors';

interface LoadingCaptureModalProps {
    visible: boolean;
    onFinish?: () => void;
    onCancel?: () => void;
    result?: { status: 'success' | 'error' };
    minDuration?: number; // em ms
}

export function LoadingCaptureModal({ visible, onFinish, onCancel, result, minDuration = 3000 }: LoadingCaptureModalProps) {
    const [show, setShow] = useState(false);
    const handleFinish = React.useCallback(() => {
        if (onFinish) onFinish();
    }, [onFinish]);

    useEffect(() => {
        let timer: number | undefined;
        if (visible) {
            setShow(true);
            timer = setTimeout(handleFinish, minDuration);
        } else {
            setShow(false);
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [visible, minDuration, handleFinish]);

    if (!visible && !show) return null;

    if (result?.status === 'error') {
        return (
            <Modal visible transparent statusBarTranslucent animationType="fade">
                <View style={styles.overlay}>
                    <Text style={{ color: Colors.global.dark, marginBottom: 16 }}>Ocorreu um erro ao processar a imagem.</Text>
                    <Button title="Cancelar" onPress={onCancel} color={Colors.global.blueDark} />
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={show} transparent statusBarTranslucent animationType="fade">
            <View style={styles.overlay}>
                <ActivityIndicator size="large" color={Colors.global.blueLight} />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});