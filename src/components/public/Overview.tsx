import type { Tournament } from '../../hooks/useTournament'
import type { Team } from '../../hooks/useTeams'
import type { Match } from '../../hooks/useMatches'
import type { Group } from '../../hooks/useGroups'
import type { Announcement } from '../../hooks/useAnnouncements'
import type { Tab } from '../../App'
import QRCode from '../ui/QRCode'

interface Props {
  tournament: Tournament | null
  teams: Team[]
  matches: Match[]
  groups: Group[]
  announcements: Announcement[]
  onTab?: (t: Tab) => void
}

function StatCard({ label, value, accent, icon, onClick }: {
  label: string; value: number | string; accent?: boolean; icon?: string; onClick?: () => void
}) {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        padding: 'var(--pad-card)', textAlign: 'center',
        cursor: onClick ? 'pointer' : 'default',
        transition: onClick ? 'transform .15s, box-shadow .15s' : undefined,
      }}
      onMouseEnter={onClick ? e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(37,99,235,.13)'
      } : undefined}
      onMouseLeave={onClick ? e => {
        (e.currentTarget as HTMLElement).style.transform = ''
        ;(e.currentTarget as HTMLElement).style.boxShadow = ''
      } : undefined}
    >
      {icon && <div style={{ fontSize: '1.5rem', marginBottom: '.4rem', opacity: .7 }}>{icon}</div>}
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 'var(--fs-stat)',
        color: accent ? 'var(--accent)' : 'var(--text)',
        lineHeight: 1,
        marginBottom: '.3rem',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 'var(--fs-label)',
        textTransform: 'uppercase',
        letterSpacing: '.14em',
        color: 'var(--muted)',
        fontWeight: 600,
      }}>
        {label}
      </div>
    </div>
  )
}

export default function Overview({ tournament, teams, matches, groups, announcements, onTab }: Props) {
  const played = matches.filter(m => m.played).length

  return (
    <div>
      {/* Hero heading + QR */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', gap: '1.5rem' }}>
        <div>
          <h2 className="sec-title" style={{ marginBottom: '.4rem' }}>
            {tournament?.name || 'Turnaj'}
          </h2>
          {[tournament?.subtitle, tournament?.date, tournament?.venue].filter(Boolean).length > 0 && (
            <div style={{ fontSize: 'var(--fs-small)', color: 'var(--muted)', letterSpacing: '.04em' }}>
              {[tournament?.subtitle, tournament?.date, tournament?.venue].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, textAlign: 'center' }}>
          <QRCode size={56} />
          <div style={{ fontSize: '.62rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: '.35rem' }}>
            Sdílet
          </div>
        </div>
      </div>

      {/* Stats / nav grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '.9rem',
        marginBottom: '1.4rem',
      }}>
        <StatCard icon="ℹ️"  label="Informace" value="→"                     onClick={onTab ? () => onTab('info')      : undefined} />
        <StatCard icon="👥" label="Týmy"     value={teams.length}   accent onClick={onTab ? () => onTab('teams')     : undefined} />
        <StatCard icon="📋" label="Zápasy"   value={matches.length}        onClick={onTab ? () => onTab('results')   : undefined} />
        <StatCard icon="📊" label="Tabulka"  value={groups.length}  accent onClick={onTab ? () => onTab('standings') : undefined} />
        <StatCard icon="⚽" label="Střelci"  value={played}                onClick={onTab ? () => onTab('scorers')   : undefined} />
        <StatCard icon="🏆" label="Play-off" value="→"                     onClick={onTab ? () => onTab('bracket')   : undefined} />
      </div>

      {/* Description */}
      {tournament?.description && (
        <div className="card-bordered" style={{ padding: 'var(--pad-card)', marginBottom: '1rem', fontSize: 'var(--fs-body)', color: 'var(--muted)', lineHeight: 1.8 }}>
          {tournament.description}
        </div>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.7rem' }}>
          {announcements.map(a => (
            <div key={a.id} className="card" style={{ padding: 'var(--pad-card)', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.6rem', lineHeight: 1, flexShrink: 0 }}>{a.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'calc(var(--fs-body) + .05rem)', marginBottom: '.3rem' }}>{a.title}</div>
                {a.body && <div style={{ fontSize: 'var(--fs-body)', color: 'var(--muted)', lineHeight: 1.7 }}>{a.body}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {!tournament?.description && !announcements.length && (
        <div className="card-bordered" style={{ padding: 'var(--pad-card)', fontSize: 'var(--fs-body)', color: 'var(--muted)', lineHeight: 1.75 }}>
          Klikni na ⚽ vlevo nahoře nebo stiskni <strong>Ctrl+Shift+A</strong> pro admin panel.
        </div>
      )}
    </div>
  )
}
