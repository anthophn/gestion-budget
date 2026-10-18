import { useEffect, useSyncExternalStore } from 'react';

export type ThemePref = 'auto' | 'light' | 'dark';
const KEY = 'kakeibo-theme';
const listeners = new Set<() => void>();

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function setTheme(pref: ThemePref) {
  try {
    if (pref === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* préférence non mémorisée */
  }
  listeners.forEach((l) => l());
}

/** Le thème est une préférence de l'appareil (pas synchronisée) : clair, sombre ou automatique. */
export function useTheme(): ThemePref {
  const pref = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
  );
  useEffect(() => {
    const root = document.documentElement;
    if (pref === 'auto') delete root.dataset.theme;
    else root.dataset.theme = pref;
  }, [pref]);
  return pref;
}
