import React, { useRef, useState, useEffect, useCallback } from "react";
import { useCaptureSettings } from '../../../context/CaptureSettingsContext';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Dimensions } from "react-native";
import CustomHeader from '../../../components/CustomHeader';
import { CameraView, Camera } from "expo-camera";
import * as Location from 'expo-location';
import * as ImagePicker from "expo-image-picker";
import PermissionRequest from "../../../components/ui/PermissionRequest";
import { Colors } from "../../..//constants/Colors";
import { CameraMarkers } from "../../../components/ui/CameraMarkers";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { ImageDecisionModal } from "../../../components/ui/ImageDecisionModal";
import { CameraActions } from '../../../components/ui/CameraActions';
import Animated, { useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { BlurView } from "expo-blur";
import { Ionicons } from '@expo/vector-icons';

const AnimatedCameraView = Animated.createAnimatedComponent(CameraView);
const MAX_ZOOM = 0.8;
const MIN_ZOOM = 0;
// Constantes para sensibilidade do zoom
const ZOOM_SENSITIVITY = 0.05;
const ZOOM_MULTIPLIER = 10;

const headerTitle = "Capturar Logomarca";

type ImageSourceType = 'camera' | 'gallery' | null;

export default function RecognizerHome() {
    const { showOrientation } = useCaptureSettings();
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
        const locStatus = request
            ? await Location.requestForegroundPermissionsAsync()
            : await Location.getForegroundPermissionsAsync();
        const granted = cameraStatus.status === 'granted' && galleryStatus.status === 'granted' && locStatus.status === 'granted';
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

    if (hasPermission === null) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors["light"]?.background || "#fff"} /></View>;
    }
    if (hasPermission === false) {
        return <PermissionRequest onRequestPermission={() => handlePermissions(true)} />;
    }

    return (
        <View style={styles.container}>
            {/* Header customizado (agora reutilizável) sobreposto */}
            <View style={styles.headerOverlay} pointerEvents="box-none">
                <CustomHeader title={headerTitle} transparent />
            </View>
            <GestureDetector gesture={pinchGesture}>
                <View style={{ flex: 1 }}>
                    <AnimatedCameraView
                        ref={cameraRef}
                        style={styles.camera}
                        facing="back"
                        zoom={zoomLevel}
                    />
                    <CameraMarkers />
                </View>
            </GestureDetector>
            {/* Orientação sobreposta no topo com glass */}
            {showOrientation && (
                <BlurView intensity={20} tint="dark" style={styles.glassTop}>
                    <Text style={styles.glassText}>
                        Aponte a câmera para a logomarca e toque em {' '}
                        <Ionicons name="camera-outline" size={20} color={Colors["light"]?.background || "#ffffff"} />
                        {'  '}para capturar ou em {' '}
                        <Ionicons name="image-outline" size={20} color={Colors["light"]?.background || "#ffffff"} />
                        {'  '}para abrir a galeria.
                    </Text>
                </BlurView>
            )}
            {/* Botões e modais sobrepostos à câmera */}
            <View style={styles.overlayContainer} pointerEvents="box-none">
                {isProcessing && <ActivityIndicator size="large" color={Colors["light"]?.background || "#fff"} style={styles.activityIndicator} />}
                <CameraActions
                    onOpenGallery={openGallery}
                    onTakePicture={handleCapture}
                />
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
        </View>
    );
}

const styles = StyleSheet.create({
    headerIcon: {
        width: 32,
        height: 32,
        marginRight: 8,
        resizeMode: 'contain',
    },
    headerText: {
        fontSize: 20,
        height: 32,
        fontWeight: 'bold',
        color: Colors["light"]?.background || '#FFFFFF',
        textAlign: 'center',
        flex: 0,
        textShadowColor: 'rgba(0,0,0,0.12)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    overlayContainer: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "flex-end",
        alignItems: "center",
        pointerEvents: "box-none",
        paddingBottom: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors["global"]?.highlight || "#FFD700",
    },
    camera: {
        flex: 1,
        width: "100%",
        height: "100%",
    },
    description: {
        display: 'none',
    },
    glassTop: {
        position: 'absolute',
        top: '14%',
        left: '50%',
        width: '90%',
        transform: [{ translateX: -0.45 * Dimensions.get('window').width }],
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.18)', // mais transparente
        zIndex: 10,
        borderTopRightRadius: 8,
        borderBottomRightRadius: 8,
        borderColor: Colors.global.bg + '99' || "#ffffff",
        borderLeftWidth: 5,
        overflow: 'hidden',
        flexDirection: 'row',
    },
    glassText: {
        color: Colors["light"]?.background || "#ffffff",
        fontSize: 18,
        fontWeight: '500',
        textShadowColor: 'rgba(0,0,0,0.12)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
        lineHeight: 25
    },
    activityIndicator: {
        position: 'absolute',
        top: -10,
        zIndex: 10,
    },
    headerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
    },
});