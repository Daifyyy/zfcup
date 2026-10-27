// Čisté funkce pro detail týmu a zápasu (bez Reactu, testovatelné).
import type { TournamentData } from './TournamentDataContext'
import type { Player } from '../hooks/usePlayers'
import { buildFixtures, type Fixture } from './fixtures'
import { getSportDef } from './sports'

const PITCH_LETTERS = 'ABCDEFGH'

export interface PlayerStats {
  goals: number
  assists: number
  cards?: { yellow: number; red: number; yellowRed: number }
  pim: number
}

export const EMPTY_STATS: PlayerStats = { goals: 0, assists: 0, pim: 0 }

interface StatFlags { assists: boolean; cards: boolean; penalties: boolean }

export function statFlags(d: Pick<TournamentData, 'tournament'>): StatFlags {
  return {
    assists: d.tournament.assists_enabled ?? false,
    cards: d.tournament.cards_enabled ?? false,
    penalties: d.tournament.penalty_minutes_enabled ?? false,
  }
}

type StatSource = Pick<TournamentData,
  'goals' | 'bracketGoals' | 'assists' | 'bracketAssists' | 'cards' | 'bracketCards' | 'penalties' | 'bracketPenalties'>

/** Součty za celý turnaj (skupiny + play-off) po hráčích. */
export function playerStats(d: StatSource, flags: StatFlags): Record<string, PlayerStats> {
  const stats: Record<string, PlayerStats> = {}
  const st = (id: string) => (stats[id] ??= { goals: 0, assists: 0, pim: 0 })
  for (const g of [...d.goals, ...d.bracketGoals]) st(g.player_id).goals += g.count
  if (flags.assists) for (const a of [...d.assists, ...d.bracketAssists]) st(a.player_id).assists += a.count
  if (flags.cards) {
    for (const c of [...d.cards, ...d.bracketCards]) {
      const s = st(c.player_id)
      s.cards ??= { yellow: 0, red: 0, yellowRed: 0 }
      if (c.type === 'yellow') s.cards.yellow++
      if (c.type === 'red') s.cards.red++
      if (c.type === 'yellow_red') s.cards.yellowRed++
    }
  }
  if (flags.penalties) for (const p of [...d.penalties, ...d.bracketPenalties]) st(p.player_id).pim += p.minutes
  return stats
}

export function rosterOf(players: Player[], teamId: string): Player[] {
  return players
    .filter(p => p.team_id === teamId)
    .sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, 'cs'))
}

export interface TeamRecord { played: number; w: number; d: number; l: number; gf: number; ga: number }

/** Bilance týmu ze všech odehraných zápasů (skupiny i play-off). */
export function teamRecord(fixtures: Fixture[], teamId: string): TeamRecord {
  const r: TeamRecord = { played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }
  for (const f of fixtures) {
    if (!f.played || (f.home_id !== teamId && f.away_id !== teamId)) continue
    const own = f.home_id === teamId ? f.home_score : f.away_score
    const opp = f.home_id === teamId ? f.away_score : f.home_score
    r.played++; r.gf += own; r.ga += opp
    if (own > opp) r.w++; else if (own < opp) r.l++; else r.d++
  }
  return r
}

/** Všechny zápasy týmu (skupiny i play-off) v časovém pořadí. */
export function teamFixtures(d: Pick<TournamentData, 'matches' | 'groups' | 'bracketRounds' | 'bracketSlots'>, teamId: string): Fixture[] {
  return buildFixtures(d.matches, d.groups, d.bracketRounds, d.bracketSlots)
    .filter(f => f.home_id === teamId || f.away_id === teamId)
}

/** Id zápasu / slotu z klíče fixture (`m-…` / `s-…`). */
export function fixtureId(f: Fixture): string {
  return f.key.slice(2)
}

// ── Detail zápasu ─────────────────────────────────────────────

export interface MatchDetail {
  id: string
  kind: 'group' | 'playoff'
  home_id: string | null
  away_id: string | null
  home_score: number
  away_score: number
  played: boolean
  scheduled_time: string | null
  match_date: string | null
  decided_in: 'regulation' | 'ot' | 'so' | null
  /** Skupina / kolo / kolo play-off */
  label: string
  pitch: string | null
  referee: string | null
}

