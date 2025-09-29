import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';

type CaptureButtonProps = {
    onPress: () => void;
};

const CaptureButton: React.FC<CaptureButtonProps> = ({ onPress }) => {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.buttonContainer,
                {
                    opacity: pressed ? 0.7 : 1, // Feedback visual ao ser pressionado
                },
            ]}
        >
            <View style={styles.outerCircle}>
                <View style={styles.innerCircle} />
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    buttonContainer: {
        // Estilos do contêiner do botão, se necessário
    },
    outerCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.5)', // Círculo externo semitransparente
        justifyContent: 'center',
        alignItems: 'center',
    },
    innerCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#fff', // Círculo interno branco
    },
});

export default CaptureButton;