import React, { useEffect } from "react";
import { Animated, View, Image } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Colors } from "../constants/Colors";
import { useSplashFade } from "../context/SplashFadeContext";

export default function GlobalSplashOverlay() {
    const [progress, setProgress] = React.useState(0);
    const slideAnim = React.useState(new Animated.Value(0))[0]; // 0 = tela cheia, 1 = fora da tela
    const { cameraReady } = useSplashFade();
    const logo = require("../assets/images/logo-splash.png");

    useEffect(() => {
        let animationFrameId: number | undefined;
        const updateProgress = () => {
            setProgress((prev) => {
                if (prev >= 100) {
                    if (animationFrameId) cancelAnimationFrame(animationFrameId);
                    return 100;
                }
                animationFrameId = requestAnimationFrame(updateProgress);
                return prev + 0.5;
            });
        };
        animationFrameId = requestAnimationFrame(updateProgress);
        return () => { if (animationFrameId) cancelAnimationFrame(animationFrameId); };
    }, []);

    useEffect(() => {
        if (progress >= 100 && cameraReady) {
            Animated.timing(slideAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }).start();
        }
    }, [progress, cameraReady, slideAnim]);

    // Só renderiza se não terminou o slide
    if (progress < 100 || !cameraReady) {
        return (
            <Animated.View
                style={{
                    flex: 1,
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    zIndex: 999,
                    transform: [
                        {
                            translateX: slideAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, -1000], // desliza para a esquerda
                            })
                        }
                    ]
                }}
                pointerEvents="none"
            >
                <StatusBar hidden />
                <View
                    style={{
                        flex: 1,
                        backgroundColor: Colors.light.splashBackground,
                        justifyContent: "center",
                        alignItems: "center",
                        position: "relative"
                    }}
                    accessible
                    accessibilityLabel="Tela de carregamento OlinxRA"
                >
                    <Image
                        source={logo}
                        style={{
                            width: "78%",
                            maxHeight: 160,
                            resizeMode: "contain",
                            marginTop: -20
                        }}
                        accessibilityLabel="Logo OlinxRA"
                    />
                    <View
                        style={{
                            position: "absolute",
                            bottom: 48,
                            width: "68%",
                            height: 6,
                            backgroundColor: Colors.light.tint,
                            justifyContent: "center",
                            borderRadius: 6,
                            overflow: "hidden",
                            marginBottom: 28
                        }}
                        accessible
                        accessibilityLabel="Barra de progresso"
                    >
                        <View
                            style={{
                                width: `${progress}%`,
                                height: 6,
                                backgroundColor: Colors.light.splashProgressBg
                            }}
                        />
                    </View>
                </View>
            </Animated.View>
        );
    }
    return null;
}