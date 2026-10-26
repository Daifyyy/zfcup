// Sjednocený seznam zápasů (skupiny/liga + play-off sloty) pro přehledy a TV.
import type { Match } from '../hooks/useMatches'
import type { BracketRound, BracketSlot } from '../hooks/useBracket'
import type { Group } from '../hooks/useGroups'
import type { Goal } from '../hooks/useGoals'
import type { BracketGoal } from '../hooks/useBracketGoals'
import type { Player } from '../hooks/usePlayers'
import { parseHHMM } from './matchState'

export interface Fixture {
  key: string
  kind: 'group' | 'playoff'
  home_id: string | null
  away_id: string | null
  home_score: number
  away_score: number
  played: boolean
  scheduled_time: string | null
  /** Datum zápasu (sezónní režim) */
  match_date: string | null
  /** Název skupiny nebo kola play-off */
  label: string
  decided_in?: 'regulation' | 'ot' | 'so' | null
  /** Pořadí pro řazení: play-off až po skupinách */
  order: number
}

/** Datum → číslo pro řazení (YYYYMMDD × 1e8); bez data 0 (jednodenní turnaj). */
function dateOrder(date: string | null | undefined): number {
  if (!date) return 0
  return Number(date.replace(/-/g, '')) * 1e8
}

export function buildFixtures(
  matches: Match[],
  groups: Group[],
  rounds: BracketRound[],
  slots: BracketSlot[],
): Fixture[] {
  const groupName = new Map(groups.map(g => [g.id, g.name]))
  const out: Fixture[] = matches.map((m, i) => ({
    key: `m-${m.id}`,
    kind: 'group',
    home_id: m.home_id,
    away_id: m.away_id,
    home_score: m.home_score,
    away_score: m.away_score,
    played: m.played,
    scheduled_time: m.scheduled_time || null,
    match_date: m.match_date ?? null,
    // V sezóně je štítkem kolo (skupina je jen „Liga“)
    label: (m.match_date && m.round) || (m.group_id && groupName.get(m.group_id)) || m.round || '',
    decided_in: m.decided_in ?? null,
    order: dateOrder(m.match_date) + (parseHHMM(m.scheduled_time) ?? 10_000) * 100 + (i % 100),
  }))
  const roundById = new Map(rounds.map(r => [r.id, r]))
  for (const s of slots) {
    const r = roundById.get(s.round_id)
    if (!s.home_id && !s.away_id) continue
    out.push({
      key: `s-${s.id}`,
      kind: 'playoff',
      home_id: s.home_id,
      away_id: s.away_id,
      home_score: s.home_score,
      away_score: s.away_score,
      played: s.played,
      scheduled_time: s.scheduled_time ?? null,
      match_date: s.match_date ?? null,
      label: r?.name ?? 'Play-off',
      decided_in: s.decided_in ?? null,
      // Play-off po základní části; v sezóně podle data
      order: (s.match_date ? dateOrder(s.match_date) : 8e15) + (r?.position ?? 0) * 1e7 + (parseHHMM(s.scheduled_time) ?? 0) * 100 + s.position,
    })
  }
  return out.sort((a, b) => a.order - b.order)
}

export interface ScorerAgg { player: Player; goals: number }

export function topScorers(players: Player[], goals: Goal[], bracketGoals: BracketGoal[], limit = 5): ScorerAgg[] {
  const agg: Record<string, number> = {}
  for (const g of goals) agg[g.player_id] = (agg[g.player_id] ?? 0) + g.count
  for (const g of bracketGoals) agg[g.player_id] = (agg[g.player_id] ?? 0) + g.count
  return players
    .map(p => ({ player: p, goals: agg[p.id] ?? 0 }))
    .filter(s => s.goals > 0)
    .sort((a, b) => b.goals - a.goals || a.player.name.localeCompare(b.player.name, 'cs'))
    .slice(0, limit)
}

/**
 * Sezónní režim: aktuální kolo pro TV tabuli/kiosk — první kolo (podle data), ve kterém
 * je neodehraný zápas; když je vše odehráno, poslední kolo. Bez dat zápasů vrací null.
 */
export function currentSeasonRound(matches: Match[]): { round: string; date: string | null; matches: Match[] } | null {
  if (!matches.some(m => m.match_date)) return null
  const byRound = new Map<string, Match[]>()
  for (const m of matches) {
    const r = m.round || '—'
    if (!byRound.has(r)) byRound.set(r, [])
    byRound.get(r)!.push(m)
  }
  const firstDate = (ms: Match[]) => ms.map(m => m.match_date ?? '').sort()[0] ?? ''
  const rounds = [...byRound.entries()].sort(([, a], [, b]) => firstDate(a).localeCompare(firstDate(b)))
  const pick = rounds.find(([, ms]) => ms.some(m => !m.played)) ?? rounds[rounds.length - 1]
  if (!pick) return null
  const [round, ms] = pick
  return {
    round,
    date: firstDate(ms) || null,
    matches: [...ms].sort((a, b) => (a.match_date ?? '').localeCompare(b.match_date ?? '') || (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? '')),
  }
}
