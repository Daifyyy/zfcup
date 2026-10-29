// Společná paleta a velikosti písma pro TV tabuli (Scoreboard) a TV režim (KioskMode).
// Pozadí v tmavých odstínech hlavní barvy turnaje (--tv-bg/--tv-col/--tv-panel v index.css,
// míchají --brand do tmavé báze → bílý text vždy čitelný); akcent = značka zesvětlená
// pro tmavé plochy (--brand-on-dark, nastavuje applyTournamentTheme v src/lib/theme.ts).

export const TV = {
  bg:       'var(--tv-bg)',
  col:      'var(--tv-col)',
  panel:    'var(--tv-panel)',
  hdr:      'var(--chrome)',
  text:     '#f5f7fa',
  muted:    'rgba(226,232,240,.66)',
  accent:   'var(--brand-on-dark)',
  /** Jemné podbarvení v barvě značky (vedoucí řádek apod.) */
  accentSoft: 'color-mix(in srgb, var(--brand-on-dark) 12%, transparent)',
  border:   'rgba(255,255,255,.08)',
  upcoming: 'rgba(255,255,255,.03)',
  live:     'var(--live)',
  success:  '#4ade80',
  warn:     '#fbbf24',
  gold:     '#f5c451',
  silver:   '#cbd5e1',
  bronze:   '#d08a4a',
  fifth:    '#a5b4fc',
  seventh:  '#94a3b8',
  ninth:    '#64748b',
} as const

/**
 * Plynulé velikosti — rostou s šířkou obrazovky (Full HD i 4K díky vw, horní mez až pro 4K+).
 * Navrženo pro 1920×1080; na 3840×2160 je vše 2× větší.
 * --tv-vw = 1 % šířky obrazovky (v ukázce na úvodní stránce = 1 % virtuální 1920px plochy).
 */
export const TV_SIZE = {
  title:   'clamp(1.4rem, calc(2.4 * var(--tv-vw, 1vw)), 6.4rem)',
  section: 'clamp(.85rem, calc(1.2 * var(--tv-vw, 1vw)), 3.2rem)',
  body:    'clamp(.72rem, calc(1.05 * var(--tv-vw, 1vw)), 2.8rem)',
  small:   'clamp(.62rem, calc(.85 * var(--tv-vw, 1vw)), 2.3rem)',
  score:   'clamp(1rem, calc(1.55 * var(--tv-vw, 1vw)), 4.1rem)',
  pts:     'clamp(.95rem, calc(1.4 * var(--tv-vw, 1vw)), 3.7rem)',
  label:   'clamp(.56rem, calc(.75 * var(--tv-vw, 1vw)), 2rem)',
} as const

/** Velikost respektující automatické zmenšení v FitBox (--tv-fit). */
export function fit(size: string): string {
  return `calc(${size} * var(--tv-fit, 1))`
}

/** Velikost loga v px přepočtená na rozlišení (návrh pro 1920 px šířky; 4K = 2×). */
export function tvLogo(px: number): number {
  const w = typeof window === 'undefined' ? 1920 : window.innerWidth
  return Math.round(px * Math.max(1, w / 1920))
}

/** Barvy pásem postupu na tmavém pozadí (lib/zones.ts → kind) */
export const TV_ZONE = {
  a: { color: TV.success, bg: 'rgba(74,222,128,.08)' },
  b: { color: TV.warn, bg: 'rgba(251,191,36,.07)' },
} as const
