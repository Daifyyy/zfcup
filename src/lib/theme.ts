// Branding turnaje (white-label): přepisuje CSS tokeny --brand* podle
// tournament.brand_primary / brand_secondary. NULL = výchozí vzhled platformy.

const HEX = /^#([0-9a-f]{6})$/i

export const DEFAULT_BRAND = '#1d4ed8'
export const DEFAULT_BRAND_2 = '#e11d48'

/** Předvolby palet pro admin (primární, sekundární). */
export const BRAND_PRESETS: { name: string; primary: string; secondary: string }[] = [
  { name: 'Modrá (výchozí)', primary: '#1d4ed8', secondary: '#e11d48' },
  { name: 'Námořní',         primary: '#0f2a5c', secondary: '#f59e0b' },
  { name: 'Vínová',          primary: '#9f1239', secondary: '#0b1220' },
  { name: 'Zelená',          primary: '#0f7b3f', secondary: '#facc15' },
  { name: 'Oranžová',        primary: '#ea580c', secondary: '#0b1220' },
  { name: 'Fialová',         primary: '#6d28d9', secondary: '#14b8a6' },
  { name: 'Černá',           primary: '#111827', secondary: '#d4a017' },
]

export function isHex(v: unknown): v is string {
  return typeof v === 'string' && HEX.test(v.trim())
}

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

/** Relativní jas dle WCAG 2.x */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

/** Čitelná barva textu na dané barvě (bílá nebo téměř černá). */
export function inkOn(hex: string): string {
  return contrastRatio(hex, '#ffffff') >= contrastRatio(hex, '#0b1220') ? '#ffffff' : '#0b1220'
}

function mix(hex: string, with_: string, amount: number): string {
  const a = toRgb(hex), b = toRgb(with_)
  return toHex([a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount])
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = toRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

/**
 * Barva značky pro text/čáry na světlém pozadí — pokud je primární barva
 * příliš světlá (např. žlutá), ztmaví se, aby měla kontrast ≥ 3:1.
 */
function readableOnLight(hex: string): string {
  let c = hex
  for (let i = 0; i < 8 && contrastRatio(c, '#ffffff') < 3; i++) c = mix(c, '#000000', 0.15)
  return c
}

export interface BrandVars { [k: string]: string }

export function brandVars(primary?: string | null, secondary?: string | null): BrandVars | null {
  if (!isHex(primary)) return null
  const p = readableOnLight(primary.trim())
  const s = isHex(secondary) ? secondary.trim() : DEFAULT_BRAND_2
  return {
    '--brand': p,
    '--brand-hov': mix(p, '#000000', 0.15),
    '--brand-ink': inkOn(p),
    '--brand-soft': rgba(p, 0.08),
    '--brand-line': rgba(p, 0.28),
    '--brand-2': s,
  }
}

const KEYS = ['--brand', '--brand-hov', '--brand-ink', '--brand-soft', '--brand-line', '--brand-2']

/** Aplikuje branding turnaje na :root. Bez barev vrátí výchozí tokeny z index.css. */
export function applyTournamentTheme(t: { brand_primary?: string | null; brand_secondary?: string | null } | null | undefined): void {
  const root = document.documentElement
  const vars = brandVars(t?.brand_primary, t?.brand_secondary)
  for (const k of KEYS) root.style.removeProperty(k)
  if (!vars) return
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
}
