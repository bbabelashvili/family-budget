/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#111111',
        card: '#1a1a1a',
        border: '#2a2a2a',
      },
    },
  },
  plugins: [],
}
