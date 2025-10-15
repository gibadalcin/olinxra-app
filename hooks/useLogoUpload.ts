import { getLogoFromCache, saveLogoToCache } from './useLogoCache';
import { API_CONFIG } from '../config/api';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { v4 as uuidv4 } from 'uuid';

/**
 * Envia uma imagem para o backend para comparação.
 * Usa um upload de arquivo no formato multipart/form-data.
 */
async function searchLogoInBackend(imageUri: string): Promise<any | null> {
    try {
        const backendUrl = API_CONFIG.BASE_URL;
        if (!backendUrl) throw new Error("Backend URL não configurada");

        const formData = new FormData();
        formData.append("file", {
            uri: imageUri,
            type: "image/jpeg",
            name: "compare.jpg"
        } as any);

        const response = await fetch(`${backendUrl}/search-logo/`, {
            method: "POST",
            body: formData,
        });

        if (response.ok) {
            return await response.json();
        }

        console.error("Erro do backend:", await response.text());
        return null;
    } catch (error) {
        console.error("Erro na comunicação com o backend:", error);
        return null;
    }
}

/**
 * Lida com a lógica completa de comparação de logo, incluindo cache e comunicação com o backend.
 */
export async function compareLogo(imageUri: string) {
    const SIMILARIDADE_MINIMA = 0.7;
    let finalUri: string = imageUri;

    // 1. Manuseio do URI (base64 vs. file://)
    if (imageUri.startsWith('data:image')) {
        try {
            const tempPath = FileSystem.cacheDirectory + `temp_${uuidv4()}.jpg`;
            const fileBase64 = imageUri.split(',')[1];
            await FileSystem.writeAsStringAsync(tempPath, fileBase64, { encoding: FileSystem.EncodingType.Base64 });
            finalUri = tempPath;
        } catch (error) {
            console.error("Erro ao criar arquivo temporário:", error);
            return { status: 'error', error: "Erro ao processar imagem." };
        }
    }

    // 2. Redimensionamento e Compressão
    const manipResult = await ImageManipulator.manipulateAsync(
        finalUri,
        [{ resize: { width: 500 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );

    // 3. Verificação de Cache pelo conteúdo da imagem
    const fileBuffer = await FileSystem.readAsStringAsync(manipResult.uri, { encoding: FileSystem.EncodingType.Base64 });
    const cached = await getLogoFromCache(fileBuffer);
    if (cached && cached.found) {
        return { status: 'cached', data: cached };
    }

    // 4. Envio para o Backend e Timeout
    const backendResult = await Promise.race([
        searchLogoInBackend(manipResult.uri),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout na comunicação com o backend')), 8000))
    ]);

    // 5. Tratamento da Resposta
    if (backendResult && backendResult.found && typeof backendResult.confidence === 'number') {
        if (backendResult.confidence >= SIMILARIDADE_MINIMA) {
            await saveLogoToCache(fileBuffer, backendResult);
            return { status: 'recognized', data: backendResult };
        } else {
            return {
                status: 'low_similarity',
                data: backendResult,
                message: `Nenhum logo reconhecido com confiança suficiente. Similaridade: ${(backendResult.confidence).toFixed(2)}%`
            };
        }
    }

    return { status: 'not_found' };
}

/**
 * Envia uma imagem para o backend para cadastro.
 * Usa um upload de arquivo no formato multipart/form-data.
 */
export async function uploadLogoToBackend(imageUri: string, name: string) {
    const backendUrl = API_CONFIG.BASE_URL;
    if (!backendUrl) throw new Error("Backend URL não configurada");

    const formData = new FormData();
    formData.append("file", {
        uri: imageUri,
        type: "image/jpeg",
        name: name + ".jpg"
    } as any);
    formData.append("name", name);

    const response = await fetch(`${backendUrl}/add-logo/`, {
        method: "POST",
        body: formData,
    });

    let result;
    try {
        result = await response.json();
        console.log('[uploadLogoToBackend] Resposta do backend:', result);
    } catch (e) {
        const text = await response.text();
        console.error('[uploadLogoToBackend] Erro ao parsear JSON:', text);
        if (!response.ok) {
            throw new Error(text);
        }
        // Se persistiu mas não retornou JSON, retorna texto para debug
        return { status: 'unknown', raw: text };
    }

    if (!response.ok) {
        throw new Error(result?.error || JSON.stringify(result));
    }
    return result;
}