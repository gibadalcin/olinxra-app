function getBackendUrl(): string {
  // Sempre prioriza variável de ambiente do Expo ou React Native
  const expoUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  const reactAppUrl = process.env.REACT_APP_API_URL;

  if (expoUrl && expoUrl.trim()) {
    console.log('[API_CONFIG] ✅ Usando backend do EXPO_PUBLIC_BACKEND_URL:', expoUrl);
    return expoUrl.trim();
  }

  if (reactAppUrl && reactAppUrl.trim()) {
    console.log('[API_CONFIG] ✅ Usando backend do REACT_APP_API_URL:', reactAppUrl);
    return reactAppUrl.trim();
  }

  // Se não definido, usa URL padrão de desenvolvimento (localhost não funciona em dispositivos físicos)
  const fallbackUrl = 'https://olinxra-app-k828c.ondigitalocean.app';
  console.warn('[API_CONFIG] ⚠️ Nenhuma variável de ambiente encontrada, usando URL padrão:', fallbackUrl);
  return fallbackUrl;
}

export const API_CONFIG = {
  BASE_URL: getBackendUrl().replace(/\/$/, ''),
  ENDPOINTS: {
    COMPARE_LOGO: '/search-logo/',
    CONSULTA_CONTEUDO: '/consulta-conteudo/',
    CONTEUDO_POR_REGIAO: '/api/conteudo-por-regiao',
    CONTEUDO_POR_RADIUS: '/api/conteudo',
    GENERATE_GLB: '/api/generate-glb-from-image',
    REVERSE_GEOCODE: '/api/reverse-geocode',
    DEBUG_LOGOS: '/debug/logos'
  }
} as const;