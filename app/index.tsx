import React, { useEffect, useState } from "react";
import { View, Animated, Image } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";

// Esconde o cabeçalho da Stack para esta página
export const options = {
    headerShown: false,
};

export default function Splash() {
    const [progress, setProgress] = useState(0);
    const fadeAnim = useState(new Animated.Value(1))[0];
    const router = useRouter();
    const logo = require("@/assets/images/logo-splash.png");

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    Animated.timing(fadeAnim, {
                        toValue: 0,
                        duration: 600,
                        useNativeDriver: true,
                    }).start(() => {
                        router.replace("/(tabs)/recognizer");
                    });
                    return 100;
                }
                return prev + 2;
            });
        }, 30);
        return () => clearInterval(interval);
    }, [fadeAnim, router]);

    return (
        <>
            <StatusBar hidden />
            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
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
                            width: "68%",
                            maxHeight: 160,
                            resizeMode: "contain",
                            marginTop: 0
                        }}
                        accessibilityLabel="Logo OlinxRA"
                    />
                    <ThemedText style={{ marginTop: -40, fontSize: 16, color: Colors.global.light }}>
                        Reconheça. Localize. Explore.
                    </ThemedText>

                    <View
                        style={{
                            position: "absolute",
                            bottom: 48,
                            width: "60%",
                            height: 6,
                            backgroundColor: Colors.light.tint,
                            justifyContent: "center",
                            borderRadius: 6,
                            overflow: "hidden",
                            marginBottom: 32
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
        </>
    );
}