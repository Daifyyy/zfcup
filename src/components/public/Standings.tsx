import { calcGroupStandings } from '../../lib/standings'
import type { Group } from '../../hooks/useGroups'
import type { Match } from '../../hooks/useMatches'
import type { Team } from '../../hooks/useTeams'
import type { Tournament } from '../../hooks/useTournament'
import Empty from '../ui/Empty'
import { TeamLogo } from '../ui/TeamLogo'
import { getAdvancingCutoffs } from '../../lib/formats'

interface Props {
  groups: Group[]
  matches: Match[]
  teams: Team[]
  tournament: Tournament | null
}

// Barevné zvýraznění řádku dle pozice a formátu
function rowStyle(i: number, advancing: number, consolation: number, sfCutoff?: number, qfCutoff?: number): {
  bg: string; borderLeft: string; badge: string | null; badgeColor: string
} {
  // League mode (sfCutoff/qfCutoff defined)
  if (sfCutoff !== undefined) {
    if (i < sfCutoff) return { bg: 'rgba(22,163,74,.07)', borderLeft: '4px solid rgba(22,163,74,.55)', badge: '→ SF', badgeColor: '#15803d' }
    if (qfCutoff !== undefined && i < qfCutoff) return { bg: 'rgba(245,158,11,.07)', borderLeft: '4px solid rgba(245,158,11,.5)', badge: '→ QF', badgeColor: '#b45309' }
    return { bg: 'transparent', borderLeft: '4px solid transparent', badge: null, badgeColor: '' }
  }
  // Groups mode
  if (advancing > 0 && i < advancing) return { bg: 'rgba(22,163,74,.07)', borderLeft: '4px solid rgba(22,163,74,.55)', badge: i === 0 ? '🥇' : '→ Playoff', badgeColor: '#15803d' }
  if (consolation > 0 && i < advancing + consolation) return { bg: 'rgba(245,158,11,.07)', borderLeft: '4px solid rgba(245,158,11,.4)', badge: '→ Útěcha', badgeColor: '#b45309' }
  return { bg: 'transparent', borderLeft: '4px solid transparent', badge: null, badgeColor: '' }
}

export default function Standings({ groups, matches, teams, tournament }: Props) {
  const gt = (id: string) => teams.find(t => t.id === id)
  const isLeague = tournament?.format === 'league'

  const cutoffs = tournament
    ? getAdvancingCutoffs(tournament.format_id ?? '', tournament)
    : { advancing: 1 }
  const sfCutoff = cutoffs.sfCutoff
  const qfCutoff = cutoffs.qfCutoff
  const advancing = cutoffs.advancing ?? 1
  const consolation = cutoffs.consolation ?? 0

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
                {(sfCutoff !== undefined || advancing > 0 || consolation > 0) && rows.length > 1 && (
                  <div style={{ display: 'flex', gap: '.6rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
                    {sfCutoff !== undefined && (
                      <span style={{ fontSize: 'var(--fs-label)', color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'rgba(22,163,74,.55)' }} />
                        1–{sfCutoff} → Semifinále
                      </span>
                    )}
                    {qfCutoff !== undefined && (
                      <span style={{ fontSize: 'var(--fs-label)', color: '#b45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'rgba(245,158,11,.55)' }} />
                        {sfCutoff !== undefined ? `${sfCutoff + 1}–${qfCutoff}` : `1–${qfCutoff}`} → Čtvrtfinále
                      </span>
                    )}
                    {sfCutoff === undefined && advancing > 0 && (
                      <span style={{ fontSize: 'var(--fs-label)', color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'rgba(22,163,74,.55)' }} />
                        Vítěz skupiny → Playoff
                      </span>
                    )}
                    {consolation > 0 && (
                      <span style={{ fontSize: 'var(--fs-label)', color: '#b45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'rgba(245,158,11,.55)' }} />
                        → Útěcha
                      </span>
                    )}
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
                  {/* Sloupec pro badge postupu */}
                  {(sfCutoff !== undefined || advancing > 0) && <th style={{ width: 48 }} />}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const team = gt(row.id)
                  const rankClass = i === 0 ? 'rank rank-1' : i === 1 ? 'rank rank-2' : i === 2 ? 'rank rank-3' : 'rank'
                  const gdColor = row.gd > 0 ? 'var(--success)' : row.gd < 0 ? 'var(--danger)' : 'var(--muted)'
                  const rs = rowStyle(i, advancing, consolation, sfCutoff, qfCutoff)
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
                          {team && <TeamLogo team={team} size={30} />}
                          <span className="standings-name" style={{ fontWeight: 600 }}>{team?.name ?? row.id}</span>
                          {/* Badge 🥇 u vítěze skupiny (skupinový formát) */}
                          {rs.badge && sfCutoff === undefined && i === 0 && (
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
                      {/* Badge → SF / → QF / → Playoff / → Útěcha */}
                      {(sfCutoff !== undefined || advancing > 0) && (
                        <td style={{ textAlign: 'center', padding: 'var(--pad-cell)' }}>
                          {rs.badge && sfCutoff !== undefined && (
                            <span style={{
                              fontSize: 'var(--fs-label)', fontWeight: 700,
                              color: rs.badgeColor,
                              background: sfCutoff !== undefined && i < sfCutoff ? 'rgba(22,163,74,.12)' : 'rgba(245,158,11,.12)',
                              border: `1px solid ${sfCutoff !== undefined && i < sfCutoff ? 'rgba(22,163,74,.3)' : 'rgba(245,158,11,.3)'}`,
                              borderRadius: 20, padding: '2px 7px', whiteSpace: 'nowrap',
                            }}>
                              {rs.badge}
                            </span>
                          )}
                          {rs.badge && sfCutoff === undefined && rs.badge !== '🥇' && (
                            <span style={{
                              fontSize: 'var(--fs-label)', fontWeight: 700,
                              color: rs.badgeColor,
                              background: consolation > 0 && i >= advancing ? 'rgba(245,158,11,.12)' : 'rgba(22,163,74,.12)',
                              border: `1px solid ${consolation > 0 && i >= advancing ? 'rgba(245,158,11,.3)' : 'rgba(22,163,74,.3)'}`,
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
