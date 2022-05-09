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
          100: '#D6F0DE',
          200: '#B7DDC2',
          300: '#A3D7B2',
          400: '#88C499',
          500: '#74AF84',
          600: '#639972',
          700: '#5C8968',
          800: '#4C6F55',
          900: '#3E5E47',
        }
      },
    },
  },
  darkMode: 'class',
  plugins: [],
}
