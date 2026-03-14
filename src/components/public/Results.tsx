import type { Match } from '../../hooks/useMatches'
import type { Team } from '../../hooks/useTeams'
import Empty from '../ui/Empty'

interface Props {
  matches: Match[]
  teams: Team[]
}

export default function Results({ matches, teams }: Props) {
  const tn = (id: string) => teams.find(t => t.id === id)?.name ?? '—'
  const tc = (id: string) => teams.find(t => t.id === id)?.color ?? '#94a3b8'

  if (!matches.length) return <Empty icon="📋" text="Žádné zápasy." />

  const roundsMap: Record<string, Match[]> = {}
  for (const m of matches) {
    const r = m.round || 'Bez skupiny'
    if (!roundsMap[r]) roundsMap[r] = []
    roundsMap[r].push(m)
  }
  // Sort round names alphabetically so order is stable regardless of DB fetch order
  const rounds = Object.entries(roundsMap).sort(([a], [b]) => a.localeCompare(b, 'cs'))

  return (
    <div>
      <div className="sec-head">
        <span className="sec-title">Výsledky</span>
      </div>

      {rounds.map(([round, ms]) => (
        <div key={round}>
          {/* Group header — prominent separator */}
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '1.1rem',
            letterSpacing: '.15em',
            color: 'var(--text)',
            textTransform: 'uppercase',
            fontWeight: 700,
            margin: '1.6rem 0 .75rem',
            padding: '.5rem 1rem',
            borderLeft: '5px solid var(--accent)',
            background: 'rgba(37,99,235,.04)',
            borderRadius: '0 8px 8px 0',
          }}>
            {round}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem', marginBottom: '.5rem' }}>
            {ms.map(m => {
              const hw = m.played && m.home_score > m.away_score
              const aw = m.played && m.away_score > m.home_score
              return (
                <div key={m.id} className="card" style={{
                  padding: 'var(--pad-match)',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  alignItems: 'center',
                  gap: '1rem',
                }}>
                  {/* Home */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.6rem', minWidth: 0 }}>
                    <span style={{
                      fontWeight: hw ? 700 : 500,
                      fontSize: 'var(--fs-body)',
                      color: hw ? 'var(--accent)' : aw ? 'var(--muted)' : 'var(--text)',
                      background: hw ? 'var(--accent-dim)' : 'transparent',
                      padding: hw ? '2px 8px' : '2px 0',
                      borderRadius: hw ? 5 : 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{tn(m.home_id)}</span>
                    <span className="team-dot" style={{ background: tc(m.home_id), width: 12, height: 12, flexShrink: 0 }} />
                  </div>

                  {/* Score */}
                  <div style={{ textAlign: 'center', minWidth: 110 }}>
                    <div style={{
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: 'var(--fs-score)',
                      letterSpacing: '.1em',
                      lineHeight: 1,
                      color: m.played ? 'var(--text)' : 'var(--muted)',
                    }}>
                      {m.played ? `${m.home_score} : ${m.away_score}` : 'VS'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '.4rem', marginTop: '.2rem' }}>
                      {m.scheduled_time && (
                        <span style={{ fontSize: 'var(--fs-small)', color: 'var(--muted)' }}>{m.scheduled_time}</span>
                      )}
                      <span style={{
                        display: 'inline-block',
                        fontSize: '.62rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '.1em',
                        padding: '2px 7px',
                        borderRadius: 20,
                        background: m.played ? 'rgba(22,163,74,.1)' : 'var(--border)',
                        color: m.played ? 'var(--success)' : 'var(--muted)',
                      }}>
                        {m.played ? '✓ Odehráno' : 'Plánováno'}
                      </span>
                    </div>
                  </div>

                  {/* Away */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', minWidth: 0 }}>
                    <span className="team-dot" style={{ background: tc(m.away_id), width: 12, height: 12, flexShrink: 0 }} />
                    <span style={{
                      fontWeight: aw ? 700 : 500,
                      fontSize: 'var(--fs-body)',
                      color: aw ? 'var(--accent)' : hw ? 'var(--muted)' : 'var(--text)',
                      background: aw ? 'var(--accent-dim)' : 'transparent',
                      padding: aw ? '2px 8px' : '2px 0',
                      borderRadius: aw ? 5 : 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{tn(m.away_id)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
