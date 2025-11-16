import React, { createContext, useContext, useState } from 'react';

interface SplashFadeContextType {
  cameraReady: boolean;
  setCameraReady: (ready: boolean) => void;
}

const SplashFadeContext = createContext<SplashFadeContextType | undefined>(undefined);

export const SplashFadeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cameraReady, setCameraReady] = useState(false);
  return (
    <SplashFadeContext.Provider value={{ cameraReady, setCameraReady }}>
      {children}
    </SplashFadeContext.Provider>
  );
};

export function useSplashFade() {
  const ctx = useContext(SplashFadeContext);
  if (!ctx) throw new Error('useSplashFade deve ser usado dentro do SplashFadeProvider');
  return ctx;
}
