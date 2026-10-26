// Stav zápasu pro UI (badge „Živě“, pás „Právě se hraje“) — bez změny DB.
// „Živě“ = zápas není uložený jako odehraný a aktuální čas spadá do jeho okna.
// Den zápasu: match_date (sezónní režim), jinak tips_lock_from (datum jednodenního
// turnaje, YYYY-MM-DD). Bez známého data se zápas nikdy neoznačí jako živý.
import { todayISO } from './dates'

export type MatchState = 'scheduled' | 'live' | 'final'

interface MatchLike {
  played: boolean
  scheduled_time?: string | null
  match_date?: string | null
}

interface TournamentLike {
  tips_lock_from?: string | null
  match_duration?: number | null
}

export function parseHHMM(time: string | null | undefined): number | null {
  if (!time) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export function isTournamentDay(tournament: TournamentLike | null | undefined, now = new Date()): boolean {
  const date = tournament?.tips_lock_from
  return !!date && date === todayISO(now)
}

/** Den zápasu: vlastní datum (sezóna), jinak datum turnaje. */
export function matchDay(match: MatchLike, tournament: TournamentLike | null | undefined): string | null {
  return match.match_date || tournament?.tips_lock_from || null
}

export function getMatchState(
  match: MatchLike,
  tournament: TournamentLike | null | undefined,
  now = new Date(),
): MatchState {
  if (match.played) return 'final'
  const day = matchDay(match, tournament)
  if (!day || day !== todayISO(now)) return 'scheduled'
  const start = parseHHMM(match.scheduled_time)
  if (start === null) return 'scheduled'
  const duration = tournament?.match_duration || 20
  const minutesNow = now.getHours() * 60 + now.getMinutes()
  return minutesNow >= start && minutesNow < start + duration ? 'live' : 'scheduled'
}
