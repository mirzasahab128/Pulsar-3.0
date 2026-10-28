import React, { createContext, useContext, useEffect, useState } from 'react';

export type WidthMode = 'fluid' | 'wide' | 'default' | 'compact';
export type DensityMode = 'compact' | 'standard' | 'spacious';
export type CoreWidgetMode = 'expanded' | 'standard' | 'collapsed';

interface DisplayContextType {
  widthMode: WidthMode;
  setWidthMode: (mode: WidthMode) => void;
  density: DensityMode;
  setDensity: (mode: DensityMode) => void;
  uiScale: number;
  setUiScale: (scale: number) => void;
  coreWidgetMode: CoreWidgetMode;
  setCoreWidgetMode: (mode: CoreWidgetMode) => void;
  // Computed classes
  containerClass: string;
  spacingClass: string;
}

const DisplayContext = createContext<DisplayContextType>({
  widthMode: 'wide',
  setWidthMode: () => {},
  density: 'standard',
  setDensity: () => {},
  uiScale: 100,
  setUiScale: () => {},
  coreWidgetMode: 'standard',
  setCoreWidgetMode: () => {},
  containerClass: 'max-w-7xl mx-auto',
  spacingClass: 'space-y-6 py-6',
});

export const DisplayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [widthMode, setWidthModeState] = useState<WidthMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pulsar_width_mode') as WidthMode;
      if (['fluid', 'wide', 'default', 'compact'].includes(saved)) return saved;
      // Default to wide (1600px) or fluid depending on viewport
      return window.innerWidth > 1400 ? 'wide' : 'fluid';
    }
    return 'wide';
  });

  const [density, setDensityState] = useState<DensityMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pulsar_density') as DensityMode;
      if (['compact', 'standard', 'spacious'].includes(saved)) return saved;
    }
    return 'standard';
  });

  const [uiScale, setUiScaleState] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = Number(localStorage.getItem('pulsar_ui_scale'));
      if ([90, 95, 100, 105, 110].includes(saved)) return saved;
    }
    return 100;
  });

  const [coreWidgetMode, setCoreWidgetModeState] = useState<CoreWidgetMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pulsar_core_mode') as CoreWidgetMode;
      if (['expanded', 'standard', 'collapsed'].includes(saved)) return saved;
    }
    return 'standard';
  });

  const setWidthMode = (mode: WidthMode) => {
    setWidthModeState(mode);
    localStorage.setItem('pulsar_width_mode', mode);
  };

  const setDensity = (mode: DensityMode) => {
    setDensityState(mode);
    localStorage.setItem('pulsar_density', mode);
  };

  const setUiScale = (scale: number) => {
    setUiScaleState(scale);
    localStorage.setItem('pulsar_ui_scale', String(scale));
  };

  const setCoreWidgetMode = (mode: CoreWidgetMode) => {
    setCoreWidgetModeState(mode);
    localStorage.setItem('pulsar_core_mode', mode);
  };

  // Apply root CSS scale
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.style.fontSize = `${(uiScale / 100) * 16}px`;
    }
  }, [uiScale]);

  // Compute container class based on width mode
  const containerClass = {
    fluid: 'w-full px-3 sm:px-5 md:px-8 xl:px-10 2xl:px-12',
    wide: 'max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8',
    default: 'max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8',
    compact: 'max-w-5xl w-full mx-auto px-4 sm:px-6',
  }[widthMode];

  // Compute vertical spacing based on density
  const spacingClass = {
    compact: 'space-y-3.5 py-3 sm:py-4',
    standard: 'space-y-6 py-5 sm:py-6',
    spacious: 'space-y-8 py-8 sm:py-10',
  }[density];

  return (
    <DisplayContext.Provider
      value={{
        widthMode,
        setWidthMode,
        density,
        setDensity,
        uiScale,
        setUiScale,
        coreWidgetMode,
        setCoreWidgetMode,
        containerClass,
        spacingClass,
      }}
    >
      {children}
    </DisplayContext.Provider>
  );
};

export const useDisplay = () => useContext(DisplayContext);
