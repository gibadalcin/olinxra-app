import { useEffect, useState } from 'react';
import { Linking } from 'react-native';

// Module-level cache to avoid repeating probes across the app lifecycle.
let cachedSupportsAR: boolean | null = null;
let probingPromise: Promise<boolean> | null = null;

const SCENE_VIEWER_TEST_FILE = 'https://storage.googleapis.com/olinxra-public/sample.glb';
const SCENE_VIEWER_PROBE = (file: string) => `https://arvr.google.com/scene-viewer/1.2?file=${encodeURIComponent(file)}&mode=ar_preferred`;

export function getCachedARSupport(): boolean | null {
    return cachedSupportsAR;
}

export async function probeARSupport(): Promise<boolean> {
    // If already probing, return the same promise to dedupe concurrent calls.
    if (probingPromise) return probingPromise;
    if (cachedSupportsAR !== null) return cachedSupportsAR;

    probingPromise = (async () => {
        try {
            const probeUrl = SCENE_VIEWER_PROBE(SCENE_VIEWER_TEST_FILE);
            const can = await Linking.canOpenURL(probeUrl);
            cachedSupportsAR = Boolean(can);
        } catch (e) {
            cachedSupportsAR = false;
        } finally {
            probingPromise = null;
        }
        return cachedSupportsAR!;
    })();

    return probingPromise;
}

// React hook for components that want to read the cached value and trigger a
// probe if it's not available yet. The hook returns the cached value which may
// be null while probing.
export default function useARSupport(): boolean | null {
    const [value, setValue] = useState<boolean | null>(getCachedARSupport());

    useEffect(() => {
        let mounted = true;
        if (value === null) {
            probeARSupport().then((v) => { if (mounted) setValue(v); }).catch(() => { if (mounted) setValue(false); });
        }
        return () => { mounted = false; };
    }, [value]);

    return value;
}
