/** @type {import('tailwindcss').Config} */
// Design system "Drafting Table" — see docs/superpowers/specs/2026-06-07-design-system.md.
// Two fixed surfaces, not a runtime theme toggle: `ink` (dark editor side, blue
// undertone) and `paper` (warm vellum preview side). One decisive `accent`
// (cobalt signal) + sparing `amber` highlight. Tailwind config is the source of
// truth for component classes; a few raw CSS vars in globals.css mirror these for
// things utilities can't express (scrollbars, blueprint grid).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Ink — dark editor surface (charcoal with a blue undertone, never pure gray)
        ink: {
          950: '#0B0E13', // app backdrop / deepest well
          900: '#10141B', // gutter, rail
          850: '#141925',
          800: '#1A2130', // panels, toolbox, console
          750: '#212A3B',
          700: '#2A3447', // raised controls
          line: '#33405A', // hairline on dark (use /60 etc. for softer)
        },
        // Paper — warm vellum preview surface (never pure white)
        paper: {
          50: '#FAF7F1',
          100: '#F2ECE0',
          200: '#E7DECB',
          line: '#E2D8C5',
        },
        // Accent — cobalt signal (the one dominant color)
        accent: {
          DEFAULT: '#2F6BFF',
          press: '#1E50D8',
          soft: 'rgba(47,107,255,0.16)', // tint on dark
          tint: 'rgba(47,107,255,0.10)', // tint on light
        },
        // Amber — used sparingly: active markers, unsaved dot
        signal: {
          amber: '#E59A2B',
          amberSoft: 'rgba(229,154,43,0.16)',
        },
        // Text
        ondark: { strong: '#E8EEF7', muted: '#8A99AE', faint: '#5C6A80' },
        onlight: { strong: '#1B2330', muted: '#5A6473', faint: '#8A93A1' },
        ok: '#2FA56B',
        danger: '#E0524A',
      },
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
      },
      borderRadius: { sm: '4px', DEFAULT: '7px', md: '7px', lg: '11px', xl: '16px' },
      boxShadow: {
        pop: '0 1px 2px rgba(16,20,27,.08), 0 12px 32px -8px rgba(16,20,27,.22)',
        'pop-dark': '0 1px 2px rgba(0,0,0,.4), 0 16px 40px -12px rgba(0,0,0,.6)',
        inset: 'inset 0 1px 0 rgba(255,255,255,.04)',
      },
      transitionTimingFunction: { draft: 'cubic-bezier(.2,.8,.2,1)' },
      keyframes: {
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'overlay-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      },
      animation: {
        'rise-in': 'rise-in .26s cubic-bezier(.2,.8,.2,1) both',
        'pop-in': 'pop-in .18s cubic-bezier(.2,.8,.2,1) both',
        'overlay-in': 'overlay-in .18s ease-out both',
      },
    },
  },
  plugins: [],
};
