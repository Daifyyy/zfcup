// Konečné pořadí turnaje — čisté funkce (grafika Vítěz a Konečné pořadí).
// Play-off: finále (1., 2.), zápasy o umístění („O 3. místo“, „O 5. místo“…), ostatní podle kola,
// ve kterém vypadli (sdílené místo „5.–8.“). Liga bez play-off: konečná tabulka.
import type { Team } from '../hooks/useTeams'
import type { Group } from '../hooks/useGroups'
import type { Match } from '../hooks/useMatches'
import type { BracketRound, BracketSlot } from '../hooks/useBracket'
import type { SportDef } from './sports'
import { calcGroupStandings } from './standings'
import { isPlacementRound } from './history'

export interface PlaceRow {
  team: Team
  /** Místo od–do (sdílené místo: from < to) */
  from: number
  to: number
}

export interface FinalStandings {
  /** Turnaj je rozhodnutý (vítěz známý) */
  decided: boolean
  champion?: Team
  /** Skóre finále, např. „3:2 PP“ (u ligy chybí) */
  finalScore?: string
  rows: PlaceRow[]
}

const SUFFIX: Record<string, string> = { ot: ' PP', so: ' SN' }

/** „O 3. místo“ → 3; „O 5.–8. místo“ → 5; jinak null. */
export function placementOf(roundName: string): number | null {
  const m = /^o\s*(\d+)/i.exec(roundName.trim())
  return m ? Number(m[1]) : null
}

const winnerLoser = (s: BracketSlot): [string, string] | null => {
  if (!s.played || !s.home_id || !s.away_id || s.home_score === s.away_score) return null
  return s.home_score > s.away_score ? [s.home_id, s.away_id] : [s.away_id, s.home_id]
}

export function computeFinalStandings(d: {
  teams: Team[]; groups: Group[]; matches: Match[]
  bracketRounds: BracketRound[]; bracketSlots: BracketSlot[]
  format?: string; leagueHasPlayoff?: boolean
}, sport: SportDef): FinalStandings {
  const teamById = new Map(d.teams.map(t => [t.id, t]))
  const rounds = [...d.bracketRounds].sort((a, b) => a.position - b.position)

  // ── Liga bez play-off: rozhoduje tabulka po odehrání všech zápasů ──
  if (rounds.length === 0) {
    const group = d.groups.length === 1 ? d.groups[0] : d.groups.find(g => g.name === 'Liga')
    const finished = d.matches.length > 0 && d.matches.every(m => m.played)
    if (!group || !finished) return { decided: false, rows: [] }
    const table = calcGroupStandings(group, d.matches, sport)
    const rows = table.flatMap((r, i) => { const t = teamById.get(r.id); return t ? [{ team: t, from: i + 1, to: i + 1 }] : [] })
    return { decided: rows.length > 0, champion: rows[0]?.team, rows }
  }

  // ── Play-off ──
  const mainRounds = rounds.filter(r => !isPlacementRound(r.name))
  const finalRound = mainRounds[mainRounds.length - 1]
  const finalSlot = finalRound ? d.bracketSlots.find(s => s.round_id === finalRound.id) : undefined
  const fin = finalSlot ? winnerLoser(finalSlot) : null
  if (!finalSlot || !fin) return { decided: false, rows: [] }

  const place = new Map<string, { from: number; to: number }>()
  place.set(fin[0], { from: 1, to: 1 })
  place.set(fin[1], { from: 2, to: 2 })

  // Zápasy o umístění (O 3. místo, O 5. místo…)
  for (const r of rounds) {
    const n = placementOf(r.name)
    if (n == null) continue
    const slots = d.bracketSlots.filter(s => s.round_id === r.id)
    // Jedno kolo „O 5. místo“ s jedním zápasem → 5./6.; víc zápasů v kole „o umístění“ = semifinále umístění (vítěz/poražený se určí v dalším kole)
    if (slots.length !== 1) continue
    const wl = winnerLoser(slots[0])
    if (!wl) continue
    if (!place.has(wl[0])) place.set(wl[0], { from: n, to: n })
    if (!place.has(wl[1])) place.set(wl[1], { from: n + 1, to: n + 1 })
  }

  // Ostatní účastníci play-off: podle kola hlavního pavouka, ve kterém vypadli (pozdější kolo = lepší)
  const taken = () => new Set([...place.values()].flatMap(p => Array.from({ length: p.to - p.from + 1 }, (_, i) => p.from + i)))
  for (let ri = mainRounds.length - 2; ri >= 0; ri--) {
    const losers = d.bracketSlots
      .filter(s => s.round_id === mainRounds[ri].id)
      .map(winnerLoser).filter((x): x is [string, string] => !!x)
      .map(([, loser]) => loser)
      .filter(id => !place.has(id))
    if (!losers.length) continue
    const used = taken()
    let from = 1
    while (used.has(from)) from++
    const to = from + losers.length - 1
    for (const id of losers) place.set(id, { from, to })
  }

  const rows = [...place.entries()]
    .flatMap(([id, p]) => { const t = teamById.get(id); return t ? [{ team: t, ...p }] : [] })
    .sort((a, b) => a.from - b.from || a.team.name.localeCompare(b.team.name, 'cs'))
  return {
    decided: true,
    champion: teamById.get(fin[0]),
    finalScore: `${finalSlot.home_score}:${finalSlot.away_score}${SUFFIX[finalSlot.decided_in ?? ''] ?? ''}`,
    rows,
  }
}

/** „5.“ nebo „5.–8.“ */
export function placeLabel(r: Pick<PlaceRow, 'from' | 'to'>): string {
  return r.from === r.to ? `${r.from}.` : `${r.from}.–${r.to}.`
}
