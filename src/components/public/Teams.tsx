import { useEffect, useState } from 'react'
import { ChevronRight, X } from 'lucide-react'
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
import { CardChip } from '../ui/CardChip'
import { MatchRow } from '../ui/MatchRow'
import { getMatchState } from '../../lib/matchState'

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

function RoleBadge({ role }: { role: string | null }) {
  const c = <span className="tm-role" title="Kapitán">C</span>
  const g = <span className="tm-role tm-role--gk" title="Brankář">B</span>
  if (role === 'captain') return c
  if (role === 'goalkeeper') return g
  if (role === 'both') return <>{c}{g}</>
  return null
}

interface PlayerStats {
  goals: number
  assists: number
  cards?: { yellow: number; red: number; yellowRed: number }
  pim: number
}

function StatBadges({ s, showAssists, showCards, showPenalties }: { s: PlayerStats; showAssists: boolean; showCards: boolean; showPenalties: boolean }) {
  return (
    <span className="tm-stats">
      {s.goals > 0 && <span className="tm-stat" title="Góly">{s.goals} G</span>}
      {showAssists && s.assists > 0 && <span className="tm-stat tm-stat--a" title="Asistence">{s.assists} A</span>}
      {showCards && s.cards && (
        <>
          {s.cards.yellow > 0 && <CardChip kind="yellow" count={s.cards.yellow > 1 ? s.cards.yellow : undefined} />}
          {s.cards.yellowRed > 0 && <CardChip kind="yellow_red" />}
          {s.cards.red > 0 && <CardChip kind="red" />}
        </>
      )}
      {showPenalties && s.pim > 0 && <span className="tm-stat tm-stat--pim" title="Trestné minuty">{s.pim}′</span>}
    </span>
  )
}

