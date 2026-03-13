import { useState } from 'react'
import type { Team } from '../../hooks/useTeams'
import type { Player } from '../../hooks/usePlayers'
import Empty from '../ui/Empty'

interface Props {
  teams: Team[]
  players: Player[]
}

function RosterModal({ team, players, onClose }: { team: Team; players: Player[]; onClose: () => void }) {
  const roster = players.filter(p => p.team_id === team.id).sort((a, b) => (a.number ?? 999) - (b.number ?? 999))
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.45)',
        zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 400, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '1rem 1.2rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: '.75rem',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: team.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Bebas Neue', sans-serif", fontSize: '.95rem', color: '#fff', fontWeight: 700,
          }}>
            {team.name.substring(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '.95rem' }}>{team.name}</div>
            <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>{roster.length} hráčů</div>
          </div>
          <button onClick={onClose} className="btn btn-d btn-sm">✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '.6rem .8rem' }}>
          {roster.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '.82rem' }}>
              Soupiska není zadána.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center', padding: '.4rem .6rem', color: 'var(--muted)', fontSize: '.62rem', textTransform: 'uppercase', letterSpacing: '.1em', borderBottom: '1px solid var(--border)' }}>#</th>
                  <th style={{ textAlign: 'left', padding: '.4rem .6rem', color: 'var(--muted)', fontSize: '.62rem', textTransform: 'uppercase', letterSpacing: '.1em', borderBottom: '1px solid var(--border)' }}>Hráč</th>
                </tr>
              </thead>
              <tbody>
                {roster.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ textAlign: 'center', padding: '.5rem .6rem', color: 'var(--muted)', fontFamily: "'Bebas Neue', sans-serif", fontSize: '.95rem' }}>{p.number ?? '—'}</td>
                    <td style={{ padding: '.5rem .6rem', fontWeight: 500 }}>{p.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Teams({ teams, players }: Props) {
  const [modalTeam, setModalTeam] = useState<Team | null>(null)

  if (!teams.length) return <Empty icon="👥" text="Žádné týmy." />

  return (
    <div>
      <div className="sec-head">
        <span className="sec-title">Týmy</span>
        <span className="sec-badge">{teams.length}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '.8rem' }}>
        {teams.map(t => {
          const count = players.filter(p => p.team_id === t.id).length
          return (
            <div
              key={t.id}
              className="card"
              onClick={() => setModalTeam(t)}
              style={{
                padding: '1.1rem',
                position: 'relative', overflow: 'hidden',
                cursor: 'pointer', transition: 'transform .15s, box-shadow .15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,.1)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = ''
                ;(e.currentTarget as HTMLElement).style.boxShadow = ''
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: t.color }} />
              <div style={{
                width: 40, height: 40, borderRadius: 9,
                background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.05rem',
                color: '#fff', marginBottom: '.65rem', fontWeight: 700,
              }}>
                {t.name.substring(0, 2).toUpperCase()}
              </div>
              <div style={{ fontWeight: 600, fontSize: '.9rem', marginBottom: '.25rem' }}>{t.name}</div>
              {count > 0 && (
                <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>{count} hráčů → soupiska</div>
              )}
            </div>
          )
        })}
      </div>

      {modalTeam && (
        <RosterModal team={modalTeam} players={players} onClose={() => setModalTeam(null)} />
      )}
    </div>
  )
}