/** Najde zápas nebo play-off slot podle id. */
export function findMatchDetail(d: TournamentData, id: string): MatchDetail | null {
  const sport = getSportDef(d.tournament.sport)
  const refName = (rid?: string | null) => (rid ? d.referees.find(r => r.id === rid)?.name ?? null : null)
  const m = d.matches.find(x => x.id === id)
  if (m) {
    const group = m.group_id ? d.groups.find(g => g.id === m.group_id) : undefined
    const isSeason = d.tournament.schedule_mode === 'season'
    // Hřiště: jen jednodenní liga, kde se ve stejném čase hraje víc zápasů (stejně jako v Zápasech)
    let pitch: string | null = null
    if (d.tournament.format === 'league' && !isSeason && m.scheduled_time) {
      const same = d.matches.filter(x => x.scheduled_time === m.scheduled_time)
      if (same.length >= 2) {
        const i = same.findIndex(x => x.id === m.id)
        pitch = `${sport.terms.pitchLabel} ${PITCH_LETTERS[i] ?? i + 1}`
      }
    }
    const label = isSeason
      ? m.round || group?.name || ''
      : [group?.name, m.round && m.round !== group?.name ? m.round : null].filter(Boolean).join(' · ') || m.round || ''
    return {
      id: m.id, kind: 'group',
      home_id: m.home_id, away_id: m.away_id, home_score: m.home_score, away_score: m.away_score,
      played: m.played, scheduled_time: m.scheduled_time || null, match_date: m.match_date ?? null,
      decided_in: m.decided_in ?? null, label, pitch, referee: refName(m.referee_id),
    }
  }
  const s = d.bracketSlots.find(x => x.id === id)
  if (s) {
    const round = d.bracketRounds.find(r => r.id === s.round_id)
    return {
      id: s.id, kind: 'playoff',
      home_id: s.home_id, away_id: s.away_id, home_score: s.home_score, away_score: s.away_score,
      played: s.played, scheduled_time: s.scheduled_time ?? null, match_date: s.match_date ?? null,
      decided_in: s.decided_in ?? null, label: round?.name ?? 'Play-off', pitch: null, referee: refName(s.referee_id),
    }
  }
  return null
}

export interface PlayerLine { player: Player; value: number }

export interface SideEvents {
  goals: PlayerLine[]
  assists: PlayerLine[]
  cards: { player: Player; type: 'yellow' | 'red' | 'yellow_red' }[]
  /** Trestné minuty — součet za hráče */
  penalties: PlayerLine[]
}

export interface MatchEvents { home: SideEvents; away: SideEvents; unknown: number }

const emptySide = (): SideEvents => ({ goals: [], assists: [], cards: [], penalties: [] })

/** Události zápasu rozdělené na domácí/hosty. `unknown` = záznamy hráčů, kteří už nejsou v soupisce. */
export function matchEvents(d: TournamentData, md: MatchDetail): MatchEvents {
  const isSlot = md.kind === 'playoff'
  const ofMatch = <T extends { match_id?: string; slot_id?: string }>(rows: T[]) =>
    rows.filter(r => (isSlot ? r.slot_id : r.match_id) === md.id)
  const goals = isSlot ? ofMatch(d.bracketGoals) : ofMatch(d.goals)
  const assists = isSlot ? ofMatch(d.bracketAssists) : ofMatch(d.assists)
  const cards = isSlot ? ofMatch(d.bracketCards) : ofMatch(d.cards)
  const penalties = isSlot ? ofMatch(d.bracketPenalties) : ofMatch(d.penalties)

  const playerById = new Map(d.players.map(p => [p.id, p]))
  const out: MatchEvents = { home: emptySide(), away: emptySide(), unknown: 0 }
  const sideOf = (playerId: string): { side: SideEvents; player: Player } | null => {
    const p = playerById.get(playerId)
    if (!p) { out.unknown++; return null }
    if (p.team_id === md.home_id) return { side: out.home, player: p }
    if (p.team_id === md.away_id) return { side: out.away, player: p }
    out.unknown++
    return null
  }
  const addLine = (list: PlayerLine[], player: Player, v: number) => {
    const row = list.find(x => x.player.id === player.id)
    if (row) row.value += v
    else list.push({ player, value: v })
  }

  for (const g of goals) { const x = sideOf(g.player_id); if (x && g.count > 0) addLine(x.side.goals, x.player, g.count) }
  if (d.tournament.assists_enabled) {
    for (const a of assists) { const x = sideOf(a.player_id); if (x && a.count > 0) addLine(x.side.assists, x.player, a.count) }
  }
  if (d.tournament.cards_enabled) {
    for (const c of cards) { const x = sideOf(c.player_id); if (x) x.side.cards.push({ player: x.player, type: c.type }) }
  }
  if (d.tournament.penalty_minutes_enabled) {
    for (const p of penalties) { const x = sideOf(p.player_id); if (x) addLine(x.side.penalties, x.player, p.minutes) }
  }
  const byValue = (a: PlayerLine, b: PlayerLine) => b.value - a.value || a.player.name.localeCompare(b.player.name, 'cs')
  for (const side of [out.home, out.away]) {
    side.goals.sort(byValue); side.assists.sort(byValue); side.penalties.sort(byValue)
  }
  return out
}
