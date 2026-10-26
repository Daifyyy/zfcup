import type { ReactNode } from 'react'

type Tone = 'neutral' | 'live' | 'final' | 'brand' | 'win' | 'warn' | 'outline'

export function Badge({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  const cls = tone === 'neutral' ? 'ui-badge' : `ui-badge ui-badge--${tone}`
  return (
    <span className={cls} title={title}>
      {tone === 'live' && <span className="ui-live-dot" />}
      {children}
    </span>
  )
}

/** Badge stavu zápasu včetně PP/SN. */
export function MatchStatusBadge({ state, decidedIn }: {
  state: 'scheduled' | 'live' | 'final'
  decidedIn?: 'regulation' | 'ot' | 'so' | null
}) {
  if (state === 'live') return <Badge tone="live">Živě</Badge>
  if (state === 'final') {
    if (decidedIn === 'ot') return <Badge tone="final" title="Rozhodnuto v prodloužení">Konec PP</Badge>
    if (decidedIn === 'so') return <Badge tone="final" title="Rozhodnuto v nájezdech">Konec SN</Badge>
    return <Badge tone="final">Konec</Badge>
  }
  return null
}
