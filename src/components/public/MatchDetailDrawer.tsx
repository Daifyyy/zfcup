import { useMemo, useState } from 'react'
import { CalendarDays, Clock, Gavel, MapPin, Share2, X } from 'lucide-react'
import { TeamLogo } from '../ui/TeamLogo'
import { CardChip } from '../ui/CardChip'
import { MatchStatusBadge } from '../ui/Badge'
import { getMatchState } from '../../lib/matchState'
import { formatDateWeekday } from '../../lib/dates'
import { getSportDef, type SportDef } from '../../lib/sports'
import { GoalMark, AssistMark, PimMark } from '../ui/EventIcons'
import { ShareMatchDialog } from '../share/lazy'
import { matchUrl, withAccessCode } from '../../lib/share'
import { useTournamentData, useDetail } from '../../lib/TournamentDataContext'
import { findMatchDetail, matchEvents, type SideEvents } from '../../lib/details'
import type { Team } from '../../hooks/useTeams'

const DECIDED_LABEL: Record<string, string> = { ot: 'po prodloužení', so: 'po nájezdech' }

function TeamSide({ team, align, onOpen }: { team?: Team; align: 'home' | 'away'; onOpen: (id: string) => void }) {
  const body = (
    <>
      {team ? <TeamLogo team={team} size={56} radius={8} /> : <span className="md-side__ph" />}
      <span className="md-side__name">{team?.name ?? 'Určí se'}</span>
    </>
  )
  if (!team) return <div className={`md-side md-side--${align}`}>{body}</div>
  return (
    <button type="button" className={`md-side md-side--${align}`} onClick={() => onOpen(team.id)} title={`Detail týmu ${team.name}`}>
      {body}
    </button>
  )
}

