import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ARNavigationControlsProps {
    currentIndex: number;
    totalModels: number;
    onPrevious: () => void;
    onNext: () => void;
}

export function ARNavigationControls({
    currentIndex,
    totalModels,
    onPrevious,
    onNext,
}: ARNavigationControlsProps) {
    // Não renderizar se houver apenas 1 ou nenhum modelo
    if (totalModels <= 1) {
        return null;
    }

    const canGoPrevious = currentIndex > 0;
    const canGoNext = currentIndex < totalModels - 1;

    return (
        <View style={styles.container}>
            <View style={styles.controlsWrapper}>
                {/* Botão Anterior */}
                <TouchableOpacity
                    style={[
                        styles.navButton,
                        !canGoPrevious && styles.navButtonDisabled,
                    ]}
                    onPress={onPrevious}
                    disabled={!canGoPrevious}
                >
                    <Text style={[
                        styles.navButtonText,
                        !canGoPrevious && styles.navButtonTextDisabled,
                    ]}>
                        ◀
                    </Text>
                </TouchableOpacity>

                {/* Contador */}
                <View style={styles.counter}>
                    <Text style={styles.counterText}>
                        {currentIndex + 1}/{totalModels}
                    </Text>
                    <Text style={styles.counterLabel}>Modelos AR</Text>
                </View>

                {/* Botão Próximo */}
                <TouchableOpacity
                    style={[
                        styles.navButton,
                        !canGoNext && styles.navButtonDisabled,
                    ]}
                    onPress={onNext}
                    disabled={!canGoNext}
                >
                    <Text style={[
                        styles.navButtonText,
                        !canGoNext && styles.navButtonTextDisabled,
                    ]}>
                        ▶
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignItems: 'center',
    },
    controlsWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 25,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    navButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#3498db',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 8,
    },
    navButtonDisabled: {
        backgroundColor: '#555',
        opacity: 0.5,
    },
    navButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    navButtonTextDisabled: {
        color: '#999',
    },
    counter: {
        marginHorizontal: 16,
        alignItems: 'center',
    },
    counterText: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    counterLabel: {
        color: '#bbb',
        fontSize: 11,
        textTransform: 'uppercase',
    },
});
