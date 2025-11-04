/**
 * Comandos úteis para desenvolvimento
 * 
 * Para usar, importe no arquivo principal (ex: App.tsx ou _layout.tsx)
 * e exponha no objeto global:
 * 
 * ```typescript
 * import * as DevCommands from '@/utils/devCommands';
 * if (__DEV__) {
 *   (global as any).dev = DevCommands;
 * }
 * ```
 * 
 * Depois, no console do Expo/Metro:
 * ```javascript
 * global.dev.clearCache()
 * global.dev.clearBrandCache('g3')
 * global.dev.listCache()
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { invalidateBrandCache, clearAllCache } from './contentCache';

const CACHE_KEY_PREFIX = '@ar_content_cache_';

/**
 * Lista todos os caches armazenados
 */
export async function listCache(): Promise<void> {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(k => k.startsWith(CACHE_KEY_PREFIX));

        console.log('📦 ========================================');
        console.log(`📦 Total de caches: ${cacheKeys.length}`);
        console.log('📦 ========================================');

        for (const key of cacheKeys) {
            const cached = await AsyncStorage.getItem(key);
            if (cached) {
                const parsed = JSON.parse(cached);
                const age = Date.now() - parsed.timestamp;
                const ageMinutes = Math.floor(age / 1000 / 60);

                console.log(`\n📦 ${key}`);
                console.log(`   ⏱️  Idade: ${ageMinutes} minutos`);
                console.log(`   📊 Timestamp: ${new Date(parsed.timestamp).toLocaleString()}`);
            }
        }

        console.log('\n📦 ========================================');
    } catch (error) {
        console.error('❌ Erro ao listar cache:', error);
    }
}

/**
 * Limpa cache de uma marca específica
 */
export async function clearBrandCache(marca: string): Promise<void> {
    try {
        console.log(`🗑️  Invalidando cache da marca: ${marca}...`);
        const count = await invalidateBrandCache(marca);
        console.log(`✅ ${count} caches removidos`);
        console.log('');
        console.log('🔄 Próximos passos:');
        console.log('   1. Reabra o app');
        console.log('   2. Capture a logo novamente');
        console.log('   3. O cache será recriado com dados atualizados');
    } catch (error) {
        console.error('❌ Erro ao limpar cache da marca:', error);
    }
}

/**
 * Limpa TODO o cache de conteúdo
 */
export async function clearCache(): Promise<void> {
    try {
        console.log('🗑️  Limpando TODO o cache de conteúdo...');
        await clearAllCache();
        console.log('✅ Cache limpo com sucesso');
        console.log('');
        console.log('🔄 Próximos passos:');
        console.log('   1. Reabra o app');
        console.log('   2. Capture uma logo');
        console.log('   3. O cache será recriado com dados atualizados');
    } catch (error) {
        console.error('❌ Erro ao limpar cache:', error);
    }
}

/**
 * Mostra ajuda dos comandos disponíveis
 */
export function help(): void {
    console.log('');
    console.log('🛠️  ========================================');
    console.log('🛠️  COMANDOS DE DESENVOLVIMENTO');
    console.log('🛠️  ========================================');
    console.log('');
    console.log('📋 Comandos disponíveis:');
    console.log('');
    console.log('   global.dev.listCache()');
    console.log('   → Lista todos os caches armazenados');
    console.log('');
    console.log('   global.dev.clearBrandCache("g3")');
    console.log('   → Limpa cache de uma marca específica');
    console.log('');
    console.log('   global.dev.clearCache()');
    console.log('   → Limpa TODO o cache de conteúdo');
    console.log('');
    console.log('   global.dev.help()');
    console.log('   → Mostra esta ajuda');
    console.log('');
    console.log('🛠️  ========================================');
    console.log('');
}
