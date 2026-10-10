/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pearl: '#F8F9FB',
        gold: { DEFAULT: '#B8962E', light: '#F5EBCB', dark: '#9A7D22' },
        ink: { DEFAULT: '#111827', soft: '#6B7280' },
        ok: '#16A34A',
        warn: '#D97706',
        bad: '#DC2626',
      },
      boxShadow: {
        soft: '0 8px 30px rgba(0,0,0,0.06)',
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans Thai"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
