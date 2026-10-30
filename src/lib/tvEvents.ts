// Události pro TV (animace gólu, hlasatel, chytrá režie) — čisté funkce, bez Reactu.
// Pravidlo „od teď“ (docs/ROADMAP-PREMIUM.md, Vlna 5, pravidlo 2): TV si pamatuje výchozí stav
// a hlásí jen rozdíly proti němu. DB nemá časové značky změn, proto o „starých“ událostech
// rozhoduje volající: když TV nebyla připojená, stav se jen přepíše (rebase) bez hlášení.
import type { Match } from '../hooks/useMatches'
import type { BracketRound, BracketSlot } from '../hooks/useBracket'
import type { Goal } from '../hooks/useGoals'
import type { BracketGoal } from '../hooks/useBracketGoals'
import { getMatchState } from './matchState'
import { isPlacementRound } from './history'

export interface GameState {
  id: string
  home_id: string | null
  away_id: string | null
  h: number
  a: number
  played: boolean
  live: boolean
  label: string
  groupId: string | null
}

export interface TvSnapshot {
  games: Map<string, GameState>
  /** `${gameId}:${playerId}` → počet gólů */
  goals: Map<string, number>
  /** id skupin, kde jsou odehrané všechny zápasy */
  groupsDone: Set<string>
  /** vítěz turnaje (finále odehrané a rozhodnuté) */
  championId: string | null
}

export type TvEvent =
  | { type: 'goal'; key: string; gameId: string; teamId: string; count: number; scorers: string[]; h: number; a: number }
  | { type: 'match_start'; key: string; gameId: string }
  | { type: 'match_end'; key: string; gameId: string }
  | { type: 'group_done'; key: string; groupId: string }
  | { type: 'champion'; key: string; teamId: string }

export interface SnapshotInput {
  tournament: { tips_lock_from?: string | null; match_duration?: number | null } | null
  matches: Match[]
  groups: { id: string; name: string }[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  goals: Goal[]
  bracketGoals: BracketGoal[]
}

export function buildSnapshot(d: SnapshotInput, now = new Date()): TvSnapshot {
  const games = new Map<string, GameState>()
  const groupName = new Map(d.groups.map(g => [g.id, g.name]))
  for (const m of d.matches) {
    games.set(m.id, {
      id: m.id, home_id: m.home_id, away_id: m.away_id, h: m.home_score ?? 0, a: m.away_score ?? 0, played: m.played,
      live: getMatchState(m, d.tournament, now) === 'live',
      label: (m.group_id && groupName.get(m.group_id)) || m.round || '', groupId: m.group_id,
    })
  }
  const roundName = new Map(d.bracketRounds.map(r => [r.id, r.name]))
  for (const s of d.bracketSlots) {
    if (!s.home_id || !s.away_id) continue
    games.set(s.id, {
      id: s.id, home_id: s.home_id, away_id: s.away_id, h: s.home_score ?? 0, a: s.away_score ?? 0, played: s.played,
      live: getMatchState(s, d.tournament, now) === 'live', label: roundName.get(s.round_id) ?? 'Play-off', groupId: null,
    })
  }
  const goals = new Map<string, number>()
  for (const g of d.goals) goals.set(`${g.match_id}:${g.player_id}`, g.count)
  for (const g of d.bracketGoals) goals.set(`${g.slot_id}:${g.player_id}`, g.count)

  const groupsDone = new Set<string>()
  for (const g of d.groups) {
    const ms = d.matches.filter(m => m.group_id === g.id)
    if (ms.length > 0 && ms.every(m => m.played)) groupsDone.add(g.id)
  }

  let championId: string | null = null
  const main = [...d.bracketRounds].filter(r => !isPlacementRound(r.name)).sort((a, b) => a.position - b.position)
  const finalRound = main[main.length - 1]
  const fin = finalRound ? d.bracketSlots.find(s => s.round_id === finalRound.id) : undefined
  if (fin?.played && fin.home_id && fin.away_id && fin.home_score !== fin.away_score) {
    championId = fin.home_score > fin.away_score ? fin.home_id : fin.away_id
  }
  return { games, goals, groupsDone, championId }
}

/** Hráči, kterým v zápase přibyly góly mezi dvěma stavy (tým = `teamPlayers`). */
export function newScorers(prev: TvSnapshot, next: TvSnapshot, gameId: string, teamPlayers: Set<string>): string[] {
  const out: string[] = []
  for (const [key, count] of next.goals) {
    const [gid, pid] = key.split(':')
    if (gid !== gameId || !teamPlayers.has(pid)) continue
    const before = prev.goals.get(key) ?? 0
    for (let i = before; i < count; i++) out.push(pid)
  }
  return out
}

/**
 * Události mezi dvěma stavy. Snížení skóre (oprava) ani smazaný gól nic nehlásí.
 * `teamPlayers(teamId)` = id hráčů týmu (pro určení střelců).
 */
export function diffSnapshots(prev: TvSnapshot, next: TvSnapshot, teamPlayers: (teamId: string) => Set<string>): TvEvent[] {
  const out: TvEvent[] = []
  for (const [id, g] of next.games) {
    const p = prev.games.get(id)
    if (!p) continue // nový zápas v rozpisu — nic nehlásit
    // změna týmů ve slotu (nasazení play-off) = nový zápas, ne gól
    if (p.home_id !== g.home_id || p.away_id !== g.away_id) continue
    // Góly jen u rozehraného zápasu: výsledek zadaný až po zápase (skóre + „odehráno“ najednou)
    // = jen konec zápasu; změna skóre odehraného zápasu = oprava, nehlásí se
    const inPlay = !p.played && !g.played
    const sides: [string | null, number, number][] = inPlay ? [[g.home_id, p.h, g.h], [g.away_id, p.a, g.a]] : []
    for (const [teamId, before, after] of sides) {
      if (!teamId || after <= before) continue
      out.push({
        type: 'goal', key: `goal:${id}:${g.h}:${g.a}:${teamId}`, gameId: id, teamId, count: after - before,
        scorers: newScorers(prev, next, id, teamPlayers(teamId)), h: g.h, a: g.a,
      })
    }
    if (!p.live && !p.played && g.live && !g.played) out.push({ type: 'match_start', key: `start:${id}`, gameId: id })
    if (!p.played && g.played) out.push({ type: 'match_end', key: `end:${id}`, gameId: id })
  }
  for (const gid of next.groupsDone) if (!prev.groupsDone.has(gid)) out.push({ type: 'group_done', key: `group:${gid}`, groupId: gid })
  if (next.championId && next.championId !== prev.championId) out.push({ type: 'champion', key: `champ:${next.championId}`, teamId: next.championId })
  return out
}
