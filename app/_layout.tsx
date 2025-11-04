import { Stack } from "expo-router";
import { CaptureSettingsProvider } from '@/context/CaptureSettingsContext';
import { ARPayloadProvider } from '@/context/ARPayloadContext';
import { useHideNavigationBar } from "@/hooks/useNavigationBar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useEffect } from 'react';
import { probeARSupport } from '@/hooks/useARSupport';

// 🛠️ Expõe comandos de desenvolvimento no console
if (__DEV__) {
    import('@/utils/devCommands').then((DevCommands) => {
        (globalThis as any).dev = DevCommands;
        console.log('');
        console.log('🛠️  ========================================');
        console.log('🛠️  COMANDOS DE DEV DISPONÍVEIS');
        console.log('🛠️  ========================================');
        console.log('');
        console.log('   Digite: global.dev.help()');
        console.log('');
        console.log('🛠️  ========================================');
        console.log('');
    }).catch(() => { /* ignore */ });
}

export default function Layout() {
    // Esconde a barra de navegação do Android
    useHideNavigationBar();

    // Probe AR support in background while the app finishes loading so
    // downstream screens can use the cached result without triggering a
    // fresh probe.
    useEffect(() => {
        try { probeARSupport().catch(() => { /* ignore */ }); } catch (e) { /* ignore */ }
    }, []);

    // Wrapper de gestos para acessibilidade e navegação
    return (
        <CaptureSettingsProvider>
            <ARPayloadProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <StatusBar hidden />
                    <Stack
                        screenOptions={{
                            headerShown: false,
                        }}
                    />
                </GestureHandlerRootView>
            </ARPayloadProvider>
        </CaptureSettingsProvider>
    );
}