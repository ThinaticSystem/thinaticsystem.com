module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      aspectRatio: {
        auto: 'auto',
        square: '1 / 1',
        video: '16 / 9',
      },
      colors: {
        eclair: {
          50: '#F2FFF6',
          100: '#C7E7D0',
          200: '#B7DDC2',
          300: '#A7DCB6',
          400: '#80D196',
          500: '#6AAE7D',
          600: '#639972',
          700: '#608669',
          800: '#4c6f55',
          900: '#3E5E47',
        }
      },
    },
  },
  plugins: [],
}
