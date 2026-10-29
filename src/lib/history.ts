// Výpočty historie soutěže napříč ročníky — čisté funkce bez přístupu k DB.
// Vstup: CompetitionHistoryData (src/hooks/useCompetitions.ts).
//
// Identita napříč ročníky:
//   tým  → club_id, jinak normalizované jméno týmu (starší ročníky bez propojení)
//   hráč → person_id, jinak klub + normalizované jméno hráče
import type { Tournament } from '../hooks/useTournament'
import type { Team } from '../hooks/useTeams'
import type { Match } from '../hooks/useMatches'
import type { BracketRound, BracketSlot } from '../hooks/useBracket'
import type { CompetitionHistoryData } from '../hooks/useCompetitions'
import type { SportDef } from './sports'
import { calcGroupStandings, type StandingRow } from './standings'

export function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Kola o umístění (O 3. místo, O 5-6. místo, Útěšné QF…) — mimo hlavní pavouk. */
export function isPlacementRound(name: string): boolean {
  return /^o\s*\d/i.test(name.trim()) || /^útěš/i.test(name.trim())
}

export function clubKeyOf(team: Pick<Team, 'club_id' | 'name'>): string {
  return team.club_id ? `club:${team.club_id}` : `name:${normalizeName(team.name)}`
}

// ── Jednotný zápis zápasu (skupina/liga i play-off) ────────────────────────────

export interface HistMatch {
  key: string
  tournamentId: string
  edition: number
  kind: 'group' | 'playoff'
  homeTeamId: string
  awayTeamId: string
  homeScore: number
  awayScore: number
  decidedIn: 'regulation' | 'ot' | 'so' | null
  /** Pořadí pro série: datum → čas → play-off kolo */
  order: string
  label: string
}

function editionNo(t: Tournament, index: number): number {
  return t.edition ?? index + 1
}

export function collectMatches(d: CompetitionHistoryData): HistMatch[] {
  const edByTid = new Map(d.editions.map((t, i) => [t.id, editionNo(t, i)]))
  const groupName = new Map(d.groups.map(g => [g.id, g.name]))
  const roundById = new Map(d.bracketRounds.map(r => [r.id, r]))
  const out: HistMatch[] = []
  for (const m of d.matches as (Match & { tournament_id?: string })[]) {
    if (!m.played || !m.tournament_id) continue
    const ed = edByTid.get(m.tournament_id); if (ed === undefined) continue
    out.push({
      key: `m-${m.id}`, tournamentId: m.tournament_id, edition: ed, kind: 'group',
      homeTeamId: m.home_id, awayTeamId: m.away_id, homeScore: m.home_score, awayScore: m.away_score,
      decidedIn: m.decided_in ?? null,
      order: `${String(ed).padStart(4, '0')}|0|${m.match_date ?? ''}|${m.scheduled_time ?? ''}`,
      label: (m.group_id && groupName.get(m.group_id)) || m.round || '',
    })
  }
  for (const s of d.bracketSlots as (BracketSlot & { tournament_id?: string })[]) {
    if (!s.played || !s.home_id || !s.away_id || !s.tournament_id) continue
    const ed = edByTid.get(s.tournament_id); if (ed === undefined) continue
    const r = roundById.get(s.round_id)
    out.push({
      key: `s-${s.id}`, tournamentId: s.tournament_id, edition: ed, kind: 'playoff',
      homeTeamId: s.home_id, awayTeamId: s.away_id, homeScore: s.home_score, awayScore: s.away_score,
      decidedIn: s.decided_in ?? null,
      order: `${String(ed).padStart(4, '0')}|1|${String(r?.position ?? 0).padStart(3, '0')}|${s.match_date ?? ''}|${s.position}`,
      label: r?.name ?? 'Play-off',
    })
  }
  return out.sort((a, b) => a.order.localeCompare(b.order))
}

// ── Souhrn ročníku ─────────────────────────────────────────────────────────────

