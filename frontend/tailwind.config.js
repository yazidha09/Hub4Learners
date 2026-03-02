/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        drift1: 'drift1 22s ease-in-out infinite',
        drift2: 'drift2 26s ease-in-out infinite',
        drift3: 'drift3 18s ease-in-out infinite',
        drift4: 'drift4 30s ease-in-out infinite',
      },
      keyframes: {
        drift1: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(80px, 120px) scale(1.08)' },
          '66%': { transform: 'translate(-40px, 60px) scale(0.95)' },
        },
        drift2: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '40%': { transform: 'translate(-100px, -80px) scale(1.1)' },
          '70%': { transform: 'translate(60px, -40px) scale(0.92)' },
        },
        drift3: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(-80px, 100px) scale(1.05)' },
        },
        drift4: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '30%': { transform: 'translate(60px, -60px) scale(1.1)' },
          '60%': { transform: 'translate(-30px, 80px) scale(0.9)' },
        },
      },
    },
  },
  plugins: [],
}
