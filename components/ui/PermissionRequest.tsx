import React from 'react';
import { View, Button, StyleSheet, type ImageSourcePropType } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Image } from 'expo-image';
import { Colors } from '../../constants/Colors';

type PermissionRequestProps = {
    onRequestPermission: () => void;
};

// Removemos o 'export' da função
function PermissionRequest({ onRequestPermission }: PermissionRequestProps) {
    const textColor = Colors['light'].headerText;

    return (
        <View style={styles.container}>
            {/* ... JSX ... */}
            <Image
                source={require('../../assets/images/adaptive-icon.png')}
                style={styles.logo}
                contentFit='contain'
            />
            <ThemedText style={[styles.permissionText, { color: textColor }]}>
                Para continuar, precisamos da sua permissão para acessar a câmera e a galeria.
            </ThemedText>
            <Button
                onPress={onRequestPermission}
                title="Conceder Permissão"
                color="#0047AB"
            />
        </View>
    );
}

// ADICIONAMOS O EXPORT DEFAULT AQUI:
export default PermissionRequest;

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        backgroundColor: '#012E57',
    },
    logo: {
        width: 200,
        height: 180,
        marginBottom: 30,
    },
    permissionText: {
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 26,
        paddingHorizontal: 20,
        maxWidth: '90%',
    },
});