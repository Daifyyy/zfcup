// Ukázkový turnaj pro demo na úvodní stránce — čistě v paměti, žádné dotazy do DB.
// Časová osa: skupiny a semifinále odehrané, o 3. místo odehrané, finále se právě hraje.
import type { TournamentData } from '../lib/TournamentDataContext'
import type { Tournament } from '../hooks/useTournament'
import type { Team } from '../hooks/useTeams'
import type { Player } from '../hooks/usePlayers'
import type { Group } from '../hooks/useGroups'
import type { Match } from '../hooks/useMatches'
import type { Goal } from '../hooks/useGoals'
import type { Assist } from '../hooks/useAssists'
import type { Card } from '../hooks/useCards'
import type { BracketRound, BracketSlot } from '../hooks/useBracket'
import type { BracketGoal } from '../hooks/useBracketGoals'
import type { Sponsor } from '../hooks/useSponsors'
import { todayISO } from '../lib/dates'

const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

const TEAMS: [string, string][] = [
  ['FC Severka', '#1d4ed8'], ['SK Lokomotiva', '#dc2626'], ['Dynamo Jih', '#16a34a'], ['Sokol Východ', '#ea580c'],
  ['AC Úsvit', '#7c3aed'], ['Slavoj Hora', '#0891b2'], ['Tatran Brod', '#ca8a04'], ['Union Most', '#db2777'],
]
const FIRST = ['Jakub', 'Tomáš', 'Ondřej', 'Lukáš', 'Matěj']
const LAST = ['Dvořák', 'Kříž', 'Beneš', 'Holub', 'Zeman', 'Pokorný', 'Růžička', 'Šimek']

/** Skóre zápasů skupin (domácí, hosté) v pořadí párů 0-1, 2-3, 0-2, 1-3, 0-3, 1-2 */
const GROUP_SCORES: [number, number][][] = [
  [[3, 1], [2, 2], [1, 0], [0, 2], [4, 2], [1, 1]],
  [[0, 1], [2, 0], [3, 3], [1, 2], [2, 1], [0, 0]],
]
const PAIRS = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]]

