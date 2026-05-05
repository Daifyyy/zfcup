import * as XLSX from 'xlsx'
import type { Match } from '../hooks/useMatches'
import type { Group } from '../hooks/useGroups'
import type { Team } from '../hooks/useTeams'
import type { Player } from '../hooks/usePlayers'

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
  tournament?: { match_duration: number; round_break: number },
) {
  const header = ['Čas', 'Domácí', 'Hosté', 'Výsledek']
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

  const buildFieldRows = (fieldIndex: 0 | 1): string[][] => {
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

  const colWidths = [{ wch: 8 }, { wch: 22 }, { wch: 22 }, { wch: 10 }]

  const wb = XLSX.utils.book_new()

  for (const [label, fieldIndex] of [['Hřiště A', 0], ['Hřiště B', 1]] as [string, 0 | 1][]) {
    const ws = XLSX.utils.aoa_to_sheet([header, ...buildFieldRows(fieldIndex)])
    ws['!cols'] = colWidths
    XLSX.utils.book_append_sheet(wb, ws, label)
  }

  XLSX.writeFile(wb, 'zf-cup-rozpis.xlsx')
}

// A6 landscape: 148 × 105 mm
// Usable width with 5mm margins: ~138mm ≈ 52 char units
// Usable height with 6mm margins: ~93mm ≈ 24 rows at 11pt
//
// Column layout (7 cols, total 51 wch):
//   [14] home_name | [7] home_role | [4] home_goals | [1] sep
//   [14] away_name | [7] away_role | [4] away_goals
//
// Row structure per card:
//   row 0: "Čas: HH:MM"             (14pt)
//   row 1: "Tým domácí" · "Tým hosté"  (14pt)
//   row 2: col headers               (10pt)
//   rows 3..N: players side by side  (11pt each)
//   → manual page break after row N

export function exportRefCards(matches: Match[], groups: Group[], teams: Team[], players: Player[]) {
  type Row = (string | number)[]
  const allRows: Row[] = []
  const rowHeights: XLSX.RowInfo[] = []
  // Page break row indices (0-based, break inserted AFTER this row)
  const pageBreakRows: number[] = []
  let ri = 0  // current row index

  const sorted = [...matches].sort((a, b) =>
    (a.scheduled_time || '').localeCompare(b.scheduled_time || '')
  )

  for (let mi = 0; mi < sorted.length; mi++) {
    const m = sorted[mi]
    const hn = teamName(m.home_id, teams)
    const an = teamName(m.away_id, teams)
    const time = m.scheduled_time || '—'

    const homePl = players
      .filter(p => p.team_id === m.home_id)
      .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
    const awayPl = players
      .filter(p => p.team_id === m.away_id)
      .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
    const maxLen = Math.max(homePl.length, awayPl.length, 1)

    // Čas
    allRows.push([`Čas: ${time}`, '', '', '', ''])
    rowHeights.push({ hpt: 14 })
    ri++

    // Team names
    allRows.push([hn, '', '', an, ''])
    rowHeights.push({ hpt: 14 })
    ri++

    // Column headers
    allRows.push(['Hráč', 'Góly', '', 'Hráč', 'Góly'])
    rowHeights.push({ hpt: 10 })
    ri++

    // Player rows
    for (let i = 0; i < maxLen; i++) {
      const hp = homePl[i]
      const ap = awayPl[i]
      allRows.push([
        hp?.name ?? '', '',
        '',
        ap?.name ?? '', '',
      ])
      rowHeights.push({ hpt: 11 })
      ri++
    }

    // Page break after each card except the last
    if (mi < sorted.length - 1) {
      pageBreakRows.push(ri - 1)
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(allRows)

  // Column widths: 24 + 6 + 1 + 24 + 6 = 61 wch → fits A6 landscape
  ws['!cols'] = [
    { wch: 24 }, { wch: 6 }, { wch: 1 },
    { wch: 24 }, { wch: 6 },
  ]

  ws['!rows'] = rowHeights

  // A6 = paperSize 70, landscape orientation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(ws as any)['!pageSetup'] = {
    paperSize: 70,
    orientation: 'landscape',
    scale: 90,
    horizontalDpi: 200,
    verticalDpi: 200,
  }

  // Narrow margins (inches): left/right 0.2", top/bottom 0.24", header/footer 0.1"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(ws as any)['!margins'] = {
    left: 0.2, right: 0.2,
    top: 0.24, bottom: 0.24,
    header: 0.1, footer: 0.1,
  }

  // Manual row page breaks — format: array of { man: 1, id: rowIndex }
  if (pageBreakRows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(ws as any)['!rowBreaks'] = pageBreakRows.map(id => ({ man: 1, id }))
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Karty rozhodčích')
  XLSX.writeFile(wb, 'zf-cup-karty.xlsx')
}
