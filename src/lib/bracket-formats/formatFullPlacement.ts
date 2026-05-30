import { supabase } from '../supabase'
import { calcGroupStandings } from '../standings'
import { createRound, slotsOf, fill } from './bracketHelpers'
import type { TournamentFormatDef, SeedParams, AutoAdvanceParams, AutoAdvanceResult } from '../formats'

// Round structure:
// pos 0: Útěšné QF (2 slots) ← group 5th/6th places
// pos 1: Čtvrtfinále (4 slots) ← cross-seeded top-4 from each group
// pos 2: O 11. místo (1 slot) ← consolation QF losers
// pos 3: O 9. místo (1 slot) ← consolation QF winners
// pos 4: O 7-8. místo (SF) (2 slots) ← main QF losers
// pos 5: Semifinále (2 slots) ← main QF winners
// pos 6: O 7. místo (1 slot) ← O7-8 SF losers
// pos 7: O 5-6. místo (1 slot) ← O7-8 SF winners
// pos 8: O 3. místo (1 slot) ← SF losers  [BracketTab early return maxPos-1=8]
// pos 9: Finále (1 slot) ← SF winners     [BracketTab early return maxPos=9]
// Note: maxPos=9, maxPos-1=8 → early return fires for pos>=8
// SF is at pos 5 < 8, so autoAdvance case 5 must handle the SF advance.

async function generate(): Promise<void> {
  await createRound('Útěšné QF',         2, 0)
  await createRound('Čtvrtfinále',       4, 1)
  await createRound('O 11. místo',       1, 2)
  await createRound('O 9. místo',        1, 3)
  await createRound('O 7-8. místo (SF)', 2, 4)
  await createRound('Semifinále',        2, 5)
  await createRound('O 7. místo',        1, 6)
  await createRound('O 5-6. místo',      1, 7)
  await createRound('O 3. místo',        1, 8)
  await createRound('Finále',            1, 9)
}

async function seed({ groups, matches, bracketRounds, bracketSlots }: SeedParams): Promise<void> {
  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name))
  if (sortedGroups.length < 2) throw new Error('Plný pavouk vyžaduje alespoň 2 skupiny')

  const grpA = calcGroupStandings(sortedGroups[0], matches).map(r => r.id)
  const grpB = calcGroupStandings(sortedGroups[1], matches).map(r => r.id)

  const roundAt = (pos: number) => bracketRounds.find(r => r.position === pos)
  const slotsAt = (pos: number) => {
    const r = roundAt(pos); return r ? slotsOf(bracketSlots, r.id) : []
  }

  // Consolation QF (pos 0): 5A vs 6B, 6A vs 5B
  const consQFSlots = slotsAt(0)
  const consPairs = [
    { home: fill(grpA, 4), away: fill(grpB, 5) },
    { home: fill(grpB, 4), away: fill(grpA, 5) },
  ]
  for (let i = 0; i < consPairs.length; i++) {
    const slot = consQFSlots[i]; if (!slot) continue
    const { error } = await supabase.from('bracket_slots')
      .update({ home_id: consPairs[i].home, away_id: consPairs[i].away }).eq('id', slot.id)
    if (error) throw error
  }

  // Main QF (pos 1): cross-seed 1A vs 4B, 2A vs 3B, 1B vs 4A, 2B vs 3A
  const qfSlots = slotsAt(1)
  const qfPairs = [
    { home: fill(grpA, 0), away: fill(grpB, 3) },  // 1A vs 4B
    { home: fill(grpA, 1), away: fill(grpB, 2) },  // 2A vs 3B
    { home: fill(grpB, 0), away: fill(grpA, 3) },  // 1B vs 4A
    { home: fill(grpB, 1), away: fill(grpA, 2) },  // 2B vs 3A
  ]
  for (let i = 0; i < qfPairs.length; i++) {
    const slot = qfSlots[i]; if (!slot) continue
    const { error } = await supabase.from('bracket_slots')
      .update({ home_id: qfPairs[i].home, away_id: qfPairs[i].away }).eq('id', slot.id)
    if (error) throw error
  }
}

