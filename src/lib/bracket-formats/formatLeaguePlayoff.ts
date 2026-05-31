import { supabase } from '../supabase'
import { calcGroupStandings } from '../standings'
import { createRound, slotsOf, fill } from './bracketHelpers'
import type { TournamentFormatDef, SeedParams, AutoAdvanceParams, AutoAdvanceResult } from '../formats'

async function generate(tournamentId: string): Promise<void> {
  await createRound('Čtvrtfinále', 2, 0, tournamentId)
  await createRound('Semifinále',  2, 1, tournamentId)
  await createRound('O 3. místo',  1, 2, tournamentId)
  await createRound('Finále',      1, 3, tournamentId)
}

async function seed({ groups, matches, bracketRounds, bracketSlots }: SeedParams): Promise<void> {
  const ligaGroup = groups.find(g => g.name === 'Liga')
  if (!ligaGroup) throw new Error('Skupinu "Liga" nenalezena — nejprve vygeneruj ligový rozpis')

  const firstRound = bracketRounds.find(r => r.position === 0)
  if (!firstRound) throw new Error('Struktura playoff nenalezena')
  const firstSlots = slotsOf(bracketSlots, firstRound.id)

  const standings = calcGroupStandings(ligaGroup, matches).slice(0, 6).map(r => r.id)
  // QF: slot 0 = 3.vs6., slot 1 = 4.vs5.
  const qfPairs = [
    { home: fill(standings, 2), away: fill(standings, 5) },
    { home: fill(standings, 3), away: fill(standings, 4) },
  ]
  for (let i = 0; i < qfPairs.length; i++) {
    const slot = firstSlots[i]; if (!slot) continue
    const { error } = await supabase.from('bracket_slots')
      .update({ home_id: qfPairs[i].home, away_id: qfPairs[i].away }).eq('id', slot.id)
    if (error) throw error
  }

  // SF: seed 2. (idx1) a 1. (idx0) jako home
  const sfRound = bracketRounds.find(r => r.position === 1)
  if (sfRound) {
    const sfSlots = slotsOf(bracketSlots, sfRound.id)
    const sfSeeds = [fill(standings, 1), fill(standings, 0)]
    for (let i = 0; i < sfSeeds.length; i++) {
      const slot = sfSlots[i]; if (!slot) continue
      const { error } = await supabase.from('bracket_slots')
        .update({ home_id: sfSeeds[i], away_id: null }).eq('id', slot.id)
      if (error) throw error
    }
  }
}

async function autoAdvance({ slot, data, currentRound, allRounds, allSlots }: AutoAdvanceParams): Promise<AutoAdvanceResult> {
  const maxPos = Math.max(...allRounds.map(r => r.position))
  const homeWins = (data.home_score ?? 0) > (data.away_score ?? 0)
  const winner = homeWins ? data.home_id! : data.away_id!
  const loser  = homeWins ? data.away_id! : data.home_id!
  const isEven = slot.position % 2 === 0

  // QF (pos 0) → SF slot at same index (home pre-seeded as bye)
  if (currentRound.position === 0) {
    const sfRound = allRounds.find(r => r.position === 1)
    if (sfRound) {
      const sfSlots = slotsOf(allSlots, sfRound.id)
      const targetSlot = sfSlots[slot.position]
      if (targetSlot) {
        await supabase.from('bracket_slots').update({ away_id: winner }).eq('id', targetSlot.id)
        return { toast: 'Uloženo ✓ — vítěz postoupil do semifinále' }
      }
    }
    return { toast: 'Uloženo ✓' }
  }

  // SF (pos 1) → Final + O3
  if (currentRound.position === 1) {
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

export const formatLeaguePlayoffDef: TournamentFormatDef = {
  id: 'league_playoff',
  label: 'Liga + Play-off',
  description: 'Round-robin → Top-6: 3.vs6. a 4.vs5. v QF; 1. a 2. s bye do SF → Finále',
  groupConfig: { tournamentFormat: 'league', defaultGroups: 1, defaultAdvancingPerGroup: 6, leagueHasPlayoff: true },
  fns: { generate, seed, autoAdvance },
}
