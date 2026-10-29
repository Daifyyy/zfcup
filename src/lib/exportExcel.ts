import * as XLSX from 'xlsx'
import type { Match } from '../hooks/useMatches'
import type { Group } from '../hooks/useGroups'
import type { Team } from '../hooks/useTeams'
import type { BracketRound, BracketSlot } from '../hooks/useBracket'

function teamName(id: string, teams: Team[]) {
  return teams.find(t => t.id === id)?.name ?? '?'
}


function timeToMin(t: string): number {
  const m = t.match(/(\d{1,2}):(\d{2})/)
  if (!m) return NaN
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

export function exportSchedule(
  matches: Match[],
  groups: Group[],
  teams: Team[],
  numPitches: number = 2,
  tournament?: { match_duration: number; round_break: number },
  pitchLabel: string = 'Hřiště',
  opts: { bracketRounds?: BracketRound[]; bracketSlots?: BracketSlot[]; fileBase?: string } = {},
) {
  const base = slugFile(opts.fileBase ?? 'turnaj')
  // List Play-off (pokud existuje): Kolo | Čas | Domácí | Hosté | Výsledek
  const addPlayoff = (wb: XLSX.WorkBook) => {
    const rounds = [...(opts.bracketRounds ?? [])].sort((a, b) => a.position - b.position)
    const slots = opts.bracketSlots ?? []
    if (!rounds.length || !slots.length) return
    const rows: string[][] = [['Kolo', 'Datum', 'Čas', 'Domácí', 'Hosté', 'Výsledek']]
    for (const r of rounds) {
      for (const sl of slots.filter(x => x.round_id === r.id).sort((a, b) => a.position - b.position)) {
        rows.push([
          r.name,
          sl.match_date ? sl.match_date.split('-').reverse().join('.') : '',
          sl.scheduled_time || '',
          sl.home_id ? teamName(sl.home_id, teams) : 'Určí se',
          sl.away_id ? teamName(sl.away_id, teams) : 'Určí se',
          sl.played ? `${sl.home_score}:${sl.away_score}` : '',
        ])
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 7 }, { wch: 24 }, { wch: 24 }, { wch: 9 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Play-off')
  }
  // Sezónní rozpis (zápasy s datem): po kolech — Kolo / Datum / Čas / Domácí / Hosté / Výsledek
  if (matches.some(m => m.match_date)) {
    const rows: string[][] = [['Kolo', 'Datum', 'Čas', 'Domácí', 'Hosté', 'Výsledek']]
    const bySeason = [...matches].sort((x, y) =>
      (x.match_date ?? '').localeCompare(y.match_date ?? '') || (x.scheduled_time ?? '').localeCompare(y.scheduled_time ?? ''))
    let prevRound = ''
    for (const m of bySeason) {
      if (prevRound && m.round !== prevRound) rows.push(['', '', '', '', '', ''])
      prevRound = m.round
      const d = m.match_date ? m.match_date.split('-').reverse().join('.') : ''
      rows.push([m.round, d, m.scheduled_time || '', teamName(m.home_id, teams), teamName(m.away_id, teams), m.played ? `${m.home_score}:${m.away_score}` : ''])
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 7 }, { wch: 24 }, { wch: 24 }, { wch: 9 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Rozpis')
    addPlayoff(wb)
    XLSX.writeFile(wb, `${base}-rozpis.xlsx`)
    return
  }

  const sorted = [...matches].sort((a, b) =>
    (a.scheduled_time || '').localeCompare(b.scheduled_time || ''),
  )

  const gapThreshold = tournament
    ? (tournament.match_duration + tournament.round_break + 2)
    : Infinity

  // Group matches by time — first in group = field A, second = field B
  const byTime = new Map<string, Match[]>()
  for (const m of sorted) {
    const t = m.scheduled_time || ''
    if (!byTime.has(t)) byTime.set(t, [])
    byTime.get(t)!.push(m)
  }

  const buildFieldRows = (fieldIndex: number): string[][] => {
    const rows: string[][] = []
    const times = Array.from(byTime.keys()).sort((a, b) => a.localeCompare(b))
    let prevTime: number | null = null

    for (const t of times) {
      const group = byTime.get(t)!
      const m = group[fieldIndex]
      const currTime = timeToMin(t)

      if (prevTime !== null && !isNaN(prevTime) && !isNaN(currTime) && (currTime - prevTime) > gapThreshold) {
        rows.push(['— — — přestávka — — —', '', '', ''])
      }

      if (m) {
        rows.push([
          m.scheduled_time || '',
          teamName(m.home_id, teams),
          teamName(m.away_id, teams),
          m.played ? `${m.home_score}:${m.away_score}` : '',
        ])
      }

      prevTime = currTime
    }

    return rows
  }

  const header = ['Čas', 'Domácí', 'Hosté', 'Výsledek']
  const allRows: string[][] = []

  const pitchLabels = 'ABCD'
  for (let i = 0; i < numPitches; i++) {
    allRows.push([`${pitchLabel} ${pitchLabels[i] ?? i + 1}`, '', '', ''])
    allRows.push(header)
    allRows.push(...buildFieldRows(i))
    allRows.push(['', '', '', ''])
  }

  const ws = XLSX.utils.aoa_to_sheet(allRows)
  ws['!cols'] = [{ wch: 8 }, { wch: 22 }, { wch: 22 }, { wch: 10 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Rozpis')
  addPlayoff(wb)
  XLSX.writeFile(wb, `${base}-rozpis.xlsx`)
}

function slugFile(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'turnaj'
}
