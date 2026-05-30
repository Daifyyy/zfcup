import type { TournamentFormatDef, SeedParams, AutoAdvanceParams, AutoAdvanceResult } from '../formats'

async function generate(): Promise<void> {
  // Liga bez playoff — žádná kola
}

async function seed(_params: SeedParams): Promise<void> {
  // Nic k nasazení
}

async function autoAdvance(_params: AutoAdvanceParams): Promise<AutoAdvanceResult> {
  return { toast: 'Uloženo ✓' }
}

export const formatLeagueDef: TournamentFormatDef = {
  id: 'league',
  label: 'Liga (bez playoff)',
  description: 'Round-robin každý s každým. Vítěz = 1. místo tabulky.',
  groupConfig: { tournamentFormat: 'league', defaultGroups: 1, defaultAdvancingPerGroup: 0, leagueHasPlayoff: false },
  fns: { generate, seed, autoAdvance },
}
