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
    console.log('[ARNavigationControls] 📊 Renderizando:', { currentIndex, totalModels });

    // Não renderizar se não houver modelos
    if (totalModels < 1) {
        console.log('[ARNavigationControls] ❌ totalModels < 1, retornando null');
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
        paddingHorizontal: 4,
        paddingVertical: 0,
        alignItems: 'center',
    },
    controlsWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(52, 152, 219, 0.15)', // Azul transparente para combinar
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        // Sombras removidas para evitar "estouro"
        marginBottom: 4,
        width: '100%',
    },
    navButton: {
        width: 52,
        height: 52,
        borderRadius: 26, // Circular
        backgroundColor: '#3498db',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 12,
        shadowColor: '#3498db',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    navButtonDisabled: {
        backgroundColor: 'rgba(100, 100, 100, 0.3)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowOpacity: 0,
        elevation: 0,
    },
    navButtonText: {
        color: 'white',
        fontSize: 22,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    navButtonTextDisabled: {
        color: '#999',
    },
    counter: {
        marginHorizontal: 24,
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        minWidth: 80,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    counterText: {
        color: '#3498db',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 2,
        letterSpacing: 1,
    },
    counterLabel: {
        color: '#666',
        fontSize: 9,
        textTransform: 'uppercase',
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});
