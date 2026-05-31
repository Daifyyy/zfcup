import { supabase } from '../supabase'
import { calcGroupStandings } from '../standings'
import { createRound, slotsOf, fill } from './bracketHelpers'
import type { TournamentFormatDef, SeedParams, AutoAdvanceParams, AutoAdvanceResult } from '../formats'

async function generate(tournamentId: string): Promise<void> {
  await createRound('Semifinále', 2, 0, tournamentId)
  await createRound('O 3. místo', 1, 1, tournamentId)
  await createRound('Finále',     1, 2, tournamentId)
}

async function seed({ groups, matches, bracketRounds, bracketSlots, advancingPerGroup }: SeedParams): Promise<void> {
  const firstRound = bracketRounds.find(r => r.position === 0)
  if (!firstRound) throw new Error('Struktura playoff nenalezena')
  const firstSlots = slotsOf(bracketSlots, firstRound.id)

  const isSingleGroup = groups.length === 1
  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name))

  if (isSingleGroup) {
    const standings = calcGroupStandings(groups[0], matches).slice(0, 4).map(r => r.id)
    const pairs = [
      { home: fill(standings, 0), away: fill(standings, 3) },
      { home: fill(standings, 1), away: fill(standings, 2) },
    ]
    for (let i = 0; i < pairs.length; i++) {
      const slot = firstSlots[i]; if (!slot) continue
      const { error } = await supabase.from('bracket_slots')
        .update({ home_id: pairs[i].home, away_id: pairs[i].away }).eq('id', slot.id)
      if (error) throw error
    }
  } else {
    // 2 groups × top-2: A1 vs B2, B1 vs A2
    const grpA = calcGroupStandings(sortedGroups[0], matches).slice(0, advancingPerGroup).map(r => r.id)
    const grpB = calcGroupStandings(sortedGroups[1], matches).slice(0, advancingPerGroup).map(r => r.id)
    const pairs = [
      { home: fill(grpA, 0), away: fill(grpB, 1) },
      { home: fill(grpB, 0), away: fill(grpA, 1) },
    ]
    for (let i = 0; i < pairs.length; i++) {
      const slot = firstSlots[i]; if (!slot) continue
      const { error } = await supabase.from('bracket_slots')
        .update({ home_id: pairs[i].home, away_id: pairs[i].away }).eq('id', slot.id)
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

export const formatSFDef: TournamentFormatDef = {
  id: 'groups_sf',
  label: 'Skupiny + Semifinále',
  description: 'Až 4 postupující → Semifinále → O 3. místo + Finále',
  groupConfig: { tournamentFormat: 'groups', defaultGroups: 2, defaultAdvancingPerGroup: 2 },
  fns: { generate, seed, autoAdvance },
}
