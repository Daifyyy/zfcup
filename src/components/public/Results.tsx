import type { Match } from '../../hooks/useMatches'
import type { Team } from '../../hooks/useTeams'
import Empty from '../ui/Empty'
import { TeamLogo } from '../ui/TeamLogo'

interface Props {
  matches: Match[]
  teams: Team[]
}

export default function Results({ matches, teams }: Props) {
  const tn = (id: string) => teams.find(t => t.id === id)?.name ?? '—'
  const tt = (id: string) => teams.find(t => t.id === id) ?? { color: '#94a3b8', logo_url: null }

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
                <div key={m.id} className="card match-grid">
                  {/* Čas — vlevo */}
                  <div className="match-col-time">
                    {m.scheduled_time || ''}
                  </div>

                  {/* Home — dot before name in DOM; CSS row-reverse shows [name][dot] on desktop */}
                  <div className="match-col-home">
                    <TeamLogo team={tt(m.home_id)} size={32} />
                    <span className="match-team-name" style={{
                      fontWeight: hw ? 700 : 500,
                      fontSize: 'var(--fs-body)',
                      color: hw ? 'var(--accent)' : aw ? 'var(--muted)' : 'var(--text)',
                      background: hw ? 'var(--accent-dim)' : 'transparent',
                      padding: hw ? '2px 8px' : '2px 0',
                      borderRadius: hw ? 5 : 0,
                    }}>{tn(m.home_id)}</span>
                    {/* Per-team score — shown only on mobile */}
                    <span className="match-score-side" style={{ color: hw ? 'var(--accent)' : 'var(--muted)' }}>
                      {m.played ? m.home_score : ''}
                    </span>
                  </div>

                  {/* Score — shown only on desktop */}
                  <div className="match-col-score">
                    <div style={{
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: 'var(--fs-score)',
                      letterSpacing: '.1em',
                      lineHeight: 1,
                      color: m.played ? 'var(--text)' : 'var(--muted)',
                    }}>
                      {m.played ? `${m.home_score} : ${m.away_score}` : 'VS'}
                    </div>
                  </div>

                  {/* Away */}
                  <div className="match-col-away">
                    <TeamLogo team={tt(m.away_id)} size={32} />
                    <span className="match-team-name" style={{
                      fontWeight: aw ? 700 : 500,
                      fontSize: 'var(--fs-body)',
                      color: aw ? 'var(--accent)' : hw ? 'var(--muted)' : 'var(--text)',
                      background: aw ? 'var(--accent-dim)' : 'transparent',
                      padding: aw ? '2px 8px' : '2px 0',
                      borderRadius: aw ? 5 : 0,
                    }}>{tn(m.away_id)}</span>
                    {/* Per-team score — shown only on mobile */}
                    <span className="match-score-side" style={{ color: aw ? 'var(--accent)' : 'var(--muted)' }}>
                      {m.played ? m.away_score : ''}
                    </span>
                  </div>

                  {/* Badge stav */}
                  <div className="match-col-badge">
                    <span style={{
                      fontSize: '.6rem', fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '.08em',
                      padding: '2px 6px', borderRadius: 20,
                      background: m.played ? 'rgba(22,163,74,.1)' : 'var(--border)',
                      color: m.played ? 'var(--success)' : 'var(--muted)',
                      whiteSpace: 'nowrap',
                    }}>
                      {m.played ? '✓' : '—'}
                    </span>
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
