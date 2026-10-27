// Společná paleta a velikosti písma pro TV tabuli (Scoreboard) a TV režim (KioskMode).
// Tmavé „broadcast“ pozadí; akcent = značka turnaje zesvětlená pro tmavé plochy
// (--brand-on-dark, nastavuje applyTournamentTheme v src/lib/theme.ts).

export const TV = {
  bg:       '#060a12',
  col:      '#0d1422',
  panel:    '#0a101c',
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
 */
export const TV_SIZE = {
  title:   'clamp(1.4rem, 2.4vw, 6.4rem)',
  section: 'clamp(.85rem, 1.2vw, 3.2rem)',
  body:    'clamp(.72rem, 1.05vw, 2.8rem)',
  small:   'clamp(.62rem, .85vw, 2.3rem)',
  score:   'clamp(1rem, 1.55vw, 4.1rem)',
  pts:     'clamp(.95rem, 1.4vw, 3.7rem)',
  label:   'clamp(.56rem, .75vw, 2rem)',
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
