// Výsledkový servis pro média — jeden XLSX se záložkami Výsledky / Tabulky / Play-off / Střelci.
// xlsx se načítá dynamicky, aby nebyl ve veřejném balíku.
import type { Match } from '../hooks/useMatches'
import type { Group } from '../hooks/useGroups'
import type { Team } from '../hooks/useTeams'
import type { Player } from '../hooks/usePlayers'
import type { Goal } from '../hooks/useGoals'
import type { BracketGoal } from '../hooks/useBracketGoals'
import type { BracketRound, BracketSlot } from '../hooks/useBracket'
import type { SportDef } from './sports'
import { calcGroupStandings } from './standings'

interface Input {
  tournamentName: string
  sportDef: SportDef
  matches: Match[]
  groups: Group[]
  teams: Team[]
  players: Player[]
  goals: Goal[]
  bracketGoals: BracketGoal[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
}

const DECIDED: Record<string, string> = { ot: 'po prodloužení', so: 'po nájezdech' }

function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'turnaj'
}

export async function exportPressResults(d: Input): Promise<void> {
  const XLSX = await import('xlsx')
  const tn = (id: string | null) => (id ? d.teams.find(t => t.id === id)?.name : undefined) ?? '—'
  const groupName = new Map(d.groups.map(g => [g.id, g.name]))
  const wb = XLSX.utils.book_new()

  // Výsledky
  const hasDates = d.matches.some(m => m.match_date)
  const results: (string | number)[][] = [[...(hasDates ? ['Datum'] : []), 'Čas', 'Skupina / kolo', 'Domácí', 'Skóre', 'Hosté', 'Poznámka']]
  for (const m of [...d.matches].sort((a, b) => (a.match_date ?? '').localeCompare(b.match_date ?? '') || (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))) {
    results.push([
      ...(hasDates ? [m.match_date ? m.match_date.split('-').reverse().join('.') : ''] : []),
      m.scheduled_time || '',
      (hasDates && m.round) || (m.group_id && groupName.get(m.group_id)) || m.round || '',
      tn(m.home_id),
      m.played ? `${m.home_score}:${m.away_score}` : '—',
      tn(m.away_id),
      m.played && m.decided_in ? DECIDED[m.decided_in] ?? '' : (m.played ? '' : 'neodehráno'),
    ])
  }
  const wsR = XLSX.utils.aoa_to_sheet(results)
  wsR['!cols'] = [...(hasDates ? [{ wch: 11 }] : []), { wch: 7 }, { wch: 16 }, { wch: 24 }, { wch: 8 }, { wch: 24 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, wsR, 'Výsledky')

  // Tabulky
  const draws = d.sportDef.standings.allowDraws
  const tables: (string | number)[][] = []
  for (const g of d.groups) {
    tables.push([g.name])
    tables.push(draws ? ['#', 'Tým', 'Z', 'V', 'R', 'P', 'Skóre', '+/−', 'Body'] : ['#', 'Tým', 'Z', 'V', 'P', 'Skóre', '+/−', 'Body'])
    calcGroupStandings(g, d.matches, d.sportDef).forEach((r, i) => {
      tables.push(draws
        ? [i + 1, tn(r.id), r.played, r.w, r.d, r.l, `${r.gf}:${r.ga}`, r.gd, r.pts]
        : [i + 1, tn(r.id), r.played, r.w, r.l, `${r.gf}:${r.ga}`, r.gd, r.pts])
    })
    tables.push([])
  }
  if (tables.length) {
    const wsT = XLSX.utils.aoa_to_sheet(tables)
    wsT['!cols'] = [{ wch: 5 }, { wch: 26 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 8 }, { wch: 6 }, { wch: 6 }]
    XLSX.utils.book_append_sheet(wb, wsT, 'Tabulky')
  }

  // Play-off
  if (d.bracketRounds.length) {
    const po: (string | number)[][] = [['Kolo', 'Čas', 'Domácí', 'Skóre', 'Hosté', 'Poznámka']]
    for (const r of [...d.bracketRounds].sort((a, b) => a.position - b.position)) {
      for (const s of d.bracketSlots.filter(x => x.round_id === r.id).sort((a, b) => a.position - b.position)) {
        po.push([
          r.name, s.scheduled_time ?? '', tn(s.home_id),
          s.played ? `${s.home_score}:${s.away_score}` : '—', tn(s.away_id),
          s.played && s.decided_in ? DECIDED[s.decided_in] ?? '' : '',
        ])
      }
    }
    const wsP = XLSX.utils.aoa_to_sheet(po)
    wsP['!cols'] = [{ wch: 16 }, { wch: 7 }, { wch: 24 }, { wch: 8 }, { wch: 24 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, wsP, 'Play-off')
  }

  // Střelci
  const agg: Record<string, number> = {}
  for (const g of [...d.goals, ...d.bracketGoals]) agg[g.player_id] = (agg[g.player_id] ?? 0) + g.count
  const scorers = d.players
    .filter(p => (agg[p.id] ?? 0) > 0)
    .sort((a, b) => agg[b.id] - agg[a.id] || a.name.localeCompare(b.name, 'cs'))
  const sc: (string | number)[][] = [['#', 'Hráč', 'Tým', 'Góly']]
  scorers.forEach((p, i) => sc.push([i + 1, p.name, tn(p.team_id), agg[p.id]]))
  const wsS = XLSX.utils.aoa_to_sheet(sc)
  wsS['!cols'] = [{ wch: 5 }, { wch: 26 }, { wch: 24 }, { wch: 6 }]
  XLSX.utils.book_append_sheet(wb, wsS, d.sportDef.terms.scorersLabel.slice(0, 31))

  XLSX.writeFile(wb, `${slug(d.tournamentName)}-vysledkovy-servis.xlsx`)
}
