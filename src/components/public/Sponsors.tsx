import { ExternalLink } from 'lucide-react'
import type { Sponsor } from '../../hooks/useSponsors'
import { groupByTier } from '../../lib/partners'
import { SectionHeader } from '../ui/Card'
import { reachUrl } from '../../lib/partnerReach'
import Empty from '../ui/Empty'

interface Props {
  sponsors: Sponsor[]
}

function PartnerTile({ sponsor, height }: { sponsor: Sponsor; height: number }) {
  const inner = (
    <>
      <div className="pt-tile__logo" style={{ height }}>
        {sponsor.logo_url
          ? <img src={sponsor.logo_url} alt={sponsor.name} />
          : <span className="pt-tile__fallback">{sponsor.name}</span>}
      </div>
      <div className="pt-tile__name">
        {sponsor.name}
        {(sponsor.website_url || sponsor.reach) && <ExternalLink size={12} />}
      </div>
      {sponsor.reach?.cta && <div className="pt-tile__cta">{sponsor.reach.cta}</div>}
    </>
  )
  // QR akce partnera (modul partner_reach): odkaz přes měřené přesměrování
  const href = sponsor.reach ? reachUrl(sponsor.reach.code, 'web') : sponsor.website_url
  return href ? (
    <a className="pt-tile" href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
  ) : (
    <div className="pt-tile">{inner}</div>
  )
}

export default function Sponsors({ sponsors }: Props) {
  if (!sponsors.length) return <Empty text="Partneři turnaje budou brzy představeni." />
  const groups = groupByTier(sponsors)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <SectionHeader title="Partneři turnaje" subtitle="Děkujeme partnerům, kteří turnaj podporují." />
      {groups.map(({ tier, items }) => (
        <section key={tier.id} className={`pt-group pt-group--${tier.id}`}>
          <h3 className="pt-group__title">{tier.plural}</h3>
          <div className="pt-group__grid" style={{ ['--pt-min' as string]: tier.id === 'title' ? '320px' : tier.id === 'main' ? '240px' : '180px' }}>
            {items.map(s => <PartnerTile key={s.id} sponsor={s} height={tier.logoHeight} />)}
          </div>
        </section>
      ))}
    </div>
  )
}
