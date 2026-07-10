/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        indigo: {
          650: '#4f46e5', // A custom Indigo shade used in the app
        }
      }
    },
  },
  plugins: [],
}