function EventList({ side, align, sport }: { side: SideEvents; align: 'home' | 'away'; sport: SportDef }) {
  const empty = !side.goals.length && !side.assists.length && !side.cards.length && !side.penalties.length
  if (empty) return <div className={`md-events__col md-events__col--${align} md-events__none`}>—</div>
  return (
    <div className={`md-events__col md-events__col--${align}`}>
      {side.goals.length > 0 && (
        <div className="md-ev" aria-label={sport.terms.scorersLabel}>
          {side.goals.map(g => (
            <div key={g.player.id} className="md-ev__row">
              <GoalMark sport={sport} />
              <span className="md-ev__name">{g.player.name}</span>
              {g.value > 1 && <span className="md-ev__val">{g.value}×</span>}
            </div>
          ))}
        </div>
      )}
      {side.assists.length > 0 && (
        <div className="md-ev" aria-label="Asistence">
          {side.assists.map(a => (
            <div key={a.player.id} className="md-ev__row">
              <AssistMark />
              <span className="md-ev__name">{a.player.name}</span>
              {a.value > 1 && <span className="md-ev__val">{a.value}×</span>}
            </div>
          ))}
        </div>
      )}
      {side.cards.length > 0 && (
        <div className="md-ev" aria-label="Karty">
          {side.cards.map((c, i) => (
            <div key={`${c.player.id}-${i}`} className="md-ev__row">
              <CardChip kind={c.type} />
              <span className="md-ev__name">{c.player.name}</span>
            </div>
          ))}
        </div>
      )}
      {side.penalties.length > 0 && (
        <div className="md-ev" aria-label="Trestné minuty">
          {side.penalties.map(p => (
            <div key={p.player.id} className="md-ev__row">
              <PimMark minutes={p.value} />
              <span className="md-ev__name">{p.player.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Detail zápasu nebo play-off slotu: skóre, termín, hřiště, rozhodčí, střelci, asistence, karty, tresty. */
export default function MatchDetailDrawer({ matchId, onClose, allowLink = true }: { matchId: string; onClose: () => void; /** Ukázka bez vlastní adresy → bez kopírování odkazu */ allowLink?: boolean }) {
  const data = useTournamentData()
  const { openTeam } = useDetail()
  const [graphic, setGraphic] = useState(false)
  const { tournament, teams } = data
  const sport = getSportDef(tournament.sport)
  const md = useMemo(() => findMatchDetail(data, matchId), [data, matchId])
  const events = useMemo(() => (md ? matchEvents(data, md) : null), [data, md])

  if (!md || !events) {
    return (
      <div className="tm-drawer" onClick={onClose}>
        <aside className="tm-drawer__panel" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Zápas nenalezen">
          <header className="tm-drawer__head md-head">
            <div style={{ flex: 1 }} className="tm-drawer__name">{data.bracketLoading ? 'Načítám…' : 'Zápas nenalezen'}</div>
            <button type="button" className="tm-drawer__close" onClick={onClose} aria-label="Zavřít"><X size={20} /></button>
          </header>
          {!data.bracketLoading && <div className="tm-drawer__sec">Odkaz je neplatný nebo byl zápas smazán.</div>}
        </aside>
      </div>
    )
  }

  const home = md.home_id ? teams.find(t => t.id === md.home_id) : undefined
  const away = md.away_id ? teams.find(t => t.id === md.away_id) : undefined
  const state = getMatchState(md, tournament)
  const showScore = state !== 'scheduled'
  const sideCount = (x: SideEvents) => x.goals.length + x.assists.length + x.cards.length + x.penalties.length
  const anyEvent = sideCount(events.home) + sideCount(events.away) > 0
  const hasEvents = state !== 'scheduled' || anyEvent
  const dateText = md.match_date ? formatDateWeekday(md.match_date) : tournament.date
  const timeText = md.scheduled_time ? `${sport.terms.kickoffLabel} ${md.scheduled_time}` : md.played ? null : 'Termín upřesníme'
  const facts = [
    dateText && { key: 'date', icon: <CalendarDays size={15} />, text: dateText },
    timeText && { key: 'time', icon: <Clock size={15} />, text: timeText },
    md.pitch && { key: 'pitch', icon: <MapPin size={15} />, text: md.pitch },
    md.referee && { key: 'ref', icon: <Gavel size={15} />, text: md.referee },
  ].filter(Boolean) as { key: string; icon: JSX.Element; text: string }[]
  const title = `${home?.name ?? 'Určí se'} – ${away?.name ?? 'Určí se'}`

  return (
    <div className="tm-drawer" onClick={onClose}>
      <aside className="tm-drawer__panel" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <header className="tm-drawer__head md-head">
          <div className="md-head__label">{md.label || (md.kind === 'playoff' ? 'Play-off' : 'Zápas')}</div>
          {allowLink && (
            <button type="button" className="tm-drawer__close" onClick={() => setGraphic(true)} title="Sdílet zápas (obrázek)" aria-label="Sdílet zápas">
              <Share2 size={20} />
            </button>
          )}
          <button type="button" className="tm-drawer__close" onClick={onClose} aria-label="Zavřít"><X size={20} /></button>
        </header>

        <div className={`md-board${state === 'live' ? ' md-board--live' : ''}`}>
          <TeamSide team={home} align="home" onOpen={openTeam} />
          <div className="md-score">
            {showScore ? (
              <div className="md-score__nums">
                {state === 'live' && <span className="ui-live-dot md-score__dot" aria-label="Živě" />}
                <span>{md.home_score}</span><i>:</i><span>{md.away_score}</span>
              </div>
            ) : (
              <div className="md-score__vs">vs</div>
            )}
            <MatchStatusBadge state={state} decidedIn={md.decided_in} />
            {state === 'final' && md.decided_in && DECIDED_LABEL[md.decided_in] && (
              <div className="md-score__note">{DECIDED_LABEL[md.decided_in]}</div>
            )}
          </div>
          <TeamSide team={away} align="away" onOpen={openTeam} />
        </div>


        {facts.length > 0 && (
          <ul className="md-facts">
            {facts.map(f => <li key={f.key}>{f.icon}{f.text}</li>)}
          </ul>
        )}

        {hasEvents && (
          <section className="tm-drawer__sec">
            <h3>Průběh</h3>
            {anyEvent ? (
              <div className="md-events ui-card">
                <EventList side={events.home} align="home" sport={sport} />
                <EventList side={events.away} align="away" sport={sport} />
              </div>
            ) : (
              <p className="md-note" style={{ marginTop: 0 }}>
                {state === 'final' && md.home_score + md.away_score > 0 ? 'Střelci nebyli zadáni.' : 'Zatím bez zapsaných událostí.'}
              </p>
            )}
            {events.unknown > 0 && (
              <p className="md-note">Některé záznamy patří hráčům, kteří už nejsou na soupisce.</p>
            )}
            {anyEvent && state === 'final' && md.home_score + md.away_score > 0 && events.home.goals.length + events.away.goals.length === 0 && (
              <p className="md-note">Střelci nebyli zadáni.</p>
            )}
          </section>
        )}
      </aside>
      {graphic && (
        // portál do <body>, ale React události by probublaly až sem a zavřely detail
        <div onClick={e => e.stopPropagation()}>
          <ShareMatchDialog
            tournament={tournament}
            sponsors={data.sponsors ?? []}
            home={home}
            away={away}
            homeScore={md.home_score}
            awayScore={md.away_score}
            label={md.label || (md.kind === 'playoff' ? 'Play-off' : 'Zápas')}
            decidedIn={md.decided_in}
            live={state === 'live'}
            upcoming={!showScore}
            time={md.scheduled_time}
            events={events}
            url={matchUrl(tournament.id, md.id)}
            codeUrl={withAccessCode(matchUrl(tournament.id, md.id), tournament)}
            onClose={() => setGraphic(false)}
          />
        </div>
      )}
    </div>
  )
}
