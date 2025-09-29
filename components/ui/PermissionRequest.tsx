import React from 'react';
import { View, Button, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Image } from 'expo-image';

type PermissionRequestProps = {
    onRequestPermission: () => void;
};

export function PermissionRequest({ onRequestPermission }: PermissionRequestProps) {
    return (
        <View style={styles.container}>
            <Image
                source={require('../../assets/images/adaptive-icon.png')}
                style={styles.logo}
                contentFit='contain'
            />
            <ThemedText style={styles.permissionText}>
                Precisamos de permissão para acessar a câmera.
            </ThemedText>
            <Button onPress={onRequestPermission} title="Conceder Permissão" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    logo: {
        width: 200,
        height: 180,
        marginBottom: 20,
    },
    permissionText: {
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 26,
        paddingHorizontal: 20,
        maxWidth: '90%',
    },
});