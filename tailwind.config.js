/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
        },
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      keyframes: { fadeIn: { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } } },
      animation: { fadeIn: 'fadeIn .25s ease-out' },
    },
  },
  plugins: [],
}
