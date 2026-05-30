import type { BracketRound, BracketSlot } from '../hooks/useBracket'
import type { Group } from '../hooks/useGroups'
import type { Match } from '../hooks/useMatches'
import type { Tournament } from '../hooks/useTournament'

// ── Shared param types ─────────────────────────────────────────────────────────

export interface SeedParams {
  groups: Group[]
  matches: Match[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  advancingPerGroup: number
}

export interface AutoAdvanceParams {
  slot: BracketSlot
  data: Partial<BracketSlot>
  currentRound: BracketRound
  allRounds: BracketRound[]
  allSlots: BracketSlot[]
}

export interface AutoAdvanceResult {
  toast: string
}

export interface BracketFormatFns {
  generate(): Promise<void>
  seed(params: SeedParams): Promise<void>
  autoAdvance(params: AutoAdvanceParams): Promise<AutoAdvanceResult>
}

export interface FormatGroupConfig {
  tournamentFormat: 'groups' | 'league'
  defaultGroups: number
  defaultAdvancingPerGroup: number
  leagueHasPlayoff?: boolean
  consolationPerGroup?: number
}

export interface TournamentFormatDef {
  id: string
  label: string
  description: string
  groupConfig: FormatGroupConfig
  fns: BracketFormatFns
}

// ── Advancing cutoffs for Standings coloring ───────────────────────────────────

export interface AdvancingCutoffs {
  sfCutoff?: number       // i < sfCutoff → green (direct to SF)
  qfCutoff?: number       // i < qfCutoff → amber (to QF)
  advancing: number       // i < advancing → green (to playoffs, groups mode)
  consolation?: number    // i < consolation (in addition to advancing) → amber (to consolation bracket)
}

// Import format implementations (lazy to avoid circular deps)
import { formatSFDef } from './bracket-formats/formatSF'
import { formatSixDef } from './bracket-formats/formatSix'
import { formatSixCrossDef } from './bracket-formats/formatSixCross'
import { formatQFDef } from './bracket-formats/formatQF'
import { formatQFFullDef } from './bracket-formats/formatQFFull'
import { formatLeagueDef } from './bracket-formats/formatLeague'
import { formatLeaguePlayoffDef } from './bracket-formats/formatLeaguePlayoff'
import { formatLeagueSFDef } from './bracket-formats/formatLeagueSF'
import { formatFullPlacementDef } from './bracket-formats/formatFullPlacement'
import { formatKnockout8Def } from './bracket-formats/formatKnockout8'
import { formatRO16Def } from './bracket-formats/formatRO16'

export const TOURNAMENT_FORMATS: TournamentFormatDef[] = [
  formatLeagueDef,
  formatLeaguePlayoffDef,
  formatLeagueSFDef,
  formatSFDef,
  formatSixDef,
  formatSixCrossDef,
  formatQFDef,
  formatQFFullDef,
  formatFullPlacementDef,
  formatKnockout8Def,
  formatRO16Def,
]

export function getFormatDef(formatId: string): TournamentFormatDef | undefined {
  if (!formatId) return undefined
  return TOURNAMENT_FORMATS.find(f => f.id === formatId)
}

export function getLegacyFormatDef(tournament: Tournament | null, groups: Group[]): TournamentFormatDef | undefined {
  if (!tournament) return undefined
  const isLeague = tournament.format === 'league'
  if (isLeague) {
    return (tournament.league_has_playoff ?? true) ? formatLeaguePlayoffDef : formatLeagueDef
  }
  const advancingPerGroup = tournament.advancing_per_group ?? 2
  const totalAdvancing = advancingPerGroup * groups.length
  const crossSeed = tournament.playoff_style === 'cross'
  const isSingleGroup = groups.length === 1
  if (isSingleGroup || totalAdvancing <= 4) return formatSFDef
  if (totalAdvancing === 6 && crossSeed) return formatSixCrossDef
  if (totalAdvancing === 6) return formatSixDef
  return formatQFDef
}

export function getAdvancingCutoffs(formatId: string, tournament?: Tournament | null): AdvancingCutoffs {
  const def = getFormatDef(formatId)
  if (!def && tournament?.format === 'league') {
    return { sfCutoff: 2, qfCutoff: 6 }
  }
  switch (formatId) {
    case 'league': return {}
    case 'league_playoff': return { sfCutoff: 2, qfCutoff: 6 }
    case 'groups_sf': return { advancing: 2 }
    case 'groups_six': return { advancing: 2 }
    case 'groups_six_cross': return { advancing: 2 }
    case 'groups_qf': return { advancing: tournament?.advancing_per_group ?? 2 }
    case 'groups_qf_full': return { advancing: tournament?.advancing_per_group ?? 2 }
    case 'groups_full_placement': return { advancing: 4, consolation: 2 }
    case 'league_sf': return { sfCutoff: 4 }
    case 'knockout_8': return { advancing: 0 }
    case 'groups_ro16': return { advancing: tournament?.advancing_per_group ?? 2 }
    default:
      // Legacy fallback
      if (tournament?.format === 'league') return { sfCutoff: 2, qfCutoff: 6 }
      return { advancing: tournament?.advancing_per_group ?? 2 }
  }
}
