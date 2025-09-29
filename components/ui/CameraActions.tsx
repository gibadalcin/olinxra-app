import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';

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
    return (
        <View style={styles.buttonRow}>
            <Pressable onPress={onOpenGallery}>
                <Ionicons name="images" size={32} color={Colors.light.tabIconDefault} />
                <ThemedText style={styles.gallery}>Galeria</ThemedText>
            </Pressable>
            <Pressable
                style={({ pressed }) => [
                    styles.mainButton,
                    { opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={onTakePicture}
            >
                <View style={styles.outerCircle}>
                    <View style={styles.innerCircle}>
                        <Ionicons name="camera" size={32} color={Colors.light.background} />
                    </View>
                </View>
            </Pressable>
            <Pressable onPress={onOpenHistory}>
                <Ionicons name="folder-open" size={32} color={Colors.light.tabIconDefault} />
                <ThemedText style={styles.history}>Salvos</ThemedText>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    buttonRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-around',
        width: '100%',
        marginTop: 32,
    },
    mainButton: {
        marginBottom: 20,
    },
    outerCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: Colors.dark.tint,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.dark.tint,
        shadowOffset: { width: 1, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 3,
    },
    innerCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.dark.tint,
        borderColor: Colors.light.background,
        borderWidth: 3,
        justifyContent: 'center',
        alignItems: 'center',
    },
    history: {
        fontSize: 12,
        textAlign: 'center',
        fontWeight: '800',
    },
    gallery: {
        fontSize: 12,
        textAlign: 'center',
        fontWeight: '600',
    },
});