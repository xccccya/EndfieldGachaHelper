import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--brand)',
          hover: 'var(--brand-hover)',
          active: 'var(--brand-active)',
        },
        bg: {
          0: 'var(--bg-0)',
          1: 'var(--bg-1)',
          2: 'var(--bg-2)',
        },
        fg: {
          0: 'var(--fg-0)',
          1: 'var(--fg-1)',
          2: 'var(--fg-2)',
        },
        border: {
          DEFAULT: 'var(--border)',
        },
      },
      borderRadius: {
        xl2: '1rem',
      },
      boxShadow: {
        panel: '0 16px 40px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
} satisfies Config;

