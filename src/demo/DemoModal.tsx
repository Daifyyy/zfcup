// Ukázka funkce na úvodní stránce: skutečné komponenty aplikace nad ukázkovými daty
// (src/demo/mockTournament.ts) — žádné dotazy do DB, nic se neukládá.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Mail, MousePointerClick, X } from 'lucide-react'
import { buildDemoData } from './mockTournament'
import { FEATURES, type DemoKey } from './features'
import { TournamentDataContext, DetailContext, useDetail, type DetailTarget } from '../lib/TournamentDataContext'
import { buildFixtures } from '../lib/fixtures'
import { getMatchState } from '../lib/matchState'
import { calcGroupStandings } from '../lib/standings'
import { getSportDef } from '../lib/sports'
import { getTitlePartner, sortByTier } from '../lib/partners'
import { fixtureId } from '../lib/details'
import { TOURNAMENT_FORMATS } from '../lib/formats'
import { contactHref } from '../lib/brand'
import { Card } from '../components/ui/Card'
import { MatchRow } from '../components/ui/MatchRow'
import Standings from '../components/public/Standings'
import Bracket from '../components/public/Bracket'
import Scoreboard from '../components/public/Scoreboard'
import TeamDetailDrawer from '../components/public/TeamDetailDrawer'
import MatchDetailDrawer from '../components/public/MatchDetailDrawer'
import { MatchGraphic, TableGraphic, FORMAT_SIZE } from '../components/share/templates'
import { BestTeamGraphic } from '../components/share/templatesExtra'
import { bestTeamScopes } from '../lib/tournamentGraphics'
import { useBackClose } from '../lib/useBackClose'

interface Props {
  initial: DemoKey
  onClose: () => void
}

/** Plocha navržená pro pevnou velikost (TV, grafika), zmenšená na šířku kontejneru. */
function Scaled({ w, h, children, className }: { w: number; h: number; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.4)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(el.clientWidth / w))
    ro.observe(el)
    return () => ro.disconnect()
  }, [w])
  return (
    <div ref={ref} className={className} style={{ position: 'relative', width: '100%', height: h * scale, overflow: 'hidden' }}>
      {/* transform = obal pro position: fixed uvnitř (TV tabule, drawer) */}
      <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: '0 0', position: 'absolute', inset: '0 auto auto 0', ['--tv-vw' as string]: `${w / 100}px` }}>
        {children}
      </div>
    </div>
  )
}

export default function DemoModal({ initial, onClose }: Props) {
  const features = FEATURES
  useBackClose(true, onClose, 'demo')
  const [key, setKey] = useState<DemoKey>(initial)
  const [detail, setDetail] = useState<DetailTarget | null>(null)
  const data = useMemo(() => buildDemoData(), [])
  const feature = features.find(f => f.key === key) ?? features[0]
  const index = features.indexOf(feature)

  // Ukázkové detaily se otevírají uvnitř náhledu (bez změny adresy a historie)
  const detailApi = useMemo(() => ({
    openTeam: (id: string) => setDetail({ kind: 'team', id }),
    openMatch: (id: string) => setDetail({ kind: 'match', id }),
  }), [])

  useEffect(() => { setDetail(null) }, [key])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (detail) setDetail(null); else onClose() }
      if (e.key === 'ArrowRight') setKey(features[(index + 1) % features.length].key)
      if (e.key === 'ArrowLeft') setKey(features[(index - 1 + features.length) % features.length].key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detail, index, features, onClose])

  const Icon = feature.icon
  const mail = contactHref()

  return (
    <div className="lp-modal dm" onClick={onClose}>
      <div className="dm-panel" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Ukázka: ${feature.title}`}>
        <header className="dm-head">
          <span className="dm-head__icon"><Icon size={18} /></span>
          <h2 className="dm-head__title">{feature.title}</h2>
          <span className="dm-head__badge">Ukázka</span>
          <button type="button" className="tm-drawer__close" onClick={onClose} aria-label="Zavřít"><X size={20} /></button>
        </header>

        <div className="dm-body">
          <TournamentDataContext.Provider value={data}>
            <DetailContext.Provider value={detailApi}>
              <div className="dm-stage">
                <Preview k={feature.key} data={data} />
                {detail && (
                  <div className="dm-overlay">
                    {detail.kind === 'team'
                      ? <TeamDetailDrawer teamId={detail.id} onClose={() => setDetail(null)} allowLink={false} />
                      : <MatchDetailDrawer matchId={detail.id} onClose={() => setDetail(null)} allowLink={false} />}
                  </div>
                )}
              </div>
            </DetailContext.Provider>
          </TournamentDataContext.Provider>

          <aside className="dm-info">
            <p className="dm-info__lead">{feature.text}</p>
            <ul className="dm-info__points">
              {feature.points.map(p => <li key={p}>{p}</li>)}
            </ul>
            {(feature.key === 'live' || feature.key === 'formats') && (
              <p className="dm-info__hint"><MousePointerClick size={15} />Zkus kliknout na zápas nebo tým.</p>
            )}
            {mail && (
              <a className="ui-btn ui-btn--primary ui-btn--block" href={mail}><Mail size={16} />Chci turnaj</a>
            )}
            <div className="dm-nav">
              <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setKey(features[(index - 1 + features.length) % features.length].key)}>
                <ChevronLeft size={16} />Předchozí
              </button>
              <span className="dm-nav__dots">
                {features.map(f => (
                  <button key={f.key} type="button" className={`dm-dot${f.key === key ? ' dm-dot--on' : ''}`} onClick={() => setKey(f.key)} aria-label={f.title} title={f.title} />
                ))}
              </span>
              <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setKey(features[(index + 1) % features.length].key)}>
                Další<ChevronRight size={16} />
              </button>
            </div>
            <p className="dm-info__note">Ukázková data — fiktivní turnaj.</p>
          </aside>
        </div>
      </div>
    </div>
  )
}

function Preview({ k, data }: { k: DemoKey; data: ReturnType<typeof buildDemoData> }) {
  const { tournament, teams, players, groups, matches, goals, bracketGoals, bracketRounds, bracketSlots, sponsors } = data
  const teamById = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams])
  const sortedSponsors = useMemo(() => sortByTier(sponsors), [sponsors])
  const fixtures = useMemo(() => buildFixtures(matches, groups, bracketRounds, bracketSlots), [matches, groups, bracketRounds, bracketSlots])
  const { openMatch } = useDetail()

  const row = (f: (typeof fixtures)[number]) => (
    <MatchRow
      key={f.key}
      home={f.home_id ? teamById.get(f.home_id) : undefined}
      away={f.away_id ? teamById.get(f.away_id) : undefined}
      homeScore={f.home_score}
      awayScore={f.away_score}
      state={getMatchState(f, tournament)}
      decidedIn={f.decided_in}
      meta={<div>{f.scheduled_time}<div className="ui-match__label">{f.label}</div></div>}
      onClick={() => openMatch(fixtureId(f))}
    />
  )

  switch (k) {
    case 'live': {
      const live = fixtures.filter(f => getMatchState(f, tournament) === 'live')
      const recent = fixtures.filter(f => f.played).slice(-4).reverse()
      return (
          <div className="dm-col">
            {live.length > 0 && <Card padded={false} title="Právě se hraje">{live.map(row)}</Card>}
            <Card padded={false} title="Poslední výsledky">{recent.map(row)}</Card>
            <Standings groups={groups} matches={matches} teams={teams} tournament={tournament} />
          </div>
      )
    }
    case 'tv':
      return (
        <Scaled w={1920} h={1080} className="dm-tv">
          <Scoreboard
            tournament={tournament} teams={teams} players={players} groups={groups} matches={matches} goals={goals}
            bracketGoals={bracketGoals} bracketRounds={bracketRounds} bracketSlots={bracketSlots}
            onExit={() => {}} historyStep={false} sponsors={sortedSponsors} presentedBy={getTitlePartner(sponsors)}
          />
        </Scaled>
      )
    case 'share': {
      const final = bracketSlots.find(s => s.id === 's-sf2')!
      const rows = calcGroupStandings(groups[0], matches, getSportDef(tournament.sport))
      const { w, h } = FORMAT_SIZE.square
      const bestTeam = bestTeamScopes(data)[0]
      return (
        <div className="dm-share">
          <Scaled w={w} h={h} className="dm-share__item">
            <MatchGraphic format="square" tournament={tournament} sponsors={sortedSponsors} home={teamById.get(final.home_id!)} away={teamById.get(final.away_id!)} homeScore={final.home_score} awayScore={final.away_score} label="Semifinále" />
          </Scaled>
          <Scaled w={w} h={h} className="dm-share__item">
            <TableGraphic format="square" tournament={tournament} sponsors={sortedSponsors} groupName={groups[0].name} rows={rows} teams={teams} allowDraws />
          </Scaled>
          {bestTeam && (
            <Scaled w={w} h={h} className="dm-share__item">
              <BestTeamGraphic format="square" tournament={tournament} sponsors={sortedSponsors} title={bestTeam.label} team={bestTeam.team} hockey={false} />
            </Scaled>
          )}
        </div>
      )
    }
    case 'formats':
      return (
          <div className="dm-col">
            <Bracket rounds={bracketRounds} slots={bracketSlots} teams={teams} />
            <div className="dm-formats">
              {TOURNAMENT_FORMATS.map(f => <span key={f.id} className="dm-format" title={f.description}>{f.label}</span>)}
            </div>
          </div>
      )
    default:
      return null
  }
}
