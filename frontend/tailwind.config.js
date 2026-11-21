/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gov: {
          navy: '#002B49',
          blue: '#1E3A8A',
          saffron: '#FF9933',
          green: '#138808',
          slate: '#F8FAFC'
        }
      }
    },
  },
  plugins: [],
}
