import type { Group } from '../hooks/useGroups'
import type { Match } from '../hooks/useMatches'

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

export function calcGroupStandings(group: Group, matches: Match[]): StandingRow[] {
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
    if (m.home_score > m.away_score) { h.w++; h.pts += 3; a.l++ }
    else if (m.home_score < m.away_score) { a.w++; a.pts += 3; h.l++ }
    else { h.d++; h.pts++; a.d++; a.pts++ }
  }

  const arr = Object.values(rows).map(r => ({ ...r, gd: r.gf - r.ga }))

  if (group.tiebreaker === 'h2h_first') {
    arr.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts
      // Head-to-head
      const h2h = groupMatches.filter(m =>
        (m.home_id === a.id && m.away_id === b.id) ||
        (m.home_id === b.id && m.away_id === a.id)
      )
      let aPts = 0, bPts = 0
      for (const m of h2h) {
        if (m.home_id === a.id) {
          if (m.home_score > m.away_score) aPts += 3
          else if (m.home_score === m.away_score) { aPts++; bPts++ }
          else bPts += 3
        } else {
          if (m.away_score > m.home_score) aPts += 3
          else if (m.away_score === m.home_score) { aPts++; bPts++ }
          else bPts += 3
        }
      }
      if (bPts !== aPts) return bPts - aPts
      return b.gd - a.gd || b.gf - a.gf
    })
  } else {
    arr.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
  }

  return arr
}
