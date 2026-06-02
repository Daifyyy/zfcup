import type { Goal } from '../../hooks/useGoals'
import type { BracketGoal } from '../../hooks/useBracketGoals'
import type { Assist } from '../../hooks/useAssists'
import type { BracketAssist } from '../../hooks/useBracketAssists'
import type { Card } from '../../hooks/useCards'
import type { BracketCard } from '../../hooks/useBracketCards'
import type { Player } from '../../hooks/usePlayers'
import type { Team } from '../../hooks/useTeams'
import type { Tournament } from '../../hooks/useTournament'
import Empty from '../ui/Empty'
import { TeamLogo } from '../ui/TeamLogo'

interface Props {
  goals: Goal[]
  bracketGoals: BracketGoal[]
  assists: Assist[]
  bracketAssists: BracketAssist[]
  cards: Card[]
  bracketCards: BracketCard[]
  players: Player[]
  teams: Team[]
  tournament: Tournament | null
}

const ROW = {
  display: 'grid',
  gridTemplateColumns: '52px 1fr auto',
  alignItems: 'center',
  padding: 'var(--pad-cell)',
  gap: '1rem',
} as React.CSSProperties

function PlayerInfo({ playerId, players, teams }: { playerId: string; players: Player[]; teams: Team[] }) {
  const player = players.find(p => p.id === playerId)
  if (!player) return null
  const team = teams.find(t => t.id === player.team_id)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.55rem' }}>
      {player.avatar_url && (
        <img src={player.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
      )}
      <div>
        <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)' }}>{player.name}</div>
        {team && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <TeamLogo team={team} size={28} />
            <span style={{ fontSize: 'var(--fs-small)', color: 'var(--muted)' }}>{team.name}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionHead({ title, count }: { title: string; count: number }) {
  return (
    <div className="sec-head" style={{ marginTop: '1.5rem' }}>
      <span className="sec-title">{title}</span>
      <span className="sec-badge">{count}</span>
    </div>
  )
}

export default function Statistics({ goals, bracketGoals, assists, bracketAssists, cards, bracketCards, players, teams, tournament }: Props) {
  const showAssists = tournament?.assists_enabled ?? false
  const showCards = tournament?.cards_enabled ?? false

  // ── Scorers ──────────────────────────────────────────────────────────────────
  const goalAgg: Record<string, number> = {}
  for (const g of [...goals, ...bracketGoals]) goalAgg[g.player_id] = (goalAgg[g.player_id] ?? 0) + g.count

  const assistAgg: Record<string, number> = {}
  if (showAssists) {
    for (const a of [...assists, ...bracketAssists]) assistAgg[a.player_id] = (assistAgg[a.player_id] ?? 0) + a.count
  }

  const scorers = players
    .map(p => ({ id: p.id, goals: goalAgg[p.id] ?? 0, assists: assistAgg[p.id] ?? 0 }))
    .filter(s => s.goals > 0 || (showAssists && s.assists > 0))
    .sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists) || b.goals - a.goals)

  // ── Assists leaderboard ───────────────────────────────────────────────────────
  const nahrávači = showAssists
    ? players
        .map(p => ({ id: p.id, assists: assistAgg[p.id] ?? 0 }))
        .filter(s => s.assists > 0)
        .sort((a, b) => b.assists - a.assists)
    : []

  // ── Cards leaderboard ─────────────────────────────────────────────────────────
  const cardAgg: Record<string, { yellow: number; red: number; yellowRed: number; severity: number }> = {}
  if (showCards) {
    for (const c of [...cards, ...bracketCards]) {
      if (!cardAgg[c.player_id]) cardAgg[c.player_id] = { yellow: 0, red: 0, yellowRed: 0, severity: 0 }
      if (c.type === 'yellow') { cardAgg[c.player_id].yellow++; cardAgg[c.player_id].severity += 1 }
      if (c.type === 'red') { cardAgg[c.player_id].red++; cardAgg[c.player_id].severity += 2 }
      if (c.type === 'yellow_red') { cardAgg[c.player_id].yellowRed++; cardAgg[c.player_id].severity += 3 }
    }
  }
  const disciplína = showCards
    ? Object.entries(cardAgg)
        .map(([id, counts]) => ({ id, ...counts }))
        .sort((a, b) => b.severity - a.severity)
    : []

  const hasAnyData = scorers.length > 0 || nahrávači.length > 0 || disciplína.length > 0

  if (!hasAnyData) return <Empty icon="📈" text="Žádné statistiky." />

  return (
    <div>
      {/* ── Střelci ── */}
      {scorers.length > 0 && (
        <>
          <SectionHead title="⚽ Střelci" count={scorers.length} />
          <div className="card" style={{ overflow: 'hidden' }}>
            {scorers.map((sc, i) => {
              const isFirst = i === 0
              const rankCl = i === 0 ? 'rank rank-1' : i === 1 ? 'rank rank-2' : i === 2 ? 'rank rank-3' : 'rank'
              return (
                <div key={sc.id} style={{
                  ...ROW,
                  borderBottom: i < scorers.length - 1 ? '1px solid var(--border)' : 'none',
                  background: isFirst ? 'linear-gradient(90deg,rgba(217,119,6,.06) 0%,transparent 100%)' : 'transparent',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <span className={rankCl} style={{ fontSize: '1.3rem' }}>{i + 1}</span>
                  </div>
                  <PlayerInfo playerId={sc.id} players={players} teams={teams} />
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
        </>
      )}

      {/* ── Nahrávači ── */}
      {showAssists && nahrávači.length > 0 && (
        <>
          <SectionHead title="🅰 Nahrávači" count={nahrávači.length} />
          <div className="card" style={{ overflow: 'hidden' }}>
            {nahrávači.map((n, i) => {
              const isFirst = i === 0
              const rankCl = i === 0 ? 'rank rank-1' : i === 1 ? 'rank rank-2' : i === 2 ? 'rank rank-3' : 'rank'
              return (
                <div key={n.id} style={{
                  ...ROW,
                  borderBottom: i < nahrávači.length - 1 ? '1px solid var(--border)' : 'none',
                  background: isFirst ? 'linear-gradient(90deg,rgba(22,163,74,.06) 0%,transparent 100%)' : 'transparent',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <span className={rankCl} style={{ fontSize: '1.3rem' }}>{i + 1}</span>
                  </div>
                  <PlayerInfo playerId={n.id} players={players} teams={teams} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                    <span style={{ fontSize: 'var(--fs-body)', opacity: .5 }}>🅰</span>
                    <span style={{
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: 'var(--fs-goal)',
                      color: isFirst ? '#16a34a' : 'var(--accent)',
                      lineHeight: 1,
                    }}>
                      {n.assists}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Disciplína ── */}
      {showCards && disciplína.length > 0 && (
        <>
          <SectionHead title="🟡 Disciplína" count={disciplína.length} />
          <div className="card" style={{ overflow: 'hidden' }}>
            {disciplína.map((r, i) => (
              <div key={r.id} style={{
                ...ROW,
                borderBottom: i < disciplína.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ textAlign: 'center', fontSize: '1.1rem' }}>
                  {r.yellowRed > 0 || r.red > 0 ? '🔴' : '🟡'}
                </div>
                <PlayerInfo playerId={r.id} players={players} teams={teams} />
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
            ))}
          </div>
          <div style={{ marginTop: '.6rem', fontSize: '.72rem', color: 'var(--muted)', textAlign: 'center' }}>
            🟡 žlutá · 🟡🔴 dvě žluté → červená · 🔴 přímá červená
          </div>
        </>
      )}
    </div>
  )
}
