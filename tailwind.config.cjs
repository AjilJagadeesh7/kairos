/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Semantic surface tokens — driven by CSS vars per theme
        bg:       'rgb(var(--bg)       / <alpha-value>)',
        surface:  'rgb(var(--surface)  / <alpha-value>)',
        surface2: 'rgb(var(--surface-2)/ <alpha-value>)',
        surface3: 'rgb(var(--surface-3)/ <alpha-value>)',
        border:   'rgb(var(--border)   / <alpha-value>)',
        text:     'rgb(var(--text)     / <alpha-value>)',
        text2:    'rgb(var(--text-2)   / <alpha-value>)',
        text3:    'rgb(var(--text-3)   / <alpha-value>)',
        accent:   'rgb(var(--accent)   / <alpha-value>)',
        'accent-fg': 'rgb(var(--accent-fg) / <alpha-value>)',
        // Neon tokens for cyberpunk
        neon: {
          yellow: 'rgb(var(--neon-yellow) / <alpha-value>)',
          cyan:   'rgb(var(--neon-cyan)   / <alpha-value>)',
          pink:   'rgb(var(--neon-pink)   / <alpha-value>)',
        },
      },
      boxShadow: {
        soft: '0 4px 24px rgba(0,0,0,0.10)',
        glow: '0 0 16px rgba(252,226,42,0.35)',
      },
    },
  },
  plugins: [],
}
