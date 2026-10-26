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
  /** Název skupiny nebo kola play-off */
  label: string
  decided_in?: 'regulation' | 'ot' | 'so' | null
  /** Pořadí pro řazení: play-off až po skupinách */
  order: number
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
    label: (m.group_id && groupName.get(m.group_id)) || m.round || '',
    decided_in: m.decided_in ?? null,
    order: (parseHHMM(m.scheduled_time) ?? 10_000) * 100 + (i % 100),
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
      label: r?.name ?? 'Play-off',
      decided_in: s.decided_in ?? null,
      order: 10_000_000 + (r?.position ?? 0) * 1000 + (parseHHMM(s.scheduled_time) ?? 0) + s.position,
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
