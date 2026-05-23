import type { Tournament } from '../../hooks/useTournament'
import type { Announcement } from '../../hooks/useAnnouncements'
import QRCode from '../ui/QRCode'

interface Props {
  tournament: Tournament | null
  announcements: Announcement[]
  onTab?: (t: import('../../App').Tab) => void
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
            {a.body && <div style={{ fontSize: 'var(--fs-body)', color: 'var(--muted)', lineHeight: 1.7, marginTop: '.2rem' }}>{a.body}</div>}
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

  // type === 'text' (default)
  return (
    <div className="card" style={{ padding: 'var(--pad-card)', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '1.6rem', lineHeight: 1, flexShrink: 0 }}>{a.icon}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 'calc(var(--fs-body) + .05rem)', marginBottom: '.3rem' }}>{a.title}</div>
        {a.body && <div style={{ fontSize: 'var(--fs-body)', color: 'var(--muted)', lineHeight: 1.7 }}>{a.body}</div>}
      </div>
    </div>
  )
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

      {/* Oznámení + média */}
      {announcements.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.7rem' }}>
          {announcements.map(a => <AnnouncementCard key={a.id} a={a} />)}
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
