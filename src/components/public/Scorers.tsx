import type { Goal } from '../../hooks/useGoals'
import type { Player } from '../../hooks/usePlayers'
import type { Team } from '../../hooks/useTeams'
import type { BracketGoal } from '../../hooks/useBracketGoals'
import type { Assist } from '../../hooks/useAssists'
import type { BracketAssist } from '../../hooks/useBracketAssists'
import type { Tournament } from '../../hooks/useTournament'
import Empty from '../ui/Empty'
import { TeamLogo } from '../ui/TeamLogo'

interface Props {
  goals: Goal[]
  bracketGoals: BracketGoal[]
  assists: Assist[]
  bracketAssists: BracketAssist[]
  players: Player[]
  teams: Team[]
  tournament: Tournament | null
}

export default function Scorers({ goals, bracketGoals, assists, bracketAssists, players, teams, tournament }: Props) {
  const gt = (id: string) => teams.find(t => t.id === id)
  const showAssists = tournament?.assists_enabled ?? false

  const goalAgg: Record<string, number> = {}
  for (const g of goals) goalAgg[g.player_id] = (goalAgg[g.player_id] ?? 0) + g.count
  for (const g of bracketGoals) goalAgg[g.player_id] = (goalAgg[g.player_id] ?? 0) + g.count

  const assistAgg: Record<string, number> = {}
  if (showAssists) {
    for (const a of assists) assistAgg[a.player_id] = (assistAgg[a.player_id] ?? 0) + a.count
    for (const a of bracketAssists) assistAgg[a.player_id] = (assistAgg[a.player_id] ?? 0) + a.count
  }

  const scorers = players
    .map(p => ({ id: p.id, name: p.name, team_id: p.team_id, goals: goalAgg[p.id] ?? 0, assists: assistAgg[p.id] ?? 0 }))
    .filter(s => s.goals > 0 || (showAssists && s.assists > 0))
    .sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists) || b.goals - a.goals)

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
                    <TeamLogo team={team} size={28} />
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
                {showAssists && (
                  <span style={{ fontSize: 'var(--fs-small)', color: sc.assists > 0 ? 'var(--muted)' : 'transparent', fontWeight: 600 }}>
                    +{sc.assists}A
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
