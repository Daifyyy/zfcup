import type { Group } from '../hooks/useGroups'
import type { Match } from '../hooks/useMatches'
import { getSportDef, type SportDef } from './sports'

export interface StandingRow {
  id: string
  played: number
  w: number
  d: number
  l: number
  gf: number
  ga: number
  gd: number
  pts: number
}

// Body za výhru/prohru — v základní hrací době, nebo (pokud sport podporuje OT/SO) v prodloužení/nájezdech.
function resultPts(sportDef: SportDef, decidedIn: Match['decided_in']): { win: number; loss: number } {
  const { winPts, lossPts, otWinPts, otLossPts } = sportDef.standings
  if (decidedIn && decidedIn !== 'regulation' && otWinPts !== undefined) {
    return { win: otWinPts, loss: otLossPts ?? lossPts }
  }
  return { win: winPts, loss: lossPts }
}

export function calcGroupStandings(group: Group, matches: Match[], sportDef: SportDef = getSportDef('football')): StandingRow[] {
  const { lossPts } = sportDef.standings
  const tiePts = sportDef.standings.drawPts ?? lossPts

  const rows: Record<string, StandingRow> = {}
  for (const id of group.team_ids) {
    rows[id] = { id, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }
  }

  const groupMatches = matches.filter(m => m.group_id === group.id && m.played)
  for (const m of groupMatches) {
    const h = rows[m.home_id], a = rows[m.away_id]
    if (!h || !a) continue
    h.gf += m.home_score; h.ga += m.away_score
    a.gf += m.away_score; a.ga += m.home_score
    h.played++; a.played++
    const { win, loss } = resultPts(sportDef, m.decided_in)
    if (m.home_score > m.away_score) { h.w++; h.pts += win; a.l++; a.pts += loss }
    else if (m.home_score < m.away_score) { a.w++; a.pts += win; h.l++; h.pts += loss }
    else { h.d++; h.pts += tiePts; a.d++; a.pts += tiePts }
  }

  const arr = Object.values(rows).map(r => ({ ...r, gd: r.gf - r.ga }))

  const calcH2H = (a: StandingRow, b: StandingRow): number => {
    const h2h = groupMatches.filter(m =>
      (m.home_id === a.id && m.away_id === b.id) ||
      (m.home_id === b.id && m.away_id === a.id)
    )
    let aPts = 0, bPts = 0
    for (const m of h2h) {
      const { win } = resultPts(sportDef, m.decided_in)
      if (m.home_id === a.id) {
        if (m.home_score > m.away_score) aPts += win
        else if (m.home_score === m.away_score) { aPts += tiePts; bPts += tiePts }
        else bPts += win
      } else {
        if (m.away_score > m.home_score) aPts += win
        else if (m.away_score === m.home_score) { aPts += tiePts; bPts += tiePts }
        else bPts += win
      }
    }
    return bPts - aPts
  }

  if (group.tiebreaker === 'h2h_first') {
    arr.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts
      const h2h = calcH2H(a, b)
      if (h2h !== 0) return h2h
      return b.gd - a.gd || b.gf - a.gf
    })
  } else if (group.tiebreaker === 'score_then_h2h') {
    arr.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts
      if (b.gd !== a.gd) return b.gd - a.gd
      if (b.gf !== a.gf) return b.gf - a.gf
      return calcH2H(a, b)
    })
  } else {
    arr.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
  }

  return arr
}
