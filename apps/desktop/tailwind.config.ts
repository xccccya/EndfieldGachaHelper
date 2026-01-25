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
          3: 'var(--bg-3)',
        },
        fg: {
          0: 'var(--fg-0)',
          1: 'var(--fg-1)',
          2: 'var(--fg-2)',
        },
        border: {
          DEFAULT: 'var(--border)',
        },
        accent: {
          dark: 'var(--accent-dark)',
          'btn-text': 'var(--accent-btn-text)',
        },
      },
      borderRadius: {
        /* 设计系统圆角 Token */
        xs: 'var(--radius-xs)',     /* 4px - 徽章、标签 */
        sm: 'var(--radius-sm)',     /* 6px - 小按钮、进度条 */
        md: 'var(--radius-md)',     /* 8px - 按钮、输入框 */
        lg: 'var(--radius-lg)',     /* 12px - 卡片、面板 */
        xl: 'var(--radius-xl)',     /* 16px - 主容器（备用） */
        full: 'var(--radius-full)', /* 圆形 */
        /* 兼容旧值 */
        xl2: '1rem',
        xl3: '1.5rem',
      },
      boxShadow: {
        panel: '0 8px 32px rgba(0, 0, 0, 0.12)',
        'panel-lg': '0 16px 48px rgba(0, 0, 0, 0.2)',
        glow: '0 0 20px rgba(255, 250, 0, 0.3)',
        'glow-sm': '0 0 10px rgba(255, 250, 0, 0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-brand': 'pulse-brand 2s infinite',
      },
      transitionDuration: {
        '400': '400ms',
      },
      backgroundImage: {
        'stripe-pattern': `linear-gradient(
          -45deg,
          transparent 0%,
          transparent 40%,
          var(--stripe-color) 40%,
          var(--stripe-color) 50%,
          transparent 50%,
          transparent 90%,
          var(--stripe-color) 90%,
          var(--stripe-color) 100%
        )`,
      },
      backgroundSize: {
        'stripe': '8px 8px',
      },
    },
  },
  plugins: [],
} satisfies Config;