export interface EditionSummary {
  tournament: Tournament
  edition: number
  status: 'finished' | 'in_progress' | 'not_started'
  champion?: Team
  runnerUp?: Team
  third?: Team
  /** Skóre finále, např. „3:2 PP“ */
  finalScore?: string
  decidedBy: 'playoff' | 'table' | 'none'
  /** Konečná tabulka základní části (u ligy/jedné skupiny) */
  table: StandingRow[]
  teamCount: number
  matchesPlayed: number
  matchesTotal: number
  goals: number
}

const DECIDED_SUFFIX: Record<string, string> = { ot: ' PP', so: ' SN' }

export function summarizeEditions(d: CompetitionHistoryData, sportDef: SportDef): EditionSummary[] {
  return d.editions.map((t, i) => {
    const ed = editionNo(t, i)
    const teams = d.teams.filter(x => (x as Team & { tournament_id?: string }).tournament_id === t.id)
    const teamById = new Map(teams.map(x => [x.id, x]))
    const groups = d.groups.filter(g => (g as typeof g & { tournament_id?: string }).tournament_id === t.id)
    const matches = (d.matches as (Match & { tournament_id?: string })[]).filter(m => m.tournament_id === t.id)
    const rounds = (d.bracketRounds as (BracketRound & { tournament_id?: string })[])
      .filter(r => r.tournament_id === t.id).sort((a, b) => a.position - b.position)
    const slots = (d.bracketSlots as (BracketSlot & { tournament_id?: string })[]).filter(s => s.tournament_id === t.id)

    const playedMatches = matches.filter(m => m.played)
    const playedSlots = slots.filter(s => s.played && s.home_id && s.away_id)
    const totalSlots = slots.length
    const goals = [...playedMatches, ...playedSlots].reduce((sum, m) => sum + m.home_score + m.away_score, 0)

    // Tabulka: liga / jediná skupina
    const mainGroup = groups.length === 1 ? groups[0] : groups.find(g => g.name === 'Liga')
    const table = mainGroup ? calcGroupStandings(mainGroup, matches, sportDef) : []

    let champion: Team | undefined, runnerUp: Team | undefined, third: Team | undefined
    let finalScore: string | undefined
    let decidedBy: EditionSummary['decidedBy'] = 'none'

    const mainRounds = rounds.filter(r => !isPlacementRound(r.name))
    const finalRound = mainRounds[mainRounds.length - 1]
    const finalSlot = finalRound ? slots.find(s => s.round_id === finalRound.id) : undefined
    if (finalSlot?.played && finalSlot.home_id && finalSlot.away_id && finalSlot.home_score !== finalSlot.away_score) {
      const homeWon = finalSlot.home_score > finalSlot.away_score
      champion = teamById.get(homeWon ? finalSlot.home_id : finalSlot.away_id)
      runnerUp = teamById.get(homeWon ? finalSlot.away_id : finalSlot.home_id)
      finalScore = `${finalSlot.home_score}:${finalSlot.away_score}${DECIDED_SUFFIX[finalSlot.decided_in ?? ''] ?? ''}`
      decidedBy = 'playoff'
      const thirdRound = rounds.find(r => /^o\s*3/i.test(r.name.trim()))
      const thirdSlot = thirdRound ? slots.find(s => s.round_id === thirdRound.id) : undefined
      if (thirdSlot?.played && thirdSlot.home_id && thirdSlot.away_id && thirdSlot.home_score !== thirdSlot.away_score) {
        third = teamById.get(thirdSlot.home_score > thirdSlot.away_score ? thirdSlot.home_id : thirdSlot.away_id)
      }
    } else if (rounds.length === 0 && mainGroup && matches.length > 0 && matches.every(m => m.played)) {
      // Liga bez play-off: rozhoduje konečná tabulka
      champion = teamById.get(table[0]?.id)
      runnerUp = teamById.get(table[1]?.id)
      third = teamById.get(table[2]?.id)
      decidedBy = 'table'
    }

    const matchesTotal = matches.length + totalSlots
    const matchesPlayed = playedMatches.length + playedSlots.length
    const status: EditionSummary['status'] = champion
      ? 'finished'
      : matchesPlayed > 0 ? 'in_progress' : 'not_started'

    return {
      tournament: t, edition: ed, status, champion, runnerUp, third, finalScore, decidedBy, table,
      teamCount: teams.length, matchesPlayed, matchesTotal, goals,
    }
  })
}

