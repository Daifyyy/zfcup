import { useEffect } from 'react'
import { calcGroupStandings } from '../../lib/standings'
import type { Tournament } from '../../hooks/useTournament'
import type { Team } from '../../hooks/useTeams'
import type { Group } from '../../hooks/useGroups'
import type { Match } from '../../hooks/useMatches'
import type { BracketRound, BracketSlot } from '../../hooks/useBracket'

interface Props {
  tournament: Tournament
  teams: Team[]
  groups: Group[]
  matches: Match[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  onClose: () => void
}

export default function PrintBulletin({ tournament, teams, groups, matches, bracketRounds, bracketSlots, onClose }: Props) {
  const gt = (id: string | null) => teams.find(t => t.id === id)

  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  const sortedRounds = [...bracketRounds].sort((a, b) => a.position - b.position)

  useEffect(() => {
    const timer = setTimeout(() => window.print(), 400)
    return () => clearTimeout(timer)
  }, [])

  const groupMatches = (groupId: string) =>
    [...matches.filter(m => m.group_id === groupId)].sort((a, b) =>
      (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? '')
    )

  return (
    <div className="print-bulletin" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#fff', overflowY: 'auto', padding: '2rem' }}>
      <style>{`
        @media print {
          body > * { display: none !important; }
          .print-bulletin { position: static !important; display: block !important; }
          .no-print { display: none !important; }
          .print-page-break { page-break-before: always; }
        }
        .bulletin-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
        .bulletin-table th, .bulletin-table td { border: 1px solid #ccc; padding: 3px 6px; }
        .bulletin-table th { background: #f0f0f0; font-weight: 700; }
        .bulletin-section { margin-bottom: 18px; }
        .bulletin-section-title { font-size: 13px; font-weight: 700; border-bottom: 2px solid #333; margin-bottom: 6px; padding-bottom: 2px; }
      `}</style>

      {/* Close button — hidden in print */}
      <div className="no-print" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <button type="button" className="btn btn-p" onClick={() => window.print()}>🖨 Tisknout</button>
        <button type="button" className="btn btn-d" onClick={onClose}>✕ Zavřít</button>
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '18px' }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1 }}>{tournament.name}</div>
        {tournament.subtitle && <div style={{ fontSize: 13 }}>{tournament.subtitle}</div>}
        <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>
          {[tournament.date, tournament.venue].filter(Boolean).join(' · ')}
        </div>
      </div>

      {/* Groups schedule + standings */}
      {sortedGroups.map(g => {
        const gMatches = groupMatches(g.id)
        const standings = calcGroupStandings(g, gMatches)
        return (
          <div key={g.id} className="bulletin-section">
            <div className="bulletin-section-title">Skupina {g.name}</div>

            {/* Schedule */}
            {gMatches.length > 0 && (
              <table className="bulletin-table" style={{ marginBottom: 8 }}>
                <thead>
                  <tr>
                    <th>Čas</th>
                    <th>Domácí</th>
                    <th style={{ width: 60, textAlign: 'center' }}>Výsledek</th>
                    <th>Hosté</th>
                  </tr>
                </thead>
                <tbody>
                  {gMatches.map(m => (
                    <tr key={m.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{m.scheduled_time || '—'}</td>
                      <td>{gt(m.home_id)?.name ?? '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>
                        {m.played ? `${m.home_score}:${m.away_score}` : '–:–'}
                      </td>
                      <td>{gt(m.away_id)?.name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Standings */}
            {standings.length > 0 && (
              <table className="bulletin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Tým</th>
                    <th style={{ width: 28, textAlign: 'center' }}>Z</th>
                    <th style={{ width: 28, textAlign: 'center' }}>V</th>
                    <th style={{ width: 28, textAlign: 'center' }}>R</th>
                    <th style={{ width: 28, textAlign: 'center' }}>P</th>
                    <th style={{ width: 40, textAlign: 'center' }}>Sk</th>
                    <th style={{ width: 36, textAlign: 'center' }}>Body</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, i) => (
                    <tr key={row.id} style={{ background: i === 0 ? '#f0fff4' : 'transparent' }}>
                      <td style={{ textAlign: 'center' }}>{i + 1}</td>
                      <td>{gt(row.id)?.name ?? '?'}</td>
                      <td style={{ textAlign: 'center' }}>{row.played}</td>
                      <td style={{ textAlign: 'center' }}>{row.w}</td>
                      <td style={{ textAlign: 'center' }}>{row.d}</td>
                      <td style={{ textAlign: 'center' }}>{row.l}</td>
                      <td style={{ textAlign: 'center' }}>{row.gf}:{row.ga}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{row.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}

      {/* Playoff bracket */}
      {sortedRounds.length > 0 && (
        <div className="bulletin-section">
          <div className="bulletin-section-title">Play-off</div>
          {sortedRounds.map(round => {
            const rSlots = [...bracketSlots]
              .filter(s => s.round_id === round.id)
              .sort((a, b) => a.position - b.position)
            return (
              <div key={round.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{round.name}</div>
                <table className="bulletin-table">
                  <thead>
                    <tr>
                      <th>Čas</th>
                      <th>Domácí</th>
                      <th style={{ width: 60, textAlign: 'center' }}>Výsledek</th>
                      <th>Hosté</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rSlots.map(s => (
                      <tr key={s.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{s.scheduled_time || '—'}</td>
                        <td>{s.home_id ? (gt(s.home_id)?.name ?? '?') : 'TBD'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>
                          {s.played ? `${s.home_score}:${s.away_score}` : '–:–'}
                        </td>
                        <td>{s.away_id ? (gt(s.away_id)?.name ?? '?') : 'TBD'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ fontSize: 10, color: '#999', textAlign: 'center', marginTop: 20 }}>
        Generováno aplikací ZF Cup
      </div>
    </div>
  )
}
