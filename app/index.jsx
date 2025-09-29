import React, { useEffect, useState } from "react";
import { View, Animated, Image } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useHideNavigationBar } from '../hooks/useNavigationBar';


// Esconde o cabeçalho da Stack para esta página
export const options = {
    headerShown: false,
};

export default function Splash() {
    const [progress, setProgress] = useState(0);
    const fadeAnim = useState(new Animated.Value(1))[0];
    const router = useRouter();
    useHideNavigationBar();

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
                        router.replace("/(tabs)");
                    });
                    return 100;
                }
                return prev + 2;
            });
        }, 30);

        return () => {
            clearInterval(interval);
        };
    }, []);

    return (
        <>
            <StatusBar hidden />
            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                <View style={{
                    flex: 1,
                    backgroundColor: "#0047AB",
                    justifyContent: "center",
                    alignItems: "center",
                    position: "relative"
                }}>
                    <Image
                        source={require("../assets/images/logo-splash.png")}
                        style={{
                            width: "60%",
                            height: "100%",
                            resizeMode: "contain",
                            marginBottom: "auto",
                            marginTop: "auto"
                        }}
                    />
                    <View style={{
                        position: "absolute",
                        bottom: 48,
                        width: "60%",
                        height: 6,
                        backgroundColor: "#B3CDE0",
                        justifyContent: 'center',
                        borderRadius: 6,
                        overflow: "hidden",
                        marginBottom: 32
                    }}>
                        <View style={{
                            width: `${progress}%`,
                            height: 6, // Corrigido: número, sem "px"
                            backgroundColor: "#fff"
                        }} />
                    </View>
                </View>
            </Animated.View>
        </>
    );
}