import React, { useRef, useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, Alert } from "react-native";
import { CameraView, Camera } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import PermissionRequest from "@/components/ui/PermissionRequest";
import { Colors } from "@/constants/Colors";
import { CameraMarkers } from "@/components/ui/CameraMarkers";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { ImageDecisionModal } from "@/components/ui/ImageDecisionModal";
import { CameraActions } from '@/components/ui/CameraActions';
import Animated, { useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const { width, height } = Dimensions.get("window");
const AnimatedCameraView = Animated.createAnimatedComponent(CameraView);
const MAX_ZOOM = 0.8;
const MIN_ZOOM = 0;
// Constantes para sensibilidade do zoom
const ZOOM_SENSITIVITY = 0.05;
const ZOOM_MULTIPLIER = 10;

type ImageSourceType = 'camera' | 'gallery' | null;

export default function RecognizerHome() {
    // Tipagem correta para useRef (não é preciso usar 'any' para a CameraView)
    const cameraRef = useRef<CameraView>(null);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [zoomLevel, setZoomLevel] = useState<number>(0);
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [capturedImage, setCapturedImage] = useState<string>("");
    const [imageSource, setImageSource] = useState<ImageSourceType>(null);

    const animatedZoom = useSharedValue(0);
    const startZoom = useRef(0);
    const setZoomSafely = useCallback((value: number) => {
        setZoomLevel(value);
    }, []);

    const pinchGesture = Gesture.Pinch()
        .onStart(() => {
            startZoom.current = animatedZoom.value;
        })
        .onUpdate((event) => {
            let newZoom = startZoom.current + (event.scale - 1) * ZOOM_SENSITIVITY * ZOOM_MULTIPLIER;
            newZoom = Math.max(MIN_ZOOM, Math.min(newZoom, MAX_ZOOM));
            animatedZoom.value = newZoom;
            scheduleOnRN(setZoomSafely, newZoom);
        })
        .onEnd(() => {
            scheduleOnRN(setZoomSafely, animatedZoom.value);
        });


    // Helper único de permissão
    const handlePermissions = useCallback(async (request: boolean = false) => {
        const cameraStatus = request
            ? await Camera.requestCameraPermissionsAsync()
            : await Camera.getCameraPermissionsAsync();
        const galleryStatus = request
            ? await ImagePicker.requestMediaLibraryPermissionsAsync()
            : await ImagePicker.getMediaLibraryPermissionsAsync();
        const granted = cameraStatus.status === 'granted' && galleryStatus.status === 'granted';
        setHasPermission(granted);
        return granted;
    }, []);

    useEffect(() => {
        handlePermissions();
    }, [handlePermissions]);

    const openGallery = useCallback(async () => {
        if (isProcessing) return;
        if (!(await handlePermissions())) {
            Alert.alert("Permissão Necessária", "Conceda permissão à galeria para continuar.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            quality: 1,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
            setCapturedImage(result.assets[0].uri);
            setImageSource('gallery');
            setModalVisible(true);
        }
    }, [isProcessing, handlePermissions]);

    const handleCapture = useCallback(async () => {
        if (cameraRef.current && !isProcessing) {
            setIsProcessing(true);
            if (!(await handlePermissions())) {
                Alert.alert("Permissão Necessária", "Conceda permissão à câmera para capturar.");
                setIsProcessing(false);
                return;
            }
            const photo = await cameraRef.current.takePictureAsync();
            setCapturedImage(photo.uri);
            setImageSource('camera');
            setModalVisible(true);
            setIsProcessing(false);
        }
    }, [cameraRef, isProcessing, handlePermissions]);

    const openHistory = useCallback(() => {
        // lógica para abrir histórico/salvos
    }, []);

    // Renderização
    if (hasPermission === null) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors["light"]?.background || "#fff"} /></View>;
    }
    if (hasPermission === false) {
        return <PermissionRequest onRequestPermission={() => handlePermissions(true)} />;
    }

    return (
        <View style={styles.container}>
            <GestureDetector gesture={pinchGesture}>
                <View style={styles.camera}>
                    <AnimatedCameraView
                        ref={cameraRef}
                        style={{ width: "100%", height: "100%" }}
                        facing="back"
                        zoom={zoomLevel}
                    />
                    <CameraMarkers />
                </View>
            </GestureDetector>

            <Text style={styles.description}>
                Aponte a câmera para a logomarca e toque para capturar.
            </Text>
            <View>
                {isProcessing && <ActivityIndicator size="large" color={Colors["light"]?.background || "#fff"} style={styles.activityIndicator} />}
                <CameraActions
                    onOpenGallery={openGallery}
                    onTakePicture={handleCapture}
                    onOpenHistory={openHistory}
                />
            </View>
            <ImageDecisionModal
                visible={modalVisible}
                imageUri={capturedImage}
                onCancel={() => {
                    setModalVisible(false);
                    setCapturedImage("");
                    setImageSource(null);
                }}
                saveDisabled={isProcessing}
                imageSource={imageSource}
            />
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
        backgroundColor: Colors["global"]?.highlight || "#FFD700",
    },
    camera: {
        width: width * 0.9,
        height: height * 0.5,
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