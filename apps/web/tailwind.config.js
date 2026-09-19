/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /*
         * Tema "expedicao": noite, pedra e neon.
         *
         * Os NOMES dos tokens sao os mesmos desde o primeiro dia -- so a cor
         * por tras muda. E isso que permite virar o app inteiro de sepia para
         * jogo sem tocar em 140 ocorrencias de `text-eel` espalhadas por 40
         * arquivos.
         *
         * A troca aqui e uma INVERSAO, e ela so funciona porque os papeis se
         * mantiveram coerentes no codigo:
         *
         * - `snow` era o papel mais claro e vira o fundo mais escuro. Ele
         *   tambem e o texto que senta em cima de botao colorido (`text-snow`),
         *   e continua servindo: os acentos agora sao claros e saturados, entao
         *   texto quase preto em cima deles le melhor do que texto branco lia
         *   antes.
         * - `white` deixa de ser branco e vira o painel elevado. Sobrescrever
         *   o `white` do Tailwind e o que faz os 35 `bg-white` de card virarem
         *   superficie escura sem edicao nenhuma.
         * - `X-dark` passa a ser a versao mais CLARA do acento. O nome mente,
         *   e de proposito: ele e usado em dois lugares -- texto sobre o tom
         *   `X-soft` e hover de botao -- e no escuro os dois pedem clarear, nao
         *   escurecer. Renomear custaria as mesmas 40 edicoes que a inversao
         *   existe para evitar.
         * - `X-soft` vira o tom escuro tingido do acento, para painel e chip.
         */
        snow: '#0B0E1A',
        swan: '#232B45',
        hare: '#6E7AA6',
        wolf: '#A6B0D8',
        eel: '#F2F4FF',
        white: '#141A2E',

        // Acao, acerto, avanco. O verde-menta e a cor do "continuar".
        grass: '#37E0A0',
        'grass-dark': '#6FF0BF',
        'grass-soft': '#10392C',

        // Informacao, selecao, o bloco em foco.
        macaw: '#4CC9F0',
        'macaw-dark': '#8FDFF8',
        'macaw-soft': '#0E3244',

        // Erro. Rosa e nao vermelho puro: no escuro, vermelho saturado vibra.
        cardinal: '#FF5D73',
        'cardinal-dark': '#FF9AA9',
        'cardinal-soft': '#3D1420',

        // Ouro: XP, recompensa, sequencia. A cor mais "jogo" da paleta, e por
        // isso reservada ao que de fato premia.
        bee: '#FFC94A',
        'bee-dark': '#FFDE8F',
        'bee-soft': '#3A2C0C',

        beak: '#FFC94A',

        // Violeta: o russo, e o que e raro/desbloqueavel.
        humpback: '#B15CFF',
        'humpback-dark': '#D0A0FF',
        'humpback-soft': '#2B1444',

        // Verde-agua: o alemao. Distinto do `grass` de acao para o idioma nao
        // ser confundido com o botao de avancar.
        forest: '#5BE8C8',
        'forest-dark': '#9BF2DF',
        'forest-soft': '#0C3A35',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        // Cantos mais redondos que os 0.5rem do diario: peca de jogo nao tem
        // quina viva.
        xl: '0.875rem',
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

        /* --- Personagem --- */

        // Respiracao parada: o corpo sobe e desce de leve.
        breathe: {
          '0%, 100%': { transform: 'translateY(0) scaleY(1)' },
          '50%': { transform: 'translateY(-2px) scaleY(1.02)' },
        },
        // Piscada: a palpebra fecha por um instante e volta. O atraso longo
        // entre repeticoes e o que faz parecer vivo em vez de nervoso.
        blink: {
          '0%, 92%, 100%': { transform: 'scaleY(1)' },
          '96%': { transform: 'scaleY(0.05)' },
        },
        // Comemoracao: dois pulos, o segundo menor.
        cheer: {
          '0%': { transform: 'translateY(0)' },
          '20%': { transform: 'translateY(-16px)' },
          '40%': { transform: 'translateY(0)' },
          '55%': { transform: 'translateY(-7px)' },
          '70%, 100%': { transform: 'translateY(0)' },
        },
        // Desanimo: afunda e fica.
        slump: {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(4px)' },
        },
        // Brilho pulsante para o no ativo da trilha.
        halo: {
          '0%, 100%': { opacity: '0.35', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.12)' },
        },
        // A barra de XP enchendo -- brilho que atravessa.
        sheen: {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(300%)' },
        },
      },
      animation: {
        pop: 'pop 260ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-up': 'slide-up 220ms ease-out',
        wiggle: 'wiggle 500ms ease-in-out 2',
        float: 'float 3s ease-in-out infinite',
        breathe: 'breathe 3.4s ease-in-out infinite',
        blink: 'blink 5.2s ease-in-out infinite',
        cheer: 'cheer 900ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        slump: 'slump 400ms ease-out forwards',
        halo: 'halo 2.4s ease-in-out infinite',
        sheen: 'sheen 2.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
