import { useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePref = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'rezvix_theme_pref';
const DEFAULT_PREF: ThemePref = 'light';

let _listeners: Array<(pref: ThemePref) => void> = [];
let _cached: ThemePref | null = null;

/** Global setter — can be called from ProfileScreen without hook */
export async function setThemePreference(pref: ThemePref): Promise<void> {
  _cached = pref;
  await AsyncStorage.setItem(STORAGE_KEY, pref);
  _listeners.forEach((fn) => fn(pref));
}

export function useThemePreference() {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePref>(_cached ?? DEFAULT_PREF);
  const [isHydrated, setIsHydrated] = useState(_cached !== null);

  // First load: read from AsyncStorage
  useEffect(() => {
    if (_cached !== null) return;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((val) => {
        const pref = (val as ThemePref | null) ?? DEFAULT_PREF;
        _cached = pref;
        setPreference(pref);
      })
      .catch(() => {
        _cached = DEFAULT_PREF; // storage error → fallback to default
      })
      .finally(() => {
        setIsHydrated(true);
      });
  }, []);

  // Global listener — when setThemePreference() is called elsewhere
  useEffect(() => {
    const fn = (pref: ThemePref) => setPreference(pref);
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter((l) => l !== fn); };
  }, []);

  const resolvedScheme: 'light' | 'dark' =
    preference === 'system'
      ? (systemScheme ?? 'light')
      : preference;

  const set = useCallback(async (pref: ThemePref) => {
    await setThemePreference(pref);
  }, []);

  return { preference, setPreference: set, resolvedScheme, isHydrated };
}
