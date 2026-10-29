import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Medal, Trophy } from 'lucide-react'
import { useClubPage } from '../../hooks/useClubPage'
import { clubPlayers, clubSeasons, clubTotals, headToHead, type ClubSeason } from '../../lib/clubHistory'
import { rosterOfClub } from '../../lib/clubs'
import { getSportDef } from '../../lib/sports'
import { BRAND } from '../../lib/brand'
import { Tabs } from '../ui/Tabs'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { TeamLogo } from '../ui/TeamLogo'
import Empty from '../ui/Empty'
import { RoleBadge } from '../public/TeamDetailDrawer'
import SiteFooter from '../layout/SiteFooter'

type KTab = 'seasons' | 'h2h' | 'players'

interface Props {
  slug: string
  onOpenTournament: (tournamentId: string) => void
  onHome: () => void
}

function ResultBadge({ s }: { s: ClubSeason }) {
  const r = s.result
  if (r.kind === 'champion') return <span className="kp-res kp-res--gold"><Trophy size={14} />{r.label}</span>
  if (r.kind === 'runnerUp' || r.kind === 'third') return <span className="kp-res kp-res--medal"><Medal size={14} />{r.label}</span>
  if (r.kind === 'rank') return <span className="kp-res">{r.label}</span>
  return <Badge tone={s.status === 'in_progress' ? 'brand' : 'neutral'}>{r.label}</Badge>
}

/** Veřejná stránka klubu: turnaje a umístění, vzájemné zápasy, hráči. */
export default function ClubPage({ slug, onOpenTournament, onHome }: Props) {
  const h = useClubPage(slug)
  const [tab, setTab] = useState<KTab>('seasons')
  const clubId = h.club?.id ?? ''

  const seasons = useMemo(() => (clubId ? clubSeasons(h, clubId) : []), [h, clubId])
  const totals = useMemo(() => clubTotals(seasons), [seasons])
  const h2h = useMemo(() => (clubId ? headToHead(h, clubId) : []), [h, clubId])
  const players = useMemo(() => (clubId ? clubPlayers(h, clubId) : []), [h, clubId])
  const roster = useMemo(() => (clubId ? rosterOfClub(h.roster, clubId) : []), [h.roster, clubId])

  if (h.loading) {
    return <div className="lp" style={{ alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>
  }
  if (!h.available || h.notFound || !h.club) {
    return (
      <div className="lp">
        <div className="lp-wrap" style={{ padding: '4rem 1rem' }}>
          <Empty text={!h.available ? 'Profily klubů zatím nejsou na této platformě aktivní.' : 'Klub nebyl nalezen.'} />
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button type="button" className="ui-btn ui-btn--secondary" onClick={onHome}><ChevronLeft size={16} />Zpět na přehled</button>
          </div>
        </div>
      </div>
    )
  }

  const c = h.club
  const color = c.color ?? '#64748b'
  const sports = [...new Set(h.editions.map(t => getSportDef(t.sport).label))]
  const allowDraws = h.editions.some(t => getSportDef(t.sport).standings.allowDraws)
  const showAssists = players.some(p => p.assists > 0)
  const showPim = players.some(p => p.pim > 0)
  const topPlayers = players.filter(p => p.goals + p.assists + p.pim > 0 || p.tournaments > 1).slice(0, 50)

  return (
    <div className="lp">
      <header className="hdr">
        <div className="hdr__top">
          <div className="hdr__inner">
            <button type="button" onClick={onHome} className="hdr-back"><ChevronLeft size={18} /><span className="hide-mobile">{BRAND.name}</span></button>
            <div className="hdr__crest"><TeamLogo team={{ name: c.name, color, logo_url: c.logo_url }} size={32} radius={6} /></div>
            <div className="hdr__title">
              <h1 className="hdr__name">{c.name}</h1>
              <div className="hdr__meta">
                {[sports.join(' · ') || 'Klub', `${totals.tournaments} ${totals.tournaments === 1 ? 'turnaj' : totals.tournaments >= 2 && totals.tournaments <= 4 ? 'turnaje' : 'turnajů'}`].join(' · ')}
              </div>
            </div>
          </div>
        </div>
        <div className="hdr__nav">
          <div className="hdr__inner">
            <Tabs variant="chrome" value={tab} onChange={setTab} ariaLabel="Sekce klubu" items={[
              { value: 'seasons', label: 'Turnaje' },
              { value: 'h2h', label: 'Vzájemné zápasy' },
              { value: 'players', label: 'Hráči' },
            ]} />
          </div>
        </div>
      </header>

      <main className="lp-wrap cp-main">
        <div className="ov-kpis" style={{ marginBottom: '1.25rem' }}>
          <div className="ov-kpi"><b>{totals.tournaments}</b><span>Turnajů</span></div>
          <div className="ov-kpi"><b>{totals.titles}</b><span>Titulů</span></div>
          <div className="ov-kpi"><b>{totals.w}<small>/{totals.played}</small></b><span>Výher / zápasů</span></div>
          <div className="ov-kpi"><b>{totals.gf}:{totals.ga}</b><span>Skóre</span></div>
        </div>

        {tab === 'seasons' && (
          <Card padded={false} title="Turnaje a umístění">
            {seasons.length === 0 ? (
              <div style={{ padding: '1.25rem' }}><Empty text="Klub zatím nehrál žádný turnaj." /></div>
            ) : (
              <ul className="kp-seasons">
                {seasons.map(s => (
                  <li key={s.tournament.id}>
                    <button type="button" className="kp-season" onClick={() => onOpenTournament(s.tournament.id)} title="Otevřít turnaj">
                      <div className="kp-season__main">
                        <div className="kp-season__name">{s.tournament.name}</div>
                        <div className="kp-season__meta">
                          {[s.tournament.date, getSportDef(s.tournament.sport).label, s.team.name !== c.name ? `jako ${s.team.name}` : null].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div className="kp-season__rec">
                        {s.played > 0 ? <>{s.w}V{allowDraws ? ` ${s.d}R` : ''} {s.l}P · {s.gf}:{s.ga}</> : '—'}
                        {s.topScorer && <small>{s.topScorer.name} {s.topScorer.goals}</small>}
                      </div>
                      <ResultBadge s={s} />
                      <ChevronRight size={16} className="kp-season__chev" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {tab === 'h2h' && (
          <Card padded={false} title="Vzájemné zápasy">
            {h2h.length === 0 ? (
              <div style={{ padding: '1.25rem' }}><Empty text="Zatím žádné odehrané zápasy." /></div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th className="is-left">Soupeř</th><th>Z</th><th>V</th>{allowDraws && <th>R</th>}<th>P</th><th>Skóre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h2h.map(r => (
                      <tr key={r.key}>
                        <td className="is-left">
                          <span style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontWeight: 600, minWidth: 0 }}>
                            <TeamLogo team={r} size={24} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                          </span>
                        </td>
                        <td className="is-muted">{r.played}</td>
                        <td>{r.w}</td>
                        {allowDraws && <td>{r.d}</td>}
                        <td>{r.l}</td>
                        <td className="is-strong">{r.gf}:{r.ga}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {tab === 'players' && (
          <div className="kp-players">
            <Card padded={false} title="Nejlepší hráči" >
              {topPlayers.length === 0 ? (
                <div style={{ padding: '1.25rem' }}><Empty text="Zatím bez statistik." /></div>
              ) : (
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th className="is-left">Hráč</th><th title="Turnajů">T</th><th>G</th>{showAssists && <th>A</th>}{showPim && <th>TM</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {topPlayers.map(p => (
                      <tr key={p.key}>
                        <td className="is-left" style={{ fontWeight: 600 }}>{p.name}</td>
                        <td className="is-muted">{p.tournaments}</td>
                        <td className="is-strong">{p.goals || '—'}</td>
                        {showAssists && <td>{p.assists || '—'}</td>}
                        {showPim && <td>{p.pim ? `${p.pim}′` : '—'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <Card padded={false} title={`Soupiska (${roster.length})`}>
              {roster.length === 0 ? (
                <div style={{ padding: '1.25rem' }}><Empty text="Soupiska není zadána." /></div>
              ) : (
                <ul className="tm-roster" style={{ padding: '.5rem 1rem' }}>
                  {roster.map(p => (
                    <li key={p.id}>
                      {p.avatar_url
                        ? <img className="tm-roster__avatar" src={p.avatar_url} alt="" />
                        : <span className="tm-roster__num">{p.number ?? ''}</span>}
                      <span className="tm-roster__name">{p.name}</span>
                      <RoleBadge role={p.role} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
