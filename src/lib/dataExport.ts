// Export všech dat turnaje (GDPR — přenositelnost / vrácení dat organizátorovi).
import { supabase } from './supabase'

/** Tabulky se sloupcem tournament_id, které patří k turnaji. */
export const TOURNAMENT_TABLES = [
  'teams', 'players', 'groups', 'matches', 'goals', 'assists', 'cards', 'penalties',
  'bracket_rounds', 'bracket_slots', 'bracket_goals', 'bracket_assists', 'bracket_cards', 'bracket_penalties',
  'announcements', 'rule_items', 'referees', 'sponsors',
  'tipsters', 'tips', 'bracket_tips', 'special_tips',
] as const

/** Sloupce, které se do exportu nedávají (tajné údaje). */
const OMIT: Record<string, string[]> = { tipsters: ['pin'] }

export interface TournamentExport {
  exported_at: string
  tournament: Record<string, unknown> | null
  tables: Record<string, Record<string, unknown>[]>
  /** Tabulky, které se nepodařilo načíst (např. chybí migrace) */
  skipped: Record<string, string>
}

export async function exportTournamentData(tournamentId: string): Promise<TournamentExport> {
  const out: TournamentExport = { exported_at: new Date().toISOString(), tournament: null, tables: {}, skipped: {} }

  const { data: t, error: tErr } = await supabase.from('tournament').select('*').eq('id', tournamentId).maybeSingle()
  if (tErr) throw new Error(tErr.message)
  out.tournament = t

  await Promise.all(TOURNAMENT_TABLES.map(async table => {
    const { data, error } = await supabase.from(table).select('*').eq('tournament_id', tournamentId)
    if (error) { out.skipped[table] = error.message; return }
    const omit = OMIT[table] ?? []
    out.tables[table] = (data ?? []).map(row => {
      const r = { ...(row as Record<string, unknown>) }
      for (const k of omit) delete r[k]
      return r
    })
  }))
  return out
}

/** Stáhne export jako JSON soubor. */
export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
