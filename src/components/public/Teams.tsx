import type { Team } from '../../hooks/useTeams'
import type { Player } from '../../hooks/usePlayers'
import Empty from '../ui/Empty'

interface Props {
  teams: Team[]
  players: Player[]
}

export default function Teams({ teams, players }: Props) {
  if (!teams.length) return <Empty icon="👥" text="Žádné týmy." />

  return (
    <div>
      <div className="sec-head">
        <span className="sec-title">Týmy</span>
        <span className="sec-badge">{teams.length}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '.8rem' }}>
        {teams.map(t => {
          const roster = players
            .filter(p => p.team_id === t.id)
            .sort((a, b) => (a.number ?? 999) - (b.number ?? 999))

          return (
            <div key={t.id} className="card" style={{ padding: '1.1rem', position: 'relative', overflow: 'hidden' }}>
              {/* color top bar */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: t.color }} />

              {/* header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', marginBottom: '.75rem' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                  background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem', color: '#fff', fontWeight: 700,
                }}>
                  {t.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.92rem' }}>{t.name}</div>
                  <div style={{ fontSize: '.7rem', color: 'var(--muted)' }}>{roster.length} hráčů</div>
                </div>
              </div>

              {/* roster */}
              {roster.length === 0 ? (
                <div style={{ fontSize: '.72rem', color: 'var(--muted)', fontStyle: 'italic' }}>Soupiska není zadána.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.18rem' }}>
                  {roster.map(p => (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: '.5rem',
                      padding: '.22rem .3rem',
                      borderRadius: 5,
                      fontSize: '.8rem',
                    }}>
                      <span style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: '.85rem',
                        color: t.color,
                        width: 22, textAlign: 'right', flexShrink: 0,
                      }}>
                        {p.number ?? '—'}
                      </span>
                      <span style={{ color: 'var(--text)', fontWeight: 500 }}>{p.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
