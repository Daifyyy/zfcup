// Nejlepší sestava (tým turnaje / tým kola) — čisté funkce, bez Reactu.
// Automaticky z dat, která se už načítají: góly, asistence, hráč zápasu, výhry, karty, tresty.
// Pořadatel může jednotlivá místa ručně obsadit (tournament.best_team, migrace 22).
import type { Player } from '../hooks/usePlayers'
import type { Team } from '../hooks/useTeams'
import type { SportDef } from './sports'

/** Bodování hráče (zobrazuje se i pořadatelům — měnit opatrně). */
export const BEST_TEAM_POINTS = {
  goal: 3,
  assist: 2,
  mvp: 3,
  /** Za každou výhru týmu v zápase, ve kterém hráč něco zaznamenal */
  win: 1,
  yellow: -1,
  red: -3,
  /** Za každé 2 trestné minuty */
  per2pim: -1,
  /** Brankář: čisté konto */
  cleanSheet: 2,
}

/** Max. hráčů z jednoho týmu (aby sestava nebyla jen vítěz). */
export const MAX_PER_TEAM = 2

/** Hráčů v poli podle sportu (+ 1 brankář). */
export function fieldCount(sport: SportDef): number {
  return sport.id === 'hockey' ? 5 : 4
}

export interface Game {
  id: string
  home_id: string | null
  away_id: string | null
  home_score: number
  away_score: number
  played: boolean
  mvp_player_id?: string | null
}

interface Ev { player_id: string; game_id: string }
export interface BestTeamInput {
  players: Player[]
  teams: Team[]
  games: Game[]
  goals: (Ev & { count: number })[]
  assists: (Ev & { count: number })[]
  cards: (Ev & { type: 'yellow' | 'red' | 'yellow_red' })[]
  penalties: (Ev & { minutes: number })[]
}

export interface BestTeamEntry {
  player: Player
  team?: Team
  score: number
  goals: number
  assists: number
  mvp: number
  /** Brankář: obdržené góly, zápasy, čistá konta */
  keeper?: { against: number; games: number; cleanSheets: number }
  /** Obsazeno ručně pořadatelem */
  manual: boolean
}

export interface BestTeam {
  /** null = žádný tým nemá v soupisce brankáře */
  goalkeeper: BestTeamEntry | null
  field: BestTeamEntry[]
}

const isKeeper = (p: Player) => p.role === 'goalkeeper' || p.role === 'both'

/**
 * Sestaví nejlepší sestavu. `scope` = id zápasů/slotů, které se počítají (tým kola); bez něj celý turnaj.
 * `overrides` = ruční obsazení míst: index 0 = brankář, 1… = hráči v poli.
 */
