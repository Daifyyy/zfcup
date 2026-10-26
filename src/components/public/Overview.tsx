import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronRight, MapPin, Radio } from 'lucide-react'
import type { Tab } from '../../App'
import type { Tournament } from '../../hooks/useTournament'
import type { Announcement } from '../../hooks/useAnnouncements'
import type { Team } from '../../hooks/useTeams'
import type { Player } from '../../hooks/usePlayers'
import type { Group } from '../../hooks/useGroups'
import type { Match } from '../../hooks/useMatches'
import type { Goal } from '../../hooks/useGoals'
import type { BracketGoal } from '../../hooks/useBracketGoals'
import type { BracketRound, BracketSlot } from '../../hooks/useBracket'
import type { Sponsor } from '../../hooks/useSponsors'
import QRCode from '../ui/QRCode'
import { sanitizeHtml } from '../../lib/sanitize'
import { getSportDef } from '../../lib/sports'
import { calcGroupStandings } from '../../lib/standings'
import { getMatchState } from '../../lib/matchState'
import { buildFixtures, topScorers } from '../../lib/fixtures'
import { formatDateShort } from '../../lib/dates'
import { AnnouncementCard } from './AnnouncementCard'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { MatchRow } from '../ui/MatchRow'
import { TeamLogo } from '../ui/TeamLogo'
import { PartnerStrip } from '../ui/PartnerStrip'

interface Props {
  tournament: Tournament | null
  announcements: Announcement[]
  onTab?: (t: Tab) => void
  teams?: Team[]
  players?: Player[]
  groups?: Group[]
  matches?: Match[]
  goals?: Goal[]
  bracketGoals?: BracketGoal[]
  bracketRounds?: BracketRound[]
  bracketSlots?: BracketSlot[]
  sponsors?: Sponsor[]
  presentedBy?: Sponsor | null
}

/** Překreslí komponentu každou minutu (stav „Živě“ podle hodin). */
function useMinuteTick() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])
}

