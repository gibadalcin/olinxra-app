// Global AR session gate to prevent opening multiple native AR viewers at once.
// Module-level state persists across component unmounts in the same JS runtime.

let _active = false;
let _modelKey: string | null = null;
let _startedAt = 0;

function modelKeyFromUrl(url?: string | null): string | null {
    if (!url || typeof url !== 'string') return null;
    try {
        // Normalize by stripping query/fragment and lowercasing host if present
        const qIndex = url.indexOf('?');
        const hIndex = url.indexOf('#');
        const cut = Math.min(qIndex === -1 ? url.length : qIndex, hIndex === -1 ? url.length : hIndex);
        return url.slice(0, cut);
    } catch {
        return url;
    }
}

export function isARActive(): boolean {
    console.log('[arGate] 🔍 isARActive chamado, retornando:', _active);
    return _active;
}

export function isSameARModel(url?: string | null): boolean {
    if (!_active) {
        console.log('[arGate] 🔍 isSameARModel: AR não está ativa');
        return false;
    }
    const key = modelKeyFromUrl(url);
    const isSame = !!key && key === _modelKey;
    console.log('[arGate] 🔍 isSameARModel:', isSame, '| key:', key?.substring(0, 80), '| _modelKey:', _modelKey?.substring(0, 80));
    return isSame;
}

export function activateAR(url?: string | null): void {
    const key = modelKeyFromUrl(url);
    console.log('[arGate] 🔓 activateAR chamado');
    console.log('[arGate]   - URL:', url?.substring(0, 100));
    console.log('[arGate]   - Key normalizada:', key?.substring(0, 100));
    console.log('[arGate]   - Antes: _active =', _active, ', _modelKey =', _modelKey?.substring(0, 80));
    _active = true;
    _modelKey = key;
    _startedAt = Date.now();
    console.log('[arGate]   - Depois: _active =', _active, ', _modelKey =', _modelKey?.substring(0, 80));
}

export function deactivateAR(): void {
    console.log('[arGate] 🔒 deactivateAR chamado');
    console.log('[arGate]   - Antes: _active =', _active);
    _active = false;
    _modelKey = null;
    _startedAt = 0;
    console.log('[arGate]   - Depois: _active =', _active);
}

// Optional: expose current state for debugging
export function getARState() {
    return { active: _active, modelKey: _modelKey, startedAt: _startedAt };
}
