export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        alcabama: {
          DEFAULT: '#FFA400',
          50: '#FFF7E6',
          100: '#FFEBBF',
          200: '#FFD580',
          300: '#FFBE33',
          400: '#FFB01A',
          500: '#FFA400',
          600: '#F28705',
          700: '#CC6F00',
          800: '#995300',
          900: '#663700',
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
