import { Stack } from "expo-router";
import { CaptureSettingsProvider } from '@/context/CaptureSettingsContext';
import { useHideNavigationBar } from "@/hooks/useNavigationBar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function Layout() {
    // Esconde a barra de navegação do Android
    useHideNavigationBar();

    // Wrapper de gestos para acessibilidade e navegação
    return (
        <CaptureSettingsProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <Stack
                    screenOptions={{
                        headerShown: false,
                    }}
                />
            </GestureHandlerRootView>
        </CaptureSettingsProvider>
    );
}