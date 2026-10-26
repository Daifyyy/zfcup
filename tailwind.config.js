/** @type {import('tailwindcss').Config} */
// Barvy odkazují na CSS tokeny v src/index.css — jediný zdroj pravdy.
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          0: 'var(--surface-0)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          muted:   'var(--ink-muted)',
          faint:   'var(--ink-faint)',
        },
        line: {
          DEFAULT: 'var(--line)',
          strong:  'var(--line-strong)',
        },
        chrome: {
          DEFAULT: 'var(--chrome)',
          2:       'var(--chrome-2)',
          ink:     'var(--chrome-ink)',
          muted:   'var(--chrome-muted)',
        },
        brand: {
          DEFAULT: 'var(--brand)',
          hov:     'var(--brand-hov)',
          ink:     'var(--brand-ink)',
          soft:    'var(--brand-soft)',
          2:       'var(--brand-2)',
        },
        live: 'var(--live)',
        win:  'var(--win)',
        loss: 'var(--loss)',
        draw: 'var(--draw)',
        // starší názvy
        accent:      'var(--accent)',
        'accent-hov':'var(--accent-hov)',
        muted:       'var(--muted)',
        border:      'var(--border)',
        success:     'var(--success)',
        danger:      'var(--danger)',
        gold:        'var(--gold)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body:    ['var(--font-body)'],
        // starší názvy
        bebas:   ['var(--font-display)'],
        dmsans:  ['var(--font-body)'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        card:  'var(--shadow-card)',
        lg:    'var(--shadow-lg)',
        panel: 'var(--shadow-panel)',
      },
      backgroundColor: {
        page: 'var(--surface-0)',
      },
    },
  },
  plugins: [],
}
