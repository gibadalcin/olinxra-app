import { useState, useRef } from 'react';
import { API_CONFIG } from '../config/api';
import { getCachedContent, saveCachedContent, cleanExpiredCache } from '../utils/contentCache';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Contract: fetchContentForRecognition(nome_marca, lat, lon, options)
// options: { initialRadius?: number, radii?: number[], preferConsultaHelper?: boolean }

export type ARBlock = any;

/**
 * Verifica se o cache contém GLBs com glb_signed_url null
 * Retorna true se encontrar GLBs inválidos que precisam ser atualizados
 */
function checkForInvalidGlbSignedUrls(cachedData: any): boolean {
  try {
    const blocos = cachedData?.conteudo?.blocos || cachedData?.blocos || [];

    for (const bloco of blocos) {
      // Verificar GLB direto no bloco
      if (bloco.glb_url && bloco.glb_signed_url === null) {
        console.log('[useARContent] 🔍 GLB inválido encontrado no bloco:', bloco.tipo);
        return true;
      }

      // Verificar GLBs em items de carousel
      if (bloco.items && Array.isArray(bloco.items)) {
        for (const item of bloco.items) {
          if (item.glb_url && item.glb_signed_url === null) {
            console.log('[useARContent] 🔍 GLB inválido encontrado no carousel item:', item.nome);
            return true;
          }
        }
      }
    }

    return false;
  } catch (error) {
    console.warn('[useARContent] Erro ao validar GLBs:', error);
    return false; // Em caso de erro, assume que cache está ok
  }
}

export function useARContent() {
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>('');
  const [conteudo, setConteudo] = useState<ARBlock | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function fetchConsultaHelper(nome_marca: string, lat: number, lon: number, radius?: number) {
    try {
      const base = API_CONFIG.BASE_URL || '';
      const body: any = { nome_marca, latitude: lat, longitude: lon };
      if (radius && Number.isFinite(radius)) body.radius_m = radius;
      const res = await fetch(`${base}/consulta-conteudo/`, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) return null;
      const j = await res.json();
      return j; // return full response (contains conteudo + localizacao)
    } catch (e) {
      console.warn('consulta helper error', e);
      return null;
    }
  }

  async function fetchByRadius(nome_marca: string, lat: number, lon: number, radius: number) {
    try {
      const base = API_CONFIG.BASE_URL || '';
      const url = `${base}/api/conteudo?nome_marca=${encodeURIComponent(nome_marca)}&latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&radius=${encodeURIComponent(radius)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const j = await res.json();
      return j; // full response with conteudo + localizacao
    } catch (e) {
      console.warn('fetchByRadius error', e);
      return null;
    }
  }

  async function fetchByRegion(nome_marca: string, tipo_regiao: string, nome_regiao: string) {
    try {
      const base = API_CONFIG.BASE_URL || '';
      const url = `${base}/api/conteudo-por-regiao?nome_marca=${encodeURIComponent(nome_marca)}&tipo_regiao=${encodeURIComponent(tipo_regiao)}&nome_regiao=${encodeURIComponent(nome_regiao)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const j = await res.json();
      return j; // returns {blocos, tipo_regiao, nome_regiao}
    } catch (e) {
      console.warn('fetchByRegion error', e);
      return null;
    }
  }

  // radii em metros
  const DEFAULT_RADII = [50, 200, 1000, 5000];

  async function fetchContentForRecognition(nome_marca: string, lat: number, lon: number, options: any = {}) {
    setError(null);
    setLoading(true);
    const updateStage = (stage: string) => {
      console.log('[useARContent] 📍 Stage:', stage);
      setLoadingStage(stage);
    };
    updateStage('Verificando cache local...');
    setConteudo(null);
    const abort = new AbortController();
    abortRef.current = abort;

    // Limpar cache expirado em background (não bloqueia)
    cleanExpiredCache().catch(() => { });

    try {
      // 0) Verificar cache primeiro (super rápido)
      const cachedResult = await getCachedContent(nome_marca, lat, lon);
      if (cachedResult) {
        // ✅ VALIDAÇÃO: Verificar se cache tem GLBs com signed URLs null
        const hasInvalidGlbs = checkForInvalidGlbSignedUrls(cachedResult);

        if (hasInvalidGlbs) {
          console.warn('[useARContent] ⚠️ Cache tem GLBs sem signed_url, forçando atualização...');
          // Invalidar cache e buscar novamente
          const key = `@ar_content_cache_${nome_marca}_${Math.round(lat * 100) / 100}_${Math.round(lon * 100) / 100}`;
          await AsyncStorage.removeItem(key).catch(() => { });
        } else {
          console.log('[useARContent] ✅ Usando cache');
          setConteudo(cachedResult.conteudo || cachedResult);
          setLoadingStage('');
          setLoading(false);
          return cachedResult;
        }
      }

      const radii = options.radii || DEFAULT_RADII;

      // 1) Try consulta helper first (fast path)
      setLoadingStage('Buscando conteúdo próximo...');
      const consulta = await fetchConsultaHelper(nome_marca, lat, lon, options.initialRadius);
      if (consulta && consulta.conteudo) {
        await saveCachedContent(nome_marca, lat, lon, consulta);
        setConteudo(consulta.conteudo);
        setLoadingStage('');
        setLoading(false);
        return consulta; // return full response so caller can access localizacao/nome_regiao
      }

      // 2) progressive widening using radii or radius_m from admin
      for (let r of radii) {
        setLoadingStage(`Expandindo busca (raio ${r}m)...`);
        const resp = await fetchByRadius(nome_marca, lat, lon, r);
        if (resp && resp.conteudo) {
          await saveCachedContent(nome_marca, lat, lon, resp);
          setConteudo(resp.conteudo);
          setLoadingStage('');
          setLoading(false);
          return resp; // return full response
        }
      }

      // 3) try region-level fallbacks using reverse geocode from device
      setLoadingStage('Buscando por região...');
      try {
        const rev = await fetch(`${API_CONFIG.BASE_URL}/api/reverse-geocode?lat=${lat}&lon=${lon}`);
        if (rev.ok) {
          const addr = await rev.json();
          const types = [
            { t: 'bairro', v: addr.suburb || addr.neighbourhood },
            { t: 'cidade', v: addr.city || addr.town || addr.village },
            { t: 'estado', v: addr.state },
            { t: 'pais', v: addr.country }
          ];
          for (const it of types) {
            if (!it.v) continue;
            setLoadingStage(`Buscando em ${it.v}...`);
            const regionResp = await fetchByRegion(nome_marca, it.t, it.v);
            if (regionResp && regionResp.blocos && regionResp.blocos.length) {
              const normalized = { conteudo: regionResp.blocos, nome_regiao: regionResp.nome_regiao, tipo_regiao: regionResp.tipo_regiao };
              await saveCachedContent(nome_marca, lat, lon, normalized);
              setConteudo(regionResp.blocos);
              setLoadingStage('');
              setLoading(false);
              // normalize return to include region metadata
              return normalized;
            }
          }
        }
      } catch (e) {
        // ignore reverse geocode errors
      }

      // fallback none
      setLoadingStage('');
      setLoading(false);
      return null;
    } catch (e) {
      if (abort.signal.aborted) {
        setLoadingStage('');
        setLoading(false);
        return null;
      }
      console.error('fetchContentForRecognition error', e);
      setError(String(e));
      setLoadingStage('');
      setLoading(false);
      return null;
    }
  }

  function cancel() {
    try { abortRef.current && abortRef.current.abort(); } catch (e) { }
  }

  return { loading, loadingStage, conteudo, error, fetchContentForRecognition, cancel };
}
