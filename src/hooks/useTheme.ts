import { useEffect } from 'react';
import { ThemePreference } from '../types/health';
import { syncNativeSystemBars } from '../services/androidBridge';

export function useThemeEffect(theme: ThemePreference) {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const isDark = theme === 'dark' || (theme === 'system' && media.matches);
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      const bgColor = isDark ? '#090A0C' : '#F2F2F7';
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', bgColor);
      }
      syncNativeSystemBars(isDark, bgColor);
    };

    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
