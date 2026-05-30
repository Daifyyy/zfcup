import { supabase } from '../supabase'
import { calcGroupStandings } from '../standings'
import { createRound, slotsOf, fill } from './bracketHelpers'
import type { TournamentFormatDef, SeedParams, AutoAdvanceParams, AutoAdvanceResult } from '../formats'

// Round structure:
// pos 0: Čtvrtfinále (4 slots)
// pos 1: O 7-8. místo (SF) (2 slots) ← QF losers
// pos 2: Semifinále (2 slots) ← QF winners
// pos 3: O 7. místo (1 slot) ← O7-8 SF losers
// pos 4: O 5-6. místo (1 slot) ← O7-8 SF winners
// pos 5: O 3. místo (1 slot) ← SF losers  [BracketTab early return maxPos-1=5]
// pos 6: Finále (1 slot) ← SF winners     [BracketTab early return maxPos=6]
// Note: maxPos=6, maxPos-1=5 → early return fires for pos>=5
// SF is at pos 2 < 5, so autoAdvance must handle SF manually.

async function generate(): Promise<void> {
  await createRound('Čtvrtfinále',         4, 0)
  await createRound('O 7-8. místo (SF)',   2, 1)
  await createRound('Semifinále',          2, 2)
  await createRound('O 7. místo',          1, 3)
  await createRound('O 5-6. místo',        1, 4)
  await createRound('O 3. místo',          1, 5)
  await createRound('Finále',              1, 6)
}

async function seed({ groups, matches, bracketRounds, bracketSlots, advancingPerGroup }: SeedParams): Promise<void> {
  const firstRound = bracketRounds.find(r => r.position === 0)
  if (!firstRound) throw new Error('Struktura playoff nenalezena')
  const firstSlots = slotsOf(bracketSlots, firstRound.id)

  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name))
  const grouped = sortedGroups.map(g =>
    calcGroupStandings(g, matches).slice(0, advancingPerGroup).map(r => r.id)
  )

  const qfPairs: { home: string | null; away: string | null }[] = []
  for (let i = 0; i < sortedGroups.length; i += 2) {
    const G = grouped[i]    ?? []
    const H = grouped[i + 1] ?? []
    if (advancingPerGroup >= 4) {
      qfPairs.push({ home: fill(G, 0), away: fill(H, 3) })
      qfPairs.push({ home: fill(G, 1), away: fill(H, 2) })
      qfPairs.push({ home: fill(H, 0), away: fill(G, 3) })
      qfPairs.push({ home: fill(H, 1), away: fill(G, 2) })
    } else {
      qfPairs.push({ home: fill(G, 0), away: fill(H, 1) })
      qfPairs.push({ home: fill(G, 1), away: fill(H, 0) })
      qfPairs.push({ home: fill(H, 0), away: fill(G, 1) })
      qfPairs.push({ home: fill(H, 1), away: fill(G, 0) })
    }
  }
  for (let i = 0; i < qfPairs.length; i++) {
    const slot = firstSlots[i]; if (!slot) continue
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
      // QF: winner → SF (pos 2), loser → O7-8 SF (pos 1)
      const sfTarget    = slotAt(2, Math.floor(slot.position / 2))
      const lowerTarget = slotAt(1, Math.floor(slot.position / 2))
      const ops: Promise<unknown>[] = []
      if (sfTarget)    ops.push(supabase.from('bracket_slots').update({ [field]: winner }).eq('id', sfTarget.id))
      if (lowerTarget) ops.push(supabase.from('bracket_slots').update({ [field]: loser  }).eq('id', lowerTarget.id))
      await Promise.all(ops)
      return { toast: 'Uloženo ✓ — vítěz do SF, poražený do o7-8' }
    }
    case 1: {
      // O7-8 SF: winner → O5-6 (pos 4), loser → O7 (pos 3)
      const o56Slot = firstSlotOf(4)
      const o7Slot  = firstSlotOf(3)
      const ops: Promise<unknown>[] = []
      if (o56Slot) ops.push(supabase.from('bracket_slots').update({ [field]: winner }).eq('id', o56Slot.id))
      if (o7Slot)  ops.push(supabase.from('bracket_slots').update({ [field]: loser  }).eq('id', o7Slot.id))
      await Promise.all(ops)
      return { toast: 'Uloženo ✓ — vítěz do O5-6, poražený do O7' }
    }
    case 2: {
      // SF: winner → Final (pos 6), loser → O3 (pos 5)
      // pos 2 < maxPos-1=5, so BracketTab early return does NOT fire — must handle here
      const finalSlot = firstSlotOf(6)
      const o3Slot    = firstSlotOf(5)
      const ops: Promise<unknown>[] = []
      if (finalSlot) ops.push(supabase.from('bracket_slots').update({ [field]: winner }).eq('id', finalSlot.id))
      if (o3Slot)    ops.push(supabase.from('bracket_slots').update({ [field]: loser  }).eq('id', o3Slot.id))
      await Promise.all(ops)
      return { toast: 'Uloženo ✓ — vítěz postoupil do finále' }
    }
    default:
      // Terminal positions (3: O7, 4: O5-6) — no advance
      return { toast: 'Uloženo ✓' }
  }
}

export const formatQFFullDef: TournamentFormatDef = {
  id: 'groups_qf_full',
  label: 'Skupiny + QF + Umístění',
  description: '8 postupujících: QF → dolní pavouk (O7-8) + SF → O5-6 + O3 + Finále — každý tým dostane finální místo 1–8',
  groupConfig: { tournamentFormat: 'groups', defaultGroups: 4, defaultAdvancingPerGroup: 2 },
  fns: { generate, seed, autoAdvance },
}
