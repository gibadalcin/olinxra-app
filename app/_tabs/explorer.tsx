import { View, Text, Alert } from "react-native";
import React, { useEffect, useState, useCallback } from 'react';
import PermissionRequest from '../../components/ui/PermissionRequest';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

export default function ExplorerScreen() {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);

    const checkPermissions = useCallback(async () => {
        try {
            const cam = await Camera.getCameraPermissionsAsync();
            const gal = await ImagePicker.getMediaLibraryPermissionsAsync();
            const loc = await Location.getForegroundPermissionsAsync();
            const ok = cam.status === 'granted' && gal.status === 'granted' && loc.status === 'granted';
            setHasPermission(ok);
        } catch (e) {
            setHasPermission(false);
        }
    }, []);

    useEffect(() => {
        checkPermissions();
    }, [checkPermissions]);

    const requestAllPermissions = useCallback(async () => {
        try {
            const cam = await Camera.requestCameraPermissionsAsync();
            const gal = await ImagePicker.requestMediaLibraryPermissionsAsync();
            const loc = await Location.requestForegroundPermissionsAsync();
            const ok = cam.status === 'granted' && gal.status === 'granted' && loc.status === 'granted';
            setHasPermission(ok);
            if (!ok) {
                Alert.alert('Permissões necessárias', 'Algumas permissões ainda estão negadas. Você pode ativá-las nas configurações.');
            }
        } catch (e) {
            Alert.alert('Erro', 'Falha ao solicitar permissões.');
        }
    }, []);

    if (hasPermission === null) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <Text>Verificando permissões...</Text>
            </View>
        );
    }

    if (hasPermission === false) {
        return <PermissionRequest onRequestPermission={requestAllPermissions} />;
    }

    return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text>Aqui será o conteúdo da tela Explorar</Text>
        </View>
    );
}