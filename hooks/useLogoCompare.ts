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
        // Usa a variável do backend online definida no .env e configurada em API_CONFIG
        // Prioriza variável de ambiente do Expo, depois React Native
        let backendUrl = '';
        if (process.env.EXPO_PUBLIC_BACKEND_URL) {
            backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
        } else if (process.env.REACT_APP_API_URL) {
            backendUrl = process.env.REACT_APP_API_URL;
        } else {
            backendUrl = API_CONFIG.BASE_URL;
        }
        if (!backendUrl) throw new Error("Backend URL não configurada");
        console.log("[compareLogo] Enviando para backend:", backendUrl);

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
        console.log("[compareLogo] Status da resposta:", response.status);
        let responseText = await response.text();
        console.log("[compareLogo] Texto da resposta:", responseText);

        if (response.ok) {
            try {
                return JSON.parse(responseText);
            } catch (e) {
                console.error("Erro ao parsear JSON da resposta:", e);
                return null;
            }
        }

        console.error("Erro do backend:", responseText);
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
    // Threshold ajustado para alinhar com backend (0.38 distance = ~72.5% confidence)
    // 70% estava rejeitando muitas capturas válidas (73-74%)
    // 65% pode gerar falsos positivos
    // 72% é um bom balanço entre precisão e recall
    const SIMILARIDADE_MINIMA = 0.72;
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
    // Se o backend retornou e indicou que o resultado não é confiável, pare aqui.
    if (backendResult && backendResult.trusted === false) {
        const msg = backendResult.debug_reason ? `Reconhecimento não confiável: ${backendResult.debug_reason}` : 'Reconhecimento não confiável pelo backend.';
        const result = { status: 'untrusted', data: backendResult, message: msg };
        console.log('[compareLogo] Resultado final (untrusted):', result);
        return result;
    }

    if (backendResult && backendResult.found && typeof backendResult.confidence === 'number') {
        if (backendResult.confidence >= SIMILARIDADE_MINIMA) {
            await saveLogoToCache(fileBuffer, backendResult);
            const result = { status: 'recognized', data: backendResult };
            console.log('[compareLogo] Resultado final:', result);
            return result;
        } else {
            const result = {
                status: 'low_similarity',
                data: backendResult,
                message: `Nenhum logo reconhecido com confiança suficiente. Similaridade: ${(backendResult.confidence).toFixed(2)}%`
            };
            console.log('[compareLogo] Resultado final:', result);
            return result;
        }
    }

    // Se backendResult for null, é erro de sistema
    if (backendResult === null) {
        const result = { status: 'error', error: 'Erro na comunicação com o backend.' };
        console.log('[compareLogo] Resultado final:', result);
        return result;
    }

    const result = { status: 'not_found' };
    console.log('[compareLogo] Resultado final:', result);
    return result;
}