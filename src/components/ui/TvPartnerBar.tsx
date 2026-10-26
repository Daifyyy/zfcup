import type { Sponsor } from '../../hooks/useSponsors'

/** Pruh partnerů pro TV tabuli a kiosk. Při více než 7 logách plynulý ticker. */
export function TvPartnerBar({ sponsors }: { sponsors: Sponsor[] }) {
  const withLogo = sponsors.filter(s => s.logo_url)
  if (withLogo.length === 0) return null
  const scroll = withLogo.length > 7
  const items = scroll ? [...withLogo, ...withLogo] : withLogo
  return (
    <div className="sb-partners">
      <div className="sb-partners__label">Partneři</div>
      <div className="sb-partners__viewport">
        <div
          className={scroll ? 'sb-partners__track sb-partners__track--scroll' : 'sb-partners__track'}
          style={scroll ? { animationDuration: `${withLogo.length * 4}s` } : undefined}
        >
          {items.map((sp, i) => (
            <div key={`${sp.id}-${i}`} className="sb-partners__logo" title={sp.name}>
              <img src={sp.logo_url} alt={sp.name} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
