import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { calcGroupStandings } from '../../lib/standings'
import type { Sponsor } from '../../hooks/useSponsors'
import { ShareTableDialog } from '../share/lazy'
import type { Group } from '../../hooks/useGroups'
import type { Match } from '../../hooks/useMatches'
import type { Team } from '../../hooks/useTeams'
import type { Tournament } from '../../hooks/useTournament'
import Empty from '../ui/Empty'
import { TeamLogo } from '../ui/TeamLogo'
import { Card, SectionHeader } from '../ui/Card'
import { standingsZones } from '../../lib/zones'
import { getSportDef, sportHasOvertime } from '../../lib/sports'
import { useDetail } from '../../lib/TournamentDataContext'
import { tournamentUrl } from '../../lib/share'

interface Props {
  groups: Group[]
  matches: Match[]
  teams: Team[]
  tournament: Tournament | null
  sponsors?: Sponsor[]
  showToast?: (msg: string) => void
}

const ZONE_COLOR = { a: 'var(--win)', b: 'var(--warn)' } as const

type FormResult = 'W' | 'D' | 'L'

/** Forma: posledních 5 odehraných zápasů týmu ve skupině (nejnovější vpravo). */
function teamForm(teamId: string, groupMatches: Match[]): FormResult[] {
  return groupMatches
    .filter(m => m.played && (m.home_id === teamId || m.away_id === teamId))
    .sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))
    .slice(-5)
    .map(m => {
      const own = m.home_id === teamId ? m.home_score : m.away_score
      const opp = m.home_id === teamId ? m.away_score : m.home_score
      return own > opp ? 'W' : own < opp ? 'L' : 'D'
    })
}

const FORM_LABEL: Record<FormResult, string> = { W: 'V', D: 'R', L: 'P' }

function tiebreakerText(tb: Group['tiebreaker']): string {
  if (tb === 'h2h_first') return 'vzájemný zápas → rozdíl skóre → vstřelené'
  if (tb === 'score_then_h2h') return 'rozdíl skóre → vstřelené → vzájemný zápas'
  return 'rozdíl skóre → vstřelené'
}

export default function Standings({ groups, matches, teams, tournament, sponsors = [], showToast }: Props) {
  const [shareGroupId, setShareGroupId] = useState<string | null>(null)
  const { openTeam } = useDetail()
  const teamById = new Map(teams.map(t => [t.id, t]))
  const sportDef = getSportDef(tournament?.sport)
  const allowDraws = sportDef.standings.allowDraws
  // Hokej: výhry/prohry po prodloužení zvlášť (V / VP / PP / P)
  const showOt = sportHasOvertime(sportDef)

  const zones = standingsZones(tournament)

  if (!groups.length) return <Empty text="Tabulky se zobrazí po rozlosování skupin." />

  const headers = showOt
    ? ['Z', 'V', 'VP', 'PP', 'P', 'Skóre', '+/−', 'B']
    : allowDraws
      ? ['Z', 'V', 'R', 'P', 'Skóre', '+/−', 'B']
      : ['Z', 'V', 'P', 'Skóre', '+/−', 'B']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionHeader title="Tabulka" />

      {groups.map(group => {
        const rows = calcGroupStandings(group, matches, sportDef)
        const groupMatches = matches.filter(m => m.group_id === group.id)
        const playedCount = groupMatches.filter(m => m.played).length

        return (
          <Card
            key={group.id}
            padded={false}
            title={group.name}
            actions={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem' }}>
                <span className="hide-mobile" style={{ fontSize: '.74rem', color: 'var(--ink-muted)' }}>{group.team_ids.length} týmů · {playedCount}/{groupMatches.length} odehráno</span>
                <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" title="Sdílet grafiku tabulky" onClick={() => setShareGroupId(group.id)}>
                  <Share2 size={14} />Sdílet
                </button>
              </span>
            }
          >
            <div style={{ overflowX: 'auto' }}>
              <table className="ui-table standings-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>#</th>
                    <th className="is-left">Tým</th>
                    {headers.map(h => <th key={h} style={h === 'B' ? { width: 56 } : undefined}>{h}</th>)}
                    <th className="hide-mobile" style={{ width: 120 }}>Forma</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const team = teamById.get(row.id)
                    const z = zones.zoneAt(i)
                    const zone = z ? { color: ZONE_COLOR[z.kind], label: z.label } : null
                    const gdColor = row.gd > 0 ? 'var(--win)' : row.gd < 0 ? 'var(--loss)' : 'var(--ink-muted)'
                    const cells = showOt
                      ? [row.played, row.w - row.otw, row.otw, row.otl, row.l - row.otl]
                      : allowDraws ? [row.played, row.w, row.d, row.l] : [row.played, row.w, row.l]
                    const form = teamForm(row.id, groupMatches)
                    return (
                      <tr key={row.id}>
                        <td style={{ boxShadow: zone ? `inset 4px 0 0 ${zone.color}` : undefined, fontWeight: 700 }}>
                          {i + 1}
                        </td>
                        <td className="is-left is-name">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                            <button type="button" className="ui-teamlink" onClick={() => openTeam(row.id)} title="Detail týmu">
                              {team && <TeamLogo team={team} size={30} />}
                              <span className="standings-name" style={{ fontWeight: 600 }}>{team?.name ?? row.id}</span>
                            </button>
                            {zone && zones.showLabel(i, rows.length) && (
                              <span className="std-zone hide-mobile" style={{ color: zone.color, borderColor: zone.color }}>{zone.label}</span>
                            )}
                          </div>
                        </td>
                        {cells.map((v, j) => <td key={j} className="is-muted">{v}</td>)}
                        <td className="is-muted">{row.gf}:{row.ga}</td>
                        <td style={{ color: gdColor, fontWeight: 600 }}>{row.gd > 0 ? '+' : ''}{row.gd}</td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-pts)', fontWeight: 800 }}>{row.pts}</span>
                        </td>
                        <td className="hide-mobile">
                          <div className="std-form">
                            {form.map((r, k) => <span key={k} className={`std-form__dot std-form__dot--${r}`}>{FORM_LABEL[r]}</span>)}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="std-foot">
              {rows.length > 1 && zones.legend.map(l => (
                <span key={l.text}><i style={{ background: ZONE_COLOR[l.kind] }} />{l.text}</span>
              ))}
              {showOt && (
                <span>V výhra · VP výhra po prodl./nájezdech · PP prohra po prodl./nájezdech · P prohra ({sportDef.standings.winPts}-{sportDef.standings.otWinPts}-{sportDef.standings.otLossPts}-{sportDef.standings.lossPts} b.)</span>
              )}
              <span className="std-foot__tb">Shoda bodů: {tiebreakerText(group.tiebreaker)}</span>
            </div>
          </Card>
        )
      })}

      {shareGroupId && (() => {
        const g = groups.find(x => x.id === shareGroupId)
        if (!g) return null
        return (
          <ShareTableDialog
          url={tournament ? tournamentUrl(tournament.id) : undefined}
            tournament={tournament}
            sponsors={sponsors}
            groupName={g.name}
            rows={calcGroupStandings(g, matches, sportDef)}
            teams={teams}
            allowDraws={allowDraws}
            onClose={() => setShareGroupId(null)}
            showToast={showToast}
          />
        )
      })()}
    </div>
  )
}
