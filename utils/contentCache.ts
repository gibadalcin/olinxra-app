import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY_PREFIX = '@ar_content_cache_';
const CACHE_EXPIRY_MS = 1000 * 60 * 30; // 30 minutos

export interface CachedContent {
    data: any;
    timestamp: number;
    key: string;
}

/**
 * Gera chave de cache baseada em marca e localização aproximada
 */
function generateCacheKey(nome_marca: string, lat: number, lon: number): string {
    // Arredondar coordenadas para ~1km (0.01 graus ≈ 1.1km)
    const latRounded = Math.round(lat * 100) / 100;
    const lonRounded = Math.round(lon * 100) / 100;
    return `${CACHE_KEY_PREFIX}${nome_marca}_${latRounded}_${lonRounded}`;
}

/**
 * Salva conteúdo no cache local
 */
export async function saveCachedContent(
    nome_marca: string,
    lat: number,
    lon: number,
    content: any
): Promise<void> {
    try {
        const key = generateCacheKey(nome_marca, lat, lon);
        const cached: CachedContent = {
            data: content,
            timestamp: Date.now(),
            key,
        };
        await AsyncStorage.setItem(key, JSON.stringify(cached));
        console.log('[Cache] Conteúdo salvo:', key);
    } catch (error) {
        console.warn('[Cache] Erro ao salvar:', error);
    }
}

/**
 * Busca conteúdo no cache local
 * Retorna null se não existir ou estiver expirado
 */
export async function getCachedContent(
    nome_marca: string,
    lat: number,
    lon: number
): Promise<any | null> {
    try {
        const key = generateCacheKey(nome_marca, lat, lon);
        const cached = await AsyncStorage.getItem(key);

        if (!cached) {
            console.log('[Cache] Miss:', key);
            return null;
        }

        const parsed: CachedContent = JSON.parse(cached);
        const age = Date.now() - parsed.timestamp;

        if (age > CACHE_EXPIRY_MS) {
            console.log('[Cache] Expirado:', key, `(${Math.round(age / 1000)}s)`);
            await AsyncStorage.removeItem(key); // Limpar cache expirado
            return null;
        }

        console.log('[Cache] Hit:', key, `(${Math.round(age / 1000)}s atrás)`);
        return parsed.data;
    } catch (error) {
        console.warn('[Cache] Erro ao buscar:', error);
        return null;
    }
}

/**
 * Limpa todo o cache de conteúdo AR
 */
export async function clearAllCache(): Promise<void> {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(k => k.startsWith(CACHE_KEY_PREFIX));
        await AsyncStorage.multiRemove(cacheKeys);
        console.log('[Cache] Limpeza completa:', cacheKeys.length, 'itens removidos');
    } catch (error) {
        console.warn('[Cache] Erro ao limpar:', error);
    }
}

/**
 * Remove apenas caches expirados
 */
export async function cleanExpiredCache(): Promise<void> {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(k => k.startsWith(CACHE_KEY_PREFIX));

        for (const key of cacheKeys) {
            const cached = await AsyncStorage.getItem(key);
            if (cached) {
                const parsed: CachedContent = JSON.parse(cached);
                const age = Date.now() - parsed.timestamp;
                if (age > CACHE_EXPIRY_MS) {
                    await AsyncStorage.removeItem(key);
                    console.log('[Cache] Removido expirado:', key);
                }
            }
        }
    } catch (error) {
        console.warn('[Cache] Erro na limpeza automática:', error);
    }
}

/**
 * Invalida cache de uma marca específica (todas as localizações)
 * Útil após atualizações de GLBs no backend
 */
export async function invalidateBrandCache(nome_marca: string): Promise<number> {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const brandCacheKeys = keys.filter(k =>
            k.startsWith(CACHE_KEY_PREFIX) && k.includes(`_${nome_marca}_`)
        );

        for (const key of brandCacheKeys) {
            await AsyncStorage.removeItem(key);
            console.log('[Cache] 🗑️ Invalidado cache da marca:', key);
        }

        console.log(`[Cache] ✅ Invalidados ${brandCacheKeys.length} caches da marca ${nome_marca}`);
        return brandCacheKeys.length;
    } catch (error) {
        console.warn('[Cache] Erro ao invalidar cache da marca:', error);
        return 0;
    }
}
