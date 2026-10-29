import type React from 'react'
import type { ReactNode } from 'react'
import { TeamLogo } from './TeamLogo'
import { MatchStatusBadge } from './Badge'
import type { MatchState } from '../../lib/matchState'

interface TeamLike { id: string; name: string; color: string; logo_url: string | null }

interface Props {
  home?: TeamLike
  away?: TeamLike
  homeScore?: number | null
  awayScore?: number | null
  state: MatchState
  decidedIn?: 'regulation' | 'ot' | 'so' | null
  /** Levý sloupec: čas nebo kolo */
  meta?: ReactNode
  /** Pravý sloupec: vlastní obsah místo status badge */
  trailing?: ReactNode
  logoSize?: number
  /** Doplňující řádek pod zápasem (rozhodčí, hřiště…) */
  sub?: ReactNode
  onClick?: () => void
}

/** Broadcast výsledková lišta: čas | domácí | skóre | hosté | stav. */
export function MatchRow({ home, away, homeScore, awayScore, state, decidedIn, meta, trailing, logoSize = 28, sub, onClick }: Props) {
  const showScore = state !== 'scheduled'
  const hs = homeScore ?? 0
  const as = awayScore ?? 0
  const homeLost = state === 'final' && hs < as
  const awayLost = state === 'final' && as < hs
  const cls = ['ui-match', state === 'live' && 'ui-match--live', onClick && 'ui-match--link'].filter(Boolean).join(' ')
  const linkProps = onClick ? {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': `Detail zápasu ${home?.name ?? 'Určí se'} – ${away?.name ?? 'Určí se'}`,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick() }
    },
  } : {}
  return (
    <div className={cls} onClick={onClick} {...linkProps}>
      <div className="ui-match__meta">{meta}</div>
      <div className={`ui-match__team ui-match__team--home${homeLost ? ' ui-match__team--loser' : ''}`}>
        <span className="ui-match__team-name">{home?.name ?? 'Určí se'}</span>
        {home && <TeamLogo team={home} size={logoSize} />}
      </div>
      <div className="ui-match__score">
        {state === 'live' && <span className="ui-live-dot ui-match__live-dot" aria-label="Živě" />}
        {showScore ? (
          <>
            <span className="ui-match__score-box">{hs}</span>
            <span className="ui-match__score-box">{as}</span>
          </>
        ) : (
          <span className="ui-match__vs">vs</span>
        )}
      </div>
      <div className={`ui-match__team${awayLost ? ' ui-match__team--loser' : ''}`}>
        {away && <TeamLogo team={away} size={logoSize} />}
        <span className="ui-match__team-name">{away?.name ?? 'Určí se'}</span>
      </div>
      <div className="ui-match__status">
        {trailing ?? <MatchStatusBadge state={state} decidedIn={decidedIn} />}
      </div>
      {sub && <div className="ui-match__sub">{sub}</div>}
    </div>
  )
}
