/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta no espirito do Duolingo: fundo claro, cores solidas e saturadas.
        // Cada cor "forte" tem um par "-dark" (usado como sombra 3D dos botoes)
        // e um par "-soft" (usado como fundo de destaque).
        snow: '#F7F7F7',
        swan: '#E5E5E5',
        hare: '#AFAFAF',
        wolf: '#777777',
        eel: '#3C3C3C',

        grass: '#58CC02',
        'grass-dark': '#4CAD02',
        'grass-soft': '#D7FFB8',

        macaw: '#1CB0F6',
        'macaw-dark': '#1899D6',
        'macaw-soft': '#DDF4FF',

        cardinal: '#FF4B4B',
        'cardinal-dark': '#E33131',
        'cardinal-soft': '#FFDFE0',

        bee: '#FFC800',
        'bee-dark': '#E5A600',
        'bee-soft': '#FFF4D4',

        beak: '#FF9600',
        humpback: '#CE82FF',
        'humpback-dark': '#A568CC',
        'humpback-soft': '#F7E9FF',
      },
      fontFamily: {
        sans: ['Nunito', 'ui-rounded', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['Nunito', 'ui-rounded', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '60%': { transform: 'scale(1.04)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        pop: 'pop 260ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-up': 'slide-up 220ms ease-out',
        wiggle: 'wiggle 500ms ease-in-out 2',
        float: 'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
