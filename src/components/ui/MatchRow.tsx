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
  onClick?: () => void
}

/** Broadcast výsledková lišta: čas | domácí | skóre | hosté | stav. */
export function MatchRow({ home, away, homeScore, awayScore, state, decidedIn, meta, trailing, logoSize = 28, onClick }: Props) {
  const showScore = state !== 'scheduled'
  const hs = homeScore ?? 0
  const as = awayScore ?? 0
  const homeLost = state === 'final' && hs < as
  const awayLost = state === 'final' && as < hs
  const cls = ['ui-match', state === 'live' && 'ui-match--live'].filter(Boolean).join(' ')
  return (
    <div className={cls} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="ui-match__meta">{meta}</div>
      <div className={`ui-match__team ui-match__team--home${homeLost ? ' ui-match__team--loser' : ''}`}>
        <span className="ui-match__team-name">{home?.name ?? 'TBD'}</span>
        {home && <TeamLogo team={home} size={logoSize} />}
      </div>
      <div className="ui-match__score">
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
        <span className="ui-match__team-name">{away?.name ?? 'TBD'}</span>
      </div>
      <div className="ui-match__status">
        {trailing ?? <MatchStatusBadge state={state} decidedIn={decidedIn} />}
      </div>
    </div>
  )
}