// ── Věčná tabulka ──────────────────────────────────────────────────────────────

export interface AllTimeRow {
  key: string
  name: string
  color: string
  logo_url: string | null
  editions: number
  titles: number
  finals: number
  played: number
  w: number
  otw: number
  d: number
  otl: number
  l: number
  gf: number
  ga: number
  pts: number
  /** Nejlepší konečné umístění (1/2/3), pokud je známo */
  best?: 1 | 2 | 3
}

function clubDisplay(d: CompetitionHistoryData, key: string, fallback: Team): { name: string; color: string; logo_url: string | null } {
  if (key.startsWith('club:')) {
    const club = d.clubs.find(c => c.id === key.slice(5))
    if (club) return { name: club.name, color: club.color ?? fallback.color, logo_url: club.logo_url ?? fallback.logo_url }
  }
  return { name: fallback.name, color: fallback.color, logo_url: fallback.logo_url }
}

export function allTimeTable(
  d: CompetitionHistoryData,
  sportDef: SportDef,
  summaries: EditionSummary[],
  opts: { includePlayoff?: boolean } = {},
): AllTimeRow[] {
  const includePlayoff = opts.includePlayoff ?? true
  const teamById = new Map(d.teams.map(t => [t.id, t]))
  const rows = new Map<string, AllTimeRow & { _eds: Set<number>; _latest: number }>()
  const { winPts, lossPts, otWinPts, otLossPts } = sportDef.standings
  const drawPts = sportDef.standings.drawPts ?? lossPts

  const row = (team: Team, edition: number) => {
    const key = clubKeyOf(team)
    let r = rows.get(key)
    if (!r) {
      const disp = clubDisplay(d, key, team)
      r = { key, ...disp, editions: 0, titles: 0, finals: 0, played: 0, w: 0, otw: 0, d: 0, otl: 0, l: 0, gf: 0, ga: 0, pts: 0, _eds: new Set(), _latest: -1 }
      rows.set(key, r)
    }
    // Zobrazit nejnovější jméno/logo týmu (klub se mohl přejmenovat)
    if (edition > r._latest && !key.startsWith('club:')) {
      r.name = team.name; r.color = team.color; r.logo_url = team.logo_url; r._latest = edition
    }
    r._eds.add(edition)
    return r
  }

  // Účast i bez odehraného zápasu
  const edByTid = new Map(d.editions.map((t, i) => [t.id, editionNo(t, i)]))
  for (const t of d.teams as (Team & { tournament_id?: string })[]) {
    const ed = t.tournament_id ? edByTid.get(t.tournament_id) : undefined
    if (ed !== undefined) row(t, ed)
  }

  for (const m of collectMatches(d)) {
    if (m.kind === 'playoff' && !includePlayoff) continue
    const h = teamById.get(m.homeTeamId), a = teamById.get(m.awayTeamId)
    if (!h || !a) continue
    const rh = row(h, m.edition), ra = row(a, m.edition)
    rh.played++; ra.played++
    rh.gf += m.homeScore; rh.ga += m.awayScore
    ra.gf += m.awayScore; ra.ga += m.homeScore
    const extra = !!m.decidedIn && m.decidedIn !== 'regulation' && otWinPts !== undefined
    const win = extra ? otWinPts! : winPts
    const loss = extra ? (otLossPts ?? lossPts) : lossPts
    if (m.homeScore === m.awayScore) { rh.d++; ra.d++; rh.pts += drawPts; ra.pts += drawPts; continue }
    const [winner, loser] = m.homeScore > m.awayScore ? [rh, ra] : [ra, rh]
    winner.w++; loser.l++
    if (extra) { winner.otw++; loser.otl++ }
    winner.pts += win; loser.pts += loss
  }

  for (const s of summaries) {
    const mark = (t: Team | undefined, place: 1 | 2 | 3) => {
      if (!t) return
      const r = rows.get(clubKeyOf(t)); if (!r) return
      if (place === 1) r.titles++
      if (place <= 2 && s.decidedBy === 'playoff') r.finals++
      if (!r.best || place < r.best) r.best = place
    }
    mark(s.champion, 1); mark(s.runnerUp, 2); mark(s.third, 3)
  }

  return [...rows.values()]
    .map(({ _eds, _latest, ...r }) => ({ ...r, editions: _eds.size }))
    .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name, 'cs'))
}

// ── Hráči napříč ročníky ───────────────────────────────────────────────────────

export interface PlayerHistoryRow {
  key: string
  name: string
  avatar_url: string | null
  clubs: string[]
  editions: number[]
  goals: number
  assists: number
  points: number
  pim: number
  yellow: number
  red: number
  /** Statistiky po ročnících pro profil hráče */
  byEdition: { edition: number; team: string; goals: number; assists: number; pim: number }[]
}

export function allTimePlayers(d: CompetitionHistoryData): PlayerHistoryRow[] {
  const teamById = new Map(d.teams.map(t => [t.id, t]))
  const edByTid = new Map(d.editions.map((t, i) => [t.id, editionNo(t, i)]))
  const playerById = new Map(d.players.map(p => [p.id, p]))
  const rows = new Map<string, PlayerHistoryRow & { _eds: Map<number, PlayerHistoryRow['byEdition'][number]> }>()

  const keyOf = (playerId: string) => {
    const p = playerById.get(playerId); if (!p) return null
    const team = teamById.get(p.team_id); if (!team) return null
    const ed = edByTid.get((p as typeof p & { tournament_id?: string }).tournament_id ?? '')
    if (ed === undefined) return null
    const key = p.person_id ? `person:${p.person_id}` : `name:${clubKeyOf(team)}:${normalizeName(p.name)}`
    let r = rows.get(key)
    if (!r) {
      const person = p.person_id ? d.persons.find(x => x.id === p.person_id) : undefined
      r = { key, name: person?.name ?? p.name, avatar_url: p.avatar_url ?? person?.avatar_url ?? null, clubs: [], editions: [], goals: 0, assists: 0, points: 0, pim: 0, yellow: 0, red: 0, byEdition: [], _eds: new Map() }
      rows.set(key, r)
    }
    if (!r.clubs.includes(team.name)) r.clubs.push(team.name)
    if (p.avatar_url) r.avatar_url = p.avatar_url
    let e = r._eds.get(ed)
    if (!e) { e = { edition: ed, team: team.name, goals: 0, assists: 0, pim: 0 }; r._eds.set(ed, e) }
    return { r, e }
  }

  // Účast hráče v ročníku i bez statistik
  for (const p of d.players) keyOf(p.id)
  for (const g of [...d.goals, ...d.bracketGoals]) { const k = keyOf(g.player_id); if (k) { k.r.goals += g.count; k.e.goals += g.count } }
  for (const a of [...d.assists, ...d.bracketAssists]) { const k = keyOf(a.player_id); if (k) { k.r.assists += a.count; k.e.assists += a.count } }
  for (const p of [...d.penalties, ...d.bracketPenalties]) { const k = keyOf(p.player_id); if (k) { k.r.pim += p.minutes; k.e.pim += p.minutes } }
  for (const c of [...d.cards, ...d.bracketCards]) {
    const k = keyOf(c.player_id); if (!k) continue
    if (c.type === 'yellow') k.r.yellow++
    else k.r.red++
  }

  return [...rows.values()].map(({ _eds, ...r }) => {
    const byEdition = [..._eds.values()].sort((a, b) => a.edition - b.edition)
    return { ...r, points: r.goals + r.assists, editions: byEdition.map(e => e.edition), byEdition }
  })
}

// ── Rekordy ────────────────────────────────────────────────────────────────────

export interface MatchRecord { kind: 'match'; edition: number; label: string; home: string; away: string; homeScore: number; awayScore: number; value: number }
export interface ValueRecord { kind: 'value'; edition?: number; holder: string; detail?: string; value: number }
export type HistoryRecord = MatchRecord | ValueRecord

export interface CompetitionRecords {
  biggestWin?: MatchRecord
  highestScoring?: MatchRecord
  teamGoalsInEdition?: ValueRecord
  playerGoalsInEdition?: ValueRecord
  playerGoalsInMatch?: ValueRecord
  unbeatenStreak?: ValueRecord
  winStreak?: ValueRecord
  mostTitles?: ValueRecord
}

export function computeRecords(d: CompetitionHistoryData, table: AllTimeRow[]): CompetitionRecords {
  const teamById = new Map(d.teams.map(t => [t.id, t]))
  const matches = collectMatches(d)
  const name = (id: string) => teamById.get(id)?.name ?? '—'
  const rec: CompetitionRecords = {}

  const asMatch = (m: HistMatch, value: number): MatchRecord => ({
    kind: 'match', edition: m.edition, label: m.label, home: name(m.homeTeamId), away: name(m.awayTeamId),
    homeScore: m.homeScore, awayScore: m.awayScore, value,
  })
  for (const m of matches) {
    const diff = Math.abs(m.homeScore - m.awayScore)
    const total = m.homeScore + m.awayScore
    if (!rec.biggestWin || diff > rec.biggestWin.value) rec.biggestWin = asMatch(m, diff)
    if (!rec.highestScoring || total > rec.highestScoring.value) rec.highestScoring = asMatch(m, total)
  }

  // Tým: nejvíc gólů v jednom ročníku
  const teamGoals = new Map<string, { team: Team; edition: number; goals: number }>()
  for (const m of matches) {
    for (const [tid, g] of [[m.homeTeamId, m.homeScore], [m.awayTeamId, m.awayScore]] as const) {
      const t = teamById.get(tid); if (!t) continue
      const k = `${m.edition}|${clubKeyOf(t)}`
      const cur = teamGoals.get(k) ?? { team: t, edition: m.edition, goals: 0 }
      cur.goals += g; teamGoals.set(k, cur)
    }
  }
  for (const v of teamGoals.values()) {
    if (!rec.teamGoalsInEdition || v.goals > rec.teamGoalsInEdition.value) {
      rec.teamGoalsInEdition = { kind: 'value', edition: v.edition, holder: v.team.name, value: v.goals }
    }
  }

  // Hráč: nejvíc gólů v ročníku a v jednom zápase
  const players = allTimePlayers(d)
  for (const p of players) {
    for (const e of p.byEdition) {
      if (e.goals > 0 && (!rec.playerGoalsInEdition || e.goals > rec.playerGoalsInEdition.value)) {
        rec.playerGoalsInEdition = { kind: 'value', edition: e.edition, holder: p.name, detail: e.team, value: e.goals }
      }
    }
  }
  const playerById = new Map(d.players.map(p => [p.id, p]))
  const edByTid = new Map(d.editions.map((t, i) => [t.id, editionNo(t, i)]))
  for (const g of [...d.goals, ...d.bracketGoals]) {
    const p = playerById.get(g.player_id); if (!p) continue
    if (!rec.playerGoalsInMatch || g.count > rec.playerGoalsInMatch.value) {
      const ed = edByTid.get((p as typeof p & { tournament_id?: string }).tournament_id ?? '')
      rec.playerGoalsInMatch = { kind: 'value', edition: ed, holder: p.name, detail: teamById.get(p.team_id)?.name, value: g.count }
    }
  }

  // Série (napříč ročníky, v chronologickém pořadí zápasů)
  const streaks = new Map<string, { name: string; unbeaten: number; wins: number; bestU: number; bestW: number; uFrom?: number; uTo?: number; wFrom?: number; wTo?: number; curUFrom?: number; curWFrom?: number }>()
  for (const m of matches) {
    for (const [tid, own, opp] of [[m.homeTeamId, m.homeScore, m.awayScore], [m.awayTeamId, m.awayScore, m.homeScore]] as const) {
      const t = teamById.get(tid); if (!t) continue
      const k = clubKeyOf(t)
      const s = streaks.get(k) ?? { name: t.name, unbeaten: 0, wins: 0, bestU: 0, bestW: 0 }
      s.name = t.name
      const won = own > opp, lost = own < opp
      if (lost) { s.unbeaten = 0; s.curUFrom = undefined } else {
        if (s.unbeaten === 0) s.curUFrom = m.edition
        s.unbeaten++
        if (s.unbeaten > s.bestU) { s.bestU = s.unbeaten; s.uFrom = s.curUFrom; s.uTo = m.edition }
      }
      if (won) {
        if (s.wins === 0) s.curWFrom = m.edition
        s.wins++
        if (s.wins > s.bestW) { s.bestW = s.wins; s.wFrom = s.curWFrom; s.wTo = m.edition }
      } else { s.wins = 0; s.curWFrom = undefined }
      streaks.set(k, s)
    }
  }
  const span = (a?: number, b?: number) => (a === undefined || b === undefined) ? undefined : a === b ? `${a}. ročník` : `${a}.–${b}. ročník`
  for (const s of streaks.values()) {
    if (s.bestU > 1 && (!rec.unbeatenStreak || s.bestU > rec.unbeatenStreak.value)) rec.unbeatenStreak = { kind: 'value', holder: s.name, detail: span(s.uFrom, s.uTo), value: s.bestU }
    if (s.bestW > 1 && (!rec.winStreak || s.bestW > rec.winStreak.value)) rec.winStreak = { kind: 'value', holder: s.name, detail: span(s.wFrom, s.wTo), value: s.bestW }
  }

  const topTitles = [...table].sort((a, b) => b.titles - a.titles)[0]
  if (topTitles && topTitles.titles > 0) rec.mostTitles = { kind: 'value', holder: topTitles.name, value: topTitles.titles }

  return rec
}

