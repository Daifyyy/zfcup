import type { CSSProperties, ReactNode } from 'react'

interface CardProps {
  title?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
  /** false = bez vnitřního paddingu (tabulky, seznamy zápasů) */
  padded?: boolean
  className?: string
  style?: CSSProperties
}

export function Card({ title, icon, actions, children, padded = true, className = '', style }: CardProps) {
  return (
    <section className={`ui-card ${className}`} style={style}>
      {(title || actions) && (
        <header className="ui-card__head">
          <div className="ui-card__title">{icon}{title}</div>
          {actions}
        </header>
      )}
      {padded ? <div className="ui-card__body">{children}</div> : children}
    </section>
  )
}

export function SectionHeader({ title, subtitle, actions, size = 'lg' }: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  size?: 'lg' | 'sm'
}) {
  return (
    <div className={size === 'sm' ? 'ui-sec ui-sec--sm' : 'ui-sec'}>
      <div style={{ minWidth: 0 }}>
        <h2 className="ui-sec__title">{title}</h2>
        {subtitle && <div className="ui-sec__sub">{subtitle}</div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: '.5rem', flexShrink: 0, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  )
}

export function StatTile({ value, label, accent }: { value: ReactNode; label: ReactNode; accent?: string }) {
  return (
    <div className="ui-stat" style={accent ? { borderTopColor: accent } : undefined}>
      <div className="ui-stat__value">{value}</div>
      <div className="ui-stat__label">{label}</div>
    </div>
  )
}
