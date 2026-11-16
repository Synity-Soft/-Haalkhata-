// Tailwind CSS configuration with Haat-Bazaar brand colors
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          cream:  '#F9E6A8',
          yellow: '#F2A900',
          orange: '#CC6F00',
          brown:  '#4D2A00',
        },
        surface: {
          light: '#FFFDF5',
          dark:  '#1A1008',
        }
      },
      fontFamily: {
        sans: ['Hind Siliguri', 'Noto Sans Bengali', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        base: ['1rem', { lineHeight: '1.6' }],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
      animation: {
        'slide-in': 'slideIn 0.2s ease-out',
        'fade-in':  'fadeIn 0.15s ease-out',
      },
      keyframes: {
        slideIn: { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
      },
    },
  },
  plugins: [],
}

export default config

