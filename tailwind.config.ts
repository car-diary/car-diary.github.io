import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        panel: 'rgb(var(--panel) / <alpha-value>)',
        panelAlt: 'rgb(var(--panel-alt) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        accentSoft: 'rgb(var(--accent-soft) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        text: 'rgb(var(--text) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Manrope', 'Noto Sans KR', 'sans-serif'],
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
      },
      backgroundImage: {
        'grid-dark':
          'radial-gradient(circle at 1px 1px, rgba(132, 154, 188, 0.12) 1px, transparent 0)',
      },
    },
  },
  plugins: [],
}

export default config
