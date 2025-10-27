import React, { createContext, useContext, useState, ReactNode } from 'react';

type CaptureSettings = {
    showOrientation: boolean;
    setShowOrientation: (value: boolean) => void;
};

const CaptureSettingsContext = createContext<CaptureSettings | undefined>(undefined);

export function CaptureSettingsProvider({ children }: { children?: ReactNode }) {
    const [showOrientation, setShowOrientation] = useState(true);
    return (
        <CaptureSettingsContext.Provider value={{ showOrientation, setShowOrientation }}>
            {children}
        </CaptureSettingsContext.Provider>
    );
}

export function useCaptureSettings() {
    const ctx = useContext(CaptureSettingsContext);
    if (!ctx) throw new Error('useCaptureSettings deve ser usado dentro do CaptureSettingsProvider');
    return ctx;
}