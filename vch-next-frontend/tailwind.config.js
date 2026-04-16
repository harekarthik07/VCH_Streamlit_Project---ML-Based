/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
      },
      colors: {
        'vch-bg': '#0b0c10',
        'vch-bg-soft': '#12151c',
        'vch-card': 'rgba(25, 25, 30, 0.4)',
        'vch-card-strong': 'rgba(15, 18, 24, 0.88)',
        'vch-accent': '#00CC96',
        'vch-accent-2': '#43B3AE',
        'vch-danger': '#FF4B4B',
        'vch-gold': '#FFD700',
        'vch-purple': '#ab63fa',
        'vch-text': '#ffffff',
        'vch-text-title': '#B4B4C0',
        'vch-text-muted': '#A0A0AB',
        'vch-border': 'rgba(255, 255, 255, 0.08)',
        'vch-border-top': 'rgba(255, 255, 255, 0.2)',
      },
      backdropBlur: {
        'glass': '16px',
        'glass-strong': '18px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.5)',
        'glass-hover': '0 15px 40px rgba(0, 204, 150, 0.2)',
        'glass-ambient': '0 20px 60px rgba(0, 0, 0, 0.38)',
        'glow-green': '0 0 15px rgba(0, 204, 150, 0.5)',
        'glow-red': '0 0 15px rgba(255, 75, 75, 0.5)',
        'glow-gold': '0 0 15px rgba(255, 215, 0, 0.5)',
        'card-hover-green': '0 15px 40px rgba(0, 204, 150, 0.2)',
        'card-hover-red': '0 15px 40px rgba(255, 75, 75, 0.2)',
        'card-hover-gold': '0 15px 40px rgba(255, 215, 0, 0.2)',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'fade-up-slow': 'fadeUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.2s forwards',
        'pulse-red': 'pulseRed 2s infinite',
        'pulse-glow': 'pulseGlow 2s infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseRed: {
          '0%': { boxShadow: '0 0 0 0 rgba(255, 75, 75, 0.4)' },
          '70%': { boxShadow: '0 0 15px 10px rgba(255, 75, 75, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(255, 75, 75, 0)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      transitionTimingFunction: {
        'premium': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      borderRadius: {
        'glass': '16px',
        'glass-lg': '20px',
      },
    },
  },
  plugins: [],
}
