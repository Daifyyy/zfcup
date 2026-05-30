import { supabase } from '../supabase'
import { createRound, slotsOf } from './bracketHelpers'
import type { TournamentFormatDef, SeedParams, AutoAdvanceParams, AutoAdvanceResult } from '../formats'

// Pure 8-team knockout bracket — no group stage.
// Teams are assigned manually via SlotEditor (all slots start as TBD).

async function generate(): Promise<void> {
  await createRound('Čtvrtfinále', 4, 0)
  await createRound('Semifinále',  2, 1)
  await createRound('O 3. místo',  1, 2)
  await createRound('Finále',      1, 3)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function seed(_params: SeedParams): Promise<void> {
  // No-op: admin assigns teams manually via SlotEditor
}

async function autoAdvance({ slot, data, currentRound, allRounds, allSlots }: AutoAdvanceParams): Promise<AutoAdvanceResult> {
  const maxPos = Math.max(...allRounds.map(r => r.position))
  const homeWins = (data.home_score ?? 0) > (data.away_score ?? 0)
  const winner = homeWins ? data.home_id! : data.away_id!
  const loser  = homeWins ? data.away_id! : data.home_id!
  const isEven = slot.position % 2 === 0

  // QF (pos 0) → SF
  if (currentRound.position === 0) {
    const sfRound = allRounds.find(r => r.position === 1)
    if (sfRound) {
      const sfSlots = slotsOf(allSlots, sfRound.id)
      const targetSlot = sfSlots[Math.floor(slot.position / 2)]
      const field = isEven ? 'home_id' : 'away_id'
      if (targetSlot) {
        await supabase.from('bracket_slots').update({ [field]: winner }).eq('id', targetSlot.id)
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

export const formatKnockout8Def: TournamentFormatDef = {
  id: 'knockout_8',
  label: 'Pavouk 8 týmů (bez skupin)',
  description: '8 předem určených týmů → QF → SF → O 3. místo + Finále; týmy se nasadí ručně',
  groupConfig: { tournamentFormat: 'groups', defaultGroups: 0, defaultAdvancingPerGroup: 0 },
  fns: { generate, seed, autoAdvance },
}
