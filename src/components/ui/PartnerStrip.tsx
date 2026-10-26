import type { Sponsor } from '../../hooks/useSponsors'

interface Props {
  sponsors: Sponsor[]
  label?: string
  /** Výška loga v px */
  height?: number
  /** Barevná loga (bez šedého filtru) */
  color?: boolean
}

export function PartnerLogo({ sponsor, height = 40, color }: { sponsor: Sponsor; height?: number; color?: boolean }) {
  const img = <img src={sponsor.logo_url} alt={sponsor.name} loading="lazy" />
  const style = { height, width: height * 2.6, ...(color ? { filter: 'none', opacity: 1 } : {}) }
  return sponsor.website_url ? (
    <a className="ui-partner-logo" href={sponsor.website_url} target="_blank" rel="noopener noreferrer" style={style} title={sponsor.name}>{img}</a>
  ) : (
    <span className="ui-partner-logo" style={style} title={sponsor.name}>{img}</span>
  )
}

export function PartnerStrip({ sponsors, label = 'Partneři turnaje', height = 40, color }: Props) {
  const withLogo = sponsors.filter(s => s.logo_url)
  if (withLogo.length === 0) return null
  return (
    <div className="ui-partners">
      {label && <div className="ui-partners__label">{label}</div>}
      <div className="ui-partners__row">
        {withLogo.map(s => <PartnerLogo key={s.id} sponsor={s} height={height} color={color} />)}
      </div>
    </div>
  )
}
