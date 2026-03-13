import type { Tournament } from '../../hooks/useTournament'
import type { Announcement } from '../../hooks/useAnnouncements'
import type { Tab } from '../../App'

interface Props {
  tournament: Tournament | null
  announcements: Announcement[]
  onTab?: (t: Tab) => void
}

export default function Info({ tournament, announcements, onTab }: Props) {
  return (
    <div>
      <div className="sec-head">
        <h2 className="sec-title">Informace</h2>
      </div>

      {/* Tournament details card */}
      <div className="card" style={{ padding: 'var(--pad-card)', marginBottom: '1rem' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'var(--fs-sec)', lineHeight: 1.1, marginBottom: '.5rem' }}>
          {tournament?.name || 'Turnaj'}
        </div>
        {tournament?.subtitle && (
          <div style={{ fontSize: 'var(--fs-body)', color: 'var(--muted)', marginBottom: '.25rem' }}>{tournament.subtitle}</div>
        )}
        {tournament?.date && (
          <div style={{ fontSize: 'var(--fs-small)', color: 'var(--muted)', marginBottom: '.25rem' }}>📅 {tournament.date}</div>
        )}
        {tournament?.venue && (
          <div style={{ fontSize: 'var(--fs-small)', color: 'var(--muted)', marginBottom: '.25rem' }}>📍 {tournament.venue}</div>
        )}
        {tournament?.description && (
          <div style={{ marginTop: '.85rem', fontSize: 'var(--fs-body)', color: 'var(--muted)', lineHeight: 1.75, whiteSpace: 'pre-line' }}>
            {tournament.description}
          </div>
        )}
        {!tournament?.description && (
          <div style={{ marginTop: '.85rem', fontSize: 'var(--fs-body)', color: 'var(--muted)', lineHeight: 1.75 }}>
            Informace o turnaji budou brzy doplněny.
          </div>
        )}
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <>
          <div className="sub-title">Oznámení</div>
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
        </>
      )}

      {onTab && (
        <div style={{ marginTop: '1.5rem' }}>
          <button className="btn btn-s" onClick={() => onTab('overview')}>← Zpět na přehled</button>
        </div>
      )}
    </div>
  )
}