/** Jednoduché „logo“ partnera jako SVG (data URL) — demo nepotřebuje soubory ani síť. */
function wordmark(name: string, color: string): string {
  const words = name.split(' ')
  const line1 = words.slice(0, Math.ceil(words.length / 2)).join(' ')
  const line2 = words.slice(Math.ceil(words.length / 2)).join(' ')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="96" viewBox="0 0 240 96"><rect width="240" height="96" rx="10" fill="#fff"/><circle cx="40" cy="48" r="22" fill="${color}"/><text x="40" y="56" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700" fill="#fff" text-anchor="middle">${name[0]}</text><text x="74" y="${line2 ? 44 : 55}" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="800" fill="#0b1220">${line1}</text>${line2 ? `<text x="74" y="66" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="600" fill="#5b6678">${line2}</text>` : ''}</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

export interface DemoData extends TournamentData {
  sponsors: Sponsor[]
}

export function buildDemoData(now = new Date()): DemoData {
  const id = 'demo'
  const tournament = {
    id, name: 'Firemní pohár 2026', subtitle: 'Ukázkový turnaj', date: 'Sobota 13. června', venue: 'Sportovní areál Na Výsluní',
    description: '', tips_enabled: false, format: 'groups', format_id: 'groups_sf', match_duration: 15, halves: 1,
    playoff_kickoff: '', round_break: 5, tips_lock_from: todayISO(now), num_teams: 8, num_groups: 2, advancing_per_group: 2,
    num_pitches: 2, rules_content: '', league_has_playoff: true, logo_url: null, assists_enabled: true, cards_enabled: true,
    sponsors_enabled: true, sport: 'football', penalty_minutes_enabled: false, schedule_mode: 'day', slug: 'demo',
  } as Tournament

  const teams: Team[] = TEAMS.map(([name, color], i) => ({ id: `t${i}`, name, color, logo_url: null }))
  const players: Player[] = teams.flatMap((t, ti) => FIRST.slice(0, 4).map((f, pi) => ({
    id: `p${ti}-${pi}`, team_id: t.id, name: `${f} ${LAST[(ti + pi * 3) % LAST.length]}`, number: [1, 7, 9, 10][pi],
    role: pi === 0 ? 'goalkeeper' : pi === 1 ? 'captain' : null, avatar_url: null,
  })))

  // Skupiny se hrály před 3 hodinami, každý zápas 20 min, 2 hřiště
  const start = new Date(now.getTime() - 3 * 3600_000)
  const groups: Group[] = [0, 1].map(g => ({
    id: `g${g}`, name: `Skupina ${'AB'[g]}`, team_ids: teams.slice(g * 4, g * 4 + 4).map(t => t.id), schedule: 'once',
    tiebreaker: 'score_then_h2h', start_time: hhmm(start), match_duration: 15, break_between: 5,
  } as Group))

  const matches: Match[] = []
  const goals: Goal[] = []
  const assists: Assist[] = []
  const cards: Card[] = []
  groups.forEach((g, gi) => PAIRS.forEach(([a, b], k) => {
    const [hs, as] = GROUP_SCORES[gi][k]
    const m: Match = {
      id: `m${gi}-${k}`, group_id: g.id, round: g.name, home_id: g.team_ids[a], away_id: g.team_ids[b],
      home_score: hs, away_score: as, played: true, scheduled_time: hhmm(new Date(start.getTime() + k * 20 * 60_000)),
      referee_id: null, decided_in: null,
    }
    matches.push(m)
    for (const [teamId, n] of [[m.home_id, hs], [m.away_id, as]] as [string, number][]) {
      const ti = Number(teamId.slice(1))
      for (let i = 0; i < n; i++) {
        const scorer = `p${ti}-${2 + ((i + k) % 2)}`
        const existing = goals.find(x => x.player_id === scorer && x.match_id === m.id)
        if (existing) existing.count++
        else goals.push({ id: `go-${m.id}-${scorer}`, player_id: scorer, match_id: m.id, count: 1 })
        if (i === 0) assists.push({ id: `as-${m.id}-${ti}`, player_id: `p${ti}-1`, match_id: m.id, count: 1 })
      }
    }
    if (k === 1 || k === 4) cards.push({ id: `c-${m.id}`, player_id: `p${Number(m.away_id.slice(1))}-1`, match_id: m.id, type: 'yellow' })
  }))

  // Play-off: semifinále (A1–B2, B1–A2), o 3. místo, finále (živě)
  const bracketRounds: BracketRound[] = [
    { id: 'r-sf', name: 'Semifinále', position: 1, scheduled_start: null, break_after: null },
    { id: 'r-o3', name: 'O 3. místo', position: 2, scheduled_start: null, break_after: null },
    { id: 'r-f', name: 'Finále', position: 3, scheduled_start: null, break_after: null },
  ]
  const at = (min: number) => hhmm(new Date(now.getTime() + min * 60_000))
  const bracketSlots: BracketSlot[] = [
    { id: 's-sf1', round_id: 'r-sf', position: 0, home_id: 't0', away_id: 't5', home_score: 2, away_score: 1, played: true, scheduled_time: at(-65) },
    { id: 's-sf2', round_id: 'r-sf', position: 1, home_id: 't4', away_id: 't2', home_score: 1, away_score: 3, played: true, scheduled_time: at(-65) },
    { id: 's-o3', round_id: 'r-o3', position: 0, home_id: 't5', away_id: 't4', home_score: 3, away_score: 2, played: true, scheduled_time: at(-35) },
    { id: 's-f', round_id: 'r-f', position: 0, home_id: 't0', away_id: 't2', home_score: 1, away_score: 1, played: false, scheduled_time: at(-6) },
  ]
  const bracketGoals: BracketGoal[] = [
    { id: 'bg1', player_id: 'p0-2', slot_id: 's-sf1', count: 2 }, { id: 'bg2', player_id: 'p5-3', slot_id: 's-sf1', count: 1 },
    { id: 'bg3', player_id: 'p4-2', slot_id: 's-sf2', count: 1 }, { id: 'bg4', player_id: 'p2-2', slot_id: 's-sf2', count: 2 },
    { id: 'bg5', player_id: 'p2-3', slot_id: 's-sf2', count: 1 }, { id: 'bg6', player_id: 'p5-2', slot_id: 's-o3', count: 3 },
    { id: 'bg7', player_id: 'p4-3', slot_id: 's-o3', count: 2 }, { id: 'bg8', player_id: 'p0-3', slot_id: 's-f', count: 1 },
    { id: 'bg9', player_id: 'p2-2', slot_id: 's-f', count: 1 },
  ]

  const sponsors: Sponsor[] = ([
    ['Pivovar Zlatý Klas', 'title', '#b45309'], ['Stavby Novák', 'main', '#1d4ed8'], ['Pekárna U Mlýna', 'partner', '#a16207'],
    ['Minerálka Pramen', 'supplier', '#0891b2'], ['Rádio Region', 'media', '#dc2626'], ['Autodoprava Kos', 'partner', '#16a34a'],
  ] as const).map(([name, tier, color], i) => ({ id: `sp${i}`, tournament_id: id, name, logo_url: wordmark(name, color), website_url: '', position: i, tier }))

  return {
    tournament, teams, players, groups, matches, goals, assists, cards, penalties: [],
    bracketRounds, bracketSlots, bracketGoals, bracketAssists: [], bracketCards: [], bracketPenalties: [],
    referees: [{ id: 'ref1', name: 'Petr Rozhodný' }], bracketLoading: false, sponsors,
  }
}