function MoreLink({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  if (!onClick) return null
  return (
    <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={onClick}>
      {children}<ChevronRight size={14} />
    </button>
  )
}

export default function Overview({
  tournament, announcements, onTab,
  teams = [], players = [], groups = [], matches = [], goals = [], bracketGoals = [],
  bracketRounds = [], bracketSlots = [], sponsors = [], presentedBy,
}: Props) {
  useMinuteTick()
  const sport = getSportDef(tournament?.sport)
  const SportIcon = sport.Icon
  const teamById = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams])

  const fixtures = useMemo(
    () => buildFixtures(matches, groups, bracketRounds, bracketSlots),
    [matches, groups, bracketRounds, bracketSlots],
  )
  const withState = fixtures.map(f => ({ f, state: getMatchState(f, tournament) }))
  const live = withState.filter(x => x.state === 'live')
  const upcoming = withState.filter(x => x.state === 'scheduled' && x.f.home_id && x.f.away_id).slice(0, 5)
  const recent = withState.filter(x => x.state === 'final').slice(-5).reverse()

  const playedCount = fixtures.filter(f => f.played).length
  const totalGoals = fixtures.filter(f => f.played).reduce((s, f) => s + f.home_score + f.away_score, 0)
  const scorers = topScorers(players, goals, bracketGoals, 5)

  const firstGroup = groups[0]
  const miniTable = firstGroup ? calcGroupStandings(firstGroup, matches, sport).slice(0, 6) : []

  let status: { tone: 'live' | 'final' | 'brand' | 'neutral'; text: string }
  if (fixtures.length === 0) status = { tone: 'neutral', text: 'Připravujeme' }
  else if (live.length > 0) status = { tone: 'live', text: 'Probíhá' }
  else if (playedCount === fixtures.length) status = { tone: 'final', text: 'Odehráno' }
  else if (playedCount > 0) status = { tone: 'brand', text: 'Probíhá' }
  else status = { tone: 'neutral', text: 'Nadcházející' }

  const renderRow = ({ f, state }: (typeof withState)[number]) => (
    <MatchRow
      key={f.key}
      home={f.home_id ? teamById.get(f.home_id) : undefined}
      away={f.away_id ? teamById.get(f.away_id) : undefined}
      homeScore={f.home_score}
      awayScore={f.away_score}
      state={state}
      decidedIn={f.decided_in}
      meta={<div>{f.match_date ? <>{formatDateShort(f.match_date)} <span style={{ color: 'var(--ink-faint)' }}>{f.scheduled_time}</span></> : (f.scheduled_time || '—')}<div style={{ fontSize: '.66rem', color: 'var(--ink-faint)', fontWeight: 500, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.label}</div></div>}
    />
  )

  const tournamentUrl = tournament?.id ? `${window.location.origin}/${tournament.id}` : undefined
  const hasBoard = fixtures.length > 0

  return (
    <div className="ov">
      {/* ── Hero ─────────────────────────────────────── */}
      <section className="ov-hero">
        <div className="ov-hero__crest">
          {tournament?.logo_url ? <img src={tournament.logo_url} alt="" /> : <SportIcon size={56} strokeWidth={1.25} />}
        </div>
        <div className="ov-hero__main">
          <div className="ov-hero__eyebrow">
            <Badge tone={status.tone}>{status.text}</Badge>
            <span>{sport.label}</span>
          </div>
          <h2 className="ov-hero__name">{tournament?.name}</h2>
          {tournament?.subtitle && <div className="ov-hero__sub">{tournament.subtitle}</div>}
          <div className="ov-hero__facts">
            {tournament?.date && <span><CalendarDays size={15} />{tournament.date}</span>}
            {tournament?.venue && <span><MapPin size={15} />{tournament.venue}</span>}
          </div>
        </div>
        <div className="ov-hero__side">
          {presentedBy?.logo_url && (
            <div className="ov-hero__presented">
              <span>Presented by</span>
              <img src={presentedBy.logo_url} alt={presentedBy.name} />
            </div>
          )}
          <div className="ov-hero__qr desktop-only">
            <QRCode size={72} url={tournamentUrl} />
            <span>Naskenuj a sleduj živě</span>
          </div>
        </div>
      </section>

      {/* ── Klíčová čísla ─────────────────────────────── */}
      {hasBoard && (
        <div className="ov-kpis">
          <div className="ov-kpi"><b>{teams.length}</b><span>Týmů</span></div>
          <div className="ov-kpi"><b>{playedCount}<small>/{fixtures.length}</small></b><span>Odehraných zápasů</span></div>
          <div className="ov-kpi"><b>{totalGoals}</b><span>Gólů</span></div>
          <div className="ov-kpi"><b>{playedCount ? (totalGoals / playedCount).toFixed(1) : '—'}</b><span>Gólů na zápas</span></div>
        </div>
      )}

      <div className={hasBoard ? 'ov-grid' : ''}>
        <div className="ov-col">
          {live.length > 0 && (
            <Card padded={false} title="Právě se hraje" icon={<Radio size={16} style={{ color: 'var(--live)' }} />}>
              {live.map(renderRow)}
            </Card>
          )}
          {upcoming.length > 0 && (
            <Card padded={false} title="Další zápasy" actions={<MoreLink onClick={onTab && (() => onTab('results'))}>Celý program</MoreLink>}>
              {upcoming.map(renderRow)}
            </Card>
          )}
          {recent.length > 0 && (
            <Card padded={false} title="Poslední výsledky" actions={<MoreLink onClick={onTab && (() => onTab('results'))}>Všechny výsledky</MoreLink>}>
              {recent.map(renderRow)}
            </Card>
          )}

          {tournament?.description && (
            <Card title="O turnaji">
              <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(tournament.description) }} />
            </Card>
          )}

          {announcements.length > 0 && (
            <div className="ov-news">
              <div className="ov-news__head">Novinky</div>
              {announcements.map(a => <AnnouncementCard key={a.id} a={a} />)}
            </div>
          )}
        </div>

        {hasBoard && (
          <aside className="ov-col">
            {miniTable.length > 0 && (
              <Card
                padded={false}
                title={groups.length > 1 ? `Tabulka · ${firstGroup.name}` : 'Tabulka'}
                actions={<MoreLink onClick={onTab && (() => onTab('standings'))}>Celá</MoreLink>}
              >
                <table className="ui-table">
                  <thead>
                    <tr><th>#</th><th className="is-left">Tým</th><th>Z</th><th>Skóre</th><th>B</th></tr>
                  </thead>
                  <tbody>
                    {miniTable.map((r, i) => {
                      const t = teamById.get(r.id)
                      return (
                        <tr key={r.id}>
                          <td className="is-muted">{i + 1}</td>
                          <td className="is-left">
                            <span style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontWeight: 600 }}>
                              {t && <TeamLogo team={t} size={22} />}
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t?.name}</span>
                            </span>
                          </td>
                          <td className="is-muted">{r.played}</td>
                          <td className="is-muted">{r.gf}:{r.ga}</td>
                          <td className="is-strong">{r.pts}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
            )}

            {scorers.length > 0 && (
              <Card padded={false} title={sport.terms.scorersLabel} actions={<MoreLink onClick={onTab && (() => onTab('statistics'))}>Statistiky</MoreLink>}>
                <ol className="ov-scorers">
                  {scorers.map((s, i) => {
                    const t = teamById.get(s.player.team_id)
                    return (
                      <li key={s.player.id}>
                        <span className="ov-scorers__rank">{i + 1}</span>
                        {t && <TeamLogo team={t} size={22} />}
                        <span className="ov-scorers__name">
                          {s.player.name}
                          <small>{t?.name}</small>
                        </span>
                        <span className="ov-scorers__val">{s.goals}</span>
                      </li>
                    )
                  })}
                </ol>
              </Card>
            )}
          </aside>
        )}
      </div>

      {sponsors.length > 0 && (
        <div className="ov-partners">
          <PartnerStrip sponsors={sponsors} />
        </div>
      )}
    </div>
  )
}