export function computeBestTeam(
  input: BestTeamInput,
  sport: SportDef,
  opts: { scope?: Set<string>; overrides?: Record<string, string> | null } = {},
): BestTeam {
  const inScope = (id: string) => !opts.scope || opts.scope.has(id)
  const games = input.games.filter(g => g.played && g.home_id && g.away_id && inScope(g.id))
  const gameById = new Map(games.map(g => [g.id, g]))
  const playerById = new Map(input.players.map(p => [p.id, p]))
  const teamById = new Map(input.teams.map(t => [t.id, t]))

  // ── Hráči v poli ──
  const acc = new Map<string, { goals: number; assists: number; mvp: number; neg: number; games: Set<string> }>()
  const row = (pid: string) => {
    let r = acc.get(pid)
    if (!r) { r = { goals: 0, assists: 0, mvp: 0, neg: 0, games: new Set() }; acc.set(pid, r) }
    return r
  }
  for (const g of input.goals) if (gameById.has(g.game_id) && g.count > 0) { const r = row(g.player_id); r.goals += g.count; r.games.add(g.game_id) }
  for (const a of input.assists) if (gameById.has(a.game_id) && a.count > 0) { const r = row(a.player_id); r.assists += a.count; r.games.add(a.game_id) }
  for (const g of games) if (g.mvp_player_id) { const r = row(g.mvp_player_id); r.mvp++; r.games.add(g.id) }
  for (const c of input.cards) {
    if (!gameById.has(c.game_id)) continue
    row(c.player_id).neg += c.type === 'yellow' ? -BEST_TEAM_POINTS.yellow : c.type === 'red' ? -BEST_TEAM_POINTS.red : -(BEST_TEAM_POINTS.yellow + BEST_TEAM_POINTS.red)
  }
  for (const p of input.penalties) if (gameById.has(p.game_id)) row(p.player_id).neg += Math.floor(p.minutes / 2) * -BEST_TEAM_POINTS.per2pim

  const won = (teamId: string, g: Game) =>
    (g.home_id === teamId && g.home_score > g.away_score) || (g.away_id === teamId && g.away_score > g.home_score)

  const fieldEntries: BestTeamEntry[] = []
  for (const [pid, r] of acc) {
    const player = playerById.get(pid)
    if (!player || r.games.size === 0) continue // jen záporné body (karta) bez přínosu → nezařazovat
    const wins = [...r.games].filter(id => won(player.team_id, gameById.get(id)!)).length
    const score = r.goals * BEST_TEAM_POINTS.goal + r.assists * BEST_TEAM_POINTS.assist + r.mvp * BEST_TEAM_POINTS.mvp + wins * BEST_TEAM_POINTS.win - r.neg
    fieldEntries.push({ player, team: teamById.get(player.team_id), score, goals: r.goals, assists: r.assists, mvp: r.mvp, manual: false })
  }
  fieldEntries.sort((a, b) => b.score - a.score || b.goals - a.goals || b.assists - a.assists || a.player.name.localeCompare(b.player.name, 'cs'))

  // ── Brankář: nejméně obdržených gólů na zápas (s dostatkem zápasů), pak čistá konta ──
  const keeperEntries: BestTeamEntry[] = []
  const keepersByTeam = new Map<string, Player[]>()
  for (const p of input.players) if (isKeeper(p)) keepersByTeam.set(p.team_id, [...(keepersByTeam.get(p.team_id) ?? []), p])
  const teamGames = new Map<string, { against: number; games: number; clean: number }>()
  for (const g of games) {
    for (const [tid, against] of [[g.home_id!, g.away_score], [g.away_id!, g.home_score]] as const) {
      const t = teamGames.get(tid) ?? { against: 0, games: 0, clean: 0 }
      t.against += against; t.games++; if (against === 0) t.clean++
      teamGames.set(tid, t)
    }
  }
  const maxGames = Math.max(0, ...[...teamGames.values()].map(t => t.games))
  const minGames = Math.max(1, Math.ceil(maxGames / 2))
  for (const [tid, keepers] of keepersByTeam) {
    const t = teamGames.get(tid)
    if (!t || t.games < minGames) continue
    // Víc brankářů v týmu: přednost má hráč zápasu, jinak první podle jména
    const sorted = [...keepers].sort((a, b) => (acc.get(b.id)?.mvp ?? 0) - (acc.get(a.id)?.mvp ?? 0) || a.name.localeCompare(b.name, 'cs'))
    const k = sorted[0]
    const r = acc.get(k.id)
    const wins = games.filter(g => (g.home_id === tid || g.away_id === tid) && won(tid, g)).length
    const score = t.clean * BEST_TEAM_POINTS.cleanSheet + wins * BEST_TEAM_POINTS.win + (r?.mvp ?? 0) * BEST_TEAM_POINTS.mvp - (r?.neg ?? 0) - t.against / t.games
    keeperEntries.push({
      player: k, team: teamById.get(tid), score: Math.round(score * 10) / 10,
      goals: r?.goals ?? 0, assists: r?.assists ?? 0, mvp: r?.mvp ?? 0,
      keeper: { against: t.against, games: t.games, cleanSheets: t.clean }, manual: false,
    })
  }
  keeperEntries.sort((a, b) =>
    a.keeper!.against / a.keeper!.games - b.keeper!.against / b.keeper!.games
    || b.keeper!.cleanSheets - a.keeper!.cleanSheets || b.score - a.score || a.player.name.localeCompare(b.player.name, 'cs'))

  // ── Ruční obsazení + doplnění automatikou ──
  const n = fieldCount(sport)
  const overrides = opts.overrides ?? {}
  const manualEntry = (idx: number): BestTeamEntry | null => {
    const pid = overrides[String(idx)]
    const player = pid ? playerById.get(pid) : undefined
    if (!player) return null
    const auto = (idx === 0 ? keeperEntries : fieldEntries).find(e => e.player.id === player.id)
      ?? fieldEntries.find(e => e.player.id === player.id) ?? keeperEntries.find(e => e.player.id === player.id)
    return auto ? { ...auto, manual: true } : { player, team: teamById.get(player.team_id), score: 0, goals: 0, assists: 0, mvp: 0, manual: true }
  }
  const slots: (BestTeamEntry | null)[] = Array.from({ length: n + 1 }, (_, i) => manualEntry(i))
  const used = new Set(slots.filter(Boolean).map(e => e!.player.id))
  const perTeam = new Map<string, number>()
  for (const e of slots) if (e) perTeam.set(e.player.team_id, (perTeam.get(e.player.team_id) ?? 0) + 1)

  const pick = (list: BestTeamEntry[], capped: boolean) => {
    for (const e of list) {
      if (used.has(e.player.id)) continue
      if (capped && (perTeam.get(e.player.team_id) ?? 0) >= MAX_PER_TEAM) continue
      used.add(e.player.id)
      perTeam.set(e.player.team_id, (perTeam.get(e.player.team_id) ?? 0) + 1)
      return e
    }
    return null
  }
  if (!slots[0]) slots[0] = pick(keeperEntries, true) ?? pick(keeperEntries, false)
  // brankáři se do pole nepočítají (mají vlastní místo), pokud je nevybral pořadatel
  const outfield = fieldEntries.filter(e => !isKeeper(e.player) || e.goals + e.assists > 0)
  for (let i = 1; i <= n; i++) if (!slots[i]) slots[i] = pick(outfield, true)
  for (let i = 1; i <= n; i++) if (!slots[i]) slots[i] = pick(outfield, false) // málo kandidátů → bez limitu na tým

  return { goalkeeper: slots[0], field: slots.slice(1).filter((e): e is BestTeamEntry => !!e) }
}

