import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronRight, Hourglass, Landmark, MapPin, Radio, Share2 } from 'lucide-react'
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
import { ShareTournamentDialog } from '../share/lazy'
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
import { useDetail } from '../../lib/TournamentDataContext'
import { fixtureId } from '../../lib/details'
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
  /** Turnaj je ročníkem soutěže → karta Historie soutěže */
  competition?: { name: string; slug: string } | null
  editionOptions?: { id: string; edition: number; label: string; name: string }[]
  onOpenCompetition?: (slug: string) => void
  onOpenTournament?: (id: string) => void
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
  competition, editionOptions = [], onOpenCompetition, onOpenTournament,
}: Props) {
  useMinuteTick()
  const [shareOpen, setShareOpen] = useState(false)
  const { openTeam, openMatch } = useDetail()
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
      onClick={() => openMatch(fixtureId(f))}
      meta={<div>{f.match_date ? <>{formatDateShort(f.match_date)} <span style={{ color: 'var(--ink-faint)' }}>{f.scheduled_time}</span></> : (f.scheduled_time || '—')}<div style={{ fontSize: '.66rem', color: 'var(--ink-faint)', fontWeight: 500, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.label}</div></div>}
    />
  )

  const tournamentUrl = tournament?.id ? `${window.location.origin}/${tournament.id}` : undefined
  const hasBoard = fixtures.length > 0
  const hasAside = hasBoard && scorers.length > 0

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
          {tournament && tournamentUrl && (
            <button type="button" className="ui-btn ui-btn--chrome ui-btn--sm" onClick={() => setShareOpen(true)} title="Sdílet turnaj (obrázek)">
              <Share2 size={16} />Sdílet
            </button>
          )}
          <div className="ov-hero__qr desktop-only">
            <QRCode size={72} url={tournamentUrl} />
            <span>Naskenuj a sleduj živě</span>
          </div>
        </div>
      </section>

      {/* ── O turnaji (nad čísly) ─────────────────────── */}
      {tournament?.description && (
        <Card title="O turnaji" className="ov-about">
          <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(tournament.description) }} />
        </Card>
      )}

      {/* ── Klíčová čísla ─────────────────────────────── */}
      {hasBoard && (
        <div className="ov-kpis">
          <button type="button" className="ov-kpi ov-kpi--link" onClick={() => onTab?.('teams')}>
            <b>{teams.length}</b><span>Týmů</span><ChevronRight size={14} className="ov-kpi__go" />
          </button>
          <button type="button" className="ov-kpi ov-kpi--link" onClick={() => onTab?.('results')}>
            <b>{playedCount}<small>/{fixtures.length}</small></b><span>Odehraných zápasů</span><ChevronRight size={14} className="ov-kpi__go" />
          </button>
          <button type="button" className="ov-kpi ov-kpi--link" onClick={() => onTab?.('statistics')}>
            <b>{totalGoals}</b><span>Gólů{playedCount > 0 && <em> · {(totalGoals / playedCount).toFixed(1)} na zápas</em>}</span><ChevronRight size={14} className="ov-kpi__go" />
          </button>
          <button type="button" className="ov-kpi ov-kpi--link" onClick={() => onTab?.('statistics')}>
            {scorers[0]
              ? <b className="ov-kpi__name" title={scorers[0].player.name}><span>{scorers[0].player.name}</span><small>{scorers[0].goals}</small></b>
              : <b>—</b>}
            <span>Nejlepší střelec</span><ChevronRight size={14} className="ov-kpi__go" />
          </button>
        </div>
      )}

      {/* ── Nový turnaj bez rozpisu ─────────────────── */}
      {!hasBoard && (
        <section className="ov-prep">
          <Hourglass size={28} className="ov-prep__icon" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 className="ov-prep__title">Turnaj se připravuje</h3>
            <p className="ov-prep__text">
              {teams.length > 0
                ? `Přihlášeno ${teams.length} ${teams.length === 1 ? 'tým' : teams.length < 5 ? 'týmy' : 'týmů'}. Rozpis zápasů zveřejníme brzy.`
                : 'Týmy a rozpis zápasů zveřejníme brzy.'}
              {' '}Výsledky se tu pak budou objevovat živě.
            </p>
            {teams.length > 0 && (
              <div className="ov-prep__teams">
                {teams.map(t => (
                  <button key={t.id} type="button" className="ov-prep__team" onClick={() => openTeam(t.id)} title={t.name}>
                    <TeamLogo team={t} size={28} />
                    <span>{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <div className={hasAside ? 'ov-grid' : ''}>
        <div className="ov-col">
          {live.length > 0 && (
            <Card padded={false} title="Právě se hraje" icon={<Radio size={16} style={{ color: 'var(--live)' }} />}>
              {live.map(renderRow)}
            </Card>
          )}
          {/* Tabulka hned po živých zápasech — na mobilu tak není až pod celým programem */}
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
                        <td className="is-left is-name">
                          <button type="button" className="ui-teamlink" onClick={() => openTeam(r.id)} title="Detail týmu" style={{ gap: '.5rem' }}>
                            {t && <TeamLogo team={t} size={22} />}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t?.name}</span>
                          </button>
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

          {announcements.length > 0 && (
            <div className="ov-news">
              <div className="ov-news__head">Novinky</div>
              {announcements.map(a => <AnnouncementCard key={a.id} a={a} />)}
            </div>
          )}
        </div>

        {hasAside && (
          <aside className="ov-col">
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

      {competition && onOpenCompetition && (
        <section className="ov-history">
          <div className="ov-history__head">
            <Landmark size={22} className="ov-history__icon" />
            <div style={{ minWidth: 0 }}>
              <div className="ov-history__kicker">Historie soutěže</div>
              <h3 className="ov-history__name">{competition.name}</h3>
              <p className="ov-history__text">
                {editionOptions.length > 1 ? `${editionOptions.length} ročníků — ` : ''}síň vítězů, věčná tabulka, rekordy a nejlepší hráči.
              </p>
            </div>
            <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => onOpenCompetition(competition.slug)}>
              Síň slávy<ChevronRight size={14} />
            </button>
          </div>
          {editionOptions.length > 1 && onOpenTournament && (
            <nav className="cp-edchips" aria-label="Ročníky">
              {editionOptions.map(o => (
                <button key={o.id} type="button" className={`cp-edchip${o.id === tournament?.id ? ' cp-edchip--live' : ''}`} onClick={() => o.id !== tournament?.id && onOpenTournament(o.id)} title={o.name} aria-current={o.id === tournament?.id ? 'page' : undefined}>
                  <b>{o.edition}.</b>{o.label.replace(/^\d+\. ročník( · )?/, '') || o.name}
                </button>
              ))}
            </nav>
          )}
        </section>
      )}

      {sponsors.length > 0 && (
        <div className="ov-partners">
          <PartnerStrip sponsors={sponsors} />
        </div>
      )}
      {shareOpen && tournament && tournamentUrl && (
        <ShareTournamentDialog
          tournament={tournament}
          sponsors={sponsors}
          teamCount={teams.length}
          matchCount={fixtures.length}
          goalCount={totalGoals}
          url={tournamentUrl}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  )
}
