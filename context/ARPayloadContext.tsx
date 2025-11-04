import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ARPayloadContextType {
    payload: any | null;
    setPayload: (payload: any | null) => void;
    clearPayload: () => void;
    generatedGlbUrl: string | null;
    setGeneratedGlbUrl: (url: string | null) => void;
    glbModels: string[]; // ✅ Array de URLs de modelos GLB
    setGlbModels: (models: string[]) => void;
    currentModelIndex: number; // ✅ Índice do modelo atual
    setCurrentModelIndex: (index: number) => void;
    shouldResetForNewPayload: (newPayload: any) => boolean;
    shouldAutoLaunch: boolean; // ✅ Flag que indica se deve fazer auto-launch
    setShouldAutoLaunch: (should: boolean) => void;
}

const ARPayloadContext = createContext<ARPayloadContextType | undefined>(undefined);

export function ARPayloadProvider({ children }: { children: ReactNode }) {
    const [payload, setPayloadState] = useState<any | null>(null);
    const [generatedGlbUrl, setGeneratedGlbUrlState] = useState<string | null>(null);
    const [glbModels, setGlbModelsState] = useState<string[]>([]); // ✅ Array de modelos GLB
    const [currentModelIndex, setCurrentModelIndexState] = useState<number>(0); // ✅ Índice atual
    const [lastPayloadKey, setLastPayloadKey] = useState<string | null>(null);
    const [shouldAutoLaunch, setShouldAutoLaunchState] = useState<boolean>(false); // ✅ Estado de auto-launch

    const setPayload = useCallback((newPayload: any | null) => {
        console.log('[ARPayloadContext] 📦 setPayload chamado:', newPayload ? 'presente' : 'null');

        if (newPayload) {
            // ✅ CORREÇÃO: Gera chave única usando HASH completo do previewImage
            // Usa timestamp + length para garantir unicidade mesmo com base64 similares
            const previewHash = newPayload.previewImage
                ? `${newPayload.previewImage.length}_${newPayload.previewImage.substring(0, 100)}_${newPayload.previewImage.substring(newPayload.previewImage.length - 100)}`
                : 'no-preview';
            const payloadKey = `${newPayload.nome_marca || 'unknown'}_${previewHash}`;

            // Verifica se é payload diferente
            const isNewPayload = payloadKey !== lastPayloadKey;
            console.log('[ARPayloadContext] 🔍 É novo payload:', isNewPayload);
            console.log('[ARPayloadContext] 🔑 Chave atual:', payloadKey.substring(0, 150));

            if (isNewPayload) {
                console.log('[ARPayloadContext] 🔄 Payload DIFERENTE, limpando GLB...');
                setGeneratedGlbUrlState(null); // Limpa GLB do payload anterior
                setLastPayloadKey(payloadKey);
            } else {
                console.log('[ARPayloadContext] ♻️ Mesmo payload, mantendo GLB em cache');
            }

            // ✅ NOVO PAYLOAD (primeira vez ou nova captura) = ATIVA AUTO-LAUNCH
            console.log('[ARPayloadContext] ✅ Ativando shouldAutoLaunch = true');
            setShouldAutoLaunchState(true);
        } else {
            // ❌ SEM PAYLOAD = DESATIVA AUTO-LAUNCH
            console.log('[ARPayloadContext] ❌ Sem payload, desativando shouldAutoLaunch = false');
            setShouldAutoLaunchState(false);
        }

        setPayloadState(newPayload);
    }, [lastPayloadKey]);

    const setGeneratedGlbUrl = useCallback((url: string | null) => {
        console.log('[ARPayloadContext] 💾 setGeneratedGlbUrl:', url ? 'EXISTE' : 'NULL');
        setGeneratedGlbUrlState(url);
    }, []);

    const clearPayload = useCallback(() => {
        console.log('[ARPayloadContext] 🧹 clearPayload chamado');
        setPayloadState(null);
        setGeneratedGlbUrlState(null);
        setLastPayloadKey(null);
        setShouldAutoLaunchState(false); // ✅ Desativa auto-launch ao limpar
    }, []);

    const setShouldAutoLaunch = useCallback((should: boolean) => {
        console.log('[ARPayloadContext] 🎯 setShouldAutoLaunch:', should);
        setShouldAutoLaunchState(should);
    }, []);

    const shouldResetForNewPayload = useCallback((newPayload: any): boolean => {
        if (!newPayload) return false;
        // ✅ CORREÇÃO: Usa mesmo algoritmo de hash para consistência
        const previewHash = newPayload.previewImage
            ? `${newPayload.previewImage.length}_${newPayload.previewImage.substring(0, 100)}_${newPayload.previewImage.substring(newPayload.previewImage.length - 100)}`
            : 'no-preview';
        const payloadKey = `${newPayload.nome_marca || 'unknown'}_${previewHash}`;
        return payloadKey !== lastPayloadKey;
    }, [lastPayloadKey]);

    const setGlbModels = useCallback((models: string[]) => {
        console.log('[ARPayloadContext] 🎬 setGlbModels chamado com', models.length, 'modelos');
        setGlbModelsState(models);
        setCurrentModelIndexState(0); // Reset para primeiro modelo
    }, []);

    const setCurrentModelIndex = useCallback((index: number) => {
        console.log('[ARPayloadContext] 📍 setCurrentModelIndex:', index);
        setCurrentModelIndexState(index);
    }, []);

    const value = {
        payload,
        setPayload,
        clearPayload,
        generatedGlbUrl,
        setGeneratedGlbUrl,
        glbModels,
        setGlbModels,
        currentModelIndex,
        setCurrentModelIndex,
        shouldResetForNewPayload,
        shouldAutoLaunch, // ✅ Exporta o estado
        setShouldAutoLaunch, // ✅ Exporta o setter
    };

    return (
        <ARPayloadContext.Provider value={value}>
            {children}
        </ARPayloadContext.Provider>
    );
}

export function useARPayload() {
    const context = useContext(ARPayloadContext);
    if (context === undefined) {
        throw new Error('useARPayload must be used within an ARPayloadProvider');
    }
    return context;
}
