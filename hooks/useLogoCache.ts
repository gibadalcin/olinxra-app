import * as SQLite from 'expo-sqlite';
import { sha256 } from 'js-sha256';

const db = SQLite.openDatabaseAsync('logos.db');

export async function initLogoCache(): Promise<void> {
    await (await db).withTransactionAsync(async () => {
        await (await db).execAsync('CREATE TABLE IF NOT EXISTS logos (image_hash TEXT PRIMARY KEY, api_response TEXT, timestamp INTEGER);');
    });
}

export async function getLogoFromCache(imageBase64: string) {
    const hash = sha256(imageBase64);
    
    try {
        const result = await (await db).getFirstAsync(
            'SELECT api_response FROM logos WHERE image_hash = ?;',
            [hash]
        ) as { api_response?: string } | null;

        if (result && typeof result.api_response === 'string') {
            try {
                return JSON.parse(result.api_response);
            } catch (error) {
                console.error("Erro ao decodificar JSON do cache:", error);
                return null;
            }
        }
        return null;
    } catch (error) {
        console.error("Erro ao buscar do cache:", error);
        return null;
    }
}

export async function saveLogoToCache(imageBase64: string, apiResponse: any): Promise<void> {
    const hash = sha256(imageBase64);
    const apiResponseStr = JSON.stringify(apiResponse);
    const timestamp = Date.now();
    
    try {
        await (await db).runAsync(
            'INSERT OR REPLACE INTO logos (image_hash, api_response, timestamp) VALUES (?, ?, ?);',
            [hash, apiResponseStr, timestamp]
        );
    } catch (error) {
        console.error("Erro ao salvar no cache:", error);
    }
}