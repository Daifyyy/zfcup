// Data pro grafiky turnaje (Vlna 1, bod 3) nad daty z TournamentDataContext — bez dalších dotazů.
import type { TournamentData } from './TournamentDataContext'
import { buildFixtures } from './fixtures'
import { getSportDef } from './sports'
import { statFlags } from './details'
import { bestTeamInput, computeBestTeam, type BestTeam } from './bestTeam'
import { computeFinalStandings, type FinalStandings } from './finalStandings'
import { playDays, type DayOption } from './dayDigest'
import { roundNumber } from './leagueSchedule'

export interface BestTeamScope { value: string; label: string; team: BestTeam }

/** Tým turnaje (s ručními úpravami pořadatele) + v sezóně tým každého odehraného kola (nejnovější první). */
export function bestTeamScopes(d: TournamentData): BestTeamScope[] {
  const sport = getSportDef(d.tournament.sport)
  const input = bestTeamInput(d, statFlags(d))
  const overrides = d.tournament.best_team?.slots ?? null
  const scopes: BestTeamScope[] = [{ value: 'all', label: 'Tým turnaje', team: computeBestTeam(input, sport, { overrides }) }]
  if (d.tournament.schedule_mode === 'season') {
    const rounds = new Map<string, string[]>()
    for (const m of d.matches) {
      if (!m.played || !m.round || !Number.isFinite(roundNumber(m.round))) continue
      rounds.set(m.round, [...(rounds.get(m.round) ?? []), m.id])
    }
    const sorted = [...rounds.entries()].sort(([a], [b]) => roundNumber(b) - roundNumber(a))
    for (const [round, ids] of sorted) {
      scopes.push({ value: `r:${round}`, label: `Tým kola · ${round}`, team: computeBestTeam(input, sport, { scope: new Set(ids) }) })
    }
  }
  return scopes.filter(s => s.team.field.length > 0 || s.team.goalkeeper)
}

export function finalStandingsOf(d: TournamentData): FinalStandings {
  return computeFinalStandings(d, getSportDef(d.tournament.sport))
}

export function playDaysOf(d: TournamentData): DayOption[] {
  return playDays(buildFixtures(d.matches, d.groups, d.bracketRounds, d.bracketSlots), d.tournament.schedule_mode === 'season')
}
