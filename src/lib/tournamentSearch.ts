// Vyhledávání turnajů a výběr „Právě probíhá“ na úvodní stránce (čisté funkce).

export interface SearchableTournament {
  id: string
  name: string
  subtitle?: string | null
  venue?: string | null
  date?: string | null
  tips_lock_from?: string | null
  schedule_mode?: 'day' | 'season' | null
  visibility?: 'public' | 'private'
}

/** Malá písmena bez diakritiky */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Všechna slova dotazu musí být v názvu, podtitulu, místě nebo datu. */
export function matchesQuery(t: SearchableTournament, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return false
  const hay = fold([t.name, t.subtitle, t.venue, t.date].filter(Boolean).join(' '))
  return words.every(w => hay.includes(w))
}

/**
 * Turnaje odpovídající dotazu (min. 2 znaky), seřazené podle shody v názvu.
 * Seznam z DB už obsahuje jen to, co smí uživatel vidět (RLS: veřejné, vlastní, odemčené kódem),
 * proto se soukromé nefiltrují — vlastník tak najde i své soukromé turnaje.
 */
export function searchTournaments<T extends SearchableTournament>(list: T[], query: string, limit = 30): T[] {
  if (fold(query).trim().length < 2) return []
  const q = fold(query.trim())
  return list
    .filter(t => matchesQuery(t, query))
    .sort((a, b) => Number(fold(b.name).startsWith(q)) - Number(fold(a.name).startsWith(q)) || a.name.localeCompare(b.name, 'cs'))
    .slice(0, limit)
}

/**
 * Probíhá turnaj právě teď? Jednodenní: den turnaje (`tips_lock_from`) je dnes.
 * Sezóna: má zápas v okně ±14 dní (`activeSeasonIds` dodá dotaz na zápasy).
 * Soukromé turnaje sem RLS pustí jen jejich vlastníkovi / držiteli kódu.
 */
export function isOngoing(t: SearchableTournament, today: string, activeSeasonIds: Set<string>): boolean {
  if (t.schedule_mode === 'season') return activeSeasonIds.has(t.id)
  return !!t.tips_lock_from && t.tips_lock_from === today
}

/** Datum ± dny ve formátu YYYY-MM-DD */
export function shiftISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}
