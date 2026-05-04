import { calcGroupStandings } from '../../lib/standings'
import type { Group } from '../../hooks/useGroups'
import type { Match } from '../../hooks/useMatches'
import type { Team } from '../../hooks/useTeams'
import type { Tournament } from '../../hooks/useTournament'
import Empty from '../ui/Empty'
import { TeamLogo } from '../ui/TeamLogo'

interface Props {
  groups: Group[]
  matches: Match[]
  teams: Team[]
  tournament: Tournament | null
}

// Barevné zvýraznění řádku dle pozice a formátu
function rowStyle(i: number, isLeague: boolean, totalRows: number): {
  bg: string; borderLeft: string; badge: string | null; badgeColor: string
} {
  if (isLeague) {
    if (i < 2)  return { bg: 'rgba(22,163,74,.07)',  borderLeft: '4px solid rgba(22,163,74,.55)',  badge: '→ SF', badgeColor: '#15803d' }
    if (i < 6)  return { bg: 'rgba(245,158,11,.07)', borderLeft: '4px solid rgba(245,158,11,.5)', badge: '→ QF', badgeColor: '#b45309' }
    return        { bg: 'transparent',               borderLeft: '4px solid transparent',         badge: null,   badgeColor: '' }
  }
  // Skupinový formát — 1. skupiny postupuje (zelená), 2. může postupovat (modrá)
  if (i === 0) return { bg: 'rgba(22,163,74,.07)',  borderLeft: '4px solid rgba(22,163,74,.55)',  badge: '🥇', badgeColor: '#15803d' }
  if (i === 1 && totalRows > 2) return { bg: 'rgba(37,99,235,.04)', borderLeft: '4px solid rgba(37,99,235,.3)', badge: null, badgeColor: '' }
  return          { bg: 'transparent',              borderLeft: '4px solid transparent',         badge: null, badgeColor: '' }
}

export default function Standings({ groups, matches, teams, tournament }: Props) {
  const gt = (id: string) => teams.find(t => t.id === id)
  const isLeague = tournament?.format === 'league'

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
            {/* Header skupiny */}
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid var(--border)',
              background: 'linear-gradient(135deg, #eff6ff 0%, #fff 100%)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '.08em' }}>
                  {group.name}
                </span>
                <span style={{ fontSize: 'var(--fs-small)', color: 'var(--muted)' }}>
                  {group.team_ids.length} týmů · {playedCount} odehráno
                </span>
                {/* Legenda */}
                {isLeague && (
                  <div style={{ display: 'flex', gap: '.6rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--fs-label)', color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'rgba(22,163,74,.55)' }} />
                      1–2 → Semifinále
                    </span>
                    <span style={{ fontSize: 'var(--fs-label)', color: '#b45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'rgba(245,158,11,.55)' }} />
                      3–6 → Čtvrtfinále
                    </span>
                  </div>
                )}
                {!isLeague && rows.length > 1 && (
                  <div style={{ display: 'flex', gap: '.6rem', marginLeft: 'auto' }}>
                    <span style={{ fontSize: 'var(--fs-label)', color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'rgba(22,163,74,.55)' }} />
                      Vítěz skupiny
                    </span>
                  </div>
                )}
              </div>
              {/* Tiebreaker info */}
              <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginTop: '.3rem' }}>
                Shoda bodů: {group.tiebreaker === 'h2h_first'
                  ? 'vzájemný zápas → gólový rozdíl → vstřelené góly'
                  : group.tiebreaker === 'score_then_h2h'
                  ? 'gólový rozdíl → vstřelené góly → vzájemný zápas'
                  : 'gólový rozdíl → vstřelené góly'}
              </div>
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
                  {/* Sloupec pro badge postupu (liga) */}
                  {isLeague && <th style={{ width: 48 }} />}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const team = gt(row.id)
                  const rankClass = i === 0 ? 'rank rank-1' : i === 1 ? 'rank rank-2' : i === 2 ? 'rank rank-3' : 'rank'
                  const gdColor = row.gd > 0 ? 'var(--success)' : row.gd < 0 ? 'var(--danger)' : 'var(--muted)'
                  const rs = rowStyle(i, isLeague, rows.length)
                  return (
                    <tr key={row.id} style={{
                      borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                      background: rs.bg,
                    }}>
                      <td style={{ padding: 'var(--pad-cell)', paddingLeft: 0, borderLeft: rs.borderLeft }}>
                        <span className={rankClass} style={{ marginLeft: 8 }}>{i + 1}</span>
                      </td>
                      <td style={{ padding: 'var(--pad-cell)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {team && <TeamLogo team={team} size={24} />}
                          <span className="standings-name" style={{ fontWeight: 600 }}>{team?.name ?? row.id}</span>
                          {/* Skupinový formát — badge 🥇 u vítěze */}
                          {rs.badge && !isLeague && (
                            <span style={{ fontSize: '.65rem', marginLeft: 2 }}>{rs.badge}</span>
                          )}
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
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'var(--fs-pts)', color: rs.badgeColor || 'var(--accent)' }}>
                          {row.pts}
                        </span>
                      </td>
                      {/* Badge → SF / → QF v liga modu */}
                      {isLeague && (
                        <td style={{ textAlign: 'center', padding: 'var(--pad-cell)' }}>
                          {rs.badge && (
                            <span style={{
                              fontSize: 'var(--fs-label)', fontWeight: 700,
                              color: rs.badgeColor,
                              background: i < 2 ? 'rgba(22,163,74,.12)' : 'rgba(245,158,11,.12)',
                              border: `1px solid ${i < 2 ? 'rgba(22,163,74,.3)' : 'rgba(245,158,11,.3)'}`,
                              borderRadius: 20, padding: '2px 7px', whiteSpace: 'nowrap',
                            }}>
                              {rs.badge}
                            </span>
                          )}
                        </td>
                      )}
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
