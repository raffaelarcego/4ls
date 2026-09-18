/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Diario de bordo: papel envelhecido, tinta e acentos foscos --
        // um instrumento pessoal, nao uma vitrine de jogo.
        // Os mesmos nomes de token seguem em uso; so a cor por tras mudou.
        snow: '#F5F1E6',
        swan: '#E4DCC8',
        hare: '#A79C86',
        wolf: '#6B6252',
        eel: '#22201A',

        grass: '#22344A',
        'grass-dark': '#182535',
        'grass-soft': '#DCE2E8',

        macaw: '#3E6A8F',
        'macaw-dark': '#2F5470',
        'macaw-soft': '#DCE9F0',

        cardinal: '#8C4A3A',
        'cardinal-dark': '#6E392C',
        'cardinal-soft': '#EAD9D2',

        bee: '#B3822B',
        'bee-dark': '#8F6620',
        'bee-soft': '#F0E3C8',

        beak: '#B08D57',
        humpback: '#6B2C39',
        'humpback-dark': '#54212B',
        'humpback-soft': '#E8D9DB',

        // Verde-floresta reservado ao aleman, para nao colidir com o
        // vermelho de erro (cardinal).
        forest: '#3E5C4E',
        'forest-dark': '#2E463B',
        'forest-soft': '#DCE5DE',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        xl: '0.5rem',
        '2xl': '0.75rem',
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
