// Tabulka skupiny/ligy pro TV tabuli i TV režim — jeden kód, správné sloupce podle sportu
// (fotbal V/R/P, hokej V/VP/PP/P) a pásma postupu podle formátu (lib/zones.ts).
import type { Group } from '../../hooks/useGroups'
import type { Team } from '../../hooks/useTeams'
import type { StandingRow } from '../../lib/standings'
import { sportHasOvertime, type SportDef } from '../../lib/sports'
import type { StandingsZones } from '../../lib/zones'
import { TeamLogo } from '../ui/TeamLogo'
import { TV, TV_SIZE, TV_ZONE, fit, tvLogo } from './tvTheme'

interface Props {
  group: Group
  rows: StandingRow[]
  teamById: Map<string, Team>
  sportDef: SportDef
  zones: StandingsZones
  /** Zobrazit pravidlo shody bodů a legendu pásem (liga) */
  showNotes?: boolean
  /** Legenda pásem postupu (stačí u první skupiny) */
  showLegend?: boolean
  logoSize?: number
}

const TIEBREAK: Record<Group['tiebreaker'], string> = {
  h2h_first: 'shoda: vzáj. zápas → rozdíl skóre → vstřelené',
  score_then_h2h: 'shoda: rozdíl skóre → vstřelené → vzáj. zápas',
  score_first: 'shoda: rozdíl skóre → vstřelené',
}

export function TvGroupTable({ group, rows, teamById, sportDef, zones, showNotes = false, showLegend = true, logoSize = 30 }: Props) {
  const showOt = sportHasOvertime(sportDef)
  const allowDraws = sportDef.standings.allowDraws
  const heads = showOt ? ['Z', 'V', 'VP', 'PP', 'P'] : allowDraws ? ['Z', 'V', 'R', 'P'] : ['Z', 'V', 'P']
  // Hodně týmů → hustší řádky, ať se tabulka vejde bez useknutí
  const dense = rows.length > 8
  const pad = dense ? '.06rem .22rem' : '.14rem .26rem'
  const legend = showLegend && rows.length > 1 ? zones.legend : []
  const logo = tvLogo(dense ? Math.round(logoSize * 0.8) : logoSize)

  const cell = { textAlign: 'center' as const, padding: pad, fontSize: fit(TV_SIZE.label), color: TV.muted, fontVariantNumeric: 'tabular-nums' as const }

  return (
    <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '.25rem', paddingBottom: '.18rem', borderBottom: `1px solid ${TV.border}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '.5em', minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: fit(TV_SIZE.section), letterSpacing: '.1em', color: TV.accent, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {group.name}
          </span>
          {showNotes && (
            <span style={{ fontSize: fit(TV_SIZE.label), color: TV.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
              ({TIEBREAK[group.tiebreaker] ?? TIEBREAK.score_first})
            </span>
          )}
        </div>
        {legend.length > 0 && (
          <div style={{ display: 'flex', gap: '.8rem', marginTop: '.18rem', flexWrap: 'wrap' }}>
            {legend.map(l => (
              <span key={l.text} style={{ display: 'inline-flex', alignItems: 'center', gap: '.3em', fontSize: fit(TV_SIZE.label), color: TV_ZONE[l.kind].color, fontWeight: 600 }}>
                <i style={{ width: '.6em', height: '.6em', background: TV_ZONE[l.kind].color, borderRadius: 2, display: 'inline-block' }} />
                {l.short}
              </span>
            ))}
          </div>
        )}
      </div>
      <div>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', lineHeight: 1.15, fontSize: fit(TV_SIZE.label) }}>
          <thead>
            <tr>
              {['#', 'Tým', ...heads, 'Sk', 'B'].map((h, i) => (
                <th key={h} style={{ fontSize: fit(TV_SIZE.label), textTransform: 'uppercase', letterSpacing: '.08em', color: TV.muted, textAlign: i <= 1 ? 'left' : 'center', padding: '.1rem .26rem', fontWeight: 600, width: i === 1 ? '100%' : undefined }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const team = teamById.get(row.id)
              const z = zones.zoneAt(i)
              const zc = z ? TV_ZONE[z.kind] : null
              const numColor = zc ? zc.color : TV.muted
              const values = showOt
                ? [row.played, row.w - row.otw, row.otw, row.otl, row.l - row.otl]
                : allowDraws ? [row.played, row.w, row.d, row.l] : [row.played, row.w, row.l]
              return (
                <tr key={row.id} style={{ background: zc ? zc.bg : i === 0 ? TV.accentSoft : 'transparent' }}>
                  <td style={{ padding: pad, paddingLeft: '.2rem', textAlign: 'center', borderLeft: `3px solid ${zc ? zc.color : 'transparent'}` }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: fit(TV_SIZE.pts), color: numColor, lineHeight: 1 }}>{i + 1}</span>
                  </td>
                  <td style={{ padding: pad, maxWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem', minWidth: 0 }}>
                      {team && <span style={{ display: 'inline-flex', zoom: 'var(--tv-fit, 1)' as unknown as number }}><TeamLogo team={team} size={logo} /></span>}
                      <span style={{ fontSize: fit(TV_SIZE.body), fontWeight: zc || i === 0 ? 700 : 500, color: TV.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                        {team?.name ?? row.id}
                      </span>
                    </div>
                  </td>
                  {values.map((v, j) => <td key={j} style={cell}>{v}</td>)}
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>{row.gf}:{row.ga}</td>
                  <td style={{ textAlign: 'center', padding: pad }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: fit(TV_SIZE.pts), color: zc ? zc.color : i === 0 ? TV.accent : TV.text }}>{row.pts}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
