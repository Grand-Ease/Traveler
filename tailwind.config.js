/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // GrandEase Traveler palette (from the iOS app)
        teal: {
          DEFAULT: '#199999', // ~ rgb(0.1, 0.6, 0.6)
          deep: '#0d7373',
          ring: '#0d7373',
        },
        card: '#1c1c1e',
        cardHi: '#2c2c2e',
        headerCard: '#0d2626', // rgb(0.05, 0.15, 0.15)
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
