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
  const firstRound = bracketRounds.find(r => r.position === 0)
  if (!firstRound) throw new Error('Struktura playoff nenalezena')
  const firstSlots = slotsOf(bracketSlots, firstRound.id)

  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name))
  const winners   = sortedGroups.map(g => calcGroupStandings(g, matches)[0]).filter(Boolean)
  const runnerUps = sortedGroups.map(g => calcGroupStandings(g, matches)[1]).filter(Boolean)
  const rankRows = (rows: ReturnType<typeof calcGroupStandings>) =>
    [...rows].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
  const ranked = [...rankRows(winners), ...rankRows(runnerUps)].map(r => r.id)

  // QF: slot 0 = 3.vs6., slot 1 = 4.vs5.
  const qfPairs = [
    { home: fill(ranked, 2), away: fill(ranked, 5) },
    { home: fill(ranked, 3), away: fill(ranked, 4) },
  ]
  for (let i = 0; i < qfPairs.length; i++) {
    const slot = firstSlots[i]; if (!slot) continue
    const { error } = await supabase.from('bracket_slots')
      .update({ home_id: qfPairs[i].home, away_id: qfPairs[i].away }).eq('id', slot.id)
    if (error) throw error
  }

  // SF: seed 2. a 1. jako home (bye — away doplní auto-advance)
  const sfRound = bracketRounds.find(r => r.position === 1)
  if (sfRound) {
    const sfSlots = slotsOf(bracketSlots, sfRound.id)
    const sfSeeds = [fill(ranked, 1), fill(ranked, 0)]
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

  // QF (pos 0) → SF slot at same index as away_id (home pre-seeded)
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

  // SF (pos 1) → Final (pos 3) + O3 (pos 2)
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

export const formatSixDef: TournamentFormatDef = {
  id: 'groups_six',
  label: 'Skupiny + 6-tým playoff',
  description: '6 postupujících (3 skupiny × top-2): 2 QF se dvěma bye → SF → O 3. → Finále',
  groupConfig: { tournamentFormat: 'groups', defaultGroups: 3, defaultAdvancingPerGroup: 2 },
  fns: { generate, seed, autoAdvance },
}
