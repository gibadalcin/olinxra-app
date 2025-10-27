import React from 'react';
import { View, Button, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { Image } from 'expo-image';
import { Colors } from '@/constants/Colors';

type PermissionRequestProps = {
    onRequestPermission: () => void;
};

// Removemos o 'export' da função
function PermissionRequest({ onRequestPermission }: PermissionRequestProps) {
    const textColor = Colors['light'].headerText;
    const router = useRouter();

    return (
        <View style={styles.container}>
            {/* ... JSX ... */}
            <Image
                source={require('../../assets/images/adaptive-icon.png')}
                style={styles.logo}
                contentFit='contain'
            />
            <ThemedText style={[styles.permissionText, { color: textColor }]}>Para continuar, precisamos da sua permissão para acessar:</ThemedText>
            <View style={styles.bulletList}>
                <ThemedText style={[styles.bulletItem, { color: textColor }]}>• Câmera</ThemedText>
                <ThemedText style={[styles.bulletItem, { color: textColor }]}>• Galeria</ThemedText>
                <ThemedText style={[styles.bulletItem, { color: textColor }]}>• Localização</ThemedText>
            </View>
            <View style={styles.buttonWrapper}>
                <Button
                    onPress={onRequestPermission}
                    title="Conceder Permissão"
                    color="#0047AB"
                />
            </View>
            <View style={[styles.buttonWrapper, styles.buttonSpacing]}>
                <Button
                    onPress={() => router.replace('/(tabs)/help?open=permissions')}
                    title="Negar Permissão"
                />
            </View>
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
        backgroundColor: Colors.global.light,
    },
    logo: {
        width: 200,
        height: 180,
        marginBottom: 30,
    },
    permissionText: {
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 8,
        lineHeight: 26,
        paddingHorizontal: 20,
        maxWidth: '90%',
    },
    buttonWrapper: {
        width: '70%',
    },
    buttonSpacing: {
        marginTop: 20,
    },
    bulletList: {
        width: '70%',
        alignItems: 'flex-start',
        marginBottom: 30,
    },
    bulletItem: {
        fontSize: 16,
        marginBottom: 6,
    }
});