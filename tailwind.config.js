/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-navy': '#0A1628',
        'baxi-blue': '#29B6E8',
        'deep-blue': '#0057A8',
        'magic-gold': '#FFD000',
        'quest-red': '#E8192C',
        'level-green': '#1B8A4C',
        'text-muted': 'rgba(255,255,255,0.45)',
        'card-surface': 'rgba(255,255,255,0.06)',
        'card-border': 'rgba(255,255,255,0.10)',
      },
      borderRadius: {
        card: '14px',
        btn: '10px',
        pill: '20px',
      },
      minHeight: {
        touch: '52px',
      },
    },
  },
  plugins: [],
}
