import { supabase } from '../supabase'
import { calcGroupStandings } from '../standings'
import { createRound, slotsOf, fill } from './bracketHelpers'
import type { TournamentFormatDef, SeedParams, AutoAdvanceParams, AutoAdvanceResult } from '../formats'

async function generate(tournamentId: string): Promise<void> {
  await createRound('Semifinále', 2, 0, tournamentId)
  await createRound('O 3. místo', 1, 1, tournamentId)
  await createRound('Finále',     1, 2, tournamentId)
}

async function seed({ groups, matches, bracketRounds, bracketSlots }: SeedParams): Promise<void> {
  const ligaGroup = groups.find(g => g.name === 'Liga')
  if (!ligaGroup) throw new Error('Skupina "Liga" nenalezena — nejprve vygeneruj ligový rozpis')

  const sfRound = bracketRounds.find(r => r.position === 0)
  if (!sfRound) throw new Error('Struktura playoff nenalezena')
  const sfSlots = slotsOf(bracketSlots, sfRound.id)

  const standings = calcGroupStandings(ligaGroup, matches).map(r => r.id)
  // SF: top-4 z ligy — 1. vs 4., 2. vs 3.
  const pairs = [
    { home: fill(standings, 0), away: fill(standings, 3) },
    { home: fill(standings, 1), away: fill(standings, 2) },
  ]
  for (let i = 0; i < pairs.length; i++) {
    const slot = sfSlots[i]; if (!slot) continue
    const { error } = await supabase.from('bracket_slots')
      .update({ home_id: pairs[i].home, away_id: pairs[i].away }).eq('id', slot.id)
    if (error) throw error
  }
}

async function autoAdvance({ slot, data, currentRound, allRounds, allSlots }: AutoAdvanceParams): Promise<AutoAdvanceResult> {
  const maxPos = Math.max(...allRounds.map(r => r.position))
  const homeWins = (data.home_score ?? 0) > (data.away_score ?? 0)
  const winner = homeWins ? data.home_id! : data.away_id!
  const loser  = homeWins ? data.away_id! : data.home_id!
  const isEven = slot.position % 2 === 0

  // SF (pos 0) → Final (pos 2) + O3 (pos 1)
  if (currentRound.position === 0) {
    const finalRound = allRounds.find(r => r.position === maxPos)
    const thirdRound = allRounds.find(r => r.position === maxPos - 1)
    const finalSlot  = finalRound ? slotsOf(allSlots, finalRound.id)[0] : null
    const thirdSlot  = thirdRound ? slotsOf(allSlots, thirdRound.id)[0] : null
    const field = isEven ? 'home_id' : 'away_id'
    const ops: Promise<unknown>[] = []
    if (finalSlot) ops.push(supabase.from('bracket_slots').update({ [field]: winner }).eq('id', finalSlot.id))
    if (thirdSlot) ops.push(supabase.from('bracket_slots').update({ [field]: loser  }).eq('id', thirdSlot.id))
    await Promise.all(ops)
    return { toast: 'Uloženo ✓ — vítěz postoupil do finále' }
  }
  return { toast: 'Uloženo ✓' }
}

export const formatLeagueSFDef: TournamentFormatDef = {
  id: 'league_sf',
  label: 'Liga + Semifinále',
  description: 'Round-robin liga → Top-4: 1.vs4. a 2.vs3. v SF → O 3. místo + Finále (bez čtvrtfinále)',
  groupConfig: { tournamentFormat: 'league', defaultGroups: 1, defaultAdvancingPerGroup: 4, leagueHasPlayoff: true },
  fns: { generate, seed, autoAdvance },
}
