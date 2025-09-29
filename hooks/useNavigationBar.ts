import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

export function useHideNavigationBar() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Esconde a barra imediatamente na montagem do componente
    NavigationBar.setVisibilityAsync('hidden');
    NavigationBar.setBehaviorAsync('overlay-swipe');

    // Listener para o estado do aplicativo
    const subscription = AppState.addEventListener('change', nextAppState => {
      // Quando o aplicativo volta para o estado 'active'
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        NavigationBar.setVisibilityAsync('hidden');
      }

      appState.current = nextAppState;
    });

    // Função de limpeza do hook
    return () => {
      subscription.remove();
      // Restaura a visibilidade da barra quando o componente é desmontado
      NavigationBar.setVisibilityAsync('visible');
    };
  }, []);
}