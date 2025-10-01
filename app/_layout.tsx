import { Stack } from "expo-router";
import { useHideNavigationBar } from "@/hooks/useNavigationBar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function Layout() {
    // Esconde a barra de navegação do Android
    useHideNavigationBar();

    // Wrapper de gestos para acessibilidade e navegação
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack
                screenOptions={{
                    headerShown: false,
                }}
            />
        </GestureHandlerRootView>
    );
}