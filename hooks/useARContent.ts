import { useState, useRef } from 'react';
import { API_CONFIG } from '../config/api';

// Contract: fetchContentForRecognition(nome_marca, lat, lon, options)
// options: { initialRadius?: number, radii?: number[], preferConsultaHelper?: boolean }

export type ARBlock = any;

export function useARContent() {
  const [loading, setLoading] = useState(false);
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
    setConteudo(null);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const radii = options.radii || DEFAULT_RADII;
      // 1) Try consulta helper first (fast path)
      const consulta = await fetchConsultaHelper(nome_marca, lat, lon, options.initialRadius);
      if (consulta && consulta.conteudo) {
        setConteudo(consulta.conteudo);
        setLoading(false);
        return consulta; // return full response so caller can access localizacao/nome_regiao
      }

      // 2) progressive widening using radii or radius_m from admin
      for (let r of radii) {
        const resp = await fetchByRadius(nome_marca, lat, lon, r);
        if (resp && resp.conteudo) {
          setConteudo(resp.conteudo);
          setLoading(false);
          return resp; // return full response
        }
      }

      // 3) try region-level fallbacks using reverse geocode from device
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
            const regionResp = await fetchByRegion(nome_marca, it.t, it.v);
            if (regionResp && regionResp.blocos && regionResp.blocos.length) {
              setConteudo(regionResp.blocos);
              setLoading(false);
              // normalize return to include region metadata
              return { conteudo: regionResp.blocos, nome_regiao: regionResp.nome_regiao, tipo_regiao: regionResp.tipo_regiao };
            }
          }
        }
      } catch (e) {
        // ignore reverse geocode errors
      }

      // fallback none
      setLoading(false);
      return null;
    } catch (e) {
      if (abort.signal.aborted) {
        setLoading(false);
        return null;
      }
      console.error('fetchContentForRecognition error', e);
      setError(String(e));
      setLoading(false);
      return null;
    }
  }

  function cancel() {
    try { abortRef.current && abortRef.current.abort(); } catch (e) { }
  }

  return { loading, conteudo, error, fetchContentForRecognition, cancel };
}
