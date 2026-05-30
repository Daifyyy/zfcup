import type { Tournament } from '../../hooks/useTournament'
import type { Announcement } from '../../hooks/useAnnouncements'
import type { Tab } from '../../App'
import { sanitizeHtml } from '../../lib/sanitize'

interface Props {
  tournament: Tournament | null
  announcements: Announcement[]
  onTab?: (t: Tab) => void
}

function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:v=|embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

function AnnouncementCard({ a }: { a: Announcement }) {
  const type = a.type ?? 'text'

  if (type === 'image' && a.media_url) {
    return (
      <div className="card" style={{ padding: 'var(--pad-card)', overflow: 'hidden' }}>
        <img
          src={a.media_url}
          alt={a.title}
          style={{ width: '100%', borderRadius: 8, display: 'block', objectFit: 'cover', maxHeight: 320 }}
        />
        {(a.title || a.body) && (
          <div style={{ marginTop: '.6rem' }}>
            {a.title && <div style={{ fontWeight: 700, fontSize: 'calc(var(--fs-body) + .05rem)' }}>{a.title}</div>}
            {a.body && <div className="rich-content" style={{ fontSize: 'var(--fs-body)', color: 'var(--muted)', lineHeight: 1.7, marginTop: '.2rem' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(a.body) }} />}
          </div>
        )}
      </div>
    )
  }

  if (type === 'video' && a.media_url) {
    const videoId = extractYoutubeId(a.media_url)
    if (!videoId) return null
    return (
      <div className="card" style={{ padding: 'var(--pad-card)', overflow: 'hidden' }}>
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 8, overflow: 'hidden' }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title={a.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          />
        </div>
        {a.title && (
          <div style={{ marginTop: '.6rem', fontWeight: 700, fontSize: 'calc(var(--fs-body) + .05rem)', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            <span>▶️</span> {a.title}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 'var(--pad-card)', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '1.6rem', lineHeight: 1, flexShrink: 0 }}>{a.icon}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 'calc(var(--fs-body) + .05rem)', marginBottom: '.3rem' }}>{a.title}</div>
        {a.body && <div className="rich-content" style={{ fontSize: 'var(--fs-body)', color: 'var(--muted)', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(a.body) }} />}
      </div>
    </div>
  )
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
          <div
            className="rich-content"
            style={{ marginTop: '.85rem' }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(tournament.description) }}
          />
        )}
        {!tournament?.description && (
          <div style={{ marginTop: '.85rem', fontSize: 'var(--fs-body)', color: 'var(--muted)', lineHeight: 1.75 }}>
            Informace o turnaji budou brzy doplněny.
          </div>
        )}
      </div>

      {/* Announcements + média */}
      {announcements.length > 0 && (
        <>
          <div className="sub-title">Oznámení</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.7rem' }}>
            {announcements.map(a => <AnnouncementCard key={a.id} a={a} />)}
          </div>
        </>
      )}

      {onTab && (
        <div style={{ marginTop: '1.5rem' }}>
          <button type="button" className="btn btn-s" onClick={() => onTab('overview')}>← Zpět na přehled</button>
        </div>
      )}
    </div>
  )
}
