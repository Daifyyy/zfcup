// Spoty v rotaci TV režimu (modul `tv_spots`): partner přes celou plochu nebo oznámení pořadatele.
import type { Sponsor } from '../../hooks/useSponsors'
import type { Announcement } from '../../hooks/useAnnouncements'
import { sortByTier, tierLabel, tierOf } from '../../lib/partners'
import { announcementIcon } from '../../lib/announcementIcons'
import { sanitizeHtml } from '../../lib/sanitize'
import { TV, tvLogo } from './tvTheme'
import QRCode from '../ui/QRCode'
import { reachUrl } from '../../lib/partnerReach'

export type Spot = { kind: 'partner'; sponsor: Sponsor } | { kind: 'announcement'; announcement: Announcement }

/** Kolikrát se partner objeví v jednom oběhu spotů podle úrovně. */
const WEIGHT: Record<string, number> = { title: 3, main: 2, partner: 1, supplier: 1, media: 1 }
/** Oznámení v rotaci (nejnovější podle pořadí v adminu). */
const MAX_ANNOUNCEMENTS = 3

/**
 * Oběh spotů: partneři podle váhy rozprostření mezi sebou, oznámení vložená mezi ně.
 * Generální partner 3×, hlavní 2×, ostatní 1×.
 */
export function buildSpots(sponsors: Sponsor[], announcements: Announcement[]): Spot[] {
  const partners = sortByTier(sponsors.filter(s => s.logo_url))
  const rounds = Math.max(0, ...partners.map(p => WEIGHT[tierOf(p)] ?? 1))
  const partnerSpots: Spot[] = []
  for (let r = 0; r < rounds; r++) {
    for (const p of partners) if ((WEIGHT[tierOf(p)] ?? 1) > r) partnerSpots.push({ kind: 'partner', sponsor: p })
  }
  const anns: Spot[] = [...announcements]
    .filter(a => a.title || a.body || (a.type === 'image' && a.media_url))
    .sort((a, b) => a.position - b.position)
    .slice(0, MAX_ANNOUNCEMENTS)
    .map(a => ({ kind: 'announcement', announcement: a }))
  // oznámení rovnoměrně mezi partnery
  if (!partnerSpots.length) return anns
  const out: Spot[] = []
  const every = anns.length ? Math.max(1, Math.floor(partnerSpots.length / anns.length)) : Infinity
  let ai = 0
  partnerSpots.forEach((s, i) => {
    out.push(s)
    if ((i + 1) % every === 0 && ai < anns.length) out.push(anns[ai++])
  })
  while (ai < anns.length) out.push(anns[ai++])
  return out
}

const vw = (n: number) => `calc(${n} * var(--tv-vw, 1vw))`

export function TvSpot({ spot }: { spot: Spot }) {
  if (spot.kind === 'partner') {
    const s = spot.sponsor
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: vw(2), background: TV.col }}>
        <div style={{ fontSize: vw(1.3), fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase', color: TV.accent }}>{tierLabel(tierOf(s))}</div>
        <div style={{ background: '#fff', borderRadius: 24, padding: `${vw(2.4)} ${vw(4)}`, boxShadow: '0 20px 60px rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: vw(46), height: vw(22) }}>
          <img src={s.logo_url} alt={s.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: vw(2.6), textTransform: 'uppercase', color: TV.text }}>{s.name}</div>
        {s.reach ? (
          // QR akce partnera (modul partner_reach) — sken se započte do reportu pro partnera
          <div style={{ display: 'flex', alignItems: 'center', gap: vw(1.4), background: 'rgba(255,255,255,.06)', borderRadius: 16, padding: `${vw(.8)} ${vw(1.4)}` }}>
            <div style={{ background: '#fff', padding: vw(.4), borderRadius: 10, lineHeight: 0 }}>
              <QRCode url={reachUrl(s.reach.code, 'tv')} size={Math.round(tvLogo(150))} />
            </div>
            <div style={{ fontSize: vw(1.5), fontWeight: 700, color: TV.text, maxWidth: vw(28), textAlign: 'left' }}>{s.reach.cta || 'Naskenujte kód'}</div>
          </div>
        ) : s.website_url && <div style={{ fontSize: vw(1.2), color: TV.muted }}>{s.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</div>}
      </div>
    )
  }
  const a = spot.announcement
  const { Icon } = announcementIcon(a.icon)
  const image = a.type === 'image' && a.media_url
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: vw(3), padding: `0 ${vw(5)}`, background: TV.col }}>
      {image && <img src={a.media_url} alt="" style={{ maxHeight: '80%', maxWidth: '45%', objectFit: 'contain', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.45)' }} />}
      <div style={{ maxWidth: image ? '45%' : '70%', display: 'flex', flexDirection: 'column', gap: vw(1.4) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: vw(1), fontSize: vw(1.3), fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase', color: TV.accent }}>
          <Icon size={36} />Oznámení
        </div>
        {a.title && <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: vw(4.2), lineHeight: 1, textTransform: 'uppercase', color: TV.text }}>{a.title}</div>}
        {a.body && (
          <div className="rich-content" style={{ fontSize: vw(1.7), lineHeight: 1.45, color: TV.text, maxHeight: '50vh', overflow: 'hidden' }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(a.body) }} />
        )}
      </div>
    </div>
  )
}