export interface CompetitionHighlights {
  /** Poslední ročník s vítězem */
  champion?: { team: Team; edition: number }
  /** Klub s nejvíc tituly (jen když má aspoň jeden) */
  mostTitles?: { name: string; color: string; logo_url: string | null; titles: number }
  /** Nejlepší střelec napříč ročníky */
  topScorer?: { name: string; avatar_url: string | null; goals: number; clubs: string[] }
  biggestWin?: MatchRecord
}

/** Úvodní přehled stránky soutěže: úřadující vítěz, nejúspěšnější klub, nejlepší střelec, nejvyšší výhra. */
export function competitionHighlights(
  summaries: EditionSummary[],
  table: AllTimeRow[],
  players: PlayerHistoryRow[],
  records: CompetitionRecords,
): CompetitionHighlights {
  const latest = [...summaries].reverse().find(s => s.champion)
  const best = [...table].sort((a, b) => b.titles - a.titles || b.finals - a.finals || b.pts - a.pts)[0]
  const scorer = [...players].sort((a, b) => b.goals - a.goals || b.points - a.points || a.name.localeCompare(b.name, 'cs'))[0]
  return {
    champion: latest?.champion ? { team: latest.champion, edition: latest.edition } : undefined,
    mostTitles: best && best.titles > 0 ? { name: best.name, color: best.color, logo_url: best.logo_url, titles: best.titles } : undefined,
    topScorer: scorer && scorer.goals > 0 ? { name: scorer.name, avatar_url: scorer.avatar_url, goals: scorer.goals, clubs: scorer.clubs } : undefined,
    biggestWin: records.biggestWin,
  }
}
