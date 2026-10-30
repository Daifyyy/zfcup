// Hlasování diváků o hráči zápasu (modul `fan_vote`, migrace 23).
// Hlas jen přes RPC cast_fan_vote (server ověří modul, zápas, hráče, den a limity).
// Zařízení se pozná podle náhodného id v localStorage (žádné přihlášení, žádné cookies).
import { supabase } from './supabase'
import { matchDay, parseHHMM } from './matchState'
import { todayISO } from './dates'

const VOTER_KEY = 'turnajnik_voter'
const VOTES_KEY = 'turnajnik_votes'

/** Náhodné id zařízení (32 hex) — uvedeno na stránce Cookies. */
export function voterId(): string {
  try {
    let id = localStorage.getItem(VOTER_KEY)
    if (!id || id.length < 16) {
      const bytes = new Uint8Array(16)
      crypto.getRandomValues(bytes)
      id = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
      localStorage.setItem(VOTER_KEY, id)
    }
    return id
  } catch {
    // soukromý režim bez úložiště: id jen pro tuto návštěvu
    return 'session-' + Math.random().toString(16).slice(2).padEnd(24, '0')
  }
}

/** Můj hlas v zápase (pro zvýraznění; pravda je na serveru). */
export function myVote(gameId: string): string | null {
  try { return (JSON.parse(localStorage.getItem(VOTES_KEY) ?? '{}') as Record<string, string>)[gameId] ?? null } catch { return null }
}
function rememberVote(gameId: string, playerId: string) {
  try {
    const all = JSON.parse(localStorage.getItem(VOTES_KEY) ?? '{}') as Record<string, string>
    all[gameId] = playerId
    // jen posledních 50 zápasů
    const keys = Object.keys(all)
    for (const k of keys.slice(0, Math.max(0, keys.length - 50))) delete all[k]
    localStorage.setItem(VOTES_KEY, JSON.stringify(all))
  } catch { /* nic */ }
}

export type VoteResult = 'ok' | 'disabled' | 'closed' | 'not_started' | 'invalid' | 'not_found' | 'limit' | 'error' | 'missing'

export const VOTE_MESSAGES: Record<Exclude<VoteResult, 'ok'>, string> = {
  disabled: 'Hlasování je vypnuté',
  closed: 'Hlasovat jde jen v den zápasu',
  not_started: 'Hlasování začne výkopem',
  invalid: 'Hlas se nepodařilo zapsat',
  not_found: 'Zápas nebyl nalezen',
  limit: 'Z této sítě už přišlo příliš mnoho hlasů',
  error: 'Hlas se nepodařilo odeslat — zkuste to znovu',
  missing: 'Hlasování ještě není připravené (chybí migrace 23)',
}

export async function castVote(gameId: string, playerId: string): Promise<VoteResult> {
  const { data, error } = await supabase.rpc('cast_fan_vote', { p_game: gameId, p_player: playerId, p_voter: voterId() })
  if (error) return /cast_fan_vote|function|schema cache/i.test(error.message) ? 'missing' : 'error'
  const r = (data as VoteResult) ?? 'error'
  if (r === 'ok') rememberVote(gameId, playerId)
  return r
}

export interface VoteRow { game_id: string; player_id: string; votes: number }

/** Součty hlasů turnaje: zápas → [{hráč, hlasy}] seřazené sestupně. */
export async function fetchVoteResults(tournamentId: string): Promise<Map<string, VoteRow[]> | null> {
  const { data, error } = await supabase.rpc('fan_vote_results', { p_tournament: tournamentId })
  if (error) return null
  const map = new Map<string, VoteRow[]>()
  for (const r of (data ?? []) as VoteRow[]) map.set(r.game_id, [...(map.get(r.game_id) ?? []), r])
  for (const list of map.values()) list.sort((a, b) => b.votes - a.votes)
  return map
}

/**
 * Je hlasování v zápase otevřené? Stejné pravidlo jako na serveru:
 * den zápasu = dnes a zápas začal (čas výkopu / skóre) nebo skončil.
 */
export function voteOpen(
  game: { played: boolean; home_score?: number | null; away_score?: number | null; scheduled_time?: string | null; match_date?: string | null; home_id?: string | null; away_id?: string | null },
  tournament: { tips_lock_from?: string | null } | null | undefined,
  now = new Date(),
): 'open' | 'not_started' | 'closed' {
  if (!game.home_id || !game.away_id) return 'closed'
  const day = matchDay({ ...game, played: game.played }, tournament)
  if (!day || day !== todayISO(now)) return 'closed'
  if (game.played || (game.home_score ?? 0) + (game.away_score ?? 0) > 0) return 'open'
  const start = parseHHMM(game.scheduled_time)
  if (start === null) return 'not_started'
  return now.getHours() * 60 + now.getMinutes() >= start ? 'open' : 'not_started'
}
