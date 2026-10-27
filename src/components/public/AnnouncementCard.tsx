import { PlayCircle } from 'lucide-react'
import type { Announcement } from '../../hooks/useAnnouncements'
import { sanitizeHtml } from '../../lib/sanitize'
import { announcementIcon } from '../../lib/announcementIcons'

export function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:v=|embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

/** Oznámení jako novinková karta (text / obrázek / YouTube video). */
export function AnnouncementCard({ a }: { a: Announcement }) {
  const type = a.type ?? 'text'

  if (type === 'image' && a.media_url) {
    return (
      <article className="news-card">
        <img className="news-card__media" src={a.media_url} alt={a.title} />
        {(a.title || a.body) && (
          <div className="news-card__body">
            {a.title && <h3 className="news-card__title">{a.title}</h3>}
            {a.body && <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(a.body) }} />}
          </div>
        )}
      </article>
    )
  }

  if (type === 'video' && a.media_url) {
    const videoId = extractYoutubeId(a.media_url)
    if (!videoId) return null
    return (
      <article className="news-card">
        <div className="news-card__video">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title={a.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        {a.title && (
          <div className="news-card__body">
            <h3 className="news-card__title" style={{ display: 'flex', alignItems: 'center', gap: '.45rem' }}>
              <PlayCircle size={18} style={{ color: 'var(--live)', flexShrink: 0 }} />
              {a.title}
            </h3>
          </div>
        )}
      </article>
    )
  }

  const { Icon, label } = announcementIcon(a.icon)
  return (
    <article className="news-card news-card--text">
      <div className="news-card__body news-card__body--icon">
        <span className="news-card__icon" title={label} aria-hidden="true"><Icon size={20} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          {a.title && <h3 className="news-card__title">{a.title}</h3>}
          {a.body && <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(a.body) }} />}
        </div>
      </div>
    </article>
  )
}
