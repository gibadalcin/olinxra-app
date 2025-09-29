import { useEffect } from 'react';
import * as NavigationBar from 'expo-navigation-bar';

export function useHideNavigationBar() {
  useEffect(() => {
    NavigationBar.setVisibilityAsync('hidden');

    return () => {
      NavigationBar.setVisibilityAsync('visible');
    };
  }, []);
}