import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'efgh.theme';

export function getTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;

  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

export function setTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent('efgh:theme', { detail: theme }));
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function useTheme(): Theme {
  const [theme, set] = useState<Theme>(() => getTheme());

  useEffect(() => {
    applyTheme(theme);

    const onTheme = (evt: Event) => {
      const detail = (evt as CustomEvent<Theme>).detail;
      if (detail === 'light' || detail === 'dark') set(detail);
    };

    window.addEventListener('efgh:theme', onTheme);
    return () => window.removeEventListener('efgh:theme', onTheme);
  }, [theme]);

  return theme;
}

