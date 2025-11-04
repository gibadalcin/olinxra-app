import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

interface LoadingWithTipsProps {
    visible: boolean;
    stage?: string; // Ex: "Buscando próximo (50m)", "Buscando na cidade", etc.
}

const TIPS = [
    {
        icon: 'image' as const,
        text: 'Use imagens de melhor qualidade salvas na galeria para resultados mais precisos',
    },
    {
        icon: 'sunny' as const,
        text: 'Iluminação adequada melhora significativamente o reconhecimento',
    },
    {
        icon: 'hand-left' as const,
        text: 'Mantenha a câmera estável ao capturar a logo para melhor precisão',
    },
    {
        icon: 'scan' as const,
        text: 'Capture a logo centralizada e sem obstruções para melhores resultados',
    },
    {
        icon: 'location' as const,
        text: 'Permita acesso à localização para conteúdo personalizado da sua região',
    },
    {
        icon: 'cube' as const,
        text: 'Explore modelos 3D em realidade aumentada após o reconhecimento',
    },
    {
        icon: 'wifi' as const,
        text: 'Conexão estável garante carregamento mais rápido do conteúdo',
    },
];

export default function LoadingWithTips({ visible, stage }: LoadingWithTipsProps) {
    const [currentTipIndex, setCurrentTipIndex] = useState(0);
    const [fadeAnim] = useState(new Animated.Value(1));

    useEffect(() => {
        if (!visible) return;

        // Rotacionar dicas a cada 3 segundos com fade
        const interval = setInterval(() => {
            Animated.sequence([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();

            setCurrentTipIndex((prev) => (prev + 1) % TIPS.length);
        }, 4000);

        return () => clearInterval(interval);
    }, [visible, fadeAnim]);

    if (!visible) return null;

    const currentTip = TIPS[currentTipIndex];

    return (
        <View style={styles.container}>
            <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={Colors.light?.tint || '#007AFF'} />

                {stage && (
                    <Text style={styles.stageText}>{stage}</Text>
                )}

                <Animated.View style={[styles.tipContainer, { opacity: fadeAnim }]}>
                    <Ionicons
                        name={currentTip.icon}
                        size={24}
                        color={Colors.light?.tint || '#007AFF'}
                        style={styles.tipIcon}
                    />
                    <Text style={styles.tipText}>{currentTip.text}</Text>
                </Animated.View>

                <View style={styles.dotsContainer}>
                    {TIPS.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                index === currentTipIndex && styles.dotActive,
                            ]}
                        />
                    ))}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    loadingBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 20,
        padding: 30,
        width: '85%',
        maxWidth: 400,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    stageText: {
        marginTop: 16,
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        textAlign: 'center',
    },
    tipContainer: {
        marginTop: 24,
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 8,
    },
    tipIcon: {
        marginRight: 12,
        marginTop: 2,
    },
    tipText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
        color: '#333',
        textAlign: 'left',
    },
    dotsContainer: {
        flexDirection: 'row',
        marginTop: 20,
        gap: 8,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#CCC',
    },
    dotActive: {
        backgroundColor: Colors.light?.tint || '#007AFF',
        width: 20,
    },
});
