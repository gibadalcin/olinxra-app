import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Linking, Alert, Platform, AppState, AppStateStatus, Pressable } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter, useFocusEffect } from 'expo-router';
import { API_CONFIG } from '../../config/api';
import { ARNavigationControls } from '@/components/ar';
import { useARPayload } from '@/context/ARPayloadContext'; // ✅ Usar Context
import { setRestartCaptureOnReturn } from '@/utils/lastARContent';
import useARSupport from '@/hooks/useARSupport';
import CustomHeader from '@/components/CustomHeader';
import { isARActive, isSameARModel, activateAR, deactivateAR } from '@/utils/arGate';
import { ContentBlocks } from '@/components/ContentBlocks'; // ✅ Componente de blocos de conteúdo
import LoadingWithTips from '@/components/ui/LoadingWithTips'; // ✅ Loader com dicas



// Definição das mensagens de estado da UI
const UIMessages = {
    INITIAL: 'Carregando modelo 3D...',
    LAUNCHING: 'Iniciando AR Nativo...',
    ERROR: 'Falha ao iniciar o AR Nativo.',
    READY: 'Pronto para visualizar em AR.'
};

// Componente de View Principal
export default function ARViewScreen() {
    // ✅ USA CONTEXT para payload e GLB
    const {
        payload,
        generatedGlbUrl,
        setGeneratedGlbUrl,
        shouldAutoLaunch,
        setShouldAutoLaunch
    } = useARPayload();

    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState(UIMessages.INITIAL);
    const [focusCounter, setFocusCounter] = useState(0); // ✅ Contador de foco (força re-execução do auto-launch)
    const [showContent, setShowContent] = useState(false); // ✅ Controla exibição do conteúdo após fechar AR
    const [isGeneratingGlb, setIsGeneratingGlb] = useState(false); // ✅ Estado de geração de GLB

    // ✅ NOVO: Estados para múltiplos modelos GLB
    const [glbModels, setGlbModels] = useState<Array<{ url: string; blockIndex: number; name?: string }>>([]);
    const [currentModelIndex, setCurrentModelIndex] = useState(0);

    const launchedRef = useRef(false); // Flag para auto-LAUNCH (abrir AR)
    const launchedForContentRef = useRef(false);
    const launchedAtRef = useRef<number>(0); // ✅ Timestamp de quando lançou AR (evita reset prematuro)
    const backgroundAtRef = useRef<number>(0); // ✅ Timestamp de quando foi para background (detecta App Switcher)
    const actionInProgressRef = useRef(false);
    const glbGeneratedRef = useRef(false); // Flag para saber se já gerou GLB nesta sessão
    const glbGenerationInProgressRef = useRef(false); // Flag para saber se está gerando GLB agora
    const lastPayloadRef = useRef<any>(null); // ✅ Armazena chave do payload anterior
    const closingNavRef = useRef(false); // ✅ Bloqueia efeitos automáticos durante navegação de saída
    const autoGenTriggeredRef = useRef(false); // ✅ Evita disparo duplo de geração para o mesmo payload
    const generationScheduledRef = useRef(false); // ✅ Evita agendar handleVerEmRA mais de uma vez

    // ✅ CRÍTICO: Log de montagem/desmontagem do componente
    useEffect(() => {
        console.log('[ARView] 🏗️ ========================================');
        console.log('[ARView] 🏗️ COMPONENTE MONTADO');
        console.log('[ARView] 🏗️ Refs iniciais:');
        console.log('[ARView] 🏗️   - launchedRef:', launchedRef.current);
        console.log('[ARView] 🏗️   - glbGeneratedRef:', glbGeneratedRef.current);
        console.log('[ARView] 🏗️   - lastPayloadRef:', lastPayloadRef.current);
        console.log('[ARView] 🏗️ ========================================');

        return () => {
            console.log('[ARView] 💥 ========================================');
            console.log('[ARView] 💥 COMPONENTE DESMONTANDO');
            console.log('[ARView] 💥 ========================================');
        };
    }, []);

    // evitar re-requests de fallback repetidos (marca nomes de arquivo já tentados)    // NOTE: removed preview/transform variant handling — we open payload model or generate via backend when requested.

    // Função auxiliar para buscar a URL do modelo GLB no payload (mantida)
    const findModelUrl = useCallback((obj: any): string | null => {
        if (!obj || typeof obj !== 'object') return null;
        for (const k of Object.keys(obj)) {
            const v = obj[k];
            if (typeof v === 'string' && v.toLowerCase().includes('.glb')) return v;
            if (k.toLowerCase().includes('modelurl') && typeof v === 'string') return v;
            if (k.toLowerCase().includes('model_url') && typeof v === 'string') return v;
            if (typeof v === 'object') { const r = findModelUrl(v); if (r) return r; }
        }
        return null;
    }, []);

    // Função utilitária: busca recursiva por chaves de texto (case-insensitive)
    const findStringValue = useCallback((obj: any, keys: string[]): string | null => {
        if (!obj || typeof obj !== 'object') return null;
        const lowerKeys = keys.map(k => k.toLowerCase());

        // 1) busca direto nas chaves do objeto
        for (const k of Object.keys(obj)) {
            const lowerK = k.toLowerCase();
            if (lowerKeys.includes(lowerK) && typeof obj[k] === 'string' && String(obj[k]).trim() !== '') return String(obj[k]).trim();
        }

        // 2) busca recursiva em objetos filhos
        for (const k of Object.keys(obj)) {
            const v = obj[k];
            if (v && typeof v === 'object') {
                const r = findStringValue(v, keys);
                if (r) return r;
            }
        }
        return null;
    }, []);

    function safePreview(str?: string | null, max = 120) {
        if (!str) return 'nulo'
        try {
            const isData = str.startsWith && str.startsWith('data:')
            const len = str.length
            if (isData) {
                // don't include the whole base64 in Alerts — show type and length and a tiny prefix
                const prefix = str.slice(0, Math.min(64, str.length))
                return `${prefix}... (data: base64, length=${len})`
            }
            if (str.length > max) {
                return `${str.slice(0, max)}... (length=${len})`
            }
            return str
        } catch (e) {
            return 'nulo'
        }
    }

    const router = useRouter();

    // --- CARREGAMENTO INICIAL ---
    // ✅ SIMPLIFICADO: Context gerencia o payload e shouldAutoLaunch
    useFocusEffect(
        React.useCallback(() => {
            console.log('[ARView] 🎬 🔄 ========================================');
            console.log('[ARView] 🎬 🔄 TELA GANHOU FOCO - useFocusEffect EXECUTADO');
            console.log('[ARView] 🎬 🔄 ========================================');
            console.log('[ARView] 📊 Estado do Context:');
            console.log('[ARView]    - payload:', payload ? `EXISTE (${payload.nome_marca})` : 'NULL');
            console.log('[ARView]    - generatedGlbUrl:', generatedGlbUrl ? 'EXISTE' : 'NULL');
            console.log('[ARView]    - shouldAutoLaunch:', shouldAutoLaunch);
            console.log('[ARView] 📊 Estado dos Refs:');
            console.log('[ARView]    - launchedRef.current:', launchedRef.current);
            console.log('[ARView]    - launchedForContentRef.current:', launchedForContentRef.current);

            // ✅ SOLUÇÃO ALTERNATIVA: Se voltou para tela E launchedForContent=true E gate desativada
            // = AR foi fechada, precisa navegar de volta
            if (launchedForContentRef.current && !isARActive()) {
                const timeSinceLaunch = Date.now() - launchedAtRef.current;
                const timeInBackground = backgroundAtRef.current > 0 ? Date.now() - backgroundAtRef.current : 999999;

                // Se lançou há pouco tempo (< 2s), ainda está abrindo AR, não processar
                if (timeSinceLaunch < 2000) {
                    console.log(`[ARView] ⏸️ Launch recente (${timeSinceLaunch}ms atrás), NÃO resetando launchedRef (protege contra App Switcher)`);

                    // ✅ NOVO: Inicia timer de verificação para detectar quando AR fecha
                    console.log('[ARView] 🔁 Iniciando timer de verificação (3s após launch)...');
                    console.log('[ARView] 🔁 Estado atual:');
                    console.log('[ARView] 🔁   - launchedForContentRef:', launchedForContentRef.current);
                    console.log('[ARView] 🔁   - isARActive():', isARActive());
                    console.log('[ARView] 🔁   - timeSinceLaunch:', timeSinceLaunch, 'ms');

                    setTimeout(() => {
                        const now = new Date().toISOString().substring(11, 23);
                        console.log(`[ARView] 🔁 [${now}] ⏰ TIMER DISPAROU!`);
                        console.log(`[ARView] 🔁 [${now}] Verificando estado...`);
                        console.log(`[ARView] 🔁 [${now}]   - launchedForContentRef:`, launchedForContentRef.current);
                        console.log(`[ARView] 🔁 [${now}]   - isARActive():`, isARActive());

                        // ✅ CRÍTICO: Só exibir conteúdo se AR foi fechada E ainda há flags setadas
                        // Se launchedForContentRef=false, significa que já resetou
                        if (launchedForContentRef.current && !isARActive()) {
                            const now2 = new Date().toISOString().substring(11, 23);
                            console.log(`[ARView] 🔁 [${now2}] ✅ Timer detectou: AR foi fechada!`);
                            console.log(`[ARView] 🔁 [${now2}] Resetando flags e exibindo conteúdo...`);

                            // Reseta flags PRIMEIRO
                            launchedRef.current = false;
                            launchedForContentRef.current = false;
                            launchedAtRef.current = 0;
                            backgroundAtRef.current = 0;

                            // ✅ MUDANÇA: Exibir conteúdo ao invés de navegar
                            console.log(`[ARView] 🔁 [${now2}] Exibindo conteúdo via timer...`);
                            setShowContent(true);
                            console.log(`[ARView] 🔁 [${now2}] ✅ Conteúdo exibido via timer`);
                        } else if (!launchedForContentRef.current) {
                            const now3 = new Date().toISOString().substring(11, 23);
                            console.log(`[ARView] 🔁 [${now3}] ⏸️ Timer disparou mas launchedForContentRef=false (já navegou), ignorando`);
                        } else {
                            const now3 = new Date().toISOString().substring(11, 23);
                            console.log(`[ARView] 🔁 [${now3}] ⏸️ Timer disparou mas AR ainda ativa, ignorando`);
                        }
                    }, 3000); // Espera 3s após launch inicial

                    console.log('[ARView] 🔁 Timer criado com sucesso, aguardando 3s...');

                    // ✅ CRÍTICO: NÃO cancelar o timer no cleanup!
                    // O timer precisa continuar executando mesmo se a tela perder o foco
                    // (por exemplo, se usuário navegar via App Switcher para outra tela)
                    // O timer vai detectar quando AR fechar e navegar de volta automaticamente
                    return undefined; // Sem cleanup = timer continua executando
                } else if (backgroundAtRef.current > 0 && timeInBackground < 2000) {
                    // Voltou do background rápido = App Switcher, não AR fechado
                    console.log(`[ARView] 🔄 Voltou do background rápido (${timeInBackground}ms) = App Switcher, ignorando...`);
                } else {
                    // AR foi fechada! Mostrar conteúdo ao invés de navegar
                    console.log('[ARView] 🔙 ========================================');
                    console.log('[ARView] 🔙 AR FECHADO detectado via useFocusEffect!');
                    console.log(`[ARView] 🔙 timeSinceLaunch: ${timeSinceLaunch}ms, timeInBackground: ${timeInBackground}ms`);
                    console.log('[ARView] 🔙 Exibindo conteúdo...');
                    console.log('[ARView] 🔙 ========================================');

                    // Reseta flags
                    launchedRef.current = false;
                    launchedForContentRef.current = false;
                    launchedAtRef.current = 0;
                    backgroundAtRef.current = 0;

                    // ✅ MUDANÇA: Exibir conteúdo ao invés de navegar
                    setShowContent(true);
                    return; // Early return
                }
            }

            // ✅ MUDANÇA: Resetar launchedRef ao ganhar foco APENAS se não há AR ativa (permite reentrada)
            // ✅ CRÍTICO: NÃO resetar se lançou AR há menos de 2000ms (protege contra App Switcher)
            const timeSinceLaunch = Date.now() - launchedAtRef.current;
            const isRecentLaunch = launchedRef.current && timeSinceLaunch < 2000; // ✅ Aumentado para 2s

            if (!isARActive()) {
                if (isRecentLaunch) {
                    console.log(`[ARView] ⏸️ Launch recente (${timeSinceLaunch}ms atrás), NÃO resetando launchedRef (protege contra App Switcher)`);
                } else {
                    console.log('[ARView] 🔄 Sem AR ativa E sem launch recente, resetando launchedRef para permitir auto-launch');
                    console.log(`[ARView] 🔄 timeSinceLaunch: ${timeSinceLaunch}ms`);
                    launchedRef.current = false;
                    launchedForContentRef.current = false; // ✅ Resetar também launchedForContentRef
                    launchedAtRef.current = 0; // ✅ Resetar timestamp
                    launchedAtRef.current = 0;
                    backgroundAtRef.current = 0; // ✅ Limpa timestamp também
                    // ✅ Incrementa contador para forçar re-execução do auto-launch effect
                    setFocusCounter(prev => prev + 1);
                }
            } else {
                console.log('[ARView] ⏸️ AR ainda ativa, mantendo launchedRef para evitar redisparo');
            }

            setLoading(false);

            return () => {
                console.log('[ARView] 🔙 TELA PERDEU FOCO (componente ainda montado)');
            };
        }, [payload, generatedGlbUrl, shouldAutoLaunch, router]) // ✅ Todas as dependências do Context + router
    );

    // Cleanup real ao desmontar componente completamente
    useEffect(() => {
        return () => {
            console.log('[ARView] 🧹 Componente DESMONTADO COMPLETAMENTE');
        };
    }, []);

    // ✅ NOVO: Detecta mudança de payload e exibe conteúdo automaticamente
    useEffect(() => {
        // ✅ CORREÇÃO: Gera chave única usando HASH completo (mesmo algoritmo do Context)
        const previewHash = payload && payload.previewImage
            ? `${payload.previewImage.length}_${payload.previewImage.substring(0, 100)}_${payload.previewImage.substring(payload.previewImage.length - 100)}`
            : 'no-preview';
        const currentPayloadKey = payload
            ? `${payload.nome_marca || 'unknown'}_${previewHash}`
            : null;

        const lastPayloadKey = lastPayloadRef.current;

        if (currentPayloadKey !== lastPayloadKey) {
            console.log('[ARView] 🆕 ========================================');
            console.log('[ARView] 🆕 NOVO PAYLOAD DETECTADO!');
            console.log('[ARView] 🆕 ========================================');
            console.log('[ARView] 📊 Payload anterior:', lastPayloadKey ? lastPayloadKey.substring(0, 100) + '...' : 'NENHUM');
            console.log('[ARView] 📊 Payload atual:', currentPayloadKey ? currentPayloadKey.substring(0, 100) + '...' : 'NENHUM');

            // ✅ CORREÇÃO CRÍTICA: Reseta flags para NOVO PAYLOAD
            console.log('[ARView] 🔄 Resetando flags para novo payload...');
            glbGeneratedRef.current = false;
            glbGenerationInProgressRef.current = false;
            actionInProgressRef.current = false;
            launchedRef.current = false;
            autoGenTriggeredRef.current = false;
            closingNavRef.current = false;

            // ✅ IMPORTANTE: Limpa GLB do Context
            console.log('[ARView] 🧹 Limpando generatedGlbUrl do payload anterior...');
            setGeneratedGlbUrl(null);

            // ✅ NOVO FLUXO: Exibir conteúdo automaticamente quando payload chegar
            console.log('[ARView] 📺 Exibindo tela de conteúdo automaticamente...');
            setShowContent(true);
            setShouldAutoLaunch(false); // ✅ Desabilita auto-launch

            // Atualiza referência
            lastPayloadRef.current = currentPayloadKey;
        }
    }, [payload, setGeneratedGlbUrl, setShouldAutoLaunch]);

    // ✅ NOVO: Extrair URLs de GLBs dos blocos quando payload mudar
    useEffect(() => {
        console.log('[ARView] 🔍 ========================================');
        console.log('[ARView] 🔍 EXTRAINDO GLBs DOS BLOCOS');
        console.log('[ARView] 🔍 ========================================');

        if (!payload || !payload.blocos) {
            console.log('[ARView] ❌ Nenhum payload ou blocos disponíveis');
            setGlbModels([]);
            setCurrentModelIndex(0);
            return;
        }

        // Normalizar blocos (pode vir como p.blocos.blocos ou p.blocos)
        let blocks: any[] = [];
        if (Array.isArray(payload.blocos)) {
            blocks = payload.blocos;
            console.log('[ARView] 📦 Blocos encontrados diretamente em payload.blocos (array)');
        } else if (payload.blocos.blocos && Array.isArray(payload.blocos.blocos)) {
            blocks = payload.blocos.blocos;
            console.log('[ARView] 📦 Blocos encontrados em payload.blocos.blocos (nested)');
        }

        console.log('[ARView] 📊 Total de blocos:', blocks.length);

        // Extrair GLBs de cada bloco (prioriza glb_signed_url > glb_url)
        const models: Array<{ url: string; blockIndex: number; name?: string }> = [];

        blocks.forEach((bloco, index) => {
            if (!bloco) {
                console.log(`[ARView] ⚠️ Bloco ${index} é null/undefined, ignorando...`);
                return;
            }

            console.log(`[ARView] 🔍 Processando bloco ${index}:`, {
                tipo: bloco.tipo || 'sem tipo',
                temGlbUrl: !!bloco.glb_url,
                temGlbSignedUrl: !!bloco.glb_signed_url,
                temItems: Array.isArray(bloco.items),
                quantidadeItems: Array.isArray(bloco.items) ? bloco.items.length : 0
            });

            // Verificar se bloco tem GLB (prioriza signed_url)
            const glbUrl = bloco.glb_signed_url || bloco.glb_url || null;

            if (glbUrl && typeof glbUrl === 'string' && glbUrl.includes('.glb')) {
                console.log(`[ARView] ✅ GLB encontrado no bloco ${index} (${bloco.tipo}):`, glbUrl.substring(0, 100) + '...');
                const modelName = bloco.titulo || bloco.descricao || `Modelo ${models.length + 1}`;
                models.push({ url: glbUrl, blockIndex: index, name: modelName });
            } else if (bloco.glb_url || bloco.glb_signed_url) {
                console.log(`[ARView] ⚠️ Bloco ${index} tem glb_url/glb_signed_url mas não é string válida:`, {
                    glb_url: bloco.glb_url,
                    glb_signed_url: bloco.glb_signed_url
                });
            }

            // Verificar itens de carousel
            if (Array.isArray(bloco.items)) {
                console.log(`[ARView] 🎠 Bloco ${index} é carousel com ${bloco.items.length} itens, verificando GLBs...`);

                bloco.items.forEach((item: any, itemIndex: number) => {
                    if (!item) {
                        console.log(`[ARView] ⚠️ Item ${itemIndex} do bloco ${index} é null/undefined`);
                        return;
                    }

                    console.log(`[ARView] 🔍 Item ${itemIndex} do bloco ${index}:`, {
                        temGlbUrl: !!item.glb_url,
                        temGlbSignedUrl: !!item.glb_signed_url,
                        temUrl: !!item.url,
                        temSignedUrl: !!item.signed_url
                    });

                    const itemGlbUrl = item.glb_signed_url || item.glb_url || null;

                    if (itemGlbUrl && typeof itemGlbUrl === 'string' && itemGlbUrl.includes('.glb')) {
                        console.log(`[ARView] ✅ GLB encontrado no item ${itemIndex} do bloco ${index}:`, itemGlbUrl.substring(0, 100) + '...');
                        const itemName = item.titulo || item.descricao || `Modelo ${models.length + 1}`;
                        models.push({ url: itemGlbUrl, blockIndex: index, name: itemName });
                    } else if (item.glb_url || item.glb_signed_url) {
                        console.log(`[ARView] ⚠️ Item ${itemIndex} do bloco ${index} tem glb_url/glb_signed_url mas não é string válida:`, {
                            glb_url: item.glb_url,
                            glb_signed_url: item.glb_signed_url
                        });
                    } else {
                        console.log(`[ARView] ❌ Item ${itemIndex} do bloco ${index} NÃO tem GLB`);
                    }
                });
            } else if (bloco.items) {
                console.log(`[ARView] ⚠️ Bloco ${index} tem 'items' mas NÃO é array:`, typeof bloco.items);
            }
        });

        console.log('[ARView] 🎯 ========================================');
        console.log('[ARView] 🎯 RESUMO DA EXTRAÇÃO');
        console.log('[ARView] 🎯 Total de GLBs encontrados:', models.length);
        console.log('[ARView] 🎯 Modelos extraídos:', models.map((m, i) => ({
            index: i,
            blockIndex: m.blockIndex,
            url: m.url.substring(0, 80) + '...'
        })));
        console.log('[ARView] 🎯 ========================================');

        setGlbModels(models);

        // Reset índice se não há modelos ou se índice atual é maior que quantidade de modelos
        if (models.length === 0 || currentModelIndex >= models.length) {
            setCurrentModelIndex(0);
        }
    }, [payload]);

    // --- VARIÁVEL CHAVE: URL do Modelo Final ---
    const finalModelUrl = useMemo(() => {
        console.log('[ARView] 🔍 Buscando modelo final...');

        // PRIORIDADE 1: Modelo GLB dos blocos (array glbModels)
        if (glbModels.length > 0 && currentModelIndex < glbModels.length) {
            const selectedModel = glbModels[currentModelIndex];
            console.log('[ARView] ✅ Usando GLB do bloco', selectedModel.blockIndex, `(${currentModelIndex + 1}/${glbModels.length})`);
            console.log('[ARView] 📊 URL:', selectedModel.url.substring(0, 100) + '...');
            return selectedModel.url;
        }

        // PRIORIDADE 2: Modelo GLB gerado dinamicamente (fallback)
        if (generatedGlbUrl) {
            console.log('[ARView] ✅ Usando GLB gerado dinamicamente');
            return generatedGlbUrl;
        }

        // PRIORIDADE 3: Modelo no payload (fallback antigo)
        const url = findModelUrl(payload);
        if (url) {
            console.log('[ARView] ✅ Usando modelo do payload (fallback)');
            return url;
        }

        console.log('[ARView] ❌ Nenhum modelo disponível');
        return null;
    }, [glbModels, currentModelIndex, generatedGlbUrl, payload, findModelUrl]);


    useEffect(() => {
        return () => {
            console.log('[ARView] 🧹 Componente DESMONTADO COMPLETAMENTE, resetando TODAS as flags...');
            launchedRef.current = false;
            launchedForContentRef.current = false;
            actionInProgressRef.current = false;
            glbGeneratedRef.current = false;
            glbGenerationInProgressRef.current = false;
            setGeneratedGlbUrl(null);
        };
    }, []);

    // --- VARIÁVEL CHAVE: URL do Modelo Final (Totem ou Astronauta) ---
    // Nota: removido o fluxo automático que buscava um "default" signed URL
    // pelo nome (DEFAULT_MODEL_FILENAME) para evitar referências e lógica
    // residual. Agora a URL final é tomada exclusivamente do payload quando
    // presente; caso contrário usamos um fallback público (Astronaut).

    // Log the final model URL for debugging
    useEffect(() => {
        try {
            console.log('[ARView] finalModelUrl:', finalModelUrl);
        } catch (e) { }
    }, [finalModelUrl]);

    // Read AR support from shared hook (uses cached probe run at app start).
    const supportsAR = useARSupport();

    // Removed preview diagnostics and URL normalization — not needed for native AR path.



    const openNativeARWithModel = useCallback(async (modelUrl?: string | null) => {
        console.log('[ARView] 🎯 ========================================');
        console.log('[ARView] 🎯 openNativeARWithModel INICIADO');
        console.log('[ARView] 🎯 ========================================');

        if (!modelUrl) {
            console.warn('[ARView] ⚠️ modelUrl é null/undefined, abortando');
            return false;
        }

        console.log('[ARView] 📊 Model URL recebida:', modelUrl.substring(0, 150) + '...');
        console.log('[ARView] 📊 Platform:', Platform.OS);
        setStatusMessage(UIMessages.LAUNCHING);

        // Gate global para evitar múltiplas instâncias do AR nativo
        if (isARActive()) {
            if (isSameARModel(modelUrl)) {
                console.log('[ARView] ⛔ Sessão AR já ativa para este modelo — ignorando nova abertura');
                return true;
            } else {
                console.log('[ARView] ⛔ Sessão AR já ativa (modelo diferente) — bloqueando nova abertura');
                try { Alert.alert('RA já aberta', 'Feche a RA atual antes de abrir outra.'); } catch { }
                return true;
            }
        }

        let launched = false;

        // ✅ MUDANÇA CRÍTICA: Ativar gate ANTES de abrir AR
        // Isso garante que useFocusEffect vê isARActive()=true quando tela perde/ganha foco rapidamente
        console.log('[ARView] 🔓 Ativando gate ANTES de abrir AR...');
        try { activateAR(modelUrl); } catch { }

        // Android: Scene Viewer via HTTPS (mais compatível)
        if (Platform.OS === 'android') {
            console.log('[ARView] 🤖 Android: Abrindo Scene Viewer (HTTPS)...');
            try {
                const sceneViewerUrl = `https://arvr.google.com/scene-viewer/1.2?file=${encodeURIComponent(modelUrl)}&mode=ar_preferred`;
                await Linking.openURL(sceneViewerUrl);
                launched = true;
                console.log('[ARView] ✅ Scene Viewer aberto com sucesso!');
            } catch (e) {
                console.error('[ARView] ❌ Scene Viewer falhou:', e);
                // Desativa gate se falhou
                console.log('[ARView] 🔒 Desativando gate pois abertura falhou...');
                try { deactivateAR(); } catch { }
            }
        }

        // iOS: Quick Look
        if (Platform.OS === 'ios') {
            console.log('[ARView] 🍎 iOS: Tentando Quick Look...');
            try {
                await Linking.openURL(modelUrl);
                launched = true;
                console.log('[ARView] ✅ Quick Look aberto com sucesso!');
            } catch (e) {
                console.error('[ARView] ❌ Quick Look falhou:', e);
                // Desativa gate se falhou
                console.log('[ARView] 🔒 Desativando gate pois abertura falhou...');
                try { deactivateAR(); } catch { }
            }
        }

        if (!launched) {
            console.error('[ARView] ❌ NENHUM MÉTODO DE AR FUNCIONOU!');
            setStatusMessage(UIMessages.ERROR);
            Alert.alert('AR Indisponível', UIMessages.ERROR);
            // Gate já foi desativada no catch acima
        } else {
            console.log('[ARView] ✅ AR lançado com sucesso, retornando true');
            setStatusMessage(UIMessages.READY);
            // ✅ CRÍTICO: Marca que AR foi lançada para conteúdo (precisa exibir conteúdo ao fechar)
            launchedForContentRef.current = true;
            // Gate já foi ativada no início
        }

        console.log('[ARView] 🎯 openNativeARWithModel FINALIZADO, launched:', launched);
        return launched;
    }, []);

    // Removed in-WebView AR trigger; we now generate/launch GLB from backend when needed

    // --- LÓGICA DE INICIALIZAÇÃO DA MENSAGEM ---
    useEffect(() => {
        // Se o modelo final existe e não estamos mais carregando, o sistema está pronto para o clique
        if (!loading && finalModelUrl) {
            setStatusMessage(UIMessages.READY);
        }
    }, [loading, finalModelUrl]);

    // No remote fallback models: we only use payload-provided models. If
    // there's no model, UI will show an informational message and not offer
    // an AR button.

    // ✅ DESABILITADO: Auto-launch removido - agora mostramos conteúdo primeiro
    // Auto-launch effect: quando tivermos uma URL final e não estivermos já lançando, abra o AR nativo.
    // Deve estar acima dos retornos condicionais para não alterar a ordem de Hooks entre renders.

    // REMOVIDO: Auto-launch AR - agora usuário precisa clicar em "Ver em RA"
    /*
    useEffect(() => {
        console.log('[ARView] 🔄 Auto-launch effect executado');
        if (isARActive()) {
            console.log('[ARView] ⏸️ Auto-launch: já existe AR ativa (gate global), pulando...');
            return;
        }
        console.log('[ARView] 📊 Estado atual:');
        console.log('[ARView]    - loading:', loading);
        console.log('[ARView]    - finalModelUrl:', finalModelUrl ? 'EXISTE' : 'NULL');
        console.log('[ARView]    - launchedRef.current:', launchedRef.current);
        console.log('[ARView]    - shouldAutoLaunch:', shouldAutoLaunch);
        console.log('[ARView]    - generatedGlbUrl (STATE):', generatedGlbUrl ? 'EXISTE' : 'NULL');

        if (loading) {
            console.log('[ARView] ⏸️ Auto-launch: aguardando fim do loading...');
            return;
        }
        if (!finalModelUrl) {
            console.log('[ARView] ⏸️ Auto-launch: sem modelo, aguardando geração...');
            return;
        }
        if (launchedRef.current) {
            console.log('[ARView] ⏸️ Auto-launch: já lançado anteriormente (launchedRef=true), pulando...');
            return;
        }
        // ✅ MUDANÇA: Permitir auto-launch se shouldAutoLaunch=true OU se já existe GLB gerado (reentrada)
        if (!shouldAutoLaunch && !generatedGlbUrl) {
            console.log('[ARView] ⏸️ Auto-launch: shouldAutoLaunch=FALSE e nenhum GLB gerado, pulando...');
            return;
        }

        console.log('[ARView] ✅ Condições para auto-launch atendidas!');
        console.log('[ARView] 🎯 Setando launchedRef.current = true');
        launchedRef.current = true;
        launchedForContentRef.current = true;
        launchedAtRef.current = Date.now(); // ✅ Marca timestamp do launch
        setShouldAutoLaunch(false); // ✅ Desabilita flag após executar

        console.log('[ARView] 🚀 Auto-lançando AR nativo com modelo...');
        (async () => {
            try {
                const ok = await openNativeARWithModel(finalModelUrl);
                if (!ok) {
                    console.warn('[ARView] ⚠️ Auto-launch falhou');
                    launchedRef.current = false;
                    launchedForContentRef.current = false;
                    launchedAtRef.current = 0;
                } else {
                    console.log('[ARView] ✅ AR nativo lançado com sucesso via auto-launch');
                }
            } catch (e) {
                console.warn('[ARView] ❌ auto-launch failed', e);
                launchedRef.current = false;
                launchedForContentRef.current = false;
                launchedAtRef.current = 0;
            }
        })();
    }, [loading, finalModelUrl, shouldAutoLaunch, generatedGlbUrl, focusCounter, openNativeARWithModel, setShouldAutoLaunch]);
    */

    // REMOVIDO: Auto-generate GLB - agora apenas extraímos GLBs existentes dos blocos
    /*
    // Auto-generate GLB when there's no model in payload
    useEffect(() => {
        console.log('[ARView] 🔄 Auto-generate effect executado');
        console.log('[ARView] 📊 Estado atual:');
        console.log('[ARView]    - loading:', loading);
        console.log('[ARView]    - finalModelUrl:', finalModelUrl ? 'EXISTE' : 'NULL');
        console.log('[ARView]    - payload:', payload ? 'EXISTE' : 'NULL');
        console.log('[ARView]    - glbGenerationInProgressRef.current:', glbGenerationInProgressRef.current);
        console.log('[ARView]    - glbGeneratedRef.current:', glbGeneratedRef.current);
        console.log('[ARView]    - generatedGlbUrl (STATE):', generatedGlbUrl ? 'EXISTE' : 'NULL');

        if (loading) {
            console.log('[ARView] ⏸️ Auto-generate: aguardando fim do loading...');
            return;
        }
        if (finalModelUrl) {
            console.log('[ARView] ⏸️ Auto-generate: já tem modelo, não precisa gerar');
            console.log('[ARView]    - Origem do modelo:', generatedGlbUrl ? 'GERADO (STATE)' : 'PAYLOAD');
            return;
        }
        if (isARActive()) {
            console.log('[ARView] ⏸️ Auto-generate: AR ativo (gate global) — aguardando fechamento para gerar');
            return;
        }
        if (!payload) {
            console.log('[ARView] ⏸️ Auto-generate: sem payload');
            return;
        }
        if (glbGenerationInProgressRef.current) {
            console.log('[ARView] ⏸️ Auto-generate: geração já em andamento');
            return;
        }
        if (glbGeneratedRef.current) {
            console.log('[ARView] ⏭️ GLB já foi gerado anteriormente, pulando...');
            console.log('[ARView] 📍 Estado:');
            console.log('[ARView]    - glbGeneratedRef:', glbGeneratedRef.current);
            console.log('[ARView]    - generatedGlbUrl (STATE):', generatedGlbUrl ? 'EXISTE' : 'NULL');
            console.log('[ARView]    - finalModelUrl:', finalModelUrl ? 'EXISTE' : 'NULL');
            if (!generatedGlbUrl && !finalModelUrl) {
                console.log('[ARView] ⚠️ ATENÇÃO: glbGeneratedRef=true mas ambos finalModelUrl e generatedGlbUrl são NULL!');
                console.log('[ARView] ⚠️ Isso indica que o estado foi perdido - vamos REGENERAR');
                glbGeneratedRef.current = false; // ✅ Reseta para forçar regeração
                glbGenerationInProgressRef.current = false;
            } else {
                return; // já gerou GLB nesta sessão, não gerar de novo
            }
        }

        console.log('[ARView] 💡 Auto-gerando GLB pois não há modelo no payload...');
        console.log('[ARView] 🎯 Setando glbGenerationInProgressRef = true');
        if (autoGenTriggeredRef.current) {
            console.log('[ARView] ⏸️ Auto-generate: já disparado para este payload (autoGenTriggeredRef), pulando');
            return;
        }
        autoGenTriggeredRef.current = true;
        glbGenerationInProgressRef.current = true; // Marca que está gerando AGORA
        // ✅ CORREÇÃO: NÃO seta glbGeneratedRef aqui, só depois que o GLB for realmente gerado
    }, [loading, finalModelUrl, payload, generatedGlbUrl]); // ✅ Adiciona generatedGlbUrl para detectar mudanças

    // ✅ NOVO: useEffect separado que dispara handleVerEmRA quando necessário
    useEffect(() => {
        // Só executa se glbGenerationInProgressRef está true MAS handleVerEmRA ainda não foi chamado
        if (!loading && !finalModelUrl && payload && glbGenerationInProgressRef.current && !actionInProgressRef.current) {
            console.log('[ARView] 🚀 Disparando geração de GLB via handleVerEmRA...');

            const generateGLB = async () => {
                await handleVerEmRA();
            };

            // Evita agendar mais de uma vez
            if (generationScheduledRef.current) {
                console.log('[ARView] ⏸️ Geração já agendada (generationScheduledRef), pulando');
                return;
            }
            generationScheduledRef.current = true;
            // Pequeno delay para UI renderizar
            const timer = setTimeout(generateGLB, 100);
            return () => clearTimeout(timer);
        }

        return undefined; // ✅ Sempre retorna algo
    }, [loading, finalModelUrl, payload]); // Observa estados principais
    */

    // user navigates back to the capture tab we should restart the capture
    // flow (open modal or let them pick another image). This flag will be
    // consumed by the capture screen when it gains focus.
    useEffect(() => {
        try {
            if (!finalModelUrl) {
                setRestartCaptureOnReturn(true);
            } else {
                setRestartCaptureOnReturn(false);
            }
        } catch (e) { }
    }, [finalModelUrl]);

    // When the app returns to foreground after launching AR for content,
    // close this flow and return to previous screen (capture).
    useEffect(() => {
        console.log('[ARView] 📡 ========================================');
        console.log('[ARView] 📡 AppState listener REGISTRADO');
        console.log('[ARView] 📡 Estado atual do AppState:', AppState.currentState);
        console.log('[ARView] 📡 ========================================');

        const onAppStateChange = (nextState: AppStateStatus) => {
            const now = new Date().toISOString().substring(11, 23); // HH:MM:SS.mmm
            console.log(`[ARView] 📱 ========================================`);
            console.log(`[ARView] 📱 [${now}] ⚡ APPSTATE MUDOU PARA: ${nextState}`);
            console.log(`[ARView] 📱 [${now}] ⚡ EVENTO DISPARADO!`);
            console.log(`[ARView] 📱 ========================================`);
            console.log(`[ARView] 📊 [${now}] launchedForContentRef.current:`, launchedForContentRef.current);
            console.log(`[ARView] 📊 [${now}] launchedRef.current:`, launchedRef.current);

            // ✅ CRÍTICO: Desativar gate quando app vai para background (AR foi aberta)
            // Só processa se gate ainda ativa (AR realmente foi aberta, não é App Switcher)
            if (nextState === 'background' && launchedForContentRef.current) {
                const wasARActive = isARActive();
                console.log(`[ARView] 🎬 [${now}] App foi para background — gate ativa: ${wasARActive}`);

                if (wasARActive) {
                    // AR realmente foi aberta, marca timestamp e desativa gate
                    backgroundAtRef.current = Date.now();
                    try { deactivateAR(); } catch { }
                    console.log(`[ARView] ✅ [${now}] AR aberta confirmada, gate desativada`);
                } else {
                    // Gate já foi desativada = App Switcher ou outro evento não-AR
                    console.log(`[ARView] ⏭️ [${now}] Gate já inativa, ignorando background (App Switcher?)`);
                }
                return; // ✅ Early return para clareza
            }

            if (nextState === 'active' && launchedForContentRef.current) {
                const timeInBackground = backgroundAtRef.current > 0 ? Date.now() - backgroundAtRef.current : 999999;

                // App Switcher detection: voltou rápido E background foi registrado recentemente
                // (Scene Viewer leva >2s normalmente, App Switcher é instantâneo)
                if (timeInBackground < 2000 && backgroundAtRef.current > 0) {
                    console.log(`[ARView] 🔄 [${now}] Voltou rápido (${timeInBackground}ms) = possível App Switcher, verificando...`);

                    // Se o tempo total desde o launch é muito curto (<3s), definitivamente é App Switcher
                    const timeSinceLaunch = launchedAtRef.current > 0 ? Date.now() - launchedAtRef.current : 999999;
                    if (timeSinceLaunch < 3000) {
                        console.log(`[ARView] ⏭️ [${now}] Launch recente (${timeSinceLaunch}ms), ignorando (App Switcher confirmado)`);
                        backgroundAtRef.current = 0; // ✅ Reseta para próxima transição
                        return; // ✅ Ignora esta transição
                    }

                    // Caso contrário, pode ser AR fechando rápido - continua processando
                    console.log(`[ARView] ⚠️ [${now}] Tempo desde launch OK (${timeSinceLaunch}ms), processando como AR fechado...`);
                }

                console.log(`[ARView] 🔙 [${now}] ========================================`);
                console.log(`[ARView] 🔙 [${now}] AR FECHADO - Exibindo conteúdo`);
                console.log(`[ARView] 🔙 [${now}] timeInBackground: ${timeInBackground}ms`);
                console.log(`[ARView] 🔙 [${now}] ========================================`);

                // IMPORTANTE: Reseta flags ANTES de exibir conteúdo
                launchedRef.current = false;
                launchedForContentRef.current = false;
                launchedAtRef.current = 0; // ✅ Reseta timestamp
                backgroundAtRef.current = 0; // ✅ Reseta timestamp do background
                // Libera o gate global: consideramos a sessão AR encerrada (redundante, mas seguro)
                try { deactivateAR(); } catch { }

                console.log('[ARView] 🔄 Flags resetadas');
                // NÃO resetar glbGeneratedRef nem generatedGlbUrl - mantém o GLB em cache

                // ✅ MUDANÇA CRÍTICA: Exibir conteúdo ao invés de navegar para recognizer
                console.log(`[ARView] 📺 [${now}] Exibindo conteúdo via AppState listener...`);
                setShowContent(true);
                console.log(`[ARView] ✅ [${now}] Conteúdo exibido com sucesso`);
                return; // ✅ Early return para clareza
            }

            // ✅ Log de outros estados para debug
            console.log(`[ARView] ℹ️ [${now}] AppState ${nextState} - launchedForContent=${launchedForContentRef.current} (sem ação)`);
        };

        const sub = AppState.addEventListener ? AppState.addEventListener('change', onAppStateChange) : null;

        return () => {
            console.log('[ARView] 📡 ========================================');
            console.log('[ARView] 📡 AppState listener REMOVENDO...');
            console.log('[ARView] 📡 ========================================');
            if (sub && sub.remove) sub.remove();
            console.log('[ARView] 📡 AppState listener REMOVIDO');
        };
    }, [router]);

    // ✅ SOLUÇÃO FINAL: Polling timer para detectar AR fechado quando AppState/useFocusEffect falham
    useEffect(() => {
        console.log('[ARView] ⏱️ ========================================');
        console.log('[ARView] ⏱️ Polling timer INICIADO (interval: 500ms)');
        console.log('[ARView] ⏱️ ========================================');

        let tickCount = 0;
        const checkInterval = setInterval(() => {
            tickCount++;

            // Log a cada 10 ticks (5 segundos) para monitorar atividade
            if (tickCount % 10 === 0) {
                console.log(`[ARView] ⏱️ Polling tick #${tickCount} - launchedForContent: ${launchedForContentRef.current}`);
            }

            // Só verifica se AR foi lançada
            if (!launchedForContentRef.current) return;

            const timeSinceLaunch = Date.now() - launchedAtRef.current;
            const timeInBackground = backgroundAtRef.current > 0 ? Date.now() - backgroundAtRef.current : 0;
            const wasARActive = isARActive();

            // Log detalhado quando AR está lançada
            if (tickCount % 2 === 0) { // A cada 1 segundo
                console.log(`[ARView] ⏱️ Check: timeSince=${timeSinceLaunch}ms, timeInBg=${timeInBackground}ms, gateActive=${wasARActive}`);
            }

            // Se AR está ativa, não fazer nada
            if (wasARActive) {
                return;
            }

            // Se lançou há pouco (< 3s), ainda está abrindo
            if (timeSinceLaunch < 3000) {
                return;
            }

            // Se voltou do background há pouco (< 3s), pode ser App Switcher
            if (timeInBackground > 0 && timeInBackground < 3000) {
                return;
            }

            // AR foi fechada! Exibir conteúdo ao invés de navegar
            const now = new Date().toISOString().substring(11, 23);
            console.log(`[ARView] ⏱️ [${now}] ========================================`);
            console.log(`[ARView] ⏱️ [${now}] POLLING: AR FECHADO DETECTADO!`);
            console.log(`[ARView] ⏱️ [${now}] timeSinceLaunch: ${timeSinceLaunch}ms`);
            console.log(`[ARView] ⏱️ [${now}] timeInBackground: ${timeInBackground}ms`);
            console.log(`[ARView] ⏱️ [${now}] gate ativa: ${wasARActive}`);
            console.log(`[ARView] ⏱️ [${now}] ========================================`);

            // Reseta flags
            launchedRef.current = false;
            launchedForContentRef.current = false;
            launchedAtRef.current = 0;
            backgroundAtRef.current = 0;

            // ✅ MUDANÇA: Exibir conteúdo ao invés de navegar
            console.log(`[ARView] ⏱️ [${now}] Exibindo conteúdo via polling...`);
            setShowContent(true);
            console.log(`[ARView] ⏱️ [${now}] ✅ Conteúdo exibido via polling`);
        }, 500); // ✅ Reduzido para 500ms (mais responsivo)

        return () => {
            console.log('[ARView] ⏱️ Polling timer REMOVIDO');
            clearInterval(checkInterval);
        };
    }, [router]);    // Hotspot/message handling removed — não usamos mais hotspots clicáveis

    // Helper: prefere explicitamente a imagem header (subtipo 'header' ou tipo contendo 'topo'),
    // se não existir, cai para a primeira imagem disponível (signed_url > url)
    const findFirstImageUrl = useCallback((p: any): string | null => {
        if (!p) return null;

        // Normaliza blocos (pode vir como p.blocos.blocos ou p.blocos ou p.conteudo)
        let blocks: any[] = [];
        if (p.blocos) {
            if (Array.isArray(p.blocos)) {
                blocks = p.blocos;
            } else if (p.blocos.blocos && Array.isArray(p.blocos.blocos)) {
                blocks = p.blocos.blocos;
            }
        } else if (p.conteudo && Array.isArray(p.conteudo)) {
            blocks = p.conteudo;
        }

        if (blocks.length === 0) {
            console.log('[ARView] findFirstImageUrl: nenhum bloco encontrado');
            return null;
        }

        console.log('[ARView] findFirstImageUrl: encontrados', blocks.length, 'blocos');

        // Helper para verificar se URL é válida (HTTP/HTTPS e não gs://)
        const isValidHttpUrl = (url: string) => {
            return url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
        };

        // Helper para verificar se é base64 válido (deve ter vírgula após o cabeçalho)
        const isValidBase64 = (url: string) => {
            if (!url || typeof url !== 'string') return false;
            if (!url.startsWith('data:image')) return false;
            // Base64 válido tem formato: data:image/png;base64,iVBORw0KG...
            // Se não tem vírgula, é uma URL malformada
            return url.includes(',') && url.indexOf(',') < 100; // vírgula deve estar nos primeiros 100 chars
        };

        // 1) procura por bloco com subtype/header explicitamente (prioridade)
        for (const b of blocks) {
            if (!b || typeof b !== 'object') continue;
            const subtipo = (b.subtipo || b.subType || '').toString().toLowerCase();
            const tipoLabel = (b.tipo || '').toString().toLowerCase();
            if (subtipo === 'header' || tipoLabel.includes('topo') || tipoLabel.includes('header') || tipoLabel.includes('imagem')) {
                console.log('[ARView] findFirstImageUrl: encontrado bloco header/topo/imagem:', tipoLabel);

                // PRIORIDADE 1: previewDataUrl (base64 - não expira)
                if (b.previewDataUrl) {
                    if (isValidBase64(b.previewDataUrl)) {
                        console.log('[ARView] findFirstImageUrl: usando previewDataUrl do header (BASE64 VÁLIDO)');
                        return b.previewDataUrl;
                    } else {
                        console.warn('[ARView] ⚠️ previewDataUrl existe mas NÃO é base64 válido!');
                        console.warn('[ARView] ⚠️ Primeiros 150 chars:', b.previewDataUrl.substring(0, 150));
                        console.warn('[ARView] ⚠️ Tem vírgula?', b.previewDataUrl.includes(','));

                        // ✅ CORREÇÃO: Se previewDataUrl começa com "data:image/" mas não é base64 válido,
                        // pode ser uma URL encoded malformada. Ignora e usa signed_url no lugar.
                        console.warn('[ARView] ⚠️ Ignorando previewDataUrl malformado, tentando signed_url...');
                    }
                }

                // PRIORIDADE 2: signed_url (pode expirar, mas é HTTP válido)
                if (isValidHttpUrl(b.signed_url)) {
                    console.log('[ARView] findFirstImageUrl: usando signed_url do header');
                    return b.signed_url;
                }

                // PRIORIDADE 3: url (fallback)
                if (isValidHttpUrl(b.url)) {
                    console.log('[ARView] findFirstImageUrl: usando url do header');
                    return b.url;
                }

                // carousel/itens dentro do header
                if (Array.isArray(b.items)) {
                    for (const it of b.items) {
                        if (!it) continue;

                        // PRIORIDADE 1: previewDataUrl (base64)
                        if (isValidBase64(it.previewDataUrl)) {
                            console.log('[ARView] findFirstImageUrl: usando previewDataUrl de item do header (BASE64)');
                            return it.previewDataUrl;
                        }

                        // PRIORIDADE 2: signed_url
                        if (isValidHttpUrl(it.signed_url)) {
                            console.log('[ARView] findFirstImageUrl: usando signed_url de item do header');
                            return it.signed_url;
                        }

                        // PRIORIDADE 3: url
                        if (isValidHttpUrl(it.url)) {
                            console.log('[ARView] findFirstImageUrl: usando url de item do header');
                            return it.url;
                        }
                    }
                }
            }
        }

        // 2) fallback: primeira imagem encontrada (prioriza base64)
        console.log('[ARView] findFirstImageUrl: procurando fallback em todos os blocos');
        for (const b of blocks) {
            if (!b) continue;

            // PRIORIDADE 1: previewDataUrl (base64)
            if (isValidBase64(b.previewDataUrl)) {
                console.log('[ARView] findFirstImageUrl: usando previewDataUrl do bloco fallback (BASE64)');
                return b.previewDataUrl;
            }

            // PRIORIDADE 2: signed_url
            if (isValidHttpUrl(b.signed_url)) {
                console.log('[ARView] findFirstImageUrl: usando signed_url do bloco fallback');
                return b.signed_url;
            }

            // PRIORIDADE 3: url
            if (isValidHttpUrl(b.url)) {
                console.log('[ARView] findFirstImageUrl: usando url do bloco fallback');
                return b.url;
            }

            // Dentro de items (carousel)
            if (Array.isArray(b.items)) {
                for (const it of b.items) {
                    if (!it) continue;

                    // PRIORIDADE 1: previewDataUrl (base64)
                    if (isValidBase64(it.previewDataUrl)) {
                        console.log('[ARView] findFirstImageUrl: usando previewDataUrl de item fallback (BASE64)');
                        return it.previewDataUrl;
                    }

                    // PRIORIDADE 2: signed_url
                    if (isValidHttpUrl(it.signed_url)) {
                        console.log('[ARView] findFirstImageUrl: usando signed_url de item fallback');
                        return it.signed_url;
                    }

                    // PRIORIDADE 3: url
                    if (isValidHttpUrl(it.url)) {
                        console.log('[ARView] findFirstImageUrl: usando url de item fallback');
                        return it.url;
                    }
                }
            }
        }

        console.log('[ARView] findFirstImageUrl: nenhuma URL válida encontrada');
        return null;
    }, []);

    // ✅ NOVO: Funções de navegação entre modelos
    const handlePreviousModel = useCallback(() => {
        if (currentModelIndex > 0) {
            console.log('[ARView] ⬅️ Navegando para modelo anterior:', currentModelIndex - 1);
            setCurrentModelIndex(prev => prev - 1);
        }
    }, [currentModelIndex]);

    const handleNextModel = useCallback(() => {
        if (currentModelIndex < glbModels.length - 1) {
            console.log('[ARView] ➡️ Navegando para próximo modelo:', currentModelIndex + 1);
            setCurrentModelIndex(prev => prev + 1);
        }
    }, [currentModelIndex, glbModels.length]);

    const handleVerEmRA = useCallback(async () => {
        console.log('[ARView] 🎬 ========================================');
        console.log('[ARView] 🎬 handleVerEmRA CHAMADO');
        console.log('[ARView] 🎬 ========================================');

        // ✅ CRÍTICO: Verificar gate global ANTES de prosseguir
        if (isARActive()) {
            console.warn('[ARView] ⛔ AR já ativa — bloqueando ação manual');
            try {
                Alert.alert('RA já aberta', 'Feche a RA atual antes de abrir outra.');
            } catch (e) {
                console.warn('[ARView] ⚠️ Não foi possível mostrar alerta:', e);
            }
            return;
        }

        // Prevent duplicate activations
        if (actionInProgressRef.current) {
            console.warn('[ARView] ⚠️ AÇÃO JÁ EM PROGRESSO, ignorando...');
            return;
        }
        actionInProgressRef.current = true;
        console.log('[ARView] ✅ actionInProgressRef setado para true');

        // ✅ NOVO: Se já tem GLB gerado, usar direto sem gerar de novo
        if (generatedGlbUrl) {
            console.log('[ARView] ✅ GLB já existe em cache, usando direto:', generatedGlbUrl.substring(0, 100) + '...');
            launchedRef.current = true;
            launchedForContentRef.current = true;
            launchedAtRef.current = Date.now(); // ✅ Marca timestamp ANTES de abrir AR
            await openNativeARWithModel(generatedGlbUrl);
            actionInProgressRef.current = false;
            return;
        }

        // 1) se o payload já traz um modelo (.glb) use-o
        console.log('[ARView] 🔍 Verificando se payload tem modelo GLB...');
        const payloadModel = findModelUrl(payload);
        if (payloadModel) {
            console.log('[ARView] ✅ Modelo GLB encontrado no payload, usando:', payloadModel.substring(0, 100) + '...');
            launchedRef.current = true;
            launchedForContentRef.current = true;
            launchedAtRef.current = Date.now(); // ✅ Marca timestamp ANTES de abrir AR
            await openNativeARWithModel(payloadModel);
            actionInProgressRef.current = false;
            return;
        }
        console.log('[ARView] ❌ Nenhum modelo GLB no payload');

        console.log('[ARView] 💡 Nenhum modelo no payload, tentando gerar GLB...');        // ⚠️ IMPORTANTE: Deve usar a IMAGEM DO CONTEÚDO (blocos), NÃO a imagem de comparação!
        // previewImage = imagem capturada pela câmera (comparação)
        // blocos = imagens do conteúdo da marca (o que queremos para o AR)

        let imageUrl: string | null = null;

        // PRIORIDADE 1: Busca nos blocos de conteúdo (IMAGEM DA MARCA, não da comparação)
        console.log('[ARView] 🔍 PRIORIDADE 1: Buscando imagem nos blocos de conteúdo...');
        imageUrl = findFirstImageUrl(payload);
        console.log('[ARView] 📊 findFirstImageUrl retornou:', imageUrl ? 'ENCONTRADA' : 'NULL');

        if (imageUrl) {
            console.log('[ARView] ✅ USANDO imagem dos blocos de conteúdo (CORRETO - imagem da marca)');
            console.log('[ARView] 📊 Tipo:',
                imageUrl.startsWith('data:') ? 'BASE64' :
                    imageUrl.startsWith('http') ? 'HTTP/HTTPS' :
                        'DESCONHECIDO'
            );
        }

        // FALLBACK 1.5: previewImage do payload principal (BASE64 da foto tirada)
        if (!imageUrl || (!imageUrl.startsWith('data:') && !imageUrl.startsWith('http'))) {
            console.log('[ARView] 🔍 FALLBACK 1.5: Usando previewImage do payload principal...');
            const mainPreview = payload?.previewImage;
            if (mainPreview && typeof mainPreview === 'string' && mainPreview.startsWith('data:image')) {
                imageUrl = mainPreview;
                console.log('[ARView] ✅ USANDO previewImage do payload (foto tirada pelo usuário)');
            }
        }

        // FALLBACK 2: anchorData (se blocos não tiverem imagem)
        if (!imageUrl) {
            console.log('[ARView] 🔍 FALLBACK 2: Verificando anchorData...');
            const anchorPreview = payload && payload.anchorData && typeof payload.anchorData.previewDataUrl === 'string' ? payload.anchorData.previewDataUrl : (payload && payload.anchorData && typeof payload.anchorData.previewImage === 'string' ? payload.anchorData.previewImage : null);
            console.log('[ARView] 📊 anchorPreview:', anchorPreview ? (anchorPreview.substring(0, 50) + '... (length: ' + anchorPreview.length + ')') : 'NULL');

            if (anchorPreview && anchorPreview.startsWith('data:')) {
                imageUrl = anchorPreview;
                console.log('[ARView] ✅ USANDO anchorData (data:base64)');
            } else if (anchorPreview && (anchorPreview.startsWith('http://') || anchorPreview.startsWith('https://'))) {
                imageUrl = anchorPreview;
                console.log('[ARView] ✅ USANDO anchorData (HTTP)');
            }
        }

        // FALLBACK 3: previewImage (ÚLTIMO RECURSO - é a imagem de comparação, não ideal)
        if (!imageUrl) {
            console.log('[ARView] 🔍 FALLBACK 2: Verificando payload.previewImage (imagem de comparação)...');
            const preview = payload && typeof payload.previewImage === 'string' ? payload.previewImage : null;
            console.log('[ARView] 📊 payload.previewImage:', preview ? (preview.substring(0, 50) + '... (length: ' + preview.length + ')') : 'NULL');

            if (preview && preview.startsWith('data:')) {
                imageUrl = preview;
                console.log('[ARView] ⚠️ USANDO payload.previewImage (data:base64) - ATENÇÃO: imagem de comparação!');
            } else if (preview && (preview.startsWith('http://') || preview.startsWith('https://'))) {
                imageUrl = preview;
                console.log('[ARView] ⚠️ USANDO payload.previewImage (HTTP) - ATENÇÃO: imagem de comparação!');
            }
        }

        // Se não encontrou NENHUMA imagem
        if (!imageUrl) {
            console.warn('[ARView] ❌ Nenhuma mídia válida encontrada para gerar GLB');
            try { Alert.alert('Conteúdo não disponível', 'Nenhuma mídia encontrada para abrir em RA.'); } catch (e) { }
            actionInProgressRef.current = false;
            return;
        }

        console.log('[ARView] ✅ Imagem selecionada para gerar GLB');
        console.log('[ARView] 📊 imageUrl tipo:',
            imageUrl.startsWith('data:') ? 'BASE64 (não expira)' :
                imageUrl.startsWith('http') ? 'HTTP/HTTPS (pode expirar)' :
                    'DESCONHECIDO'
        );
        console.log('[ARView] 📊 imageUrl (primeiros 100 chars):', imageUrl.substring(0, 100) + '...'); try {
            console.log('[ARView] 🔨 ========================================');
            console.log('[ARView] 🔨 INICIANDO GERAÇÃO DE GLB');
            console.log('[ARView] 🔨 ========================================');
            setStatusMessage('Gerando modelo AR...');

            // Se a URL é HTTP/HTTPS, baixar localmente e converter para base64 para evitar falha de download no backend
            if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                console.log('[ARView] 🔄 Baixando imagem no cliente para converter em base64...');
                try {
                    const baseDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
                    const target = `${baseDir}ar_source_img_${Date.now()}`;
                    const downloadRes: any = await FileSystem.downloadAsync(imageUrl, target);
                    const status = downloadRes?.status;
                    const headers = (downloadRes?.headers) || {} as Record<string, string>;
                    const ct = (headers['content-type'] || headers['Content-Type'] || '').toString();
                    console.log('[ARView] 📥 Download local status:', status, 'content-type:', ct || 'desconhecido');
                    if (status === 200 || (ct && ct.startsWith('image/'))) {
                        let mime = 'image/jpeg';
                        try {
                            if (ct && ct.startsWith('image/')) {
                                mime = ct;
                            } else {
                                const lower = imageUrl.toLowerCase();
                                if (lower.endsWith('.png')) mime = 'image/png';
                                else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
                            }
                        } catch { }
                        const base64 = await FileSystem.readAsStringAsync(downloadRes.uri, { encoding: 'base64' as any });
                        imageUrl = `data:${mime};base64,${base64}`;
                        console.log('[ARView] ✅ Imagem convertida para base64 (cliente) — evitando download no backend');
                    } else {
                        console.warn('[ARView] ⚠️ Falha ao baixar imagem no cliente, prosseguindo com URL HTTP');
                    }
                } catch (e) {
                    console.warn('[ARView] ⚠️ Erro ao baixar/ler imagem localmente, prosseguindo com URL HTTP', e);
                }
            }

            // Debug: qual URL estamos enviando para o backend (Metro)
            console.log('[ARView] 📤 URL da imagem para gerar GLB (primeiros 150 chars):', safePreview(imageUrl, 150));
            console.log('[ARView] 📤 Tipo de URL:',
                imageUrl && imageUrl.startsWith('data:') ? 'DATA URI (base64)' :
                    imageUrl && imageUrl.startsWith('http') ? 'HTTP/HTTPS' :
                        'DESCONHECIDO'
            );            // Do not send a transient filename (e.g. with Date.now()) to the backend.
            // The backend generates a stable filename based on the SHA256 of the image_url
            // so we should omit `filename` here to allow cache hits (avoid duplicate GLBs).
            // include owner_uid when available so backend can place the GLB under the proper prefix
            const ownerUid = payload && (payload.owner_uid || payload.ownerUid || payload.owner || null);
            const bodyObj: any = { image_url: imageUrl };
            if (ownerUid) bodyObj.owner_uid = ownerUid;

            console.log('[ARView] 📦 Body do request:', {
                tem_image_url: !!bodyObj.image_url,
                image_url_length: bodyObj.image_url?.length || 0,
                owner_uid: ownerUid || 'não fornecido'
            });

            // No authentication headers needed for anonymous app usage
            const headers: any = { 'Content-Type': 'application/json' };

            const endpoint = `${API_CONFIG.BASE_URL}/api/generate-glb-from-image`;
            console.log('[ARView] 🌐 Endpoint:', endpoint);
            console.log('[ARView] 📤 Enviando POST request...');

            const res = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(bodyObj)
            });

            console.log('[ARView] 📥 ========================================');
            console.log('[ARView] 📥 RESPOSTA RECEBIDA');
            console.log('[ARView] 📥 ========================================');

            // Log do status e do corpo (text) para diagnóstico
            const respText = await res.text();
            console.log('[ARView] 📥 Resposta backend status:', res.status);
            console.log('[ARView] 📥 Resposta backend body (primeiros 500 chars):', respText.substring(0, 500));

            if (!res.ok) {
                console.warn('[ARView] ❌ generate-glb-from-image falhou, status:', res.status);
                console.warn('[ARView] ❌ Corpo da resposta:', respText.substring(0, 300));

                // TENTATIVA DE RECUPERAÇÃO: se a URL era HTTP e falhou ao baixar no backend,
                // tenta novamente enviando uma imagem em base64 (data URL) obtida do payload.
                const failedToDownload = res.status === 400 && respText.includes('Failed to download image');
                const wasHttpUrl = typeof imageUrl === 'string' && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'));

                const isBase64DataUrl = (s?: string | null) => !!(s && typeof s === 'string' && s.startsWith('data:image') && s.includes(','));
                let retryBase64: string | null = null;
                if (failedToDownload && wasHttpUrl) {
                    // Preferência: algum previewDataUrl válido nos blocos
                    try {
                        const blocosArr: any[] = payload?.blocos?.blocos || payload?.blocos || payload?.conteudo || [];
                        if (Array.isArray(blocosArr)) {
                            for (const b of blocosArr) {
                                if (isBase64DataUrl(b?.previewDataUrl)) { retryBase64 = b.previewDataUrl; break; }
                                if (Array.isArray(b?.items)) {
                                    const it = b.items.find((x: any) => isBase64DataUrl(x?.previewDataUrl));
                                    if (it) { retryBase64 = it.previewDataUrl; break; }
                                }
                            }
                        }
                    } catch { }

                    // Fallback 2: anchorData preview
                    if (!retryBase64) {
                        const ap = payload?.anchorData?.previewDataUrl || payload?.anchorData?.previewImage || null;
                        if (isBase64DataUrl(ap)) retryBase64 = ap;
                    }

                    // Fallback 3: previewImage (imagem de comparação)
                    if (!retryBase64) {
                        const prev = (typeof payload?.previewImage === 'string') ? payload?.previewImage : null;
                        if (isBase64DataUrl(prev)) retryBase64 = prev as string;
                    }

                    if (retryBase64) {
                        console.log('[ARView] 🔁 Retentando geração com DATA URL base64 (cliente)');
                        const retryBody: any = { image_url: retryBase64 };
                        const res2 = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(retryBody) });
                        const t2 = await res2.text();
                        console.log('[ARView] 📥 Retentativa status:', res2.status);
                        if (!res2.ok) {
                            console.warn('[ARView] ❌ Retentativa com base64 falhou');
                            console.warn('[ARView] ❌ Corpo:', t2.substring(0, 300));
                            try { Alert.alert('Erro ao gerar modelo AR', `Status ${res2.status}\n${t2.substring(0, 200)}`); } catch (e) { }
                            openNativeARWithModel(finalModelUrl);
                            return;
                        } else {
                            let j2: any = null;
                            try { j2 = t2 ? JSON.parse(t2) : {}; } catch { }
                            const glb2 = j2 && (j2.glb_signed_url || j2.glb_url || j2.glbSignedUrl);
                            if (glb2) {
                                console.log('[ARView] ✅ GLB gerado com sucesso via retentativa base64');
                                setGeneratedGlbUrl(glb2);
                                glbGeneratedRef.current = true;
                                glbGenerationInProgressRef.current = false;
                                launchedRef.current = true;
                                launchedForContentRef.current = true;
                                launchedAtRef.current = Date.now(); // ✅ Marca timestamp ANTES de abrir AR
                                await openNativeARWithModel(glb2);
                                actionInProgressRef.current = false;
                                return;
                            } else {
                                console.warn('[ARView] ❌ Retentativa: resposta sem GLB');
                                try { Alert.alert('Erro', 'Não foi possível gerar o modelo AR.'); } catch (e) { }
                                openNativeARWithModel(finalModelUrl);
                                return;
                            }
                        }
                    }
                }

                try { Alert.alert('Erro ao gerar modelo AR', `Status ${res.status}\n${respText.substring(0, 200)}`); } catch (e) { }
                openNativeARWithModel(finalModelUrl);
                return;
            }

            // tenta parsear JSON seguro
            let j: any = null;
            try { j = respText ? JSON.parse(respText) : {}; } catch (e) { console.warn('[ARView] ⚠️ parse JSON falhou', e); }

            const glbUrl = j && (j.glb_signed_url || j.glb_url || j.glbSignedUrl);
            if (glbUrl) {
                console.log('[ARView] ✅ GLB gerado com sucesso!');
                console.log('[ARView] 📊 URL do GLB:', glbUrl.substring(0, 100) + '...');
                console.log('[ARView] 💾 Salvando GLB no STATE para persistir entre navegações...');

                // Salva o GLB gerado no STATE (para reatividade)
                setGeneratedGlbUrl(glbUrl); // STATE - dispara re-render e atualiza finalModelUrl

                // ✅ CORREÇÃO: Marca que GLB foi gerado com SUCESSO (só agora!)
                console.log('[ARView] 🎯 Setando glbGeneratedRef = true (GLB gerado com sucesso)');
                glbGeneratedRef.current = true;

                // Reseta flag de geração em andamento
                glbGenerationInProgressRef.current = false;

                console.log('[ARView] 🎯 Preparando para abrir AR nativo...');
                launchedRef.current = true; // Marca que lançou AR (evita auto-launch duplicado)
                launchedForContentRef.current = true;
                launchedAtRef.current = Date.now(); // ✅ Marca timestamp ANTES de abrir AR
                console.log('[ARView] ⏰ launchedAtRef setado para:', launchedAtRef.current);
                console.log('[ARView] 🚀 Chamando openNativeARWithModel...');
                await openNativeARWithModel(glbUrl);
                console.log('[ARView] ✅ openNativeARWithModel concluído');
                actionInProgressRef.current = false;
                return;
            }

            console.warn('[ARView] ❌ generate-glb-from-image: sem glb_signed_url na resposta');
            console.warn('[ARView] ❌ Resposta completa:', j || respText);
            try { Alert.alert('Erro', 'Não foi possível gerar o modelo AR.'); } catch (e) { }
        } catch (e) {
            console.warn('[ARView] ❌ Erro gerando GLB:', e);
            try { Alert.alert('Erro', 'Não foi possível gerar o modelo AR.'); } catch (e) { }
        } finally {
            setStatusMessage(UIMessages.READY);
            actionInProgressRef.current = false;
            glbGenerationInProgressRef.current = false; // Garante reset mesmo em erro
            generationScheduledRef.current = false; // Libera novo agendamento
        }
    }, [payload, finalModelUrl, findModelUrl, findFirstImageUrl, openNativeARWithModel]);

    // Função para iniciar geração de GLB sob demanda
    const scheduleGlbGeneration = useCallback(async () => {
        console.log('[ARView] 🔧 scheduleGlbGeneration iniciado');
        setIsGeneratingGlb(true);

        try {
            await handleVerEmRA();
        } catch (error) {
            console.error('[ARView] ❌ Erro ao gerar GLB:', error);
            Alert.alert('Erro', 'Não foi possível preparar o modelo AR.');
        } finally {
            setIsGeneratingGlb(false);
        }
    }, [handleVerEmRA]);

    // --- Renderização ---

    // Estado 1: Carregamento Inicial (enquanto payload não chega)
    if (loading) {
        return <LoadingWithTips visible={true} stage="Carregando conteúdo..." />;
    }

    // ✅ NOVO: Estado 2: Conteúdo após fechar AR
    if (showContent && payload) {
        console.log('[ARView] 📋 Renderizando tela de conteúdo...');
        console.log('[ARView] 📋 payload existe:', !!payload);
        console.log('[ARView] 📋 payload.blocos:', payload.blocos ? 'EXISTE' : 'NULL');

        // Extrai blocos do payload
        let blocos: any[] = [];
        if (payload.blocos) {
            if (Array.isArray(payload.blocos)) {
                blocos = payload.blocos;
                console.log('[ARView] 📋 Blocos extraídos diretamente (array):', blocos.length);
            } else if (payload.blocos.blocos && Array.isArray(payload.blocos.blocos)) {
                blocos = payload.blocos.blocos;
                console.log('[ARView] 📋 Blocos extraídos de .blocos.blocos:', blocos.length);
            }
        } else if (payload.conteudo && Array.isArray(payload.conteudo)) {
            blocos = payload.conteudo;
            console.log('[ARView] 📋 Blocos extraídos de .conteudo:', blocos.length);
        }

        console.log('[ARView] 📋 Total de blocos a renderizar:', blocos.length);
        blocos.forEach((b, i) => {
            console.log(`[ARView] 📋 Bloco ${i}: tipo="${b?.tipo}", subtipo="${b?.subtipo}"`);
        });

        return (
            <>
                <CustomHeader title="Conteúdo" />
                <View style={styles.contentContainer}>
                    {/* Botão Ver em RA - sempre visível quando há conteúdo */}
                    <Pressable
                        style={styles.reopenARButton}
                        onPress={() => {
                            console.log('[ARView] 🎯 ========================================');
                            console.log('[ARView] 🎯 Botão "Ver em RA" clicado');
                            console.log('[ARView] 🎯 Total de GLBs disponíveis:', glbModels.length);
                            console.log('[ARView] 🎯 Índice atual:', currentModelIndex);
                            console.log('[ARView] 🎯 GLBs encontrados:', glbModels.map((m, i) => ({
                                index: i,
                                blockIndex: m.blockIndex,
                                url: m.url.substring(0, 60) + '...'
                            })));
                            console.log('[ARView] 🎯 ========================================');

                            // Prioridade 1: GLB dos blocos
                            if (glbModels.length > 0) {
                                const modelToLaunch = glbModels[currentModelIndex].url;
                                console.log('[ARView] ✅ Usando GLB do bloco [' + currentModelIndex + ']:', modelToLaunch.substring(0, 80) + '...');
                                launchedRef.current = true;
                                launchedForContentRef.current = true;
                                launchedAtRef.current = Date.now();
                                openNativeARWithModel(modelToLaunch);
                                return;
                            }

                            // Prioridade 2: GLB gerado ou do payload
                            if (finalModelUrl) {
                                console.log('[ARView] ✅ Usando GLB gerado/payload:', finalModelUrl.substring(0, 80) + '...');
                                launchedRef.current = true;
                                launchedForContentRef.current = true;
                                launchedAtRef.current = Date.now();
                                openNativeARWithModel(finalModelUrl);
                                return;
                            }

                            // Prioridade 3: Gerar GLB sob demanda
                            console.log('[ARView] 🔧 Nenhum GLB disponível, gerando sob demanda...');
                            if (payload?.previewImage) {
                                setIsGeneratingGlb(true);
                                scheduleGlbGeneration();
                            } else {
                                console.log('[ARView] ❌ Sem imagem preview para gerar GLB');
                                Alert.alert(
                                    'Erro',
                                    'Não foi possível gerar o modelo 3D. Imagem não disponível.',
                                    [{ text: 'OK' }]
                                );
                            }
                        }}
                        disabled={isGeneratingGlb}
                    >
                        <Text style={styles.reopenARText}>
                            {isGeneratingGlb
                                ? '⏳ Preparando AR...'
                                : (launchedForContentRef.current ? '🔄 Ver novamente em AR' : '🎯 Ver em RA')
                            }
                        </Text>
                    </Pressable>


                    {/* Controles de navegação entre modelos */}
                    {glbModels.length > 1 && (
                        <ARNavigationControls
                            currentIndex={currentModelIndex}
                            totalModels={glbModels.length}
                            onPrevious={handlePreviousModel}
                            onNext={handleNextModel}
                        />
                    )}

                    {/* Renderiza blocos de conteúdo */}
                    <ContentBlocks blocos={blocos} />
                </View>
            </>
        );
    }

    // Estado 3: Tela vazia se não há payload (não deveria acontecer)
    return (
        <>
            <CustomHeader title="Conteúdo" />
            <View style={styles.center}>
                <Text style={{ color: 'white', fontSize: 16 }}>Nenhum conteúdo disponível</Text>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'black' },
    fullScreenContainer: {
        flex: 1,
        backgroundColor: 'black',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        marginTop: -18, // Adiciona sobreposição de 14px sobre o header
        justifyContent: 'center',
    },
    launchText: { color: 'white', marginTop: 10 },
    bottomBar: {
        position: 'absolute',
        bottom: 50,
        zIndex: 10,
        width: '100%',
    },
    mainActionButton: {
        backgroundColor: '#3498db',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 8,
    },
    mainActionText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    overlayNative: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2,
        alignItems: 'center',
        paddingTop: 50,
        pointerEvents: 'box-none',
    },
    contentOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 20,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    contentCard: {
        width: '94%',
        maxHeight: '78%',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
    },
    contentTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, color: '#111' },
    contentScroll: { maxHeight: 380 },
    blockRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'center' },
    blockImage: { width: '100%', height: 80, marginRight: 10, borderRadius: 6, resizeMode: 'cover' },
    blockText: { flex: 1, color: '#222' },
    closeButton: { marginTop: 8, backgroundColor: '#3498db', padding: 10, borderRadius: 8, alignItems: 'center' },
    closeButtonText: { color: 'white', fontWeight: '700' },
    // ✅ NOVOS ESTILOS: Tela de conteúdo
    contentContainer: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        marginTop: -18, // Sobrepõe 18px sobre o header
        //paddingTop: 16,
    },
    reopenARButton: {
        backgroundColor: '#3498db',
        paddingHorizontal: 24,
        paddingVertical: 14,
        margin: 4,
        borderRadius: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    reopenARText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});