/** Data turnaje → vstup výpočtu (zápasy skupin i play-off). */
export function bestTeamInput(d: {
  players: Player[]; teams: Team[]
  matches: (Game & { id: string })[]; bracketSlots: (Game & { id: string })[]
  goals: { player_id: string; match_id: string; count: number }[]
  bracketGoals: { player_id: string; slot_id: string; count: number }[]
  assists: { player_id: string; match_id: string; count: number }[]
  bracketAssists: { player_id: string; slot_id: string; count: number }[]
  cards: { player_id: string; match_id: string; type: 'yellow' | 'red' | 'yellow_red' }[]
  bracketCards: { player_id: string; slot_id: string; type: 'yellow' | 'red' | 'yellow_red' }[]
  penalties: { player_id: string; match_id: string; minutes: number }[]
  bracketPenalties: { player_id: string; slot_id: string; minutes: number }[]
}, flags: { assists: boolean; cards: boolean; penalties: boolean }): BestTeamInput {
  const m = <T extends { match_id: string }>(rows: T[]) => rows.map(r => ({ ...r, game_id: r.match_id }))
  const s = <T extends { slot_id: string }>(rows: T[]) => rows.map(r => ({ ...r, game_id: r.slot_id }))
  return {
    players: d.players,
    teams: d.teams,
    games: [...d.matches, ...d.bracketSlots],
    goals: [...m(d.goals), ...s(d.bracketGoals)],
    assists: flags.assists ? [...m(d.assists), ...s(d.bracketAssists)] : [],
    cards: flags.cards ? [...m(d.cards), ...s(d.bracketCards)] : [],
    penalties: flags.penalties ? [...m(d.penalties), ...s(d.bracketPenalties)] : [],
  }
}
