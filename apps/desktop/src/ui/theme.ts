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

    // 关键：跨窗口（如托盘菜单独立窗口）同步主题
    // 主窗口 setTheme 写入 localStorage 后，其他窗口会收到 storage 事件。
    const onStorage = (evt: StorageEvent) => {
      if (evt.key !== STORAGE_KEY) return;
      if (evt.newValue === 'light' || evt.newValue === 'dark') set(evt.newValue);
    };

    window.addEventListener('efgh:theme', onTheme);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('efgh:theme', onTheme);
      window.removeEventListener('storage', onStorage);
    };
  }, [theme]);

  return theme;
}

