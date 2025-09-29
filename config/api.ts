import Constants from 'expo-constants';

function getBackendUrl(): string {
  // Prioriza variável de ambiente do Expo
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }

  // Em desenvolvimento, detecta automaticamente o IP do Metro
  if (__DEV__) {
    const debuggerHost = Constants.expoConfig?.hostUri?.split(':')[0];
    if (debuggerHost && debuggerHost !== 'localhost' && debuggerHost !== '127.0.0.1') {
      return `http://${debuggerHost}:8000`;
    }
    return 'http://localhost:8000';
  }

  // Em produção, usar URL fixa
  return 'https://seu-backend-producao.com';
}

export const API_CONFIG = {
  BASE_URL: getBackendUrl().replace(/\/$/, ''),
  ENDPOINTS: {
    COMPARE_LOGO: '/public/compare-logo/',
    DEBUG_LOGOS: '/debug/logos'
  }
} as const;