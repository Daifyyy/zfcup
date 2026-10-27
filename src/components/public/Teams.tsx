import { ChevronRight } from 'lucide-react'
import type { Team } from '../../hooks/useTeams'
import type { Player } from '../../hooks/usePlayers'
import type { Goal } from '../../hooks/useGoals'
import type { BracketGoal } from '../../hooks/useBracketGoals'
import type { Assist } from '../../hooks/useAssists'
import type { BracketAssist } from '../../hooks/useBracketAssists'
import type { Card as CardRecord } from '../../hooks/useCards'
import type { BracketCard } from '../../hooks/useBracketCards'
import type { Penalty } from '../../hooks/usePenalties'
import type { BracketPenalty } from '../../hooks/useBracketPenalties'
import type { Tournament } from '../../hooks/useTournament'
import type { Match } from '../../hooks/useMatches'
import Empty from '../ui/Empty'
import { TeamLogo } from '../ui/TeamLogo'
import { SectionHeader } from '../ui/Card'
import { useDetail, useTournamentData } from '../../lib/TournamentDataContext'
import { EMPTY_STATS, playerStats, rosterOf, teamRecord } from '../../lib/details'
import { buildFixtures } from '../../lib/fixtures'
import { getSportDef } from '../../lib/sports'
import { RoleBadge, StatBadges, playersLabel } from './TeamDetailDrawer'

interface Props {
  teams: Team[]
  players: Player[]
  goals: Goal[]
  bracketGoals?: BracketGoal[]
  assists?: Assist[]
  bracketAssists?: BracketAssist[]
  cards?: CardRecord[]
  bracketCards?: BracketCard[]
  penalties?: Penalty[]
  bracketPenalties?: BracketPenalty[]
  tournament?: Tournament | null
  matches?: Match[]
}

export default function Teams({ teams, players, goals, bracketGoals = [], assists = [], bracketAssists = [], cards = [], bracketCards = [], penalties = [], bracketPenalties = [], tournament, matches = [] }: Props) {
  const { openTeam } = useDetail()
  const data = useTournamentData()

  if (!teams.length) return <Empty text="Týmy budou zveřejněny po uzávěrce přihlášek." />

  const showAssists = tournament?.assists_enabled ?? false
  const showCards = tournament?.cards_enabled ?? false
  const showPenalties = tournament?.penalty_minutes_enabled ?? false
  const stats = playerStats(
    { goals, bracketGoals, assists, bracketAssists, cards, bracketCards, penalties, bracketPenalties },
    { assists: showAssists, cards: showCards, penalties: showPenalties },
  )

  // Bilance na kartě = stejná jako v detailu (skupiny i play-off)
  const fixtures = buildFixtures(matches, data.groups, data.bracketRounds, data.bracketSlots)
  const allowDraws = getSportDef(tournament?.sport).standings.allowDraws

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionHeader title="Týmy" subtitle={`${teams.length} týmů · ${players.length} hráčů`} />

      <div className="tm-grid">
        {teams.map(t => {
          const roster = rosterOf(players, t.id)
          const r = teamRecord(fixtures, t.id)
          return (
            <article key={t.id} className="tm-card" style={{ borderTopColor: t.color }}>
              <button type="button" className="tm-card__head" onClick={() => openTeam(t.id)} title="Detail týmu">
                <TeamLogo team={t} size={52} radius={6} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tm-card__name">{t.name}</div>
                  <div className="tm-card__meta">
                    {playersLabel(roster.length)}{r.played > 0 && <> · {r.w}V{allowDraws ? ` ${r.d}R` : ''} {r.l}P</>}
                  </div>
                </div>
                <ChevronRight size={18} className="tm-card__chev" />
              </button>
              {roster.length === 0 ? (
                <div className="tm-card__empty">Soupiska není zadána.</div>
              ) : (
                <ul className="tm-roster">
                  {roster.map(p => (
                    <li key={p.id}>
                      {p.avatar_url
                        ? <img className="tm-roster__avatar" src={p.avatar_url} alt="" />
                        : <span className="tm-roster__num">{p.number ?? ''}</span>}
                      <span className="tm-roster__name">{p.name}</span>
                      <RoleBadge role={p.role} />
                      <StatBadges s={stats[p.id] ?? EMPTY_STATS} showAssists={showAssists} showCards={showCards} showPenalties={showPenalties} />
                    </li>
                  ))}
                </ul>
              )}
            </article>
          )
        })}
      </div>

    </div>
  )
}
