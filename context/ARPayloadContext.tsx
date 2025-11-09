import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import * as FileSystem from 'expo-file-system';
// tentativa de usar legacy quando disponível (compat com SDKs antigos)
let FileSystemLegacy: any = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    FileSystemLegacy = require('expo-file-system/legacy');
} catch (e) {
    FileSystemLegacy = null;
}

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
    // mapa filename -> uri local para imagens (ex: header)
    headerLocalMap?: Record<string, string>;
    // função para pré-carregar imagens de um payload sem alterar o payload atual
    prefetchImagesForPayload?: (payload: any | null) => void;
    // pré-carrega o header e aguarda até que o filename seja resolvido para um uri local ou até timeout
}

const ARPayloadContext = createContext<ARPayloadContextType | undefined>(undefined);

export function ARPayloadProvider({ children }: { children: ReactNode }) {
    const [payload, setPayloadState] = useState<any | null>(null);
    const [generatedGlbUrl, setGeneratedGlbUrlState] = useState<string | null>(null);
    const [glbModels, setGlbModelsState] = useState<string[]>([]); // ✅ Array de modelos GLB
    const [currentModelIndex, setCurrentModelIndexState] = useState<number>(0); // ✅ Índice atual
    // mapa filename -> local uri para imagens importantes (ex: header)
    const [headerLocalMap, setHeaderLocalMap] = useState<Record<string, string>>({});
    // evita downloads duplicados: map dest -> promise
    const inFlightDownloadsRef = React.useRef<Record<string, Promise<string | null>>>({});
    const [lastPayloadKey, setLastPayloadKey] = useState<string | null>(null);
    const [shouldAutoLaunch, setShouldAutoLaunchState] = useState<boolean>(false); // ✅ Estado de auto-launch

    const setPayload = useCallback((newPayload: any | null) => {
        console.log('[ARPayloadContext] 📦 setPayload chamado:', newPayload ? 'presente' : 'null', new Date().toISOString());

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

        // Iniciar download antecipado de todas as imagens encontradas no payload
        // Não aguardamos o resultado aqui; rodamos em background.
        if (newPayload) {
            (async () => {
                try {
                    const blocosRoot = newPayload?.blocos?.blocos || newPayload?.blocos || [];

                    const entries: Array<{ filename: string; url: string }> = [];

                    const pushIfImage = (obj: any) => {
                        if (!obj) return;
                        const url = obj?.preview_signed_url || obj?.previewSignedUrl || obj?.signed_url || obj?.signedUrl || obj?.url || obj?.previewDataUrl;
                        if (!url || String(url).startsWith('data:')) return;
                        const filename = obj?.filename || obj?.nome || String(url.split('/').pop());
                        if (entries.find((e) => e.filename === filename)) return;
                        // heurística simples para identificar header/topo: subtipo 'header' ou nome contendo 'topo'
                        const isHeader = (String(obj?.subtipo || '')).toLowerCase() === 'header' || String(filename).toLowerCase().includes('topo');
                        if (isHeader) {
                            // prioriza header no início da lista
                            entries.unshift({ filename, url });
                        } else {
                            entries.push({ filename, url });
                        }
                    };

                    if (Array.isArray(blocosRoot)) {
                        for (const b of blocosRoot) {
                            pushIfImage(b);
                            // items (carousel, gallery)
                            if (b?.items && Array.isArray(b.items)) {
                                for (const it of b.items) pushIfImage(it);
                            }
                        }
                    }

                    if (entries.length === 0) return;
                    console.log('[ARPayloadContext] 🔁 Iniciando download antecipado de imagens:', entries.length, new Date().toISOString());

                    const getCacheDir = () => {
                        return (FileSystem as any).cacheDirectory || (FileSystem as any).cacheDirectoryUri || (FileSystem as any).documentDirectory || '';
                    };

                    const cacheDir = getCacheDir();
                    if (!cacheDir) return;

                    // helper: realiza download com deduplicação por destino
                    const downloadWithDedup = async (url: string, dest: string): Promise<string | null> => {
                        const key = dest;
                        const existing = inFlightDownloadsRef.current[key];
                        if (existing) {
                            try {
                                return await existing;
                            } catch (e) {
                                return null;
                            }
                        }

                        const p = (async () => {
                            try {
                                const info = FileSystemLegacy?.getInfoAsync
                                    ? await FileSystemLegacy.getInfoAsync(dest)
                                    : await (FileSystem as any).getInfoAsync(dest);
                                if (info.exists) {
                                    return info.uri;
                                }

                                console.log('[ARPayloadContext] ▶️ iniciando download:', url, '->', dest, new Date().toISOString());
                                const startDl = Date.now();
                                let dl: any = null;
                                if ((FileSystem as any).downloadAsync) {
                                    dl = await (FileSystem as any).downloadAsync(url, dest);
                                } else if ((FileSystem as any).createDownloadResumable) {
                                    const rr = (FileSystem as any).createDownloadResumable(url, dest);
                                    dl = await rr.downloadAsync();
                                } else if (FileSystemLegacy && FileSystemLegacy.downloadAsync) {
                                    dl = await FileSystemLegacy.downloadAsync(url, dest);
                                } else if ((FileSystem as any).downloadFile) {
                                    const maybe = (FileSystem as any).downloadFile({ from: url, to: dest });
                                    if (maybe && typeof maybe.then === 'function') {
                                        dl = await maybe;
                                    } else {
                                        throw new Error('downloadFile API present but not promise-based');
                                    }
                                } else {
                                    throw new Error('No compatible FileSystem download API available');
                                }

                                const uri = (dl && (dl.uri || dl?.result?.uri)) || dest;
                                const status = dl && (dl.status || dl?.result?.status) || 200;
                                const took = Date.now() - startDl;
                                if (status >= 200 && status < 300) {
                                    console.log('[ARPayloadContext] ✅ Arquivo baixado em background:', uri, 'took(ms):', took, new Date().toISOString());
                                    return uri;
                                }
                                throw new Error('download returned status ' + status);
                            } catch (err) {
                                console.warn('[ARPayloadContext] download failed for', url, (err as any)?.message || err, new Date().toISOString());
                                throw err;
                            } finally {
                                // will be cleaned by caller via finally block
                            }
                        })();

                        inFlightDownloadsRef.current[key] = p;
                        try {
                            const res = await p;
                            return res;
                        } catch (e) {
                            return null;
                        } finally {
                            delete inFlightDownloadsRef.current[key];
                        }
                    };

                    for (const entry of entries) {
                        try {
                            const dest = `${cacheDir}olx_header_${encodeURIComponent(String(entry.filename))}`;
                            const existingInfo = FileSystemLegacy?.getInfoAsync
                                ? await FileSystemLegacy.getInfoAsync(dest)
                                : await (FileSystem as any).getInfoAsync(dest);
                            if (existingInfo.exists) {
                                console.log('[ARPayloadContext] ✅ arquivo já existe em cache:', entry.filename, existingInfo.uri, new Date().toISOString());
                                setHeaderLocalMap((prev) => ({ ...prev, [entry.filename]: existingInfo.uri }));
                                continue;
                            }

                            const uri = await downloadWithDedup(entry.url, dest);
                            if (uri) {
                                setHeaderLocalMap((prev) => ({ ...prev, [entry.filename]: uri }));
                            }
                        } catch (e) {
                            console.warn('[ARPayloadContext] falha no download antecipado da imagem', entry.filename, (e as any)?.message || e);
                        }
                    }
                    console.log('[ARPayloadContext] 🔁 download antecipado loop finalizado em', new Date().toISOString());
                } catch (e) {
                    // swallow
                }
            })();
        }
    }, [lastPayloadKey]);

    // Função pública para pré-carregar imagens de um payload sem alterar o payload atual
    const prefetchImagesForPayload = useCallback((newPayload: any | null) => {
        if (!newPayload) return;
        (async () => {
            try {
                const blocosRoot = newPayload?.blocos?.blocos || newPayload?.blocos || [];

                const entries: Array<{ filename: string; url: string }> = [];

                const pushIfImage = (obj: any) => {
                    if (!obj) return;
                    const url = obj?.preview_signed_url || obj?.previewSignedUrl || obj?.signed_url || obj?.signedUrl || obj?.url || obj?.previewDataUrl;
                    if (!url || String(url).startsWith('data:')) return;
                    const filename = obj?.filename || obj?.nome || String(url.split('/').pop());
                    if (entries.find((e) => e.filename === filename)) return;
                    const isHeader = (String(obj?.subtipo || '')).toLowerCase() === 'header' || String(filename).toLowerCase().includes('topo');
                    if (isHeader) {
                        entries.unshift({ filename, url });
                    } else {
                        entries.push({ filename, url });
                    }
                };

                if (Array.isArray(blocosRoot)) {
                    for (const b of blocosRoot) {
                        pushIfImage(b);
                        if (b?.items && Array.isArray(b.items)) {
                            for (const it of b.items) pushIfImage(it);
                        }
                    }
                }

                if (entries.length === 0) return;
                console.log('[ARPayloadContext] 🔁 prefetchImagesForPayload iniciando download de imagens:', entries.length, new Date().toISOString());

                const getCacheDir = () => {
                    return (FileSystem as any).cacheDirectory || (FileSystem as any).cacheDirectoryUri || (FileSystem as any).documentDirectory || '';
                };

                const cacheDir = getCacheDir();
                if (!cacheDir) return;

                for (const entry of entries) {
                    try {
                        const dest = `${cacheDir}olx_header_${encodeURIComponent(String(entry.filename))}`;
                        const info = FileSystemLegacy?.getInfoAsync
                            ? await FileSystemLegacy.getInfoAsync(dest)
                            : await (FileSystem as any).getInfoAsync(dest);
                        if (info.exists) {
                            console.log('[ARPayloadContext] ✅ prefetch: arquivo já existe em cache:', entry.filename, info.uri, new Date().toISOString());
                            setHeaderLocalMap((prev) => ({ ...prev, [entry.filename]: info.uri }));
                            continue;
                        }

                        console.log('[ARPayloadContext] ▶️ prefetch iniciando download:', entry.filename, entry.url, '->', dest, new Date().toISOString());
                        const startDl2 = Date.now();
                        try {
                            let dl2: any = null;
                            if ((FileSystem as any).downloadAsync) {
                                dl2 = await (FileSystem as any).downloadAsync(entry.url, dest);
                            } else if ((FileSystem as any).createDownloadResumable) {
                                const rr2 = (FileSystem as any).createDownloadResumable(entry.url, dest);
                                dl2 = await rr2.downloadAsync();
                            } else if (FileSystemLegacy && FileSystemLegacy.downloadAsync) {
                                dl2 = await FileSystemLegacy.downloadAsync(entry.url, dest);
                            } else if ((FileSystem as any).downloadFile) {
                                const maybe2 = (FileSystem as any).downloadFile({ from: entry.url, to: dest });
                                if (maybe2 && typeof maybe2.then === 'function') {
                                    dl2 = await maybe2;
                                } else {
                                    throw new Error('downloadFile API present but not promise-based');
                                }
                            } else {
                                throw new Error('No compatible FileSystem download API available');
                            }

                            const uri = (dl2 && (dl2.uri || dl2?.result?.uri)) || dest;
                            const status2 = dl2 && (dl2.status || dl2?.result?.status) || 200;
                            const took2 = Date.now() - startDl2;
                            if (status2 >= 200 && status2 < 300) {
                                console.log('[ARPayloadContext] ✅ prefetch imagem baixada:', entry.filename, uri, 'took(ms):', took2, new Date().toISOString());
                                setHeaderLocalMap((prev) => ({ ...prev, [entry.filename]: uri }));
                            } else {
                                console.warn('[ARPayloadContext] prefetch download returned status', status2, dl2, 'took(ms):', took2, new Date().toISOString());
                            }
                        } catch (e) {
                            console.warn('[ARPayloadContext] prefetchImagesForPayload falha no download:', entry.filename, (e as any)?.message || e, new Date().toISOString());
                        }
                    } catch (e) {
                        console.warn('[ARPayloadContext] prefetchImagesForPayload falha no download:', entry.filename, (e as any)?.message || e);
                    }
                }
                console.log('[ARPayloadContext] 🔁 prefetchImagesForPayload loop finalizado em', new Date().toISOString());
            } catch (e) {
                // swallow
            }
        })();
    }, []);

    // pré-carrega o header e aguarda um filename específico aparecer em headerLocalMap (útil para navegação síncrona)
    const prefetchHeaderAndWait = useCallback(async (newPayload: any | null, filename: string | null, timeoutMs = 1200): Promise<boolean> => {
        if (!newPayload || !filename) return false;
        const tStart = Date.now();
        console.log('[ARPayloadContext] 🔔 prefetchHeaderAndWait START:', filename, new Date(tStart).toISOString(), `timeoutMs=${timeoutMs}`);
        try {
            // inicia o prefetch normalmente (dispara downloads em background)
            try { prefetchImagesForPayload && prefetchImagesForPayload(newPayload); } catch (e) { /* swallow */ }

            const start = Date.now();
            while (Date.now() - start < timeoutMs) {
                if (headerLocalMap && filename && headerLocalMap[filename]) {
                    const tOk = Date.now();
                    console.log('[ARPayloadContext] 🔔 prefetchHeaderAndWait SUCCESS:', filename, new Date(tOk).toISOString(), 'elapsed_ms=', tOk - tStart);
                    return true;
                }
                // sleep 80ms
                // eslint-disable-next-line no-await-in-loop
                await new Promise((r) => setTimeout(r, 80));
            }
            const tTimeout = Date.now();
            console.log('[ARPayloadContext] 🔔 prefetchHeaderAndWait TIMEOUT:', filename, new Date(tTimeout).toISOString(), 'elapsed_ms=', tTimeout - tStart);
            return false;
        } catch (e) {
            const tErr = Date.now();
            console.log('[ARPayloadContext] 🔔 prefetchHeaderAndWait ERROR:', filename, new Date(tErr).toISOString(), 'error=', (e as any)?.message || e);
            return false;
        }
    }, [headerLocalMap, prefetchImagesForPayload]);

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
        headerLocalMap,
        prefetchImagesForPayload,
        prefetchHeaderAndWait,
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
