export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        alcabama: {
          DEFAULT: '#d3045c',
          50: '#fdf2f9',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#e83e8c',
          600: '#d3045c',
          700: '#b0034c',
          800: '#8e023d',
          900: '#6d022f',
        },
        // Mapping provided palette to slate to override default slate usage
        slate: {
          50: '#F9F9FA',  // Lighter than C5C0C8
          100: '#EAE8EB', // Lighter than C5C0C8
          200: '#C5C0C8', // Provided Light Grey 1
          300: '#A49FA6', // Provided Light Grey 2
          400: '#938E95', // Interpolated
          500: '#827E84', // Provided Grey 3
          600: '#716E73', // Interpolated
          700: '#605E62', // Provided Dark Grey
          800: '#484649', // Darker derivative
          900: '#302F31', // Darker derivative
          950: '#181718', // Almost black but warm grey
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    }
  },
  darkMode: 'class',
  plugins: [],
}
