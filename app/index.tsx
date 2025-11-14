import React, { useEffect, useState } from "react";
import { View, Animated, Image } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemedText } from "../components/ThemedText";
import { Colors } from "../constants/Colors";

// Esconde o cabeçalho da Stack para esta página
export const options = {
    headerShown: false,
};

export default function Splash() {
    const [progress, setProgress] = useState(0);
    const fadeAnim = useState(new Animated.Value(1))[0];
    const router = useRouter();
    const logo = require("../assets/images/logo-splash.png");

    useEffect(() => {
        // 1. Variável de controle (deve ser 'let' e inicializada)
        let animationFrameId: number | undefined;

        // 2. Definindo o ciclo de atualização de progresso
        const updateProgress = () => {
            // Usamos setProgress com a função de callback para garantir que usamos o valor 'prev'
            setProgress((prev) => {
                if (prev >= 100) {
                    // Se atingir 100%, paramos o loop e iniciamos o fade
                    if (animationFrameId) {
                        cancelAnimationFrame(animationFrameId);
                    }

                    Animated.timing(fadeAnim, {
                        toValue: 0,
                        duration: 600,
                        useNativeDriver: true,
                    }).start(() => {
                        router.replace("/_tabs/recognizer");
                    });
                    return 100;
                }

                // Calculamos o próximo progresso
                const nextProgress = prev + .5;

                // Agendamos o próximo frame ANTES de retornar o novo estado,
                // garantindo que o loop continue.
                animationFrameId = requestAnimationFrame(updateProgress);

                return nextProgress;
            });
        };

        // 3. Chamada inicial para começar o loop
        animationFrameId = requestAnimationFrame(updateProgress);

        // 4. Função de limpeza (cleanup) do useEffect
        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };

        // Adicione 'fadeAnim' às dependências se for uma ref/valor externo ao componente
    }, [router, fadeAnim]);

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