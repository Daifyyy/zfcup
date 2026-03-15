import type { Team } from '../../hooks/useTeams'
import type { Player } from '../../hooks/usePlayers'
import type { Goal } from '../../hooks/useGoals'
import Empty from '../ui/Empty'

interface Props {
  teams: Team[]
  players: Player[]
  goals: Goal[]
}

function Badge({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span style={{
      fontSize: '.65rem', fontWeight: 700, color,
      background: bg, border: `1px solid ${border}`,
      borderRadius: 4, padding: '1px 5px', lineHeight: 1.4, flexShrink: 0,
    }}>{label}</span>
  )
}

function RoleBadge({ role }: { role: string | null }) {
  if (role === 'captain')    return <Badge label="C" color="#92400e" bg="rgba(217,119,6,.12)"  border="rgba(217,119,6,.3)" />
  if (role === 'goalkeeper') return <Badge label="B" color="#166534" bg="rgba(22,163,74,.12)" border="rgba(22,163,74,.3)" />
  if (role === 'both')       return <><Badge label="C" color="#92400e" bg="rgba(217,119,6,.12)"  border="rgba(217,119,6,.3)" /><Badge label="B" color="#166534" bg="rgba(22,163,74,.12)" border="rgba(22,163,74,.3)" /></>
  return null
}

export default function Teams({ teams, players, goals }: Props) {
  if (!teams.length) return <Empty icon="👥" text="Žádné týmy." />

  // Aggregate goals per player
  const playerGoals: Record<string, number> = {}
  for (const g of goals) {
    playerGoals[g.player_id] = (playerGoals[g.player_id] ?? 0) + g.count
  }

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
            .sort((a, b) => a.name.localeCompare(b.name, 'cs'))

          return (
            <div key={t.id} className="card" style={{ padding: '1.1rem', position: 'relative', overflow: 'hidden' }}>
              {/* color top bar */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: t.color }} />

              {/* header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', marginBottom: '.75rem' }}>
                {t.logo_url ? (
                  <img src={t.logo_url} style={{ width: 38, height: 38, borderRadius: 9, objectFit: 'contain', flexShrink: 0, border: '1px solid var(--border)', background: '#fff' }} />
                ) : (
                  <div style={{
                    width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                    background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem', color: '#fff', fontWeight: 700,
                  }}>
                    {t.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
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
                  {roster.map(p => {
                    const g = playerGoals[p.id] ?? 0
                    return (
                      <div key={p.id} style={{
                        display: 'flex', alignItems: 'center', gap: '.45rem',
                        padding: '.22rem .3rem',
                        borderRadius: 5,
                        fontSize: '.8rem',
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '.3rem', flex: 1, minWidth: 0 }}>
                          <span style={{ color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </span>
                          <RoleBadge role={p.role} />
                        </span>
                        {g > 0 && (
                          <span style={{
                            fontSize: '.72rem', fontWeight: 700,
                            color: 'var(--accent)', flexShrink: 0,
                          }}>
                            ⚽{g}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
