// Animace gólu přes celou obrazovku (modul `goal_animation`) — TV režim i TV tabule.
// Fronta gólů: každý 5 s; volitelně „Gól vám přináší“ + logo generálního partnera (prodejné partnerovi).
import { useEffect } from 'react'
import { TeamLogo } from '../ui/TeamLogo'
import type { Team } from '../../hooks/useTeams'
import type { Player } from '../../hooks/usePlayers'
import type { Sponsor } from '../../hooks/useSponsors'
import { TV, tvLogo } from './tvTheme'

export interface GoalShow { key: string; teamId: string; scorers: string[]; count: number; homeId: string | null; awayId: string | null; h: number; a: number }

export const GOAL_SHOW_MS = 5000

const vw = (n: number) => `calc(${n} * var(--tv-vw, 1vw))`

export function GoalOverlay({ goal, teams, players, partner, onDone }: {
  goal: GoalShow
  teams: Team[]
  players: Player[]
  partner?: Sponsor | null
  onDone: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDone, GOAL_SHOW_MS)
    return () => clearTimeout(t)
  }, [goal.key, onDone])

  const team = teams.find(t => t.id === goal.teamId)
  const home = teams.find(t => t.id === goal.homeId)
  const away = teams.find(t => t.id === goal.awayId)
  const scorers = [...new Set(goal.scorers)].map(id => players.find(p => p.id === id)?.name).filter(Boolean) as string[]

  return (
    <div role="status" aria-live="assertive" style={{
      position: 'fixed', inset: 0, zIndex: 2600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: vw(1.6), color: TV.text, fontFamily: 'var(--font-body)', textAlign: 'center',
      // místo pro pruh partnera dole, aby se s výsledkem nepřekrýval
      paddingBottom: partner?.logo_url ? vw(8) : 0, boxSizing: 'border-box',
      background: 'radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--brand) 55%, #05080f) 0%, color-mix(in srgb, var(--brand) 22%, #05080f) 55%, #05080f 100%)',
      animation: 'tvGoalIn .45s cubic-bezier(.2,1.4,.4,1) both',
    }}>
      <style>{`
        @keyframes tvGoalIn { from { opacity: 0; transform: scale(1.15) } to { opacity: 1; transform: scale(1) } }
        @keyframes tvGoalWord { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.12); opacity: 1 } 100% { transform: scale(1) } }
        @keyframes tvGoalStripe { from { transform: translateX(-100%) } to { transform: translateX(100%) } }
        @media (prefers-reduced-motion: reduce) { [data-tv-goal] * { animation: none !important } }
      `}</style>
      <div data-tv-goal style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: '42%', height: vw(9), background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.08), transparent)', animation: 'tvGoalStripe 1.6s ease-out both' }} />
      </div>
      {team && <TeamLogo team={team} size={tvLogo(200)} radius={16} />}
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: vw(13), lineHeight: .9, letterSpacing: '.04em', textTransform: 'uppercase', color: '#fff', textShadow: '0 .06em .3em rgba(0,0,0,.5)', animation: 'tvGoalWord .7s cubic-bezier(.2,1.4,.4,1) .1s both' }}>
        {goal.count > 1 ? `${goal.count}× gól!` : 'Gól!'}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: vw(3.4), textTransform: 'uppercase', color: TV.accent }}>{team?.name}</div>
      {scorers.length > 0 && <div style={{ fontSize: vw(2.6), fontWeight: 700 }}>{scorers.join(', ')}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: vw(1.2), marginTop: vw(.8), fontSize: vw(1.6), fontWeight: 600, color: TV.muted }}>
        <span>{home?.name}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: vw(4), color: '#fff' }}>{goal.h}:{goal.a}</span>
        <span>{away?.name}</span>
      </div>
      {partner?.logo_url && (
        <div style={{ position: 'absolute', bottom: vw(2.4), display: 'flex', alignItems: 'center', gap: vw(1.2), background: '#fff', padding: `${vw(.7)} ${vw(1.6)}`, borderRadius: 12 }}>
          <span style={{ fontSize: vw(1), fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5b6678' }}>Gól vám přináší</span>
          <img src={partner.logo_url} alt={partner.name} style={{ height: vw(3.6), maxWidth: vw(18), objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}
