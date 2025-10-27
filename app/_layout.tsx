import { Stack } from "expo-router";
import { CaptureSettingsProvider } from '@/context/CaptureSettingsContext';
import { useHideNavigationBar } from "@/hooks/useNavigationBar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { probeARSupport } from '@/hooks/useARSupport';

export default function Layout() {
    // Esconde a barra de navegação do Android
    useHideNavigationBar();

    // Attempt anonymous Firebase auth silently so the app can request signed URLs when available.
    // Errors are intentionally ignored here to avoid interfering with the UI flow.
    useEffect(() => {
        let unsub: any = null;
        try {
            unsub = onAuthStateChanged(auth, async (user) => {
                if (!user) {
                    try {
                        await signInAnonymously(auth);
                    } catch (_e) {
                        // silent: ignore auth errors while focusing on rendering
                    }
                }
            });
        } catch (_e) {
            // ignore
        }
        // Probe AR support in background while the app finishes loading so
        // downstream screens can use the cached result without triggering a
        // fresh probe.
        try { probeARSupport().catch(() => { /* ignore */ }); } catch (e) { /* ignore */ }
        return () => { try { if (unsub) unsub(); } catch (e) { } };
    }, []);

    // Wrapper de gestos para acessibilidade e navegação
    return (
        <CaptureSettingsProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <StatusBar hidden />
                <Stack
                    screenOptions={{
                        headerShown: false,
                    }}
                />
            </GestureHandlerRootView>
        </CaptureSettingsProvider>
    );
}