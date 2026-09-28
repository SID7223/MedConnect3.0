import React, { createContext, useContext, useMemo } from 'react';
import { ThemeColors, ThemeMode, darkColors, lightColors } from '../theme/tokens';
import { useSettings } from './Settings';

interface ThemeValue {
  mode: ThemeMode;
  colors: ThemeColors;
  toggle: () => void;
}

const ThemeCtx = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings, set } = useSettings();

  // derive from settings so the saved theme applies once settings finish loading
  const mode: ThemeMode = settings.theme === 'dark' ? 'dark' : 'light';

  const value = useMemo<ThemeValue>(
    () => ({
      mode,
      colors: mode === 'dark' ? darkColors : lightColors,
      toggle: () => set('theme', mode === 'dark' ? 'light' : 'dark'),
    }),
    [mode, set]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
