import { useMemo } from 'react'
import { X } from 'lucide-react'
import { TeamLogo } from '../ui/TeamLogo'
import { CardChip } from '../ui/CardChip'
import { MatchRow } from '../ui/MatchRow'
import { getMatchState } from '../../lib/matchState'
import { formatDateShort } from '../../lib/dates'
import { getSportDef } from '../../lib/sports'
import { useTournamentData, useDetail } from '../../lib/TournamentDataContext'
import { EMPTY_STATS, fixtureId, playerStats, rosterOf, statFlags, teamFixtures, teamRecord, type PlayerStats } from '../../lib/details'

export function playersLabel(n: number): string {
  return `${n} ${n === 1 ? 'hráč' : n >= 2 && n <= 4 ? 'hráči' : 'hráčů'}`
}

export function RoleBadge({ role }: { role: string | null }) {
  const c = <span className="tm-role" title="Kapitán">C</span>
  const g = <span className="tm-role tm-role--gk" title="Brankář">B</span>
  if (role === 'captain') return c
  if (role === 'goalkeeper') return g
  if (role === 'both') return <>{c}{g}</>
  return null
}

export function StatBadges({ s, showAssists, showCards, showPenalties }: { s: PlayerStats; showAssists: boolean; showCards: boolean; showPenalties: boolean }) {
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

/** Detail týmu: bilance, zápasy (skupiny i play-off), soupiska se statistikami. */
export default function TeamDetailDrawer({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const data = useTournamentData()
  const { openMatch } = useDetail()
  const { tournament, teams, players } = data
  const flags = statFlags(data)
  const allowDraws = getSportDef(tournament.sport).standings.allowDraws
  const teamById = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams])
  const stats = useMemo(() => playerStats(data, flags), [data, flags.assists, flags.cards, flags.penalties])
  const fixtures = useMemo(() => teamFixtures(data, teamId), [data, teamId])

  const team = teamById.get(teamId)
  if (!team) {
    return (
      <div className="tm-drawer" onClick={onClose}>
        <aside className="tm-drawer__panel" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Tým nenalezen">
          <header className="tm-drawer__head md-head">
            <div style={{ flex: 1 }} className="tm-drawer__name">Tým nenalezen</div>
            <button type="button" className="tm-drawer__close" onClick={onClose} aria-label="Zavřít"><X size={20} /></button>
          </header>
          <div className="tm-drawer__sec">Odkaz je neplatný nebo byl tým smazán.</div>
        </aside>
      </div>
    )
  }
  const r = teamRecord(fixtures, teamId)
  const roster = rosterOf(players, teamId)

  return (
    <div className="tm-drawer" onClick={onClose}>
      <aside className="tm-drawer__panel" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={team.name}>
        <header className="tm-drawer__head" style={{ borderBottomColor: team.color }}>
          <TeamLogo team={team} size={64} radius={8} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tm-drawer__name">{team.name}</div>
            <div className="tm-drawer__meta">{playersLabel(roster.length)}</div>
          </div>
          <button type="button" className="tm-drawer__close" onClick={onClose} aria-label="Zavřít"><X size={20} /></button>
        </header>

        <div className="tm-drawer__kpis" style={allowDraws ? undefined : { gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div><b>{r.played}</b><span>Zápasy</span></div>
          <div><b>{r.w}</b><span>Výhry</span></div>
          {allowDraws && <div><b>{r.d}</b><span>Remízy</span></div>}
          <div><b>{r.l}</b><span>Prohry</span></div>
          <div><b>{r.gf}:{r.ga}</b><span>Skóre</span></div>
        </div>

        {fixtures.length > 0 && (
          <section className="tm-drawer__sec">
            <h3>Zápasy</h3>
            <div className="ui-card">
              {fixtures.map(f => (
                <MatchRow
                  key={f.key}
                  home={f.home_id ? teamById.get(f.home_id) : undefined}
                  away={f.away_id ? teamById.get(f.away_id) : undefined}
                  homeScore={f.home_score}
                  awayScore={f.away_score}
                  state={getMatchState(f, tournament)}
                  decidedIn={f.decided_in}
                  meta={
                    <div>
                      {f.match_date ? `${formatDateShort(f.match_date)} ${f.scheduled_time ?? ''}` : (f.scheduled_time || '—')}
                      <div className="ui-match__label">{f.label}</div>
                    </div>
                  }
                  logoSize={24}
                  onClick={() => openMatch(fixtureId(f))}
                />
              ))}
            </div>
          </section>
        )}

        <section className="tm-drawer__sec">
          <h3>Soupiska</h3>
          {roster.length === 0 ? (
            <div className="tm-card__empty">Soupiska není zadána.</div>
          ) : (
            <table className="ui-table ui-card" style={{ display: 'table' }}>
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th className="is-left">Hráč</th>
                  <th>G</th>
                  {flags.assists && <th>A</th>}
                  {flags.penalties && <th>TM</th>}
                  {flags.cards && <th>Karty</th>}
                </tr>
              </thead>
              <tbody>
                {roster.map(p => {
                  const s = stats[p.id] ?? EMPTY_STATS
                  return (
                    <tr key={p.id}>
                      <td className="is-muted">{p.number ?? '—'}</td>
                      <td className="is-left">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem', minWidth: 0 }}>
                          {p.avatar_url && <img className="tm-roster__avatar" src={p.avatar_url} alt="" />}
                          <span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{p.name}</span>
                          <RoleBadge role={p.role} />
                        </span>
                      </td>
                      <td className="is-strong">{s.goals || '—'}</td>
                      {flags.assists && <td>{s.assists || '—'}</td>}
                      {flags.penalties && <td>{s.pim ? `${s.pim}′` : '—'}</td>}
                      {flags.cards && (
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
          )}
        </section>
      </aside>
    </div>
  )
}