async function autoAdvance({ slot, data, currentRound, allRounds, allSlots }: AutoAdvanceParams): Promise<AutoAdvanceResult> {
  const homeWins = (data.home_score ?? 0) > (data.away_score ?? 0)
  const winner = homeWins ? data.home_id! : data.away_id!
  const loser  = homeWins ? data.away_id! : data.home_id!
  const isEven = slot.position % 2 === 0
  const field = isEven ? 'home_id' : 'away_id'

  const roundAt = (pos: number) => allRounds.find(r => r.position === pos)
  const firstSlotOf = (pos: number) => {
    const r = roundAt(pos); return r ? slotsOf(allSlots, r.id)[0] : null
  }
  const slotAt = (pos: number, idx: number) => {
    const r = roundAt(pos); return r ? slotsOf(allSlots, r.id)[idx] : null
  }

  switch (currentRound.position) {
    case 0: {
      // Útěšné QF → O9 (pos 3) winner, O11 (pos 2) loser
      const o9Slot  = firstSlotOf(3)
      const o11Slot = firstSlotOf(2)
      const ops: Promise<unknown>[] = []
      if (o9Slot)  ops.push(supabase.from('bracket_slots').update({ [field]: winner }).eq('id', o9Slot.id))
      if (o11Slot) ops.push(supabase.from('bracket_slots').update({ [field]: loser  }).eq('id', o11Slot.id))
      await Promise.all(ops)
      return { toast: 'Uloženo ✓ — vítěz do O9, poražený do O11' }
    }
    case 1: {
      // Main QF → SF (pos 5) winner, O7-8 SF (pos 4) loser
      const sfTarget    = slotAt(5, Math.floor(slot.position / 2))
      const lowerTarget = slotAt(4, Math.floor(slot.position / 2))
      const ops: Promise<unknown>[] = []
      if (sfTarget)    ops.push(supabase.from('bracket_slots').update({ [field]: winner }).eq('id', sfTarget.id))
      if (lowerTarget) ops.push(supabase.from('bracket_slots').update({ [field]: loser  }).eq('id', lowerTarget.id))
      await Promise.all(ops)
      return { toast: 'Uloženo ✓ — vítěz do SF, poražený do O7-8' }
    }
    case 4: {
      // O7-8 SF → O5-6 (pos 7) winner, O7 (pos 6) loser
      const o56Slot = firstSlotOf(7)
      const o7Slot  = firstSlotOf(6)
      const ops: Promise<unknown>[] = []
      if (o56Slot) ops.push(supabase.from('bracket_slots').update({ [field]: winner }).eq('id', o56Slot.id))
      if (o7Slot)  ops.push(supabase.from('bracket_slots').update({ [field]: loser  }).eq('id', o7Slot.id))
      await Promise.all(ops)
      return { toast: 'Uloženo ✓ — vítěz do O5-6, poražený do O7' }
    }
    case 5: {
      // SF → Finále (pos 9) winner, O3 (pos 8) loser
      // pos 5 < maxPos-1=8, so BracketTab early return does NOT fire — must handle here
      const finalSlot = firstSlotOf(9)
      const o3Slot    = firstSlotOf(8)
      const ops: Promise<unknown>[] = []
      if (finalSlot) ops.push(supabase.from('bracket_slots').update({ [field]: winner }).eq('id', finalSlot.id))
      if (o3Slot)    ops.push(supabase.from('bracket_slots').update({ [field]: loser  }).eq('id', o3Slot.id))
      await Promise.all(ops)
      return { toast: 'Uloženo ✓ — vítěz do finále' }
    }
    default:
      // Terminal positions (2: O11, 3: O9, 6: O7, 7: O5-6) — no advance
      return { toast: 'Uloženo ✓' }
  }
}

export const formatFullPlacementDef: TournamentFormatDef = {
  id: 'groups_full_placement',
  label: 'Skupiny + Plný pavouk',
  description: '2 skupiny × 6 týmů: top-4 do QF (křížové), poslední 2 do útěšného QF — každý tým dostane místo 1–12',
  groupConfig: { tournamentFormat: 'groups', defaultGroups: 2, defaultAdvancingPerGroup: 4, consolationPerGroup: 2 },
  fns: { generate, seed, autoAdvance },
}
