import React, { useRef, useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator, Alert } from "react-native";
import { CameraView, Camera } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import PermissionRequest from "../../../components/ui/PermissionRequest";
import { Colors } from "../../../constants/Colors";
import { CameraMarkers } from "../../../components/ui/CameraMarkers";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Slider from '@react-native-community/slider'; // instale com: expo install @react-native-community/slider

const { width, height } = Dimensions.get("window");
const MAX_ZOOM = 0.4; // valor seguro para evitar crash/foco
const MIN_ZOOM = 0;

export default function RecognizerHome() {
    const cameraRef = useRef(null);
    const [hasPermission, setHasPermission] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(0);

    // Handler de gesto de pinça otimizado (DESCOMENTE PARA DEPLOY NATIVO)
    /*
    const pinchGesture = Gesture.Pinch()
        .onUpdate((event) => {
            let nextZoom = (event.scale - 1) / 4;
            nextZoom = Math.max(MIN_ZOOM, Math.min(nextZoom, MAX_ZOOM));
            setZoomLevel(nextZoom);
        });
    */

    // Helpers de permissão
    const checkAllPermissions = useCallback(async () => {
        const cameraStatus = await Camera.getCameraPermissionsAsync();
        const galleryStatus = await ImagePicker.getMediaLibraryPermissionsAsync();
        const granted = cameraStatus.status === 'granted' && galleryStatus.status === 'granted';
        setHasPermission(granted);
        return granted;
    }, []);

    const requestAllPermissions = useCallback(async () => {
        const cameraStatus = await Camera.requestCameraPermissionsAsync();
        const galleryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
        const granted = cameraStatus.status === 'granted' && galleryStatus.status === 'granted';
        setHasPermission(granted);
    }, []);

    useEffect(() => {
        checkAllPermissions();
    }, [checkAllPermissions]);

    const openGallery = async () => {
        if (isProcessing) return;
        if (!(await checkAllPermissions())) {
            Alert.alert("Permissão Necessária", "Conceda permissão à galeria para continuar.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 1,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
            // await processImage(result.assets[0].uri);
        }
    };

    const handleCapture = async () => {
        if (cameraRef.current && !isProcessing) {
            setIsProcessing(true);
            if (!(await checkAllPermissions())) {
                Alert.alert("Permissão Necessária", "Conceda permissão à câmera para capturar.");
                setIsProcessing(false);
                return;
            }
            const photo = await cameraRef.current.takePictureAsync();
            // await processImage(photo.uri);
            setIsProcessing(false);
        }
    };

    const toggleTorch = () => {
        setTorchOn((prev) => !prev);
    };

    // Renderização
    if (hasPermission === null) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#fff" /></View>;
    }
    if (hasPermission === false) {
        return <PermissionRequest onRequestPermission={requestAllPermissions} />;
    }

    return (
        <View style={styles.container}>
            {/* DESCOMENTE PARA DEPLOY NATIVO */}
            {/*
            <GestureDetector gesture={pinchGesture}>
                <View style={styles.camera}>
                    <CameraView
                        ref={cameraRef}
                        style={{ width: "100%", height: "100%" }}
                        facing="back"
                        torch={torchOn ? "on" : "off"}
                        zoom={zoomLevel}
                    />
                    <CameraMarkers />
                </View>
            </GestureDetector>
            */}
            {/* COMENTE PARA DEPLOY NATIVO */}
            <View style={styles.camera}>
                <CameraView
                    ref={cameraRef}
                    style={{ width: "100%", height: "100%" }}
                    facing="back"
                    torch={torchOn ? "on" : "off"}
                    zoom={zoomLevel}
                />
                <CameraMarkers />
            </View>
            {/* COMENTE PARA DEPLOY NATIVO */}
            <Slider
                style={{ width: 200, alignSelf: 'center', marginTop: 12 }}
                minimumValue={MIN_ZOOM}
                maximumValue={MAX_ZOOM}
                value={zoomLevel}
                onValueChange={setZoomLevel}
                minimumTrackTintColor="#012E57"
                maximumTrackTintColor="#ccc"
            />
            <Text style={styles.description}>
                Aponte a câmera para a logomarca e toque para capturar.
            </Text>
            <View style={styles.actions}>
                {isProcessing && <ActivityIndicator size="large" color="#fff" style={styles.activityIndicator} />}
                <View style={{ justifyContent: "center", alignItems: "center", width: "100%", position: "relative" }}>
                    <TouchableOpacity style={styles.galleryButton} onPress={openGallery} disabled={isProcessing}>
                        <View style={{ alignItems: "center" }}>
                            <Ionicons name="images" size={40} color={Colors["light"]?.tabIconDefault} />
                            <Text style={styles.galleryLabel}>Galeria</Text>
                        </View>
                    </TouchableOpacity>
                    <View style={styles.captureCircle}>
                        <TouchableOpacity style={styles.captureButton} onPress={handleCapture} disabled={isProcessing}>
                            <Ionicons name="camera-outline" size={36} color={Colors["light"]?.background} />
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                        style={styles.flashButton}
                        onPress={toggleTorch}
                        disabled={isProcessing}
                    >
                        <View style={{ alignItems: "center" }}>
                            <Ionicons
                                name={torchOn ? "flashlight" : "flashlight-outline"}
                                size={40}
                                color={torchOn ? Colors["light"]?.tabIconSelected : Colors["light"]?.tabIconDefault}
                            />
                            <Text style={styles.flashLabel}>Lanterna</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        backgroundColor: Colors["light"]?.background || "#012E57",
        paddingTop: 32,
    },
    contentButtons: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Colors["light"]?.tint || "#012E57",
        width: "100%",
        position: "relative",
        height: 100,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors["light"]?.highlight || "#FFD700",
    },
    camera: {
        width: width * 0.9,
        height: height * 0.48,
        borderRadius: 8,
        overflow: "hidden",
    },
    description: {
        marginTop: 24,
        color: Colors["light"]?.text || "#151515ff",
        fontSize: 18,
        textAlign: "center",
        width: width * 0.9,
    },
    actions: {
        flexDirection: "row",
        alignItems: "flex-end",
        marginTop: 24,
        width: width * 0.9,
        justifyContent: "center",
        position: "relative",
    },
    captureCircle: {
        width: 84,
        height: 84,
        borderRadius: 55,
        backgroundColor: Colors["global"]?.blueDark || "#012E57",
        alignItems: "center",
        justifyContent: "center",
        marginHorizontal: 20,
        shadowColor: Colors["global"]?.dark || "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
        flexDirection: "row",
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "transparent",
        borderWidth: 4,
        borderColor: Colors["light"]?.background || "#ffffff",
        alignItems: "center",
        justifyContent: "center",
    },
    flashButton: {
        position: "absolute",
        right: 20,
        bottom: 4,
        width: 54,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
        borderRadius: 0,
        borderWidth: 0,
        elevation: 0,
    },
    flashLabel: {
        fontSize: 12,
        color: Colors["light"]?.tabIconDefault || "#fff",
        marginTop: 2,
        textAlign: "center"
    },
    galleryButton: {
        position: "absolute",
        left: 20,
        bottom: 4,
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
        borderRadius: 0,
        borderWidth: 0,
        elevation: 0,
    },
    galleryLabel: {
        fontSize: 12,
        color: Colors["light"]?.tabIconDefault || "#fff",
        marginTop: 2,
        textAlign: "center"
    },
    activityIndicator: {
        position: 'absolute',
        top: -10,
        zIndex: 10,
    },
});