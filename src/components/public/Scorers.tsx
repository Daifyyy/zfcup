import type { Goal } from '../../hooks/useGoals'
import type { Player } from '../../hooks/usePlayers'
import type { Team } from '../../hooks/useTeams'
import Empty from '../ui/Empty'

interface Props {
  goals: Goal[]
  players: Player[]
  teams: Team[]
}

export default function Scorers({ goals, players, teams }: Props) {
  const gt = (id: string) => teams.find(t => t.id === id)

  const agg: Record<string, number> = {}
  for (const g of goals) agg[g.player_id] = (agg[g.player_id] ?? 0) + g.count

  const scorers = Object.entries(agg)
    .map(([pid, goals]) => {
      const player = players.find(p => p.id === pid)
      if (!player) return null
      return { id: pid, name: player.name, team_id: player.team_id, goals }
    })
    .filter(s => s !== null && s.goals > 0)
    .sort((a, b) => b!.goals - a!.goals) as { id: string; name: string; team_id: string; goals: number }[]

  if (!scorers.length) return <Empty icon="⚽" text="Žádní střelci." />

  return (
    <div>
      <div className="sec-head">
        <span className="sec-title">Střelci</span>
        <span className="sec-badge">{scorers.length}</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {scorers.map((sc, i) => {
          const team = gt(sc.team_id)
          const isFirst = i === 0
          const rankCl = i === 0 ? 'rank rank-1' : i === 1 ? 'rank rank-2' : i === 2 ? 'rank rank-3' : 'rank'
          return (
            <div key={sc.id} style={{
              display: 'grid',
              gridTemplateColumns: '52px 1fr auto',
              alignItems: 'center',
              padding: 'var(--pad-cell)',
              borderBottom: i < scorers.length - 1 ? '1px solid var(--border)' : 'none',
              background: isFirst ? 'linear-gradient(90deg,rgba(217,119,6,.06) 0%,transparent 100%)' : 'transparent',
              gap: '1rem',
            }}>
              <div style={{ textAlign: 'center' }}>
                <span className={rankCl} style={{ fontSize: '1.3rem' }}>{i + 1}</span>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)' }}>{sc.name}</div>
                {team && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <span className="team-dot" style={{ background: team.color }} />
                    <span style={{ fontSize: 'var(--fs-small)', color: 'var(--muted)' }}>{team.name}</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <span style={{ fontSize: 'var(--fs-body)', opacity: .5 }}>⚽</span>
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 'var(--fs-goal)',
                  color: isFirst ? 'var(--gold)' : 'var(--accent)',
                  lineHeight: 1,
                }}>
                  {sc.goals}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
