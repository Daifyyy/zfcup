// Stav zápasu pro UI (badge „Živě“, pás „Právě se hraje“) — bez změny DB.
// „Živě“ = zápas není uložený jako odehraný a aktuální čas spadá do jeho
// časového okna. Funguje jen v den turnaje (`tips_lock_from` = datum turnaje
// ve formátu YYYY-MM-DD); bez data turnaje se nikdy neoznačí jako živý.

export type MatchState = 'scheduled' | 'live' | 'final'

interface MatchLike {
  played: boolean
  scheduled_time?: string | null
}

interface TournamentLike {
  tips_lock_from?: string | null
  match_duration?: number | null
}

function localISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseHHMM(time: string | null | undefined): number | null {
  if (!time) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export function isTournamentDay(tournament: TournamentLike | null | undefined, now = new Date()): boolean {
  const date = tournament?.tips_lock_from
  return !!date && date === localISODate(now)
}

export function getMatchState(
  match: MatchLike,
  tournament: TournamentLike | null | undefined,
  now = new Date(),
): MatchState {
  if (match.played) return 'final'
  if (!isTournamentDay(tournament, now)) return 'scheduled'
  const start = parseHHMM(match.scheduled_time)
  if (start === null) return 'scheduled'
  const duration = tournament?.match_duration || 20
  const minutesNow = now.getHours() * 60 + now.getMinutes()
  return minutesNow >= start && minutesNow < start + duration ? 'live' : 'scheduled'
}
