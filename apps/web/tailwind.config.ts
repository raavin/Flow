import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        peach:  'rgb(var(--color-peach)  / <alpha-value>)',
        butter: 'rgb(var(--color-butter) / <alpha-value>)',
        berry:  'rgb(var(--color-berry)  / <alpha-value>)',
        teal:   'rgb(var(--color-teal)   / <alpha-value>)',
        ink:    'rgb(var(--color-ink)    / <alpha-value>)',
        cloud:  'rgb(var(--color-cloud)  / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body:    ['var(--font-body)'],
      },
      borderRadius: {
        card:    'var(--radius-card)',
        panel:   'var(--radius-panel)',
        control: 'var(--radius-control)',
        pill:    'var(--radius-pill)',
        button:  'var(--radius-button)',
      },
      boxShadow: {
        card:   'var(--shadow-card)',
        button: 'var(--shadow-button)',
        floaty: 'var(--shadow-card)',
      },
      backgroundImage: {
        sprinkles: 'var(--sprinkles-gradient)',
      },
    },
  },
  plugins: [],
} satisfies Config
