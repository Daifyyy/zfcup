/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent:      '#2563eb',
        'accent-hov':'#1d4ed8',
        muted:       '#64748b',
        border:      '#e2e8f0',
        success:     '#16a34a',
        danger:      '#dc2626',
        gold:        '#d97706',
      },
      fontFamily: {
        bebas:  ['"Bebas Neue"', 'sans-serif'],
        dmsans: ['"DM Sans"', 'sans-serif'],
      },
      boxShadow: {
        card:  '0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04)',
        panel: '0 20px 60px rgba(0,0,0,.15)',
      },
      backgroundColor: {
        page: '#f8fafc',
      },
    },
  },
  plugins: [],
}
