// Program dne a souhrn dne — čisté funkce pro grafiky.
// Jednodenní turnaj: den = celý turnaj. Sezóna: zápasy s daným match_date.
import type { Fixture } from './fixtures'
import { todayISO } from './dates'

export interface DayOption {
  /** YYYY-MM-DD, u jednodenního turnaje '' (celý turnaj) */
  date: string
  fixtures: Fixture[]
}

/** Hrací dny turnaje (sezóna: podle data zápasů, vzestupně; jinak jeden „den“). */
export function playDays(fixtures: Fixture[], seasonMode: boolean): DayOption[] {
  const withTeams = fixtures.filter(f => f.home_id && f.away_id)
  if (!seasonMode) return withTeams.length ? [{ date: '', fixtures: withTeams }] : []
  const byDate = new Map<string, Fixture[]>()
  for (const f of withTeams) {
    if (!f.match_date) continue
    byDate.set(f.match_date, [...(byDate.get(f.match_date) ?? []), f])
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, list]) => ({ date, fixtures: list }))
}

/**
 * Výchozí den pro grafiku: dnešek, jinak nejbližší další hrací den (program) / poslední odehraný (souhrn).
 */
export function defaultDay(days: DayOption[], kind: 'program' | 'summary', today = todayISO()): DayOption | null {
  if (!days.length) return null
  const exact = days.find(d => d.date === today)
  if (exact || days.length === 1) return exact ?? days[0]
  if (kind === 'program') return days.find(d => d.date > today) ?? days[days.length - 1]
  const past = days.filter(d => d.date <= today && d.fixtures.some(f => f.played))
  return past[past.length - 1] ?? days[0]
}

/** Zápasy pro program (všechny zápasy dne v pořadí výkopu) a souhrn (jen odehrané). */
export function programOf(day: DayOption): Fixture[] {
  return [...day.fixtures].sort((a, b) => a.order - b.order)
}
export function summaryOf(day: DayOption): Fixture[] {
  return programOf(day).filter(f => f.played)
}

/** Rozdělení na strany grafiky (např. 40 zápasů jednodenního turnaje). */
export function paginate<T>(list: T[], perPage: number): T[][] {
  if (!list.length) return [[]]
  const pages: T[][] = []
  for (let i = 0; i < list.length; i += perPage) pages.push(list.slice(i, i + perPage))
  return pages
}
