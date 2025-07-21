// tailwind.config.js - CONFIGURACIÓN CORREGIDA
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',      // <- AGREGAR ESTA LÍNEA
    './components/**/*.{js,ts,jsx,tsx,mdx}', // <- AGREGAR ESTA LÍNEA
  ],
  theme: {
    extend: {
      colors: {
        'buddy-blue': {
          500: '#3b82f6',
          600: '#2563eb',
        },
        'buddy-green': {
          500: '#22c55e',
          600: '#16a34a',
        },
      },
    },
  },
  plugins: [],
}
