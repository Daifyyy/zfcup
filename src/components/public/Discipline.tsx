import type { Card } from '../../hooks/useCards'
import type { BracketCard } from '../../hooks/useBracketCards'
import type { Player } from '../../hooks/usePlayers'
import type { Team } from '../../hooks/useTeams'
import type { Match } from '../../hooks/useMatches'
import type { BracketSlot } from '../../hooks/useBracket'
import Empty from '../ui/Empty'
import { TeamLogo } from '../ui/TeamLogo'

interface Props {
  cards: Card[]
  bracketCards: BracketCard[]
  players: Player[]
  teams: Team[]
  matches: Match[]
  bracketSlots: BracketSlot[]
}

const CARD_WEIGHT: Record<string, number> = { yellow_red: 3, red: 2, yellow: 1 }

export default function Discipline({ cards, bracketCards, players, teams }: Props) {
  const gt = (id: string) => teams.find(t => t.id === id)

  // Agreguj kartičky per hráč
  const agg: Record<string, { yellow: number; red: number; yellowRed: number }> = {}
  for (const c of [...cards, ...bracketCards]) {
    if (!agg[c.player_id]) agg[c.player_id] = { yellow: 0, red: 0, yellowRed: 0 }
    if (c.type === 'yellow') agg[c.player_id].yellow++
    if (c.type === 'red') agg[c.player_id].red++
    if (c.type === 'yellow_red') agg[c.player_id].yellowRed++
  }

  const rows = Object.entries(agg)
    .map(([pid, counts]) => {
      const player = players.find(p => p.id === pid)
      if (!player) return null
      const severity = counts.yellowRed * 3 + counts.red * 2 + counts.yellow
      return { id: pid, name: player.name, team_id: player.team_id, ...counts, severity }
    })
    .filter(r => r !== null)
    .sort((a, b) => b!.severity - a!.severity) as {
      id: string; name: string; team_id: string; yellow: number; red: number; yellowRed: number; severity: number
    }[]

  if (!rows.length) return <Empty icon="🟡" text="Žádné kartičky." />

  return (
    <div>
      <div className="sec-head">
        <span className="sec-title">Disciplína</span>
        <span className="sec-badge">{rows.length}</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {rows.map((r, i) => {
          const team = gt(r.team_id)
          return (
            <div key={r.id} style={{
              display: 'grid',
              gridTemplateColumns: '52px 1fr auto',
              alignItems: 'center',
              padding: 'var(--pad-cell)',
              borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
              gap: '1rem',
            }}>
              <div style={{ textAlign: 'center', fontSize: '1.1rem' }}>
                {r.yellowRed > 0 || r.red > 0 ? '🔴' : '🟡'}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)' }}>{r.name}</div>
                {team && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <TeamLogo team={team} size={28} />
                    <span style={{ fontSize: 'var(--fs-small)', color: 'var(--muted)' }}>{team.name}</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {r.yellow > 0 && (
                  <span style={{ fontSize: '.75rem', fontWeight: 700, background: 'rgba(217,119,6,.12)', color: '#92400e', border: '1px solid rgba(217,119,6,.3)', borderRadius: 5, padding: '2px 7px' }}>
                    🟡 ×{r.yellow}
                  </span>
                )}
                {r.yellowRed > 0 && (
                  <span style={{ fontSize: '.75rem', fontWeight: 700, background: 'rgba(220,38,38,.08)', color: '#dc2626', border: '1px solid rgba(220,38,38,.25)', borderRadius: 5, padding: '2px 7px' }}>
                    🟡🔴 ×{r.yellowRed}
                  </span>
                )}
                {r.red > 0 && (
                  <span style={{ fontSize: '.75rem', fontWeight: 700, background: 'rgba(220,38,38,.08)', color: '#dc2626', border: '1px solid rgba(220,38,38,.25)', borderRadius: 5, padding: '2px 7px' }}>
                    🔴 ×{r.red}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: '.6rem', fontSize: '.72rem', color: 'var(--muted)', textAlign: 'center' }}>
        🟡 žlutá · 🟡🔴 dvě žluté → červená · 🔴 přímá červená
      </div>
    </div>
  )
}
