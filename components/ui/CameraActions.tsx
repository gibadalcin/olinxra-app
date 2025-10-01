import React from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';

const ICON_SIZE = 32;
const OUTER_CIRCLE_SIZE = 62;
const INNER_CIRCLE_SIZE = 60;
const PART_CIRCLE_SIZE = 2;

type CameraActionsProps = {
    onOpenGallery: () => void;
    onTakePicture: () => void;
    onOpenHistory: () => void;
};

export function CameraActions({
    onOpenGallery,
    onTakePicture,
    onOpenHistory,
}: CameraActionsProps) {
    const { width } = useWindowDimensions();
    return (
        <View style={[styles.buttonRow, { width: width * 0.9 }]}>
            <Pressable
                onPress={onOpenGallery}
                accessibilityLabel="Abrir galeria"
                accessibilityRole="button"
            >
                <Ionicons name="images" size={ICON_SIZE} color={Colors.light.tabIconDefault} />
                <ThemedText style={styles.label}>Galeria</ThemedText>
            </Pressable>
            <Pressable
                style={({ pressed }) => [
                    styles.mainButton,
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
            <Pressable
                onPress={onOpenHistory}
                accessibilityLabel="Abrir salvos"
                accessibilityRole="button"
            >
                <Ionicons name="folder-open" size={ICON_SIZE} color={Colors.light.tabIconDefault} />
                <ThemedText style={styles.label}>Salvos</ThemedText>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    buttonRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        marginTop: 24,
        justifyContent: "space-around",
        position: "relative",
    },
    mainButton: {
        marginBottom: 20,
    },
    outerCircle: {
        width: OUTER_CIRCLE_SIZE,
        height: OUTER_CIRCLE_SIZE,
        borderRadius: OUTER_CIRCLE_SIZE / PART_CIRCLE_SIZE,
        backgroundColor: Colors.dark.tint,
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
        backgroundColor: Colors.dark.tint,
        borderColor: Colors.light.background,
        borderWidth: 3,
        justifyContent: 'center',
        alignItems: 'center',
    },
    label: {
        fontSize: 12,
        textAlign: 'center',
        fontWeight: '700',
    },
});