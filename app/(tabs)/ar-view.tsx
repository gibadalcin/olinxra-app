import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Linking, Alert, Platform, AppState, AppStateStatus, Pressable } from 'react-native';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter, useFocusEffect } from 'expo-router';
import { API_CONFIG } from '../../config/api';
import { ARLauncher, ARNavigationControls } from '@/components/ar';
import { useARPayload } from '@/context/ARPayloadContext'; // âœ… Usar Context
import { setRestartCaptureOnReturn } from '@/utils/lastARContent';
import useARSupport from '@/hooks/useARSupport';
import CustomHeader from '@/components/CustomHeader';
import { isARActive, isSameARModel, activateAR, deactivateAR } from '@/utils/arGate';
import { ContentBlocks } from '@/components/ContentBlocks'; // âœ… Componente de blocos de conteÃºdo



// DefiniÃ§Ã£o das mensagens de estado da UI
const UIMessages = {
    INITIAL: 'Carregando modelo 3D...',
    LAUNCHING: 'Iniciando AR Nativo...',
    ERROR: 'Falha ao iniciar o AR Nativo.',
    READY: 'Pronto para visualizar em AR.'
};

// Componente de View Principal
export default function ARViewScreen() {
    // âœ… USA CONTEXT para payload e GLB
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
    const [glbModels, setGlbModels] = useState<Array<{ url: string; blockIndex: number }>>([]);
    const [currentModelIndex, setCurrentModelIndex] = useState(0);

    const launchedRef = useRef(false); // Flag para auto-LAUNCH (abrir AR)
    const launchedForContentRef = useRef(false);
    const launchedAtRef = useRef<number>(0); // âœ… Timestamp de quando lanÃ§ou AR (evita reset prematuro)
    const backgroundAtRef = useRef<number>(0); // âœ… Timestamp de quando foi para background (detecta App Switcher)
    const actionInProgressRef = useRef(false);
    const glbGeneratedRef = useRef(false); // Flag para saber se jÃ¡ gerou GLB nesta sessÃ£o
    const glbGenerationInProgressRef = useRef(false); // Flag para saber se estÃ¡ gerando GLB agora
    const lastPayloadRef = useRef<any>(null); // âœ… Armazena chave do payload anterior
    const closingNavRef = useRef(false); // âœ… Bloqueia efeitos automÃ¡ticos durante navegaÃ§Ã£o de saÃ­da
    const autoGenTriggeredRef = useRef(false); // âœ… Evita disparo duplo de geraÃ§Ã£o para o mesmo payload
    const generationScheduledRef = useRef(false); // âœ… Evita agendar handleVerEmRA mais de uma vez

    // âœ… CRÃTICO: Log de montagem/desmontagem do componente
    useEffect(() => {
        console.log('[ARView] ðŸ—ï¸ ========================================');
        console.log('[ARView] ðŸ—ï¸ COMPONENTE MONTADO');
        console.log('[ARView] ðŸ—ï¸ Refs iniciais:');
        console.log('[ARView] ðŸ—ï¸   - launchedRef:', launchedRef.current);
        console.log('[ARView] ðŸ—ï¸   - glbGeneratedRef:', glbGeneratedRef.current);
        console.log('[ARView] ðŸ—ï¸   - lastPayloadRef:', lastPayloadRef.current);
        console.log('[ARView] ðŸ—ï¸ ========================================');

        return () => {
            console.log('[ARView] ðŸ’¥ ========================================');
            console.log('[ARView] ðŸ’¥ COMPONENTE DESMONTANDO');
            console.log('[ARView] ðŸ’¥ ========================================');
        };
    }, []);

    // evitar re-requests de fallback repetidos (marca nomes de arquivo jÃ¡ tentados)    // NOTE: removed preview/transform variant handling â€” we open payload model or generate via backend when requested.

    // FunÃ§Ã£o auxiliar para buscar a URL do modelo GLB no payload (mantida)
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

    // FunÃ§Ã£o utilitÃ¡ria: busca recursiva por chaves de texto (case-insensitive)
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
                // don't include the whole base64 in Alerts â€” show type and length and a tiny prefix
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
    // âœ… SIMPLIFICADO: Context gerencia o payload e shouldAutoLaunch
    useFocusEffect(
        React.useCallback(() => {
            console.log('[ARView] ðŸŽ¬ ðŸ”„ ========================================');
            console.log('[ARView] ðŸŽ¬ ðŸ”„ TELA GANHOU FOCO - useFocusEffect EXECUTADO');
            console.log('[ARView] ðŸŽ¬ ðŸ”„ ========================================');
            console.log('[ARView] ðŸ“Š Estado do Context:');
            console.log('[ARView]    - payload:', payload ? `EXISTE (${payload.nome_marca})` : 'NULL');
            console.log('[ARView]    - generatedGlbUrl:', generatedGlbUrl ? 'EXISTE' : 'NULL');
            console.log('[ARView]    - shouldAutoLaunch:', shouldAutoLaunch);
            console.log('[ARView] ðŸ“Š Estado dos Refs:');
            console.log('[ARView]    - launchedRef.current:', launchedRef.current);
            console.log('[ARView]    - launchedForContentRef.current:', launchedForContentRef.current);

            // âœ… SOLUÃ‡ÃƒO ALTERNATIVA: Se voltou para tela E launchedForContent=true E gate desativada
            // = AR foi fechada, precisa navegar de volta
            if (launchedForContentRef.current && !isARActive()) {
                const timeSinceLaunch = Date.now() - launchedAtRef.current;
                const timeInBackground = backgroundAtRef.current > 0 ? Date.now() - backgroundAtRef.current : 999999;

                // Se lanÃ§ou hÃ¡ pouco tempo (< 2s), ainda estÃ¡ abrindo AR, nÃ£o processar
                if (timeSinceLaunch < 2000) {
                    console.log(`[ARView] â¸ï¸ Launch recente (${timeSinceLaunch}ms atrÃ¡s), NÃƒO resetando launchedRef (protege contra App Switcher)`);

                    // âœ… NOVO: Inicia timer de verificaÃ§Ã£o para detectar quando AR fecha
                    console.log('[ARView] ðŸ” Iniciando timer de verificaÃ§Ã£o (3s apÃ³s launch)...');
                    console.log('[ARView] ðŸ” Estado atual:');
                    console.log('[ARView] ðŸ”   - launchedForContentRef:', launchedForContentRef.current);
                    console.log('[ARView] ðŸ”   - isARActive():', isARActive());
                    console.log('[ARView] ðŸ”   - timeSinceLaunch:', timeSinceLaunch, 'ms');

                    setTimeout(() => {
                        const now = new Date().toISOString().substring(11, 23);
                        console.log(`[ARView] ðŸ” [${now}] â° TIMER DISPAROU!`);
                        console.log(`[ARView] ðŸ” [${now}] Verificando estado...`);
                        console.log(`[ARView] ðŸ” [${now}]   - launchedForContentRef:`, launchedForContentRef.current);
                        console.log(`[ARView] ðŸ” [${now}]   - isARActive():`, isARActive());

                        // âœ… CRÃTICO: SÃ³ exibir conteÃºdo se AR foi fechada E ainda hÃ¡ flags setadas
                        // Se launchedForContentRef=false, significa que jÃ¡ resetou
                        if (launchedForContentRef.current && !isARActive()) {
                            const now2 = new Date().toISOString().substring(11, 23);
                            console.log(`[ARView] ðŸ” [${now2}] âœ… Timer detectou: AR foi fechada!`);
                            console.log(`[ARView] ðŸ” [${now2}] Resetando flags e exibindo conteÃºdo...`);

                            // Reseta flags PRIMEIRO
                            launchedRef.current = false;
                            launchedForContentRef.current = false;
                            launchedAtRef.current = 0;
                            backgroundAtRef.current = 0;

                            // âœ… MUDANÃ‡A: Exibir conteÃºdo ao invÃ©s de navegar
                            console.log(`[ARView] ðŸ” [${now2}] Exibindo conteÃºdo via timer...`);
                            setShowContent(true);
                            console.log(`[ARView] ðŸ” [${now2}] âœ… ConteÃºdo exibido via timer`);
                        } else if (!launchedForContentRef.current) {
                            const now3 = new Date().toISOString().substring(11, 23);
                            console.log(`[ARView] ðŸ” [${now3}] â¸ï¸ Timer disparou mas launchedForContentRef=false (jÃ¡ navegou), ignorando`);
                        } else {
                            const now3 = new Date().toISOString().substring(11, 23);
                            console.log(`[ARView] ðŸ” [${now3}] â¸ï¸ Timer disparou mas AR ainda ativa, ignorando`);
                        }
                    }, 3000); // Espera 3s apÃ³s launch inicial

                    console.log('[ARView] ðŸ” Timer criado com sucesso, aguardando 3s...');

                    // âœ… CRÃTICO: NÃƒO cancelar o timer no cleanup!
                    // O timer precisa continuar executando mesmo se a tela perder o foco
                    // (por exemplo, se usuÃ¡rio navegar via App Switcher para outra tela)
                    // O timer vai detectar quando AR fechar e navegar de volta automaticamente
                    return undefined; // Sem cleanup = timer continua executando
                } else if (backgroundAtRef.current > 0 && timeInBackground < 2000) {
                    // Voltou do background rÃ¡pido = App Switcher, nÃ£o AR fechado
                    console.log(`[ARView] ðŸ”„ Voltou do background rÃ¡pido (${timeInBackground}ms) = App Switcher, ignorando...`);
                } else {
                    // AR foi fechada! Mostrar conteÃºdo ao invÃ©s de navegar
                    console.log('[ARView] ðŸ”™ ========================================');
                    console.log('[ARView] ðŸ”™ AR FECHADO detectado via useFocusEffect!');
                    console.log(`[ARView] ðŸ”™ timeSinceLaunch: ${timeSinceLaunch}ms, timeInBackground: ${timeInBackground}ms`);
                    console.log('[ARView] ðŸ”™ Exibindo conteÃºdo...');
                    console.log('[ARView] ðŸ”™ ========================================');

                    // Reseta flags
                    launchedRef.current = false;
                    launchedForContentRef.current = false;
                    launchedAtRef.current = 0;
                    backgroundAtRef.current = 0;

                    // âœ… MUDANÃ‡A: Exibir conteÃºdo ao invÃ©s de navegar
                    setShowContent(true);
                    return; // Early return
                }
            }

            // âœ… MUDANÃ‡A: Resetar launchedRef ao ganhar foco APENAS se nÃ£o hÃ¡ AR ativa (permite reentrada)
            // âœ… CRÃTICO: NÃƒO resetar se lanÃ§ou AR hÃ¡ menos de 2000ms (protege contra App Switcher)
            const timeSinceLaunch = Date.now() - launchedAtRef.current;
            const isRecentLaunch = launchedRef.current && timeSinceLaunch < 2000; // âœ… Aumentado para 2s

            if (!isARActive()) {
                if (isRecentLaunch) {
                    console.log(`[ARView] â¸ï¸ Launch recente (${timeSinceLaunch}ms atrÃ¡s), NÃƒO resetando launchedRef (protege contra App Switcher)`);
                } else {
                    console.log('[ARView] ðŸ”„ Sem AR ativa E sem launch recente, resetando launchedRef para permitir auto-launch');
                    console.log(`[ARView] ðŸ”„ timeSinceLaunch: ${timeSinceLaunch}ms`);
                    launchedRef.current = false;
                    launchedForContentRef.current = false; // âœ… Resetar tambÃ©m launchedForContentRef
                    launchedAtRef.current = 0; // âœ… Resetar timestamp
                    launchedAtRef.current = 0;
                    backgroundAtRef.current = 0; // âœ… Limpa timestamp tambÃ©m
                    // âœ… Incrementa contador para forÃ§ar re-execuÃ§Ã£o do auto-launch effect
                    setFocusCounter(prev => prev + 1);
                }
            } else {
                console.log('[ARView] â¸ï¸ AR ainda ativa, mantendo launchedRef para evitar redisparo');
            }

            setLoading(false);

            return () => {
                console.log('[ARView] ðŸ”™ TELA PERDEU FOCO (componente ainda montado)');
            };
        }, [payload, generatedGlbUrl, shouldAutoLaunch, router]) // âœ… Todas as dependÃªncias do Context + router
    );

    // Cleanup real ao desmontar componente completamente
    useEffect(() => {
        return () => {
            console.log('[ARView] ðŸ§¹ Componente DESMONTADO COMPLETAMENTE');
        };
    }, []);

    // âœ… NOVO: Detecta mudanÃ§a de payload e exibe conteÃºdo automaticamente
    useEffect(() => {
        // âœ… CORREÃ‡ÃƒO: Gera chave Ãºnica usando HASH completo (mesmo algoritmo do Context)
        const previewHash = payload && payload.previewImage
            ? `${payload.previewImage.length}_${payload.previewImage.substring(0, 100)}_${payload.previewImage.substring(payload.previewImage.length - 100)}`
            : 'no-preview';
        const currentPayloadKey = payload
            ? `${payload.nome_marca || 'unknown'}_${previewHash}`
            : null;

        const lastPayloadKey = lastPayloadRef.current;

        if (currentPayloadKey !== lastPayloadKey) {
            console.log('[ARView] ðŸ†• ========================================');
            console.log('[ARView] ðŸ†• NOVO PAYLOAD DETECTADO!');
            console.log('[ARView] ðŸ†• ========================================');
            console.log('[ARView] ðŸ“Š Payload anterior:', lastPayloadKey ? lastPayloadKey.substring(0, 100) + '...' : 'NENHUM');
            console.log('[ARView] ðŸ“Š Payload atual:', currentPayloadKey ? currentPayloadKey.substring(0, 100) + '...' : 'NENHUM');

            // âœ… CORREÃ‡ÃƒO CRÃTICA: Reseta flags para NOVO PAYLOAD
            console.log('[ARView] ðŸ”„ Resetando flags para novo payload...');
            glbGeneratedRef.current = false;
            glbGenerationInProgressRef.current = false;
            actionInProgressRef.current = false;
            launchedRef.current = false;
            autoGenTriggeredRef.current = false;
            closingNavRef.current = false;

            // âœ… IMPORTANTE: Limpa GLB do Context
            console.log('[ARView] ðŸ§¹ Limpando generatedGlbUrl do payload anterior...');
            setGeneratedGlbUrl(null);

            // âœ… NOVO FLUXO: Exibir conteÃºdo automaticamente quando payload chegar
            console.log('[ARView] ï¿½ Exibindo tela de conteÃºdo automaticamente...');
            setShowContent(true);
            setShouldAutoLaunch(false); // âœ… Desabilita auto-launch

            // Atualiza referÃªncia
            lastPayloadRef.current = currentPayloadKey;
        }
    }, [payload, setGeneratedGlbUrl, setShouldAutoLaunch]);

    // âœ… NOVO: Extrair URLs de GLBs dos blocos quando payload mudar
    useEffect(() => {
        console.log('[ARView] ðŸ” ========================================');
        console.log('[ARView] ðŸ” EXTRAINDO GLBs DOS BLOCOS');
        console.log('[ARView] ðŸ” ========================================');

        if (!payload || !payload.blocos) {
            console.log('[ARView] âŒ Nenhum payload ou blocos disponÃ­veis');
            setGlbModels([]);
            setCurrentModelIndex(0);
            return;
        }

        // Normalizar blocos (pode vir como p.blocos.blocos ou p.blocos)
        let blocks: any[] = [];
        if (Array.isArray(payload.blocos)) {
            blocks = payload.blocos;
            console.log('[ARView] ðŸ“¦ Blocos encontrados diretamente em payload.blocos (array)');
        } else if (payload.blocos.blocos && Array.isArray(payload.blocos.blocos)) {
            blocks = payload.blocos.blocos;
            console.log('[ARView] ï¿½ Blocos encontrados em payload.blocos.blocos (nested)');
        }

        console.log('[ARView] ðŸ“Š Total de blocos:', blocks.length);

        // Extrair GLBs de cada bloco (prioriza glb_signed_url > glb_url)
        const models: Array<{ url: string; blockIndex: number }> = [];

        blocks.forEach((bloco, index) => {
            if (!bloco) {
                console.log(`[ARView] âš ï¸ Bloco ${index} Ã© null/undefined, ignorando...`);
                return;
            }

            console.log(`[ARView] ðŸ” Processando bloco ${index}:`, {
                tipo: bloco.tipo || 'sem tipo',
                temGlbUrl: !!bloco.glb_url,
                temGlbSignedUrl: !!bloco.glb_signed_url,
                temItems: Array.isArray(bloco.items),
                quantidadeItems: Array.isArray(bloco.items) ? bloco.items.length : 0
            });

            // Verificar se bloco tem GLB (prioriza signed_url)
            const glbUrl = bloco.glb_signed_url || bloco.glb_url || null;

            if (glbUrl && typeof glbUrl === 'string' && glbUrl.includes('.glb')) {
                console.log(`[ARView] âœ… GLB encontrado no bloco ${index} (${bloco.tipo}):`, glbUrl.substring(0, 100) + '...');
                models.push({ url: glbUrl, blockIndex: index });
            } else if (bloco.glb_url || bloco.glb_signed_url) {
                console.log(`[ARView] âš ï¸ Bloco ${index} tem glb_url/glb_signed_url mas nÃ£o Ã© string vÃ¡lida:`, {
                    glb_url: bloco.glb_url,
                    glb_signed_url: bloco.glb_signed_url
                });
            }

            // Verificar itens de carousel
            if (Array.isArray(bloco.items)) {
                console.log(`[ARView] ðŸŽ  Bloco ${index} Ã© carousel com ${bloco.items.length} itens, verificando GLBs...`);

                bloco.items.forEach((item: any, itemIndex: number) => {
                    if (!item) {
                        console.log(`[ARView] âš ï¸ Item ${itemIndex} do bloco ${index} Ã© null/undefined`);
                        return;
                    }

                    console.log(`[ARView] ðŸ” Item ${itemIndex} do bloco ${index}:`, {
                        temGlbUrl: !!item.glb_url,
                        temGlbSignedUrl: !!item.glb_signed_url,
                        temUrl: !!item.url,
                        temSignedUrl: !!item.signed_url
                    });

                    const itemGlbUrl = item.glb_signed_url || item.glb_url || null;

                    if (itemGlbUrl && typeof itemGlbUrl === 'string' && itemGlbUrl.includes('.glb')) {
                        console.log(`[ARView] âœ… GLB encontrado no item ${itemIndex} do bloco ${index}:`, itemGlbUrl.substring(0, 100) + '...');
                        models.push({ url: itemGlbUrl, blockIndex: index });
                    } else if (item.glb_url || item.glb_signed_url) {
                        console.log(`[ARView] âš ï¸ Item ${itemIndex} do bloco ${index} tem glb_url/glb_signed_url mas nÃ£o Ã© string vÃ¡lida:`, {
                            glb_url: item.glb_url,
                            glb_signed_url: item.glb_signed_url
                        });
                    } else {
                        console.log(`[ARView] âŒ Item ${itemIndex} do bloco ${index} NÃƒO tem GLB`);
                    }
                });
            } else if (bloco.items) {
                console.log(`[ARView] âš ï¸ Bloco ${index} tem 'items' mas NÃƒO Ã© array:`, typeof bloco.items);
            }
        });

        console.log('[ARView] ðŸŽ¯ ========================================');
        console.log('[ARView] ðŸŽ¯ RESUMO DA EXTRAÃ‡ÃƒO');
        console.log('[ARView] ðŸŽ¯ Total de GLBs encontrados:', models.length);
        console.log('[ARView] ðŸŽ¯ Modelos extraÃ­dos:', models.map((m, i) => ({
            index: i,
            blockIndex: m.blockIndex,
            url: m.url.substring(0, 80) + '...'
        })));
        console.log('[ARView] ðŸŽ¯ ========================================');

        setGlbModels(models);

        // Reset Ã­ndice se nÃ£o hÃ¡ modelos ou se Ã­ndice atual Ã© maior que quantidade de modelos
        if (models.length === 0 || currentModelIndex >= models.length) {
            setCurrentModelIndex(0);
        }
    }, [payload]);

    // --- VARIÃVEL CHAVE: URL do Modelo Final ---
    const finalModelUrl = useMemo(() => {
        console.log('[ARView] ðŸ” Buscando modelo final...');

        // PRIORIDADE 1: Modelo GLB dos blocos (array glbModels)
        if (glbModels.length > 0 && currentModelIndex < glbModels.length) {
            const selectedModel = glbModels[currentModelIndex];
            console.log('[ARView] âœ… Usando GLB do bloco', selectedModel.blockIndex, `(${currentModelIndex + 1}/${glbModels.length})`);
            console.log('[ARView] ðŸ“Š URL:', selectedModel.url.substring(0, 100) + '...');
            return selectedModel.url;
        }

        // PRIORIDADE 2: Modelo GLB gerado dinamicamente (fallback)
        if (generatedGlbUrl) {
            console.log('[ARView] âœ… Usando GLB gerado dinamicamente');
            return generatedGlbUrl;
        }

        // PRIORIDADE 3: Modelo no payload (fallback antigo)
        const url = findModelUrl(payload);
        if (url) {
            console.log('[ARView] âœ… Usando modelo do payload (fallback)');
            return url;
        }

        console.log('[ARView] âŒ Nenhum modelo disponÃ­vel');
        return null;
    }, [glbModels, currentModelIndex, generatedGlbUrl, payload, findModelUrl]);


    useEffect(() => {
        return () => {
            console.log('[ARView] ðŸ§¹ Componente DESMONTADO COMPLETAMENTE, resetando TODAS as flags...');
            launchedRef.current = false;
            launchedForContentRef.current = false;
            actionInProgressRef.current = false;
            glbGeneratedRef.current = false;
            glbGenerationInProgressRef.current = false;
            setGeneratedGlbUrl(null);
        };
    }, []);

    // --- VARIÃVEL CHAVE: URL do Modelo Final (Totem ou Astronauta) ---
    // Nota: removido o fluxo automÃ¡tico que buscava um "default" signed URL
    // pelo nome (DEFAULT_MODEL_FILENAME) para evitar referÃªncias e lÃ³gica
    // residual. Agora a URL final Ã© tomada exclusivamente do payload quando
    // presente; caso contrÃ¡rio usamos um fallback pÃºblico (Astronaut).

    // Log the final model URL for debugging
    useEffect(() => {
        try {
            console.log('[ARView] finalModelUrl:', finalModelUrl);
        } catch (e) { }
    }, [finalModelUrl]);

    // Read AR support from shared hook (uses cached probe run at app start).
    const supportsAR = useARSupport();

    // Removed preview diagnostics and URL normalization â€” not needed for native AR path.



    const openNativeARWithModel = useCallback(async (modelUrl?: string | null) => {
        console.log('[ARView] ðŸŽ¯ ========================================');
        console.log('[ARView] ðŸŽ¯ openNativeARWithModel INICIADO');
        console.log('[ARView] ðŸŽ¯ ========================================');

        if (!modelUrl) {
            console.warn('[ARView] âš ï¸ modelUrl Ã© null/undefined, abortando');
            return false;
        }

        console.log('[ARView] ðŸ“Š Model URL recebida:', modelUrl.substring(0, 150) + '...');
        console.log('[ARView] ðŸ“Š Platform:', Platform.OS);
        setStatusMessage(UIMessages.LAUNCHING);

        // Gate global para evitar mÃºltiplas instÃ¢ncias do AR nativo
        if (isARActive()) {
            if (isSameARModel(modelUrl)) {
                console.log('[ARView] â›” SessÃ£o AR jÃ¡ ativa para este modelo â€” ignorando nova abertura');
                return true;
            } else {
                console.log('[ARView] â›” SessÃ£o AR jÃ¡ ativa (modelo diferente) â€” bloqueando nova abertura');
                try { Alert.alert('RA jÃ¡ aberta', 'Feche a RA atual antes de abrir outra.'); } catch { }
                return true;
            }
        }

        let launched = false;

        // âœ… MUDANÃ‡A CRÃTICA: Ativar gate ANTES de abrir AR
        // Isso garante que useFocusEffect vÃª isARActive()=true quando tela perde/ganha foco rapidamente
        console.log('[ARView] ðŸ”“ Ativando gate ANTES de abrir AR...');
        try { activateAR(modelUrl); } catch { }

        // Android: Scene Viewer via HTTPS (mais compatÃ­vel)
        if (Platform.OS === 'android') {
            console.log('[ARView] ðŸ¤– Android: Abrindo Scene Viewer (HTTPS)...');
            try {
                const sceneViewerUrl = `https://arvr.google.com/scene-viewer/1.2?file=${encodeURIComponent(modelUrl)}&mode=ar_preferred`;
                await Linking.openURL(sceneViewerUrl);
                launched = true;
                console.log('[ARView] âœ… Scene Viewer aberto com sucesso!');
            } catch (e) {
                console.error('[ARView] âŒ Scene Viewer falhou:', e);
                // Desativa gate se falhou
                console.log('[ARView] ðŸ”’ Desativando gate pois abertura falhou...');
                try { deactivateAR(); } catch { }
            }
        }

        // iOS: Quick Look
        if (Platform.OS === 'ios') {
            console.log('[ARView] ðŸŽ iOS: Tentando Quick Look...');
            try {
                await Linking.openURL(modelUrl);
                launched = true;
                console.log('[ARView] âœ… Quick Look aberto com sucesso!');
            } catch (e) {
                console.error('[ARView] âŒ Quick Look falhou:', e);
                // Desativa gate se falhou
                console.log('[ARView] ðŸ”’ Desativando gate pois abertura falhou...');
                try { deactivateAR(); } catch { }
            }
        }

        if (!launched) {
            console.error('[ARView] âŒ NENHUM MÃ‰TODO DE AR FUNCIONOU!');
            setStatusMessage(UIMessages.ERROR);
            Alert.alert('AR IndisponÃ­vel', UIMessages.ERROR);
            // Gate jÃ¡ foi desativada no catch acima
        } else {
            console.log('[ARView] âœ… AR lanÃ§ado com sucesso, retornando true');
            setStatusMessage(UIMessages.READY);
            // âœ… CRÃTICO: Marca que AR foi lanÃ§ada para conteÃºdo (precisa exibir conteÃºdo ao fechar)
            launchedForContentRef.current = true;
            // Gate jÃ¡ foi ativada no inÃ­cio
        }

        console.log('[ARView] ðŸŽ¯ openNativeARWithModel FINALIZADO, launched:', launched);
        return launched;
    }, []);

    // Removed in-WebView AR trigger; we now generate/launch GLB from backend when needed

    // --- LÃ“GICA DE INICIALIZAÃ‡ÃƒO DA MENSAGEM ---
    useEffect(() => {
        // Se o modelo final existe e nÃ£o estamos mais carregando, o sistema estÃ¡ pronto para o clique
        if (!loading && finalModelUrl) {
            setStatusMessage(UIMessages.READY);
        }
    }, [loading, finalModelUrl]);

    // No remote fallback models: we only use payload-provided models. If
    // there's no model, UI will show an informational message and not offer
    // an AR button.

    // âœ… DESABILITADO: Auto-launch removido - agora mostramos conteÃºdo primeiro
    // Auto-launch effect: quando tivermos uma URL final e nÃ£o estivermos jÃ¡ lanÃ§ando, abra o AR nativo.
    // Deve estar acima dos retornos condicionais para nÃ£o alterar a ordem de Hooks entre renders.

    // REMOVIDO: Auto-launch AR - agora usuÃ¡rio precisa clicar em "Ver em RA"
    /*
    useEffect(() => {
        console.log('[ARView] ðŸ”„ Auto-launch effect executado');
        if (isARActive()) {
            console.log('[ARView] â¸ï¸ Auto-launch: jÃ¡ existe AR ativa (gate global), pulando...');
            return;
        }
        console.log('[ARView] ðŸ“Š Estado atual:');
        console.log('[ARView]    - loading:', loading);
        console.log('[ARView]    - finalModelUrl:', finalModelUrl ? 'EXISTE' : 'NULL');
        console.log('[ARView]    - launchedRef.current:', launchedRef.current);
        console.log('[ARView]    - shouldAutoLaunch:', shouldAutoLaunch);
        console.log('[ARView]    - generatedGlbUrl (STATE):', generatedGlbUrl ? 'EXISTE' : 'NULL');

        if (loading) {
            console.log('[ARView] â¸ï¸ Auto-launch: aguardando fim do loading...');
            return;
        }
        if (!finalModelUrl) {
            console.log('[ARView] â¸ï¸ Auto-launch: sem modelo, aguardando geraÃ§Ã£o...');
            return;
        }
        if (launchedRef.current) {
            console.log('[ARView] â¸ï¸ Auto-launch: jÃ¡ lanÃ§ado anteriormente (launchedRef=true), pulando...');
            return;
        }
        // âœ… MUDANÃ‡A: Permitir auto-launch se shouldAutoLaunch=true OU se jÃ¡ existe GLB gerado (reentrada)
        if (!shouldAutoLaunch && !generatedGlbUrl) {
            console.log('[ARView] â¸ï¸ Auto-launch: shouldAutoLaunch=FALSE e nenhum GLB gerado, pulando...');
            return;
        }

        console.log('[ARView] âœ… CondiÃ§Ãµes para auto-launch atendidas!');
        console.log('[ARView] ðŸŽ¯ Setando launchedRef.current = true');
        launchedRef.current = true;
        launchedForContentRef.current = true;
        launchedAtRef.current = Date.now(); // âœ… Marca timestamp do launch
        setShouldAutoLaunch(false); // âœ… Desabilita flag apÃ³s executar

        console.log('[ARView] ðŸš€ Auto-lanÃ§ando AR nativo com modelo...');
        (async () => {
            try {
                const ok = await openNativeARWithModel(finalModelUrl);
                if (!ok) {
                    console.warn('[ARView] âš ï¸ Auto-launch falhou');
                    launchedRef.current = false;
                    launchedForContentRef.current = false;
                    launchedAtRef.current = 0;
                } else {
                    console.log('[ARView] âœ… AR nativo lanÃ§ado com sucesso via auto-launch');
                }
            } catch (e) {
                console.warn('[ARView] âŒ auto-launch failed', e);
                launchedRef.current = false;
                launchedForContentRef.current = false;
                launchedAtRef.current = 0;
            }
        })();
    }, [loading, finalModelUrl, shouldAutoLaunch, generatedGlbUrl, focusCounter, openNativeARWithModel, setShouldAutoLaunch]);
    */

    // REMOVIDO: Auto-generate GLB - agora apenas extraÃ­mos GLBs existentes dos blocos
    /*
    // Auto-generate GLB when there's no model in payload
    useEffect(() => {
        console.log('[ARView] ðŸ”„ Auto-generate effect executado');
        console.log('[ARView] ðŸ“Š Estado atual:');
        console.log('[ARView]    - loading:', loading);
        console.log('[ARView]    - finalModelUrl:', finalModelUrl ? 'EXISTE' : 'NULL');
        console.log('[ARView]    - payload:', payload ? 'EXISTE' : 'NULL');
        console.log('[ARView]    - glbGenerationInProgressRef.current:', glbGenerationInProgressRef.current);
        console.log('[ARView]    - glbGeneratedRef.current:', glbGeneratedRef.current);
        console.log('[ARView]    - generatedGlbUrl (STATE):', generatedGlbUrl ? 'EXISTE' : 'NULL');

        if (loading) {
            console.log('[ARView] â¸ï¸ Auto-generate: aguardando fim do loading...');
            return;
        }
        if (finalModelUrl) {
            console.log('[ARView] â¸ï¸ Auto-generate: jÃ¡ tem modelo, nÃ£o precisa gerar');
            console.log('[ARView]    - Origem do modelo:', generatedGlbUrl ? 'GERADO (STATE)' : 'PAYLOAD');
            return;
        }
        if (isARActive()) {
            console.log('[ARView] â¸ï¸ Auto-generate: AR ativo (gate global) â€” aguardando fechamento para gerar');
            return;
        }
        if (!payload) {
            console.log('[ARView] â¸ï¸ Auto-generate: sem payload');
            return;
        }
        if (glbGenerationInProgressRef.current) {
            console.log('[ARView] â¸ï¸ Auto-generate: geraÃ§Ã£o jÃ¡ em andamento');
            return;
        }
        if (glbGeneratedRef.current) {
            console.log('[ARView] â­ï¸ GLB jÃ¡ foi gerado anteriormente, pulando...');
            console.log('[ARView] ðŸ“ Estado:');
            console.log('[ARView]    - glbGeneratedRef:', glbGeneratedRef.current);
            console.log('[ARView]    - generatedGlbUrl (STATE):', generatedGlbUrl ? 'EXISTE' : 'NULL');
            console.log('[ARView]    - finalModelUrl:', finalModelUrl ? 'EXISTE' : 'NULL');
            if (!generatedGlbUrl && !finalModelUrl) {
                console.log('[ARView] âš ï¸ ATENÃ‡ÃƒO: glbGeneratedRef=true mas ambos finalModelUrl e generatedGlbUrl sÃ£o NULL!');
                console.log('[ARView] âš ï¸ Isso indica que o estado foi perdido - vamos REGENERAR');
                glbGeneratedRef.current = false; // âœ… Reseta para forÃ§ar regeraÃ§Ã£o
                glbGenerationInProgressRef.current = false;
            } else {
                return; // jÃ¡ gerou GLB nesta sessÃ£o, nÃ£o gerar de novo
            }
        }

        console.log('[ARView] ðŸ’¡ Auto-gerando GLB pois nÃ£o hÃ¡ modelo no payload...');
        console.log('[ARView] ðŸŽ¯ Setando glbGenerationInProgressRef = true');
        if (autoGenTriggeredRef.current) {
            console.log('[ARView] â¸ï¸ Auto-generate: jÃ¡ disparado para este payload (autoGenTriggeredRef), pulando');
            return;
        }
        autoGenTriggeredRef.current = true;
        glbGenerationInProgressRef.current = true; // Marca que estÃ¡ gerando AGORA
        // âœ… CORREÃ‡ÃƒO: NÃƒO seta glbGeneratedRef aqui, sÃ³ depois que o GLB for realmente gerado
    }, [loading, finalModelUrl, payload, generatedGlbUrl]); // âœ… Adiciona generatedGlbUrl para detectar mudanÃ§as

    // âœ… NOVO: useEffect separado que dispara handleVerEmRA quando necessÃ¡rio
    useEffect(() => {
        // SÃ³ executa se glbGenerationInProgressRef estÃ¡ true MAS handleVerEmRA ainda nÃ£o foi chamado
        if (!loading && !finalModelUrl && payload && glbGenerationInProgressRef.current && !actionInProgressRef.current) {
            console.log('[ARView] ðŸš€ Disparando geraÃ§Ã£o de GLB via handleVerEmRA...');

            const generateGLB = async () => {
                await handleVerEmRA();
            };

            // Evita agendar mais de uma vez
            if (generationScheduledRef.current) {
                console.log('[ARView] â¸ï¸ GeraÃ§Ã£o jÃ¡ agendada (generationScheduledRef), pulando');
                return;
            }
            generationScheduledRef.current = true;
            // Pequeno delay para UI renderizar
            const timer = setTimeout(generateGLB, 100);
            return () => clearTimeout(timer);
        }

        return undefined; // âœ… Sempre retorna algo
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
        console.log('[ARView] ðŸ“¡ ========================================');
        console.log('[ARView] ðŸ“¡ AppState listener REGISTRADO');
        console.log('[ARView] ðŸ“¡ Estado atual do AppState:', AppState.currentState);
        console.log('[ARView] ðŸ“¡ ========================================');

        const onAppStateChange = (nextState: AppStateStatus) => {
            const now = new Date().toISOString().substring(11, 23); // HH:MM:SS.mmm
            console.log(`[ARView] ðŸ“± ========================================`);
            console.log(`[ARView] ðŸ“± [${now}] âš¡ APPSTATE MUDOU PARA: ${nextState}`);
            console.log(`[ARView] ðŸ“± [${now}] âš¡ EVENTO DISPARADO!`);
            console.log(`[ARView] ðŸ“± ========================================`);
            console.log(`[ARView] ðŸ“Š [${now}] launchedForContentRef.current:`, launchedForContentRef.current);
            console.log(`[ARView] ðŸ“Š [${now}] launchedRef.current:`, launchedRef.current);

            // âœ… CRÃTICO: Desativar gate quando app vai para background (AR foi aberta)
            // SÃ³ processa se gate ainda ativa (AR realmente foi aberta, nÃ£o Ã© App Switcher)
            if (nextState === 'background' && launchedForContentRef.current) {
                const wasARActive = isARActive();
                console.log(`[ARView] ðŸŽ¬ [${now}] App foi para background â€” gate ativa: ${wasARActive}`);

                if (wasARActive) {
                    // AR realmente foi aberta, marca timestamp e desativa gate
                    backgroundAtRef.current = Date.now();
                    try { deactivateAR(); } catch { }
                    console.log(`[ARView] âœ… [${now}] AR aberta confirmada, gate desativada`);
                } else {
                    // Gate jÃ¡ foi desativada = App Switcher ou outro evento nÃ£o-AR
                    console.log(`[ARView] â­ï¸ [${now}] Gate jÃ¡ inativa, ignorando background (App Switcher?)`);
                }
                return; // âœ… Early return para clareza
            }

            if (nextState === 'active' && launchedForContentRef.current) {
                // âœ… PROTEÃ‡ÃƒO: Se voltou rÃ¡pido (< 2s) E gate jÃ¡ foi desativada, foi App Switcher, nÃ£o AR fechado
                const timeInBackground = backgroundAtRef.current > 0 ? Date.now() - backgroundAtRef.current : 999999;
                const wasARActive = isARActive();

                // App Switcher: voltou rÃ¡pido + gate jÃ¡ desativada (background jÃ¡ processou)
                if (timeInBackground < 2000 && !wasARActive) {
                    console.log(`[ARView] ðŸ”„ [${now}] Voltou rÃ¡pido (${timeInBackground}ms) + gate inativa = App Switcher, ignorando...`);
                    // NÃƒO reseta backgroundAtRef aqui - pode ter outra transiÃ§Ã£o active (fechar AR de verdade)
                    return; // âœ… Ignora esta transiÃ§Ã£o
                }

                console.log(`[ARView] ðŸ”™ [${now}] ========================================`);
                console.log(`[ARView] ðŸ”™ [${now}] AR FECHADO - Exibindo conteÃºdo`);
                console.log(`[ARView] ðŸ”™ [${now}] timeInBackground: ${timeInBackground}ms, gate ativa: ${wasARActive}`);
                console.log(`[ARView] ðŸ”™ [${now}] ========================================`);

                // IMPORTANTE: Reseta flags ANTES de exibir conteÃºdo
                launchedRef.current = false;
                launchedForContentRef.current = false;
                launchedAtRef.current = 0; // âœ… Reseta timestamp
                backgroundAtRef.current = 0; // âœ… Reseta timestamp do background
                // Libera o gate global: consideramos a sessÃ£o AR encerrada (redundante, mas seguro)
                try { deactivateAR(); } catch { }

                console.log('[ARView] ðŸ”„ Flags resetadas');
                // NÃƒO resetar glbGeneratedRef nem generatedGlbUrl - mantÃ©m o GLB em cache

                // âœ… MUDANÃ‡A CRÃTICA: Exibir conteÃºdo ao invÃ©s de navegar para recognizer
                console.log(`[ARView] ï¿½ [${now}] Exibindo conteÃºdo via AppState listener...`);
                setShowContent(true);
                console.log(`[ARView] âœ… [${now}] ConteÃºdo exibido com sucesso`);
                return; // âœ… Early return para clareza
            }

            // âœ… Log de outros estados para debug
            console.log(`[ARView] â„¹ï¸ [${now}] AppState ${nextState} - launchedForContent=${launchedForContentRef.current} (sem aÃ§Ã£o)`);
        };

        const sub = AppState.addEventListener ? AppState.addEventListener('change', onAppStateChange) : null;

        return () => {
            console.log('[ARView] ðŸ“¡ ========================================');
            console.log('[ARView] ðŸ“¡ AppState listener REMOVENDO...');
            console.log('[ARView] ðŸ“¡ ========================================');
            if (sub && sub.remove) sub.remove();
            console.log('[ARView] ðŸ“¡ AppState listener REMOVIDO');
        };
    }, [router]);

    // âœ… SOLUÃ‡ÃƒO FINAL: Polling timer para detectar AR fechado quando AppState/useFocusEffect falham
    useEffect(() => {
        console.log('[ARView] â±ï¸ ========================================');
        console.log('[ARView] â±ï¸ Polling timer INICIADO (interval: 500ms)');
        console.log('[ARView] â±ï¸ ========================================');

        let tickCount = 0;
        const checkInterval = setInterval(() => {
            tickCount++;

            // Log a cada 10 ticks (5 segundos) para monitorar atividade
            if (tickCount % 10 === 0) {
                console.log(`[ARView] â±ï¸ Polling tick #${tickCount} - launchedForContent: ${launchedForContentRef.current}`);
            }

            // SÃ³ verifica se AR foi lanÃ§ada
            if (!launchedForContentRef.current) return;

            const timeSinceLaunch = Date.now() - launchedAtRef.current;
            const timeInBackground = backgroundAtRef.current > 0 ? Date.now() - backgroundAtRef.current : 0;
            const wasARActive = isARActive();

            // Log detalhado quando AR estÃ¡ lanÃ§ada
            if (tickCount % 2 === 0) { // A cada 1 segundo
                console.log(`[ARView] â±ï¸ Check: timeSince=${timeSinceLaunch}ms, timeInBg=${timeInBackground}ms, gateActive=${wasARActive}`);
            }

            // Se AR estÃ¡ ativa, nÃ£o fazer nada
            if (wasARActive) {
                return;
            }

            // Se lanÃ§ou hÃ¡ pouco (< 3s), ainda estÃ¡ abrindo
            if (timeSinceLaunch < 3000) {
                return;
            }

            // Se voltou do background hÃ¡ pouco (< 3s), pode ser App Switcher
            if (timeInBackground > 0 && timeInBackground < 3000) {
                return;
            }

            // AR foi fechada! Exibir conteÃºdo ao invÃ©s de navegar
            const now = new Date().toISOString().substring(11, 23);
            console.log(`[ARView] â±ï¸ [${now}] ========================================`);
            console.log(`[ARView] â±ï¸ [${now}] POLLING: AR FECHADO DETECTADO!`);
            console.log(`[ARView] â±ï¸ [${now}] timeSinceLaunch: ${timeSinceLaunch}ms`);
            console.log(`[ARView] â±ï¸ [${now}] timeInBackground: ${timeInBackground}ms`);
            console.log(`[ARView] â±ï¸ [${now}] gate ativa: ${wasARActive}`);
            console.log(`[ARView] â±ï¸ [${now}] ========================================`);

            // Reseta flags
            launchedRef.current = false;
            launchedForContentRef.current = false;
            launchedAtRef.current = 0;
            backgroundAtRef.current = 0;

            // âœ… MUDANÃ‡A: Exibir conteÃºdo ao invÃ©s de navegar
            console.log(`[ARView] â±ï¸ [${now}] Exibindo conteÃºdo via polling...`);
            setShowContent(true);
            console.log(`[ARView] â±ï¸ [${now}] âœ… ConteÃºdo exibido via polling`);
        }, 500); // âœ… Reduzido para 500ms (mais responsivo)

        return () => {
            console.log('[ARView] â±ï¸ Polling timer REMOVIDO');
            clearInterval(checkInterval);
        };
    }, [router]);    // Hotspot/message handling removed â€” nÃ£o usamos mais hotspots clicÃ¡veis

    // Helper: prefere explicitamente a imagem header (subtipo 'header' ou tipo contendo 'topo'),
    // se nÃ£o existir, cai para a primeira imagem disponÃ­vel (signed_url > url)
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

        // Helper para verificar se URL Ã© vÃ¡lida (HTTP/HTTPS e nÃ£o gs://)
        const isValidHttpUrl = (url: string) => {
            return url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
        };

        // Helper para verificar se Ã© base64 vÃ¡lido (deve ter vÃ­rgula apÃ³s o cabeÃ§alho)
        const isValidBase64 = (url: string) => {
            if (!url || typeof url !== 'string') return false;
            if (!url.startsWith('data:image')) return false;
            // Base64 vÃ¡lido tem formato: data:image/png;base64,iVBORw0KG...
            // Se nÃ£o tem vÃ­rgula, Ã© uma URL malformada
            return url.includes(',') && url.indexOf(',') < 100; // vÃ­rgula deve estar nos primeiros 100 chars
        };

        // 1) procura por bloco com subtype/header explicitamente (prioridade)
        for (const b of blocks) {
            if (!b || typeof b !== 'object') continue;
            const subtipo = (b.subtipo || b.subType || '').toString().toLowerCase();
            const tipoLabel = (b.tipo || '').toString().toLowerCase();
            if (subtipo === 'header' || tipoLabel.includes('topo') || tipoLabel.includes('header') || tipoLabel.includes('imagem')) {
                console.log('[ARView] findFirstImageUrl: encontrado bloco header/topo/imagem:', tipoLabel);

                // PRIORIDADE 1: previewDataUrl (base64 - nÃ£o expira)
                if (b.previewDataUrl) {
                    if (isValidBase64(b.previewDataUrl)) {
                        console.log('[ARView] findFirstImageUrl: usando previewDataUrl do header (BASE64 VÃLIDO)');
                        return b.previewDataUrl;
                    } else {
                        console.warn('[ARView] âš ï¸ previewDataUrl existe mas NÃƒO Ã© base64 vÃ¡lido!');
                        console.warn('[ARView] âš ï¸ Primeiros 150 chars:', b.previewDataUrl.substring(0, 150));
                        console.warn('[ARView] âš ï¸ Tem vÃ­rgula?', b.previewDataUrl.includes(','));

                        // âœ… CORREÃ‡ÃƒO: Se previewDataUrl comeÃ§a com "data:image/" mas nÃ£o Ã© base64 vÃ¡lido,
                        // pode ser uma URL encoded malformada. Ignora e usa signed_url no lugar.
                        console.warn('[ARView] âš ï¸ Ignorando previewDataUrl malformado, tentando signed_url...');
                    }
                }

                // PRIORIDADE 2: signed_url (pode expirar, mas Ã© HTTP vÃ¡lido)
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

        console.log('[ARView] findFirstImageUrl: nenhuma URL vÃ¡lida encontrada');
        return null;
    }, []);

    // âœ… NOVO: FunÃ§Ãµes de navegaÃ§Ã£o entre modelos
    const handlePreviousModel = useCallback(() => {
        if (currentModelIndex > 0) {
            console.log('[ARView] â¬…ï¸ Navegando para modelo anterior:', currentModelIndex - 1);
            setCurrentModelIndex(prev => prev - 1);
        }
    }, [currentModelIndex]);

    const handleNextModel = useCallback(() => {
        if (currentModelIndex < glbModels.length - 1) {
            console.log('[ARView] âž¡ï¸ Navegando para prÃ³ximo modelo:', currentModelIndex + 1);
            setCurrentModelIndex(prev => prev + 1);
        }
    }, [currentModelIndex, glbModels.length]);

    const handleVerEmRA = useCallback(async () => {
        console.log('[ARView] ðŸŽ¬ ========================================');
        console.log('[ARView] ðŸŽ¬ handleVerEmRA CHAMADO');
        console.log('[ARView] ðŸŽ¬ ========================================');

        // âœ… CRÃTICO: Verificar gate global ANTES de prosseguir
        if (isARActive()) {
            console.warn('[ARView] â›” AR jÃ¡ ativa â€” bloqueando aÃ§Ã£o manual');
            try {
                Alert.alert('RA jÃ¡ aberta', 'Feche a RA atual antes de abrir outra.');
            } catch (e) {
                console.warn('[ARView] âš ï¸ NÃ£o foi possÃ­vel mostrar alerta:', e);
            }
            return;
        }

        // Prevent duplicate activations
        if (actionInProgressRef.current) {
            console.warn('[ARView] âš ï¸ AÃ‡ÃƒO JÃ EM PROGRESSO, ignorando...');
            return;
        }
        actionInProgressRef.current = true;
        console.log('[ARView] âœ… actionInProgressRef setado para true');

        // âœ… NOVO: Se jÃ¡ tem GLB gerado, usar direto sem gerar de novo
        if (generatedGlbUrl) {
            console.log('[ARView] âœ… GLB jÃ¡ existe em cache, usando direto:', generatedGlbUrl.substring(0, 100) + '...');
            launchedRef.current = true;
            launchedForContentRef.current = true;
            launchedAtRef.current = Date.now(); // âœ… Marca timestamp ANTES de abrir AR
            await openNativeARWithModel(generatedGlbUrl);
            actionInProgressRef.current = false;
            return;
        }

        // 1) se o payload jÃ¡ traz um modelo (.glb) use-o
        console.log('[ARView] ðŸ” Verificando se payload tem modelo GLB...');
        const payloadModel = findModelUrl(payload);
        if (payloadModel) {
            console.log('[ARView] âœ… Modelo GLB encontrado no payload, usando:', payloadModel.substring(0, 100) + '...');
            launchedRef.current = true;
            launchedForContentRef.current = true;
            launchedAtRef.current = Date.now(); // âœ… Marca timestamp ANTES de abrir AR
            await openNativeARWithModel(payloadModel);
            actionInProgressRef.current = false;
            return;
        }
        console.log('[ARView] âŒ Nenhum modelo GLB no payload');

        console.log('[ARView] ðŸ’¡ Nenhum modelo no payload, tentando gerar GLB...');        // âš ï¸ IMPORTANTE: Deve usar a IMAGEM DO CONTEÃšDO (blocos), NÃƒO a imagem de comparaÃ§Ã£o!
        // previewImage = imagem capturada pela cÃ¢mera (comparaÃ§Ã£o)
        // blocos = imagens do conteÃºdo da marca (o que queremos para o AR)

        let imageUrl: string | null = null;

        // PRIORIDADE 1: Busca nos blocos de conteÃºdo (IMAGEM DA MARCA, nÃ£o da comparaÃ§Ã£o)
        console.log('[ARView] ðŸ” PRIORIDADE 1: Buscando imagem nos blocos de conteÃºdo...');
        imageUrl = findFirstImageUrl(payload);
        console.log('[ARView] ðŸ“Š findFirstImageUrl retornou:', imageUrl ? 'ENCONTRADA' : 'NULL');

        if (imageUrl) {
            console.log('[ARView] âœ… USANDO imagem dos blocos de conteÃºdo (CORRETO - imagem da marca)');
            console.log('[ARView] ðŸ“Š Tipo:',
                imageUrl.startsWith('data:') ? 'BASE64' :
                    imageUrl.startsWith('http') ? 'HTTP/HTTPS' :
                        'DESCONHECIDO'
            );
        }

        // FALLBACK 1.5: previewImage do payload principal (BASE64 da foto tirada)
        if (!imageUrl || (!imageUrl.startsWith('data:') && !imageUrl.startsWith('http'))) {
            console.log('[ARView] ðŸ” FALLBACK 1.5: Usando previewImage do payload principal...');
            const mainPreview = payload?.previewImage;
            if (mainPreview && typeof mainPreview === 'string' && mainPreview.startsWith('data:image')) {
                imageUrl = mainPreview;
                console.log('[ARView] âœ… USANDO previewImage do payload (foto tirada pelo usuÃ¡rio)');
            }
        }

        // FALLBACK 2: anchorData (se blocos nÃ£o tiverem imagem)
        if (!imageUrl) {
            console.log('[ARView] ðŸ” FALLBACK 2: Verificando anchorData...');
            const anchorPreview = payload && payload.anchorData && typeof payload.anchorData.previewDataUrl === 'string' ? payload.anchorData.previewDataUrl : (payload && payload.anchorData && typeof payload.anchorData.previewImage === 'string' ? payload.anchorData.previewImage : null);
            console.log('[ARView] ðŸ“Š anchorPreview:', anchorPreview ? (anchorPreview.substring(0, 50) + '... (length: ' + anchorPreview.length + ')') : 'NULL');

            if (anchorPreview && anchorPreview.startsWith('data:')) {
                imageUrl = anchorPreview;
                console.log('[ARView] âœ… USANDO anchorData (data:base64)');
            } else if (anchorPreview && (anchorPreview.startsWith('http://') || anchorPreview.startsWith('https://'))) {
                imageUrl = anchorPreview;
                console.log('[ARView] âœ… USANDO anchorData (HTTP)');
            }
        }

        // FALLBACK 3: previewImage (ÃšLTIMO RECURSO - Ã© a imagem de comparaÃ§Ã£o, nÃ£o ideal)
        if (!imageUrl) {
            console.log('[ARView] ðŸ” FALLBACK 2: Verificando payload.previewImage (imagem de comparaÃ§Ã£o)...');
            const preview = payload && typeof payload.previewImage === 'string' ? payload.previewImage : null;
            console.log('[ARView] ðŸ“Š payload.previewImage:', preview ? (preview.substring(0, 50) + '... (length: ' + preview.length + ')') : 'NULL');

            if (preview && preview.startsWith('data:')) {
                imageUrl = preview;
                console.log('[ARView] âš ï¸ USANDO payload.previewImage (data:base64) - ATENÃ‡ÃƒO: imagem de comparaÃ§Ã£o!');
            } else if (preview && (preview.startsWith('http://') || preview.startsWith('https://'))) {
                imageUrl = preview;
                console.log('[ARView] âš ï¸ USANDO payload.previewImage (HTTP) - ATENÃ‡ÃƒO: imagem de comparaÃ§Ã£o!');
            }
        }

        // Se nÃ£o encontrou NENHUMA imagem
        if (!imageUrl) {
            console.warn('[ARView] âŒ Nenhuma mÃ­dia vÃ¡lida encontrada para gerar GLB');
            try { Alert.alert('ConteÃºdo nÃ£o disponÃ­vel', 'Nenhuma mÃ­dia encontrada para abrir em RA.'); } catch (e) { }
            actionInProgressRef.current = false;
            return;
        }

        console.log('[ARView] âœ… Imagem selecionada para gerar GLB');
        console.log('[ARView] ðŸ“Š imageUrl tipo:',
            imageUrl.startsWith('data:') ? 'BASE64 (nÃ£o expira)' :
                imageUrl.startsWith('http') ? 'HTTP/HTTPS (pode expirar)' :
                    'DESCONHECIDO'
        );
        console.log('[ARView] ðŸ“Š imageUrl (primeiros 100 chars):', imageUrl.substring(0, 100) + '...'); try {
            console.log('[ARView] ðŸ”¨ ========================================');
            console.log('[ARView] ðŸ”¨ INICIANDO GERAÃ‡ÃƒO DE GLB');
            console.log('[ARView] ðŸ”¨ ========================================');
            setStatusMessage('Gerando modelo AR...');

            // Se a URL Ã© HTTP/HTTPS, baixar localmente e converter para base64 para evitar falha de download no backend
            if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                console.log('[ARView] ðŸ”„ Baixando imagem no cliente para converter em base64...');
                try {
                    const baseDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
                    const target = `${baseDir}ar_source_img_${Date.now()}`;
                    const downloadRes: any = await FileSystem.downloadAsync(imageUrl, target);
                    const status = downloadRes?.status;
                    const headers = (downloadRes?.headers) || {} as Record<string, string>;
                    const ct = (headers['content-type'] || headers['Content-Type'] || '').toString();
                    console.log('[ARView] ðŸ“¥ Download local status:', status, 'content-type:', ct || 'desconhecido');
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
                        console.log('[ARView] âœ… Imagem convertida para base64 (cliente) â€” evitando download no backend');
                    } else {
                        console.warn('[ARView] âš ï¸ Falha ao baixar imagem no cliente, prosseguindo com URL HTTP');
                    }
                } catch (e) {
                    console.warn('[ARView] âš ï¸ Erro ao baixar/ler imagem localmente, prosseguindo com URL HTTP', e);
                }
            }

            // Debug: qual URL estamos enviando para o backend (Metro)
            console.log('[ARView] ðŸ“¤ URL da imagem para gerar GLB (primeiros 150 chars):', safePreview(imageUrl, 150));
            console.log('[ARView] ðŸ“¤ Tipo de URL:',
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

            console.log('[ARView] ðŸ“¦ Body do request:', {
                tem_image_url: !!bodyObj.image_url,
                image_url_length: bodyObj.image_url?.length || 0,
                owner_uid: ownerUid || 'nÃ£o fornecido'
            });

            // No authentication headers needed for anonymous app usage
            const headers: any = { 'Content-Type': 'application/json' };

            const endpoint = `${API_CONFIG.BASE_URL}/api/generate-glb-from-image`;
            console.log('[ARView] ðŸŒ Endpoint:', endpoint);
            console.log('[ARView] ðŸ“¤ Enviando POST request...');

            const res = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(bodyObj)
            });

            console.log('[ARView] ðŸ“¥ ========================================');
            console.log('[ARView] ðŸ“¥ RESPOSTA RECEBIDA');
            console.log('[ARView] ðŸ“¥ ========================================');

            // Log do status e do corpo (text) para diagnÃ³stico
            const respText = await res.text();
            console.log('[ARView] ðŸ“¥ Resposta backend status:', res.status);
            console.log('[ARView] ðŸ“¥ Resposta backend body (primeiros 500 chars):', respText.substring(0, 500));

            if (!res.ok) {
                console.warn('[ARView] âŒ generate-glb-from-image falhou, status:', res.status);
                console.warn('[ARView] âŒ Corpo da resposta:', respText.substring(0, 300));

                // TENTATIVA DE RECUPERAÃ‡ÃƒO: se a URL era HTTP e falhou ao baixar no backend,
                // tenta novamente enviando uma imagem em base64 (data URL) obtida do payload.
                const failedToDownload = res.status === 400 && respText.includes('Failed to download image');
                const wasHttpUrl = typeof imageUrl === 'string' && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'));

                const isBase64DataUrl = (s?: string | null) => !!(s && typeof s === 'string' && s.startsWith('data:image') && s.includes(','));
                let retryBase64: string | null = null;
                if (failedToDownload && wasHttpUrl) {
                    // PreferÃªncia: algum previewDataUrl vÃ¡lido nos blocos
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

                    // Fallback 3: previewImage (imagem de comparaÃ§Ã£o)
                    if (!retryBase64) {
                        const prev = (typeof payload?.previewImage === 'string') ? payload?.previewImage : null;
                        if (isBase64DataUrl(prev)) retryBase64 = prev as string;
                    }

                    if (retryBase64) {
                        console.log('[ARView] ðŸ” Retentando geraÃ§Ã£o com DATA URL base64 (cliente)');
                        const retryBody: any = { image_url: retryBase64 };
                        const res2 = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(retryBody) });
                        const t2 = await res2.text();
                        console.log('[ARView] ðŸ“¥ Retentativa status:', res2.status);
                        if (!res2.ok) {
                            console.warn('[ARView] âŒ Retentativa com base64 falhou');
                            console.warn('[ARView] âŒ Corpo:', t2.substring(0, 300));
                            try { Alert.alert('Erro ao gerar modelo AR', `Status ${res2.status}\n${t2.substring(0, 200)}`); } catch (e) { }
                            openNativeARWithModel(finalModelUrl);
                            return;
                        } else {
                            let j2: any = null;
                            try { j2 = t2 ? JSON.parse(t2) : {}; } catch { }
                            const glb2 = j2 && (j2.glb_signed_url || j2.glb_url || j2.glbSignedUrl);
                            if (glb2) {
                                console.log('[ARView] âœ… GLB gerado com sucesso via retentativa base64');
                                setGeneratedGlbUrl(glb2);
                                glbGeneratedRef.current = true;
                                glbGenerationInProgressRef.current = false;
                                launchedRef.current = true;
                                launchedForContentRef.current = true;
                                launchedAtRef.current = Date.now(); // âœ… Marca timestamp ANTES de abrir AR
                                await openNativeARWithModel(glb2);
                                actionInProgressRef.current = false;
                                return;
                            } else {
                                console.warn('[ARView] âŒ Retentativa: resposta sem GLB');
                                try { Alert.alert('Erro', 'NÃ£o foi possÃ­vel gerar o modelo AR.'); } catch (e) { }
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
            try { j = respText ? JSON.parse(respText) : {}; } catch (e) { console.warn('[ARView] âš ï¸ parse JSON falhou', e); }

            const glbUrl = j && (j.glb_signed_url || j.glb_url || j.glbSignedUrl);
            if (glbUrl) {
                console.log('[ARView] âœ… GLB gerado com sucesso!');
                console.log('[ARView] ðŸ“Š URL do GLB:', glbUrl.substring(0, 100) + '...');
                console.log('[ARView] ðŸ’¾ Salvando GLB no STATE para persistir entre navegaÃ§Ãµes...');

                // Salva o GLB gerado no STATE (para reatividade)
                setGeneratedGlbUrl(glbUrl); // STATE - dispara re-render e atualiza finalModelUrl

                // âœ… CORREÃ‡ÃƒO: Marca que GLB foi gerado com SUCESSO (sÃ³ agora!)
                console.log('[ARView] ðŸŽ¯ Setando glbGeneratedRef = true (GLB gerado com sucesso)');
                glbGeneratedRef.current = true;

                // Reseta flag de geraÃ§Ã£o em andamento
                glbGenerationInProgressRef.current = false;

                console.log('[ARView] ðŸŽ¯ Preparando para abrir AR nativo...');
                launchedRef.current = true; // Marca que lanÃ§ou AR (evita auto-launch duplicado)
                launchedForContentRef.current = true;
                launchedAtRef.current = Date.now(); // âœ… Marca timestamp ANTES de abrir AR
                console.log('[ARView] â° launchedAtRef setado para:', launchedAtRef.current);
                console.log('[ARView] ðŸš€ Chamando openNativeARWithModel...');
                await openNativeARWithModel(glbUrl);
                console.log('[ARView] âœ… openNativeARWithModel concluÃ­do');
                actionInProgressRef.current = false;
                return;
            }

            console.warn('[ARView] âŒ generate-glb-from-image: sem glb_signed_url na resposta');
            console.warn('[ARView] âŒ Resposta completa:', j || respText);
            try { Alert.alert('Erro', 'NÃ£o foi possÃ­vel gerar o modelo AR.'); } catch (e) { }
        } catch (e) {
            console.warn('[ARView] âŒ Erro gerando GLB:', e);
            try { Alert.alert('Erro', 'NÃ£o foi possÃ­vel gerar o modelo AR.'); } catch (e) { }
        } finally {
            setStatusMessage(UIMessages.READY);
            actionInProgressRef.current = false;
            glbGenerationInProgressRef.current = false; // Garante reset mesmo em erro
            generationScheduledRef.current = false; // Libera novo agendamento
        }
    }, [payload, finalModelUrl, findModelUrl, findFirstImageUrl, openNativeARWithModel]);

    // Função para iniciar geração de GLB sob demanda
    const scheduleGlbGeneration = useCallback(async () => {
        console.log('[ARView]  scheduleGlbGeneration iniciado');
        setIsGeneratingGlb(true);

        try {
            await handleVerEmRA();
        } catch (error) {
            console.error('[ARView]  Erro ao gerar GLB:', error);
            Alert.alert('Erro', 'Não foi possível preparar o modelo AR.');
        } finally {
            setIsGeneratingGlb(false);
        }
    }, [handleVerEmRA]);

    // --- RenderizaÃ§Ã£o ---

    // Estado 1: Carregamento Inicial
    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0000ff" /><Text style={styles.launchText}>Buscando conteÃºdo...</Text></View>;

    // âœ… NOVO: Estado 2: ConteÃºdo apÃ³s fechar AR
    if (showContent && payload) {
        console.log('[ARView] ðŸ“‹ Renderizando tela de conteÃºdo...');
        console.log('[ARView] ðŸ“‹ payload existe:', !!payload);
        console.log('[ARView] ðŸ“‹ payload.blocos:', payload.blocos ? 'EXISTE' : 'NULL');

        // Extrai blocos do payload
        let blocos: any[] = [];
        if (payload.blocos) {
            if (Array.isArray(payload.blocos)) {
                blocos = payload.blocos;
                console.log('[ARView] ðŸ“‹ Blocos extraÃ­dos diretamente (array):', blocos.length);
            } else if (payload.blocos.blocos && Array.isArray(payload.blocos.blocos)) {
                blocos = payload.blocos.blocos;
                console.log('[ARView] ðŸ“‹ Blocos extraÃ­dos de .blocos.blocos:', blocos.length);
            }
        } else if (payload.conteudo && Array.isArray(payload.conteudo)) {
            blocos = payload.conteudo;
            console.log('[ARView] ðŸ“‹ Blocos extraÃ­dos de .conteudo:', blocos.length);
        }

        console.log('[ARView] ðŸ“‹ Total de blocos a renderizar:', blocos.length);
        blocos.forEach((b, i) => {
            console.log(`[ARView] ðŸ“‹ Bloco ${i}: tipo="${b?.tipo}", subtipo="${b?.subtipo}"`);
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
                            console.log('[ARView] 📊 Total de GLBs disponíveis:', glbModels.length);
                            console.log('[ARView] 📊 Índice atual:', currentModelIndex);
                            console.log('[ARView] 📊 GLBs encontrados:', glbModels.map((m, i) => ({
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
                            console.log('[ARView] ⚙️ Nenhum GLB disponível, gerando sob demanda...');
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

    // Estado 3: Tela vazia se nÃ£o hÃ¡ payload (nÃ£o deveria acontecer)
    return (
        <>
            <CustomHeader title="ConteÃºdo" />
            <View style={styles.center}>
                <Text style={{ color: 'white', fontSize: 16 }}>Nenhum conteÃºdo disponÃ­vel</Text>
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
        marginTop: -18, // Adiciona sobreposiÃ§Ã£o de 14px sobre o header
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
    // âœ… NOVOS ESTILOS: Tela de conteÃºdo
    contentContainer: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    reopenARButton: {
        backgroundColor: '#3498db',
        paddingHorizontal: 24,
        paddingVertical: 14,
        margin: 16,
        borderRadius: 10,
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
