function getBackendUrl(): string {
  // Sempre prioriza variável de ambiente do Expo ou React Native
  const expoUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (expoUrl) {
    console.log('[API_CONFIG] Usando backend:', expoUrl);
    return expoUrl;
  }
  // Se não definido, alerta e retorna URL padrão de produção
  console.warn('[API_CONFIG] Nenhuma variável de ambiente encontrada, usando URL padrão.');
  return 'https://seu-backend-producao.com';
}

export const API_CONFIG = {
  BASE_URL: getBackendUrl().replace(/\/$/, ''),
  ENDPOINTS: {
    COMPARE_LOGO: '/public/compare-logo/',
    DEBUG_LOGOS: '/debug/logos'
  }
} as const;