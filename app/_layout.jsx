import { Stack } from "expo-router";
import { useHideNavigationBar } from '@hooks/useNavigationBar'; // Hook customizado
import { GestureHandlerRootView } from 'react-native-gesture-handler'; // Importação CRÍTICA

export default function Layout() {
    // Garante que a barra de navegação do sistema Android seja escondida
    useHideNavigationBar();

    return (
        // CRÍTICO: Envolve todo o aplicativo com o wrapper de gestos
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack
                screenOptions={{
                    headerShown: false, // Esconde o cabeçalho em todas as telas
                }}
            />
        </GestureHandlerRootView>
    );
}