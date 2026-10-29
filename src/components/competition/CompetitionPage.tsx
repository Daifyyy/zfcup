import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Medal, Trophy } from 'lucide-react'
import { useCompetitionHistory } from '../../hooks/useCompetitions'
import { getSportDef, sportHasOvertime } from '../../lib/sports'
import { BRAND } from '../../lib/brand'
import { allTimePlayers, allTimeTable, computeRecords, summarizeEditions, type HistoryRecord, type PlayerHistoryRow } from '../../lib/history'
import { Tabs } from '../ui/Tabs'
import { Card, SectionHeader } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { TeamLogo } from '../ui/TeamLogo'
import Empty from '../ui/Empty'
import SiteFooter from '../layout/SiteFooter'

type CTab = 'editions' | 'table' | 'records' | 'players'

interface Props {
  slug: string
  onOpenTournament: (tournamentId: string) => void
  onHome: () => void
}

/** Veřejná stránka soutěže: síň vítězů, věčná tabulka, rekordy, hráči napříč ročníky. */
export default function CompetitionPage({ slug, onOpenTournament, onHome }: Props) {
  const h = useCompetitionHistory(slug)
  const [tab, setTab] = useState<CTab>('editions')
  const [includePlayoff, setIncludePlayoff] = useState(true)
  const [playerSort, setPlayerSort] = useState<'goals' | 'points' | 'pim' | 'editions'>('goals')
  const [profile, setProfile] = useState<PlayerHistoryRow | null>(null)
  const sport = getSportDef(h.competition?.sport)
  const SportIcon = sport.Icon

  const summaries = useMemo(() => summarizeEditions(h, sport), [h, sport])
  const table = useMemo(() => allTimeTable(h, sport, summaries, { includePlayoff }), [h, sport, summaries, includePlayoff])
  const records = useMemo(() => computeRecords(h, allTimeTable(h, sport, summaries)), [h, sport, summaries])
  const players = useMemo(() => allTimePlayers(h), [h])

  if (h.loading) {
    return (
      <div className="lp" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }
  if (!h.available || h.notFound || !h.competition) {
    return (
      <div className="lp">
        <div className="lp-wrap" style={{ padding: '4rem 1rem' }}>
          <Empty text={!h.available ? 'Soutěže zatím nejsou na této platformě aktivní.' : 'Soutěž nebyla nalezena.'} />
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button type="button" className="ui-btn ui-btn--secondary" onClick={onHome}><ChevronLeft size={16} />Zpět na přehled</button>
          </div>
        </div>
      </div>
    )
  }

  const c = h.competition
  const finished = summaries.filter(s => s.champion)
  const latest = [...summaries].reverse().find(s => s.champion)
  const totalMatches = summaries.reduce((s, e) => s + e.matchesPlayed, 0)
  const totalGoals = summaries.reduce((s, e) => s + e.goals, 0)
  const showOt = sportHasOvertime(sport)
  const allowDraws = sport.standings.allowDraws
  const sortedPlayers = [...players]
    .filter(p => playerSort === 'editions' ? true : p[playerSort] > 0)
    .sort((a, b) => playerSort === 'editions'
      ? b.editions.length - a.editions.length || b.goals - a.goals
      : b[playerSort] - a[playerSort] || b.goals - a.goals || a.name.localeCompare(b.name, 'cs'))
    .slice(0, 100)
  const showAssists = players.some(p => p.assists > 0)
  const showPim = players.some(p => p.pim > 0)

  return (
    <div className="lp">
      {/* ── Hlavička soutěže ── */}
      <header className="hdr">
        <div className="hdr__top">
          <div className="hdr__inner">
            <button type="button" onClick={onHome} className="hdr-back"><ChevronLeft size={18} /><span className="hide-mobile">{BRAND.name}</span></button>
            <div className="hdr__crest">{c.logo_url ? <img src={c.logo_url} alt="" /> : <SportIcon size={22} />}</div>
            <div className="hdr__title">
              <h1 className="hdr__name">{c.name}</h1>
              <div className="hdr__meta">{sport.label} · {summaries.length} {summaries.length === 1 ? 'ročník' : summaries.length < 5 ? 'ročníky' : 'ročníků'}</div>
            </div>
          </div>
        </div>
        <div className="hdr__nav">
          <div className="hdr__inner">
            <Tabs variant="chrome" value={tab} onChange={setTab} ariaLabel="Sekce soutěže" items={[
              { value: 'editions', label: 'Ročníky' },
              { value: 'table', label: 'Věčná tabulka' },
              { value: 'records', label: 'Rekordy' },
              { value: 'players', label: 'Hráči' },
            ]} />
          </div>
        </div>
      </header>

      <main className="lp-wrap cp-main">
        {/* Souhrn */}
        <div className="ov-kpis" style={{ marginBottom: '1.25rem' }}>
          <div className="ov-kpi"><b>{summaries.length}</b><span>Ročníků</span></div>
          <div className="ov-kpi"><b>{table.length}</b><span>Klubů</span></div>
          <div className="ov-kpi"><b>{totalMatches}</b><span>Odehraných zápasů</span></div>
          <div className="ov-kpi"><b>{totalGoals}</b><span>Gólů</span></div>
        </div>

        {tab === 'editions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {latest?.champion && (
              <div className="brk-champion">
                <Trophy size={28} />
                <TeamLogo team={latest.champion} size={44} />
                <div>
                  <div className="brk-champion__label">Úřadující vítěz · {latest.edition}. ročník</div>
                  <div className="brk-champion__name">{latest.champion.name}</div>
                </div>
              </div>
            )}
            <SectionHeader title="Síň vítězů" subtitle={`${finished.length} ${finished.length === 1 ? 'dokončený ročník' : 'dokončených ročníků'}`} />
            <div className="cp-editions">
              {[...summaries].reverse().map(s => (
                <button key={s.tournament.id} type="button" className="cp-edition" onClick={() => onOpenTournament(s.tournament.id)}>
                  <div className="cp-edition__no">
                    <b>{s.edition}.</b><span>ročník</span>
                  </div>
                  <div className="cp-edition__body">
                    <div className="cp-edition__name">
                      {s.tournament.name}
                      {s.tournament.season_label && <small>{s.tournament.season_label}</small>}
                    </div>
                    {s.champion ? (
                      <div className="cp-podium">
                        <span className="cp-podium__1"><Trophy size={14} />{s.champion.name}</span>
                        {s.runnerUp && <span><Medal size={14} />{s.runnerUp.name}</span>}
                        {s.third && <span><Medal size={14} />{s.third.name}</span>}
                        {s.finalScore && <span className="cp-podium__score">finále {s.finalScore}</span>}
                      </div>
                    ) : (
                      <div style={{ marginTop: '.35rem' }}>
                        <Badge tone={s.status === 'in_progress' ? 'brand' : 'neutral'}>{s.status === 'in_progress' ? `Probíhá · ${s.matchesPlayed}/${s.matchesTotal} zápasů` : 'Připravuje se'}</Badge>
                      </div>
                    )}
                    <div className="cp-edition__meta">{s.teamCount} týmů · {s.matchesPlayed} zápasů · {s.goals} gólů{s.tournament.venue ? ` · ${s.tournament.venue}` : ''}</div>
                  </div>
                  <ChevronRight size={18} className="lp-tcard__chev" />
                </button>
              ))}
            </div>
            {summaries.length === 0 && <Empty text="Soutěž zatím nemá žádný ročník." />}
          </div>
        )}

        {tab === 'table' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <SectionHeader
              title="Věčná tabulka"
              subtitle="Součet všech ročníků — body podle pravidel sportu"
              actions={
                <label className="chk-item" style={{ fontSize: '.82rem' }}>
                  <input type="checkbox" checked={includePlayoff} onChange={e => setIncludePlayoff(e.target.checked)} />
                  <span>Včetně play-off</span>
                </label>
              }
            />
            {table.length === 0 ? <Empty text="Zatím žádné odehrané zápasy." /> : (
              <Card padded={false}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="ui-table standings-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th className="is-left">Klub</th>
                        <th title="Účasti">Úč.</th>
                        <th title="Tituly"><Trophy size={13} /></th>
                        <th>Z</th>
                        <th>V</th>
                        {showOt && <th>VP</th>}
                        {allowDraws && <th>R</th>}
                        {showOt && <th>PP</th>}
                        <th>P</th>
                        <th>Skóre</th>
                        <th>B</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.map((r, i) => {
                        // Profil klubu (migrace 13: klub má slug)
                        const clubSlug = r.key.startsWith('club:') ? (h.clubs.find(c => c.id === r.key.slice(5)) as { slug?: string | null } | undefined)?.slug : null
                        const name = (
                          <>
                            <TeamLogo team={{ name: r.name, color: r.color, logo_url: r.logo_url }} size={28} />
                            <span className="standings-name" style={{ fontWeight: 600 }}>{r.name}</span>
                          </>
                        )
                        return (
                        <tr key={r.key}>
                          <td className="is-muted" style={{ fontWeight: 700 }}>{i + 1}</td>
                          <td className="is-left">
                            {clubSlug ? (
                              <a className="ui-teamlink" href={`/k/${clubSlug}`} title="Profil klubu" style={{ gap: '.55rem' }}>{name}</a>
                            ) : (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '.55rem' }}>{name}</span>
                            )}
                          </td>
                          <td className="is-muted">{r.editions}</td>
                          <td style={{ fontWeight: 700, color: r.titles ? 'var(--gold)' : 'var(--ink-faint)' }}>{r.titles || '–'}</td>
                          <td className="is-muted">{r.played}</td>
                          <td className="is-muted">{showOt ? r.w - r.otw : r.w}</td>
                          {showOt && <td className="is-muted">{r.otw}</td>}
                          {allowDraws && <td className="is-muted">{r.d}</td>}
                          {showOt && <td className="is-muted">{r.otl}</td>}
                          <td className="is-muted">{showOt ? r.l - r.otl : r.l}</td>
                          <td className="is-muted">{r.gf}:{r.ga}</td>
                          <td><span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-pts)', fontWeight: 800 }}>{r.pts}</span></td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {tab === 'records' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <SectionHeader title="Rekordy soutěže" />
            <div className="cp-records">
              <RecordTile label="Nejvyšší výhra" rec={records.biggestWin} unit="rozdíl" />
              <RecordTile label="Nejvíc gólů v zápase" rec={records.highestScoring} unit="gólů" />
              <RecordTile label="Nejvíc gólů týmu v ročníku" rec={records.teamGoalsInEdition} unit="gólů" />
              <RecordTile label="Nejvíc gólů hráče v ročníku" rec={records.playerGoalsInEdition} unit="gólů" />
              <RecordTile label="Nejvíc gólů hráče v zápase" rec={records.playerGoalsInMatch} unit="gólů" />
              <RecordTile label="Nejdelší série bez porážky" rec={records.unbeatenStreak} unit="zápasů" />
              <RecordTile label="Nejdelší vítězná série" rec={records.winStreak} unit="zápasů" />
              <RecordTile label="Nejvíc titulů" rec={records.mostTitles} unit="titulů" />
            </div>
          </div>
        )}

        {tab === 'players' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <SectionHeader title="Hráči napříč ročníky" subtitle="Klikni na hráče pro jeho historii" actions={
              <div className="ui-seg">
                {([['goals', 'Góly'], ...(showAssists ? [['points', 'Body']] : []), ...(showPim ? [['pim', 'Tresty']] : []), ['editions', 'Účasti']] as [typeof playerSort, string][]).map(([v, l]) => (
                  <button key={v} type="button" className={playerSort === v ? 'ui-seg__btn ui-seg__btn--active' : 'ui-seg__btn'} onClick={() => setPlayerSort(v)}>{l}</button>
                ))}
              </div>
            } />
            {sortedPlayers.length === 0 ? <Empty text="Zatím žádné statistiky hráčů." /> : (
              <Card padded={false}>
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th className="is-left">Hráč</th>
                      <th>Ročníky</th>
                      <th>G</th>
                      {showAssists && <th>A</th>}
                      {showAssists && <th>B</th>}
                      {showPim && <th>TM</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPlayers.map((p, i) => (
                      <tr key={p.key} onClick={() => setProfile(p)} style={{ cursor: 'pointer' }}>
                        <td className="is-muted" style={{ fontWeight: 700 }}>{i + 1}</td>
                        <td className="is-left">
                          <div className="st-player">
                            {p.avatar_url && <img className="st-player__avatar" src={p.avatar_url} alt="" />}
                            <div style={{ minWidth: 0 }}>
                              <div className="st-player__name">{p.name}</div>
                              <div className="st-player__team">{p.clubs.join(' · ')}</div>
                            </div>
                          </div>
                        </td>
                        <td className="is-muted">{p.editions.length}</td>
                        <td className="is-strong">{p.goals}</td>
                        {showAssists && <td className="is-muted">{p.assists}</td>}
                        {showAssists && <td className="is-strong">{p.points}</td>}
                        {showPim && <td className="is-muted">{p.pim}′</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        )}
      </main>
      <SiteFooter />

      {profile && (
        <div className="tm-drawer" onClick={() => setProfile(null)}>
          <aside className="tm-drawer__panel" onClick={e => e.stopPropagation()} role="dialog" aria-label={profile.name}>
            <header className="tm-drawer__head" style={{ borderBottomColor: 'var(--brand)' }}>
              {profile.avatar_url && <img src={profile.avatar_url} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tm-drawer__name">{profile.name}</div>
                <div className="tm-drawer__meta">{profile.clubs.join(' · ')}</div>
              </div>
              <button type="button" className="tm-drawer__close" onClick={() => setProfile(null)} aria-label="Zavřít">×</button>
            </header>
            <div className="tm-drawer__kpis">
              <div><b>{profile.editions.length}</b><span>Ročníky</span></div>
              <div><b>{profile.goals}</b><span>Góly</span></div>
              <div><b>{profile.assists}</b><span>Asistence</span></div>
              <div><b>{profile.points}</b><span>Body</span></div>
              <div><b>{profile.pim}</b><span>Tresty</span></div>
            </div>
            <section className="tm-drawer__sec">
              <h3>Po ročnících</h3>
              <table className="ui-table ui-card" style={{ display: 'table' }}>
                <thead><tr><th className="is-left">Ročník</th><th className="is-left">Tým</th><th>G</th><th>A</th><th>TM</th></tr></thead>
                <tbody>
                  {profile.byEdition.map(e => (
                    <tr key={e.edition}>
                      <td className="is-left" style={{ fontWeight: 700 }}>{e.edition}.</td>
                      <td className="is-left">{e.team}</td>
                      <td className="is-strong">{e.goals}</td>
                      <td>{e.assists}</td>
                      <td>{e.pim ? `${e.pim}′` : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </aside>
        </div>
      )}
    </div>
  )
}

function RecordTile({ label, rec, unit }: { label: string; rec?: HistoryRecord; unit: string }) {
  return (
    <div className="cp-record">
      <div className="cp-record__label">{label}</div>
      {rec ? (
        <>
          <div className="cp-record__value">{rec.value}<small>{unit}</small></div>
          <div className="cp-record__detail">
            {rec.kind === 'match'
              ? <>{rec.home} {rec.homeScore}:{rec.awayScore} {rec.away}</>
              : <>{rec.holder}{rec.detail ? ` · ${rec.detail}` : ''}</>}
            {rec.edition !== undefined && <span> · {rec.edition}. ročník</span>}
          </div>
        </>
      ) : <div className="cp-record__detail">Zatím bez záznamu</div>}
    </div>
  )
}
