import type { Goal } from '../../../hooks/useGoals'
import type { Player } from '../../../hooks/usePlayers'
import type { Team } from '../../../hooks/useTeams'
import type { BracketGoal } from '../../../hooks/useBracketGoals'

interface Props {
  goals: Goal[]
  bracketGoals: BracketGoal[]
  players: Player[]
  teams: Team[]
}

export default function ScorersTab({ goals, bracketGoals, players, teams }: Props) {
  const agg: Record<string, number> = {}
  for (const g of goals) agg[g.player_id] = (agg[g.player_id] ?? 0) + g.count
  for (const g of bracketGoals) agg[g.player_id] = (agg[g.player_id] ?? 0) + g.count

  const scorers = Object.entries(agg)
    .map(([pid, g]) => {
      const player = players.find(p => p.id === pid)
      const team = player ? teams.find(t => t.id === player.team_id) : null
      return player ? { id: pid, name: player.name, teamName: team?.name ?? '—', teamColor: team?.color ?? '#94a3b8', goals: g } : null
    })
    .filter(Boolean)
    .filter(s => s!.goals > 0)
    .sort((a, b) => b!.goals - a!.goals) as { id: string; name: string; teamName: string; teamColor: string; goals: number }[]

  return (
    <div>
      <div className="info-box">
        Střelci se generují automaticky z gólů zadaných v záložce <strong>Zápasy → ⚽ Góly</strong>.
      </div>
      {!scorers.length ? (
        <p style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Zatím žádní střelci.</p>
      ) : (
        <div className="a-list">
          {scorers.map((s, i) => (
            <div key={s.id} className="a-item">
              <span className="rank" style={{
                color: i === 0 ? 'var(--gold)' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'var(--muted)',
                width: 22, textAlign: 'center', flexShrink: 0,
              }}>
                {i + 1}
              </span>
              <div style={{ flex: 1 }}>
                <div className="a-item-main">{s.name}</div>
                <div className="a-item-sub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="team-dot" style={{ background: s.teamColor }} />{s.teamName}
                </div>
              </div>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.25rem', color: 'var(--accent)' }}>
                ⚽ {s.goals}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
