/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    screens: {
      xs: '360px',
      sm: '480px',
      md: '768px',
      lg: '1024px',
      xl: '1200px',
      '2xl': '1440px',
    },
    extend: {
      colors: {
        // Theme Design Tokens
        background: 'var(--color-background)',
        'background-secondary': 'var(--color-background-secondary)',
        card: 'var(--color-card)',
        elevated: 'var(--color-elevated)',
        input: 'var(--color-input)',
        accent: 'var(--color-accent)',
        'accent-secondary': 'var(--color-accent-secondary)',
        text: 'var(--color-text)',
        'text-secondary': 'var(--color-text-secondary)',
        border: 'var(--color-border)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)',

        brand: {
          cream: 'var(--color-brand-cream)',
          yellow: 'var(--color-brand-yellow)',
          orange: '#CC6F00',
          brown: 'var(--color-brand-brown)',
          heroDark: 'var(--color-hero-dark)',
          sale: 'var(--color-sale)',
          purchase: 'var(--color-purchase)',
          credit: 'var(--color-credit)',
          expiry: 'var(--color-expiry)',
          assistant: 'var(--color-assistant)',
        },
        surface: {
          light: '#FFFDF5',
          dark: '#251C16',
        },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card-elevated': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
}
