import { Stack } from "expo-router";
import { CaptureSettingsProvider } from '../context/CaptureSettingsContext';
import { ARPayloadProvider } from '../context/ARPayloadContext';
import { useHideNavigationBar } from "../hooks/useNavigationBar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useEffect } from 'react';
import { probeARSupport } from '../hooks/useARSupport';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native';

// 🛠️ Expõe comandos de desenvolvimento no console
if (__DEV__) {
    import('../utils/devCommands').then((DevCommands) => {
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
        // probe AR support in background (non-blocking)
        try { probeARSupport().catch(() => { /* ignore */ }); } catch (e) { /* ignore */ }

        // Best-effort: prefetch nearby content metadata and a few thumbnails while app loads.
        // We intentionally don't block rendering on this; it's a background optimization.
        (async function prefetchNearby() {
            try {
                // Request permission but don't block if denied
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;

                // try last known first (fast), fallback to getCurrentPosition if needed
                let pos = await Location.getLastKnownPositionAsync();
                if (!pos) pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                if (!pos?.coords) return;
                const lat = Number(pos.coords.latitude.toFixed(4));
                const lon = Number(pos.coords.longitude.toFixed(4));
                const cacheKey = `@nearby_content_${lat}_${lon}`;

                // If we already have a recent cache, skip heavy fetch
                const existing = await AsyncStorage.getItem(cacheKey);
                if (existing) return;

                const base = process.env.EXPO_PUBLIC_BACKEND_URL || '';
                if (!base) return;
                const url = `${base.replace(/\/$/, '')}/api/content/nearby?lat=${lat}&lon=${lon}&radius_km=5`;

                // Short fetch with timeout (best-effort)
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3000);
                let resp;
                try {
                    resp = await fetch(url, { signal: controller.signal });
                } finally {
                    clearTimeout(timeout);
                }
                if (!resp || !resp.ok) return;
                const json = await resp.json();

                await AsyncStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: json }));

                // Collect up to 6 image urls to prefetch (thumbnails/headers)
                const imageUrls: string[] = [];
                if (Array.isArray(json?.blocks)) {
                    for (const blk of json.blocks) {
                        if (blk?.items && Array.isArray(blk.items)) {
                            for (const it of blk.items) {
                                const u = it?.signed_url || it?.signedUrl || it?.url;
                                if (u && imageUrls.length < 6) imageUrls.push(u);
                            }
                        }
                        if (blk?.signed_url && imageUrls.length < 6) imageUrls.push(blk.signed_url);
                        if (imageUrls.length >= 6) break;
                    }
                }

                await Promise.all(imageUrls.map(u => Image.prefetch(u)));
            } catch (e) {
                // ignore errors - prefetch is best-effort
            }
        })();
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