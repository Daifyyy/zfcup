// Historie klubu napříč turnaji a soutěžemi (veřejná stránka /k/{slug}). Čisté funkce.
import type { CompetitionHistoryData } from '../hooks/useCompetitions'
import type { Tournament } from '../hooks/useTournament'
import type { Team } from '../hooks/useTeams'
import type { LibraryClub, LibraryPerson } from './clubs'
import { calcGroupStandings } from './standings'
import { getSportDef } from './sports'
import { clubKeyOf, collectMatches, normalizeName, summarizeEditions } from './history'

/** Data všech turnajů, kde klub hrál (stejný tvar jako historie soutěže). */
export interface ClubHistoryData extends CompetitionHistoryData {
  club: LibraryClub | null
  /** Aktuální soupiska z knihovny */
  roster: LibraryPerson[]
}

type WithTid<T> = T & { tournament_id?: string }
const tidOf = (x: unknown) => (x as { tournament_id?: string }).tournament_id

export type SeasonResult =
  | { kind: 'champion' | 'runnerUp' | 'third'; label: string }
  | { kind: 'rank'; label: string; rank: number }
  | { kind: 'none'; label: string }

export interface ClubSeason {
  tournament: Tournament
  team: Team
  result: SeasonResult
  played: number
  w: number
  d: number
  l: number
  gf: number
  ga: number
  topScorer?: { name: string; goals: number }
  status: 'finished' | 'in_progress' | 'not_started'
}

/** Týmy klubu v jednotlivých turnajích. */
export function clubTeams(d: ClubHistoryData, clubId: string): Team[] {
  return d.teams.filter(t => t.club_id === clubId)
}

/** Výsledek klubu v každém turnaji, nejnovější první. */
export function clubSeasons(d: ClubHistoryData, clubId: string): ClubSeason[] {
  const out: ClubSeason[] = []
  const playerById = new Map(d.players.map(p => [p.id, p]))
  for (const team of clubTeams(d, clubId)) {
    const t = d.editions.find(e => e.id === tidOf(team))
    if (!t) continue
    const sport = getSportDef(t.sport)
    const [summary] = summarizeEditions({ ...d, editions: [t] }, sport)

    let result: SeasonResult = { kind: 'none', label: summary.status === 'not_started' ? 'Připravuje se' : 'Probíhá' }
    if (summary.champion?.id === team.id) result = { kind: 'champion', label: 'Vítěz' }
    else if (summary.runnerUp?.id === team.id) result = { kind: 'runnerUp', label: '2. místo' }
    else if (summary.third?.id === team.id) result = { kind: 'third', label: '3. místo' }
    else if (summary.status !== 'not_started') {
      // Pořadí v tabulce skupiny/ligy, kde tým hrál
      const group = d.groups.find(g => tidOf(g) === t.id && g.team_ids.includes(team.id))
      if (group) {
        const matches = d.matches.filter(m => tidOf(m) === t.id)
        const rows = calcGroupStandings(group, matches, sport)
        const i = rows.findIndex(r => r.id === team.id)
        if (i >= 0 && rows[i].played > 0) {
          const groups = d.groups.filter(g => tidOf(g) === t.id)
          result = { kind: 'rank', rank: i + 1, label: groups.length > 1 ? `${i + 1}. ve skupině ${group.name.replace(/^Skupina\s+/i, '')}` : `${i + 1}. v tabulce` }
        }
      }
    }

    // Bilance ze všech odehraných zápasů (skupiny i play-off)
    let w = 0, dr = 0, l = 0, gf = 0, ga = 0
    const games = [
      ...(d.matches as WithTid<(typeof d.matches)[number]>[]).filter(m => m.tournament_id === t.id && m.played),
      ...(d.bracketSlots as WithTid<(typeof d.bracketSlots)[number]>[]).filter(s => s.tournament_id === t.id && s.played),
    ]
    for (const m of games) {
      if (m.home_id !== team.id && m.away_id !== team.id) continue
      const own = m.home_id === team.id ? m.home_score : m.away_score
      const opp = m.home_id === team.id ? m.away_score : m.home_score
      gf += own; ga += opp
      if (own > opp) w++; else if (own < opp) l++; else dr++
    }

    // Nejlepší střelec týmu v turnaji
    const goalsByPlayer = new Map<string, number>()
    for (const g of [...d.goals, ...d.bracketGoals]) {
      const p = playerById.get(g.player_id)
      if (p?.team_id === team.id) goalsByPlayer.set(p.id, (goalsByPlayer.get(p.id) ?? 0) + g.count)
    }
    let topScorer: ClubSeason['topScorer']
    for (const [pid, goals] of goalsByPlayer) {
      if (goals > 0 && (!topScorer || goals > topScorer.goals)) topScorer = { name: playerById.get(pid)!.name, goals }
    }

    out.push({ tournament: t, team, result, played: w + dr + l, w, d: dr, l, gf, ga, topScorer, status: summary.status })
  }
  // Nejnovější první: podle data založení, jinak podle čísla ročníku
  const created = (t: Tournament) => (t as Tournament & { created_at?: string }).created_at ?? ''
  return out.sort((a, b) => created(b.tournament).localeCompare(created(a.tournament)) || (b.tournament.edition ?? 0) - (a.tournament.edition ?? 0))
}

export interface ClubTotals { tournaments: number; titles: number; podiums: number; played: number; w: number; d: number; l: number; gf: number; ga: number }

export function clubTotals(seasons: ClubSeason[]): ClubTotals {
  const t: ClubTotals = { tournaments: seasons.length, titles: 0, podiums: 0, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }
  for (const s of seasons) {
    if (s.result.kind === 'champion') t.titles++
    if (s.result.kind === 'champion' || s.result.kind === 'runnerUp' || s.result.kind === 'third') t.podiums++
    t.played += s.played; t.w += s.w; t.d += s.d; t.l += s.l; t.gf += s.gf; t.ga += s.ga
  }
  return t
}

export interface HeadToHeadRow { key: string; name: string; color: string; logo_url: string | null; played: number; w: number; d: number; l: number; gf: number; ga: number }

/** Vzájemné zápasy s ostatními kluby (soupeř podle klubu, jinak podle jména). */
export function headToHead(d: ClubHistoryData, clubId: string): HeadToHeadRow[] {
  const ownTeams = new Set(clubTeams(d, clubId).map(t => t.id))
  const teamById = new Map(d.teams.map(t => [t.id, t]))
  const rows = new Map<string, HeadToHeadRow>()
  for (const m of collectMatches(d)) {
    const homeOwn = ownTeams.has(m.homeTeamId)
    const awayOwn = ownTeams.has(m.awayTeamId)
    if (homeOwn === awayOwn) continue
    const opp = teamById.get(homeOwn ? m.awayTeamId : m.homeTeamId)
    if (!opp) continue
    const key = clubKeyOf(opp)
    const r = rows.get(key) ?? { key, name: opp.name, color: opp.color, logo_url: opp.logo_url, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }
    const own = homeOwn ? m.homeScore : m.awayScore
    const against = homeOwn ? m.awayScore : m.homeScore
    r.played++; r.gf += own; r.ga += against
    if (own > against) r.w++; else if (own < against) r.l++; else r.d++
    // Zobrazit poslední známé jméno a logo soupeře
    r.name = opp.name; r.color = opp.color; r.logo_url = opp.logo_url ?? r.logo_url
    rows.set(key, r)
  }
  return [...rows.values()].sort((a, b) => b.played - a.played || b.w - a.w || a.name.localeCompare(b.name, 'cs'))
}

export interface ClubPlayerRow { key: string; name: string; tournaments: number; goals: number; assists: number; pim: number }

/** Hráči klubu napříč turnaji (osoba, jinak jméno). */
export function clubPlayers(d: ClubHistoryData, clubId: string): ClubPlayerRow[] {
  const ownTeams = new Set(clubTeams(d, clubId).map(t => t.id))
  const rows = new Map<string, ClubPlayerRow & { tids: Set<string> }>()
  const keyOfPlayer = new Map<string, string>()
  for (const p of d.players) {
    if (!ownTeams.has(p.team_id)) continue
    const key = p.person_id ? `person:${p.person_id}` : `name:${normalizeName(p.name)}`
    keyOfPlayer.set(p.id, key)
    const r = rows.get(key) ?? { key, name: p.name, tournaments: 0, goals: 0, assists: 0, pim: 0, tids: new Set<string>() }
    const tid = tidOf(p)
    if (tid) r.tids.add(tid)
    r.name = p.name
    rows.set(key, r)
  }
  const add = (pid: string, field: 'goals' | 'assists' | 'pim', v: number) => {
    const k = keyOfPlayer.get(pid); if (!k) return
    rows.get(k)![field] += v
  }
  for (const g of [...d.goals, ...d.bracketGoals]) add(g.player_id, 'goals', g.count)
  for (const a of [...d.assists, ...d.bracketAssists]) add(a.player_id, 'assists', a.count)
  for (const p of [...d.penalties, ...d.bracketPenalties]) add(p.player_id, 'pim', p.minutes)
  return [...rows.values()]
    .map(({ tids, ...r }) => ({ ...r, tournaments: tids.size }))
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.tournaments - a.tournaments || a.name.localeCompare(b.name, 'cs'))
}
