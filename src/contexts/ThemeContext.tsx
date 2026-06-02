import React, {
  createContext,
  useContext,
  useMemo,
} from 'react';

import {
  lightColors,
  darkColors,
  brand,
  market,
  taxi,
  driver,
  semantic,
  type ColorTokens,
} from '../theme/colors';
import { typography, fontFamily, type TypographyScale } from '../theme/typography';
import { space, radius, lightElevation, darkElevation, getElevation } from '../theme/spacing';
import { duration, easing, spring } from '../theme/animation';
import { useThemePreference } from '../hooks/useThemePreference';

// ─── Theme shape ───────────────────────────────────────────────────────────────
export interface Theme {
  isDark: boolean;
  colors: ColorTokens;
  brand:    typeof brand;
  market:   typeof market;
  taxi:     typeof taxi;
  driver:   typeof driver;
  semantic: typeof semantic;
  typography: TypographyScale;
  fontFamily: typeof fontFamily;
  space:    typeof space;
  radius:   typeof radius;
  elevation: typeof lightElevation;
  getElevation: typeof getElevation;
  duration: typeof duration;
  easing:   typeof easing;
  spring:   typeof spring;
}

// ─── Context ───────────────────────────────────────────────────────────────────
const ThemeContext = createContext<Theme | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { resolvedScheme, isHydrated } = useThemePreference();
  const isDark = resolvedScheme === 'dark';

  // Hold render until AsyncStorage is read — prevents flash of wrong theme
  if (!isHydrated) return null;

  const theme = useMemo<Theme>(() => ({
    isDark,
    colors:      isDark ? darkColors  : lightColors,
    brand,
    market,
    taxi,
    driver,
    semantic,
    typography,
    fontFamily,
    space,
    radius,
    elevation:    isDark ? darkElevation : lightElevation,
    getElevation: (level, dark) => getElevation(level, dark ?? isDark),
    duration,
    easing,
    spring,
  }), [isDark]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────
export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
}
