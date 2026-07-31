import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          dark: 'hsl(var(--primary-dark))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          soft: 'hsl(var(--surface-soft))',
        },
        canvas: 'hsl(var(--canvas))',
        divider: 'hsl(var(--divider))',
        placeholder: 'hsl(var(--placeholder))',
        // Status colors — single source of truth for StatusBadge
        status: {
          held: 'hsl(var(--status-held))',
          pending: 'hsl(var(--status-pending))',
          confirmed: 'hsl(var(--status-confirmed))',
          checkedin: 'hsl(var(--status-checkedin))',
          completed: 'hsl(var(--status-completed))',
          cancelled: 'hsl(var(--status-cancelled))',
          noshow: 'hsl(var(--status-noshow))',
        },
        /**
         * Warm status tints from the approved design: a teal family for
         * confirmed/positive states and a gold family for awaiting-action
         * states. Paired surface + border so a badge or banner never has to
         * hard-code a hex.
         */
        tint: {
          teal: 'hsl(var(--tint-teal))',
          'teal-border': 'hsl(var(--tint-teal-border))',
          'teal-ink': 'hsl(var(--primary))',
          gold: 'hsl(var(--tint-gold))',
          'gold-border': 'hsl(var(--tint-gold-border))',
          'gold-ink': 'hsl(var(--accent-foreground))',
          neutral: 'hsl(var(--muted))',
          'neutral-border': 'hsl(var(--tint-neutral-border))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // Design-system shapes: cards 14–16px, controls 11–12px.
        card: 'var(--radius-card)',
        control: 'var(--radius-control)',
      },
      fontFamily: {
        sans: [
          'var(--font-sans-latin)',
          'var(--font-sans-arabic)',
          'Segoe UI',
          'Arial',
          'system-ui',
          'sans-serif',
        ],
        editorial: [
          'var(--font-editorial-latin)',
          'var(--font-editorial-arabic)',
          'Geeza Pro',
          'Georgia',
          'serif',
        ],
      },
    },
  },
  plugins: [],
};
export default config;