export default function Teams({ teams, players, goals, bracketGoals = [], assists = [], bracketAssists = [], cards = [], bracketCards = [], penalties = [], bracketPenalties = [], tournament, matches = [] }: Props) {
  const [detailId, setDetailId] = useState<string | null>(null)

  useEffect(() => {
    if (!detailId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetailId(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailId])

  if (!teams.length) return <Empty text="Týmy budou zveřejněny po uzávěrce přihlášek." />

  const showAssists = tournament?.assists_enabled ?? false
  const showCards = tournament?.cards_enabled ?? false
  const showPenalties = tournament?.penalty_minutes_enabled ?? false
  const teamById = new Map(teams.map(t => [t.id, t]))

  const stats: Record<string, PlayerStats> = {}
  const st = (id: string) => (stats[id] ??= { goals: 0, assists: 0, pim: 0 })
  for (const g of [...goals, ...bracketGoals]) st(g.player_id).goals += g.count
  if (showAssists) for (const a of [...assists, ...bracketAssists]) st(a.player_id).assists += a.count
  if (showCards) {
    for (const c of [...cards, ...bracketCards]) {
      const s = st(c.player_id)
      s.cards ??= { yellow: 0, red: 0, yellowRed: 0 }
      if (c.type === 'yellow') s.cards.yellow++
      if (c.type === 'red') s.cards.red++
      if (c.type === 'yellow_red') s.cards.yellowRed++
    }
  }
  if (showPenalties) for (const p of [...penalties, ...bracketPenalties]) st(p.player_id).pim += p.minutes
  const EMPTY: PlayerStats = { goals: 0, assists: 0, pim: 0 }

  function record(teamId: string) {
    let w = 0, d = 0, l = 0, gf = 0, ga = 0
    for (const m of matches) {
      if (!m.played || (m.home_id !== teamId && m.away_id !== teamId)) continue
      const own = m.home_id === teamId ? m.home_score : m.away_score
      const opp = m.home_id === teamId ? m.away_score : m.home_score
      gf += own; ga += opp
      if (own > opp) w++; else if (own < opp) l++; else d++
    }
    return { w, d, l, gf, ga, played: w + d + l }
  }

  const rosterOf = (teamId: string) => players
    .filter(p => p.team_id === teamId)
    .sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, 'cs'))

  const detail = detailId ? teamById.get(detailId) : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionHeader title="Týmy" subtitle={`${teams.length} týmů · ${players.length} hráčů`} />

      <div className="tm-grid">
        {teams.map(t => {
          const roster = rosterOf(t.id)
          const r = record(t.id)
          return (
            <article key={t.id} className="tm-card" style={{ borderTopColor: t.color }}>
              <button type="button" className="tm-card__head" onClick={() => setDetailId(t.id)} title="Detail týmu">
                <TeamLogo team={t} size={52} radius={6} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tm-card__name">{t.name}</div>
                  <div className="tm-card__meta">
                    {roster.length} hráčů{r.played > 0 && <> · {r.w}V {r.d}R {r.l}P</>}
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
                      <StatBadges s={stats[p.id] ?? EMPTY} showAssists={showAssists} showCards={showCards} showPenalties={showPenalties} />
                    </li>
                  ))}
                </ul>
              )}
            </article>
          )
        })}
      </div>

      {detail && (() => {
        const r = record(detail.id)
        const roster = rosterOf(detail.id)
        const teamMatches = matches
          .filter(m => m.home_id === detail.id || m.away_id === detail.id)
          .sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))
        return (
          <div className="tm-drawer" onClick={() => setDetailId(null)}>
            <aside className="tm-drawer__panel" onClick={e => e.stopPropagation()} role="dialog" aria-label={detail.name}>
              <header className="tm-drawer__head" style={{ borderBottomColor: detail.color }}>
                <TeamLogo team={detail} size={64} radius={8} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tm-drawer__name">{detail.name}</div>
                  <div className="tm-drawer__meta">{roster.length} hráčů</div>
                </div>
                <button type="button" className="tm-drawer__close" onClick={() => setDetailId(null)} aria-label="Zavřít"><X size={20} /></button>
              </header>

              <div className="tm-drawer__kpis">
                <div><b>{r.played}</b><span>Zápasy</span></div>
                <div><b>{r.w}</b><span>Výhry</span></div>
                <div><b>{r.d}</b><span>Remízy</span></div>
                <div><b>{r.l}</b><span>Prohry</span></div>
                <div><b>{r.gf}:{r.ga}</b><span>Skóre</span></div>
              </div>

              {teamMatches.length > 0 && (
                <section className="tm-drawer__sec">
                  <h3>Zápasy</h3>
                  <div className="ui-card">
                    {teamMatches.map(m => (
                      <MatchRow
                        key={m.id}
                        home={teamById.get(m.home_id)}
                        away={teamById.get(m.away_id)}
                        homeScore={m.home_score}
                        awayScore={m.away_score}
                        state={getMatchState(m, tournament)}
                        decidedIn={m.decided_in}
                        meta={m.scheduled_time}
                        logoSize={24}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section className="tm-drawer__sec">
                <h3>Soupiska</h3>
                <table className="ui-table ui-card" style={{ display: 'table' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}>#</th>
                      <th className="is-left">Hráč</th>
                      <th>G</th>
                      {showAssists && <th>A</th>}
                      {showPenalties && <th>TM</th>}
                      {showCards && <th>Karty</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map(p => {
                      const s = stats[p.id] ?? EMPTY
                      return (
                        <tr key={p.id}>
                          <td className="is-muted">{p.number ?? '—'}</td>
                          <td className="is-left">
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem' }}>
                              {p.avatar_url && <img className="tm-roster__avatar" src={p.avatar_url} alt="" />}
                              <span style={{ fontWeight: 600 }}>{p.name}</span>
                              <RoleBadge role={p.role} />
                            </span>
                          </td>
                          <td className="is-strong">{s.goals || '—'}</td>
                          {showAssists && <td>{s.assists || '—'}</td>}
                          {showPenalties && <td>{s.pim ? `${s.pim}′` : '—'}</td>}
                          {showCards && (
                            <td>
                              <span style={{ display: 'inline-flex', gap: '.3rem' }}>
                                {s.cards?.yellow ? <CardChip kind="yellow" count={s.cards.yellow} /> : null}
                                {s.cards?.yellowRed ? <CardChip kind="yellow_red" /> : null}
                                {s.cards?.red ? <CardChip kind="red" /> : null}
                                {!s.cards && '—'}
                              </span>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </section>
            </aside>
          </div>
        )
      })()}
    </div>
  )
}
