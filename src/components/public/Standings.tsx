import { calcGroupStandings } from '../../lib/standings'
import type { Group } from '../../hooks/useGroups'
import type { Match } from '../../hooks/useMatches'
import type { Team } from '../../hooks/useTeams'
import Empty from '../ui/Empty'
import { TeamLogo } from '../ui/TeamLogo'

interface Props {
  groups: Group[]
  matches: Match[]
  teams: Team[]
}

export default function Standings({ groups, matches, teams }: Props) {
  const gt = (id: string) => teams.find(t => t.id === id)

  if (!groups.length) return <Empty icon="📊" text="Nejsou definovány žádné skupiny. Přidej je v admin panelu → Skupiny." />

  return (
    <div>
      <div className="sec-head">
        <span className="sec-title">Tabulka</span>
      </div>

      {groups.map(group => {
        const rows = calcGroupStandings(group, matches)
        const playedCount = matches.filter(m => m.group_id === group.id && m.played).length

        return (
          <div key={group.id} className="card" style={{ overflow: 'hidden', marginBottom: '1.4rem' }}>
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: '1rem',
              background: 'linear-gradient(135deg, #eff6ff 0%, #fff 100%)',
            }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '.08em' }}>
                {group.name}
              </span>
              <span style={{ fontSize: 'var(--fs-small)', color: 'var(--muted)' }}>
                {group.team_ids.length} týmů · {playedCount} odehráno
              </span>
            </div>
            <table className="standings-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-body)' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {(['#', 'Tým', 'Z', 'V', 'R', 'P', 'Skóre', '+/−', 'Body'] as const).map((h, i) => (
                    <th key={h} style={{
                      padding: 'var(--pad-cell)',
                      color: 'var(--muted)', fontSize: 'var(--fs-label)',
                      textTransform: 'uppercase', letterSpacing: '.12em',
                      textAlign: i <= 1 ? 'left' : 'center',
                      fontWeight: 600, whiteSpace: 'nowrap',
                      width: i === 0 ? 40 : undefined,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const team = gt(row.id)
                  const rankClass = i === 0 ? 'rank rank-1' : i === 1 ? 'rank rank-2' : i === 2 ? 'rank rank-3' : 'rank'
                  const gdColor = row.gd > 0 ? 'var(--success)' : row.gd < 0 ? 'var(--danger)' : 'var(--muted)'
                  const isTop = i === 0
                  return (
                    <tr key={row.id} style={{
                      borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                      background: isTop ? 'rgba(37,99,235,.03)' : 'transparent',
                    }}>
                      <td style={{ textAlign: 'center', padding: 'var(--pad-cell)' }}>
                        <span className={rankClass}>{i + 1}</span>
                      </td>
                      <td style={{ padding: 'var(--pad-cell)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {team && <TeamLogo team={team} size={20} />}
                          <span className="standings-name" style={{ fontWeight: 600 }}>{team?.name ?? row.id}</span>
                        </div>
                      </td>
                      {[row.played, row.w, row.d, row.l].map((v, j) => (
                        <td key={j} style={{ textAlign: 'center', padding: 'var(--pad-cell)', color: 'var(--muted)' }}>{v}</td>
                      ))}
                      <td style={{ textAlign: 'center', padding: 'var(--pad-cell)', color: 'var(--muted)' }}>{row.gf}:{row.ga}</td>
                      <td style={{ textAlign: 'center', padding: 'var(--pad-cell)', color: gdColor, fontWeight: 600 }}>
                        {row.gd > 0 ? '+' : ''}{row.gd}
                      </td>
                      <td style={{ textAlign: 'center', padding: 'var(--pad-cell)' }}>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'var(--fs-pts)', color: 'var(--accent)' }}>
                          {row.pts}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
