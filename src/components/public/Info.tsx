import { CalendarDays, ChevronLeft, MapPin } from 'lucide-react'
import type { Tournament } from '../../hooks/useTournament'
import type { Announcement } from '../../hooks/useAnnouncements'
import type { Tab } from '../../App'
import { sanitizeHtml } from '../../lib/sanitize'
import { AnnouncementCard } from './AnnouncementCard'
import { Card, SectionHeader } from '../ui/Card'

interface Props {
  tournament: Tournament | null
  announcements: Announcement[]
  onTab?: (t: Tab) => void
}

export default function Info({ tournament, announcements, onTab }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      <SectionHeader title="Informace" />

      <Card title={tournament?.name || 'Turnaj'}>
        {tournament?.subtitle && <div style={{ color: 'var(--ink-muted)', marginBottom: '.5rem' }}>{tournament.subtitle}</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem 1.25rem', fontSize: '.86rem', color: 'var(--ink-muted)' }}>
          {tournament?.date && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}><CalendarDays size={15} />{tournament.date}</span>}
          {tournament?.venue && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}><MapPin size={15} />{tournament.venue}</span>}
        </div>
        {tournament?.description ? (
          <div className="rich-content" style={{ marginTop: '.9rem' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(tournament.description) }} />
        ) : (
          <div style={{ marginTop: '.9rem', color: 'var(--ink-muted)' }}>Informace o turnaji budou brzy doplněny.</div>
        )}
      </Card>

      {announcements.length > 0 && (
        <div className="ov-news">
          <div className="ov-news__head">Novinky</div>
          {announcements.map(a => <AnnouncementCard key={a.id} a={a} />)}
        </div>
      )}

      {onTab && (
        <div>
          <button type="button" className="ui-btn ui-btn--secondary" onClick={() => onTab('overview')}>
            <ChevronLeft size={16} />Zpět na přehled
          </button>
        </div>
      )}
    </div>
  )
}
