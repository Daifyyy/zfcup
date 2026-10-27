// Postupová pásma v tabulce podle formátu (web, TV tabule, kiosk). Čisté funkce.
import { getAdvancingCutoffs } from './formats'
import type { Tournament } from '../hooks/useTournament'

/** a = přímý postup (semifinále / play-off), b = druhé pásmo (čtvrtfinále / útěcha) */
export type ZoneKind = 'a' | 'b'
export interface Zone { kind: ZoneKind; label: string }
export interface ZoneLegend { kind: ZoneKind; text: string; short: string }

export interface StandingsZones {
  zoneAt: (index: number) => Zone | null
  legend: ZoneLegend[]
  /** Zobrazit štítek pásma u řádku (u jediného postupujícího v malé skupině jen u 1.) */
  showLabel: (index: number, rows: number) => boolean
}

export function standingsZones(tournament: Pick<Tournament, 'format' | 'format_id' | 'advancing_per_group'> | null | undefined): StandingsZones {
  const c = tournament ? getAdvancingCutoffs(tournament.format_id ?? '', tournament as Tournament) : { advancing: 1 }
  const { sfCutoff, qfCutoff } = c
  const advancing = c.advancing ?? 1
  const consolation = c.consolation ?? 0

  // Liga bez play-off: o vítězi rozhoduje tabulka
  if (Object.keys(c).length === 0) {
    return {
      zoneAt: i => (i === 0 ? { kind: 'a', label: 'Vítěz' } : null),
      legend: [{ kind: 'a', text: '1. místo = vítěz ligy', short: '1. → vítěz ligy' }],
      showLabel: i => i === 0,
    }
  }

  const zoneAt = (i: number): Zone | null => {
    if (sfCutoff !== undefined) {
      if (i < sfCutoff) return { kind: 'a', label: 'SF' }
      if (qfCutoff !== undefined && i < qfCutoff) return { kind: 'b', label: 'QF' }
      return null
    }
    if (advancing > 0 && i < advancing) return { kind: 'a', label: i === 0 ? 'Vítěz' : 'Play-off' }
    if (consolation > 0 && i < advancing + consolation) return { kind: 'b', label: 'Útěcha' }
    return null
  }

  const legend: ZoneLegend[] = []
  if (sfCutoff !== undefined) {
    legend.push({ kind: 'a', text: `1–${sfCutoff} postup do semifinále`, short: `1–${sfCutoff} → semifinále` })
    if (qfCutoff !== undefined) legend.push({ kind: 'b', text: `${sfCutoff + 1}–${qfCutoff} postup do čtvrtfinále`, short: `${sfCutoff + 1}–${qfCutoff} → čtvrtfinále` })
  } else {
    if (advancing > 0) legend.push(advancing === 1
      ? { kind: 'a', text: 'Vítěz skupiny postupuje do play-off', short: '1. → play-off' }
      : { kind: 'a', text: `1–${advancing} postup do play-off`, short: `1–${advancing} → play-off` })
    if (consolation > 0) legend.push({ kind: 'b', text: 'Útěšná část', short: `${advancing + 1}–${advancing + consolation} → útěcha` })
  }

  const showLabel = (i: number, rows: number) => i === 0 || sfCutoff !== undefined || advancing + consolation < rows

  return { zoneAt, legend, showLabel }
}
