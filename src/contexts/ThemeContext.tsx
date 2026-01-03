/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { onActiveUserChange, readUserScopedItem, writeUserScopedItem } from '../utils/userStorage';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

const THEME_STORAGE_KEY = 'atlas-theme';

const getStoredTheme = (): ThemePreference => {
  try {
    const stored = readUserScopedItem(THEME_STORAGE_KEY, 'local');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch (err) {
    void err;
  }
  return 'system';
};

const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = React.useState<ThemePreference>(() => getStoredTheme());
  const [systemTheme, setSystemTheme] = React.useState<ResolvedTheme>(() => getSystemTheme());

  React.useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = (event?: MediaQueryListEvent) => {
      const prefersDark = event ? event.matches : media.matches;
      setSystemTheme(prefersDark ? 'dark' : 'light');
    };

    updateSystemTheme();
    if (media.addEventListener) {
      media.addEventListener('change', updateSystemTheme);
      return () => {
        media.removeEventListener('change', updateSystemTheme);
      };
    }
    media.addListener(updateSystemTheme);
    return () => {
      media.removeListener(updateSystemTheme);
    };
  }, []);

  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  React.useEffect(() => {
    try {
      writeUserScopedItem(THEME_STORAGE_KEY, theme, 'local');
    } catch (err) {
      void err;
    }
  }, [theme]);

  React.useEffect(() => {
    const unsubscribe = onActiveUserChange(() => {
      setTheme(getStoredTheme());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const value = React.useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
};
