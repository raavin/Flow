import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        peach: 'rgb(var(--color-peach) / <alpha-value>)',
        butter: 'rgb(var(--color-butter) / <alpha-value>)',
        berry: 'rgb(var(--color-berry) / <alpha-value>)',
        teal: 'rgb(var(--color-teal) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        cloud: 'rgb(var(--color-cloud) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
      },
      borderRadius: {
        card: 'var(--radius-card)',
        panel: 'var(--radius-panel)',
        control: 'var(--radius-control)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        button: 'var(--shadow-button)',
        floaty: 'var(--shadow-card)',
      },
      backgroundImage: {
        sprinkles:
          'radial-gradient(circle at 20% 20%, rgba(255,232,163,0.9) 0 10%, transparent 11%), radial-gradient(circle at 80% 10%, rgba(217,108,138,0.15) 0 12%, transparent 13%), radial-gradient(circle at 70% 70%, rgba(75,166,166,0.18) 0 12%, transparent 13%)',
      },
    },
  },
  plugins: [],
} satisfies Config
