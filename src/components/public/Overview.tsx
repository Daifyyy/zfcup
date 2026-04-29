import type { Tournament } from '../../hooks/useTournament'
import type { Announcement } from '../../hooks/useAnnouncements'
import QRCode from '../ui/QRCode'

interface Props {
  tournament: Tournament | null
  announcements: Announcement[]
  onTab?: (t: import('../../App').Tab) => void
}

export default function Overview({ tournament, announcements }: Props) {
  const tmeta = [tournament?.subtitle, tournament?.date, tournament?.venue].filter(Boolean).join(' · ')

  return (
    <div>
      {/* Hero: název + datum/místo + QR */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="sec-title" style={{ marginBottom: '.5rem' }}>
            {tournament?.name || 'Turnaj'}
          </h2>
          {tmeta && (
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--muted)', letterSpacing: '.04em', lineHeight: 1.6 }}>
              {tmeta}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, textAlign: 'center' }}>
          <QRCode size={100} />
          <div style={{ fontSize: '.62rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: '.35rem' }}>
            Sdílet
          </div>
        </div>
      </div>

      {/* Popis turnaje */}
      {tournament?.description && (
        <div className="card-bordered" style={{ padding: 'var(--pad-card)', marginBottom: '1rem', fontSize: 'var(--fs-body)', color: 'var(--muted)', lineHeight: 1.8 }}>
          {tournament.description}
        </div>
      )}

      {/* Oznámení */}
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
