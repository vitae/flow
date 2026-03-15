import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        flow: {
          green: '#00FF00',
          magenta: '#FF00FF',
          yellow: '#FFFF00',
          red: '#FF0000',
          black: '#000000',
          dark: '#0a0a0a',
          darker: '#050505',
          gray: {
            100: '#e0e0e0',
            200: '#b0b0b0',
            300: '#808880',
            400: '#606060',
            500: '#404040',
            600: '#2a2a2a',
            700: '#1a1a1a',
            800: '#111111',
            900: '#0a0a0a',
          },
        },
      },
      fontFamily: {
        display: ['Montserrat', 'Jost', 'sans-serif'],
        body: ['Montserrat', 'Jost', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'scan-line': 'scan-line 4s linear infinite',
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-up': 'slide-up 0.5s ease-out',
        'matrix-rain': 'matrix-rain 1.5s linear infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px #00FF00, 0 0 10px #00FF0040' },
          '50%': { boxShadow: '0 0 20px #00FF00, 0 0 40px #00FF0060' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(0,255,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,0,0.03) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
    },
  },
  plugins: [],
};

export default config;
