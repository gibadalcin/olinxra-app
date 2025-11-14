import React from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from '../../components/ThemedText';
import { Colors } from '../../constants/Colors';

const ICON_SIZE = 40;
const OUTER_CIRCLE_SIZE = 72;
const INNER_CIRCLE_SIZE = 70;
const PART_CIRCLE_SIZE = 2;

type CameraActionsProps = {
    onOpenGallery: () => void;
    onTakePicture: () => void;
};

export function CameraActions({
    onOpenGallery,
    onTakePicture,
}: CameraActionsProps) {
    const { width } = useWindowDimensions();
    return (
        <View style={[styles.absoluteContainer, { width: width * 0.9, alignSelf: 'center' }]}>
            <Pressable
                onPress={onOpenGallery}
                accessibilityLabel="Abrir galeria"
                accessibilityRole="button"
                style={styles.galleryButton}
            >
                <Ionicons name="images" size={ICON_SIZE} color={Colors.light.background + '99'} />
                <ThemedText style={styles.label}>Galeria</ThemedText>
            </Pressable>
            <Pressable
                style={({ pressed }) => [
                    styles.captureButton,
                    { opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={onTakePicture}
                accessibilityLabel="Capturar imagem"
                accessibilityRole="button"
            >
                <View style={styles.outerCircle}>
                    <View style={styles.innerCircle}>
                        <Ionicons name="camera-outline" size={ICON_SIZE} color={Colors.light.background} />
                    </View>
                </View>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    absoluteContainer: {
        position: 'relative',
        height: OUTER_CIRCLE_SIZE + 40,
        marginBottom: '6%',
    },
    galleryButton: {
        position: 'absolute',
        left: '10%',
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    captureButton: {
        position: 'absolute',
        left: '50%',
        top: 0,
        transform: [{ translateX: -OUTER_CIRCLE_SIZE / 2 }],
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    sideButton: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    mainButton: {
        marginBottom: 20,
    },
    outerCircle: {
        width: OUTER_CIRCLE_SIZE,
        height: OUTER_CIRCLE_SIZE,
        borderRadius: OUTER_CIRCLE_SIZE / PART_CIRCLE_SIZE,
        backgroundColor: 'rgba(0,0,0,0.35)', // semitransparente
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.global.dark,
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 3,
        elevation: 3,
    },
    innerCircle: {
        width: INNER_CIRCLE_SIZE,
        height: INNER_CIRCLE_SIZE,
        borderRadius: INNER_CIRCLE_SIZE / PART_CIRCLE_SIZE,
        backgroundColor: Colors.global.bg + '99',
        borderColor: Colors.light.background + 'cc',
        borderWidth: 3,
        justifyContent: 'center',
        alignItems: 'center',
    },
    label: {
        fontSize: 12,
        textAlign: 'center',
        fontWeight: '700',
        color: Colors.light.background + 'cc',
    },
});