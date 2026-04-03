import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#090d14',
        panel: '#101722',
        panelAlt: '#162130',
        accent: '#6cb7ff',
        accentSoft: '#8bd4ff',
        success: '#49d39a',
        warn: '#f4ba53',
        danger: '#ff7d7d',
        text: '#edf4ff',
        muted: '#9ba7ba',
        border: '#223246',
      },
      fontFamily: {
        sans: ['Manrope', 'Noto Sans KR', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 20px 60px rgba(0, 0, 0, 0.28)',
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
