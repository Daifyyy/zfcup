import { supabase } from '../supabase'
import { calcGroupStandings } from '../standings'
import { createRound, slotsOf, fill } from './bracketHelpers'
import type { TournamentFormatDef, SeedParams, AutoAdvanceParams, AutoAdvanceResult } from '../formats'

// Round structure:
// pos 0: Osmifinále (8 slots) ← top-2 from 8 groups, cross-seeded
// pos 1: Čtvrtfinále (4 slots) ← R16 winners
// pos 2: Semifinále (2 slots) ← QF winners
// pos 3: O 3. místo (1 slot) ← SF losers
// pos 4: Finále (1 slot) ← SF winners

async function generate(): Promise<void> {
  await createRound('Osmifinále',  8, 0)
  await createRound('Čtvrtfinále', 4, 1)
  await createRound('Semifinále',  2, 2)
  await createRound('O 3. místo',  1, 3)
  await createRound('Finále',      1, 4)
}

async function seed({ groups, matches, bracketRounds, bracketSlots }: SeedParams): Promise<void> {
  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name))
  if (sortedGroups.length < 2) throw new Error('R16 vyžaduje alespoň 2 skupiny')

  // top-2 from each group
  const grouped = sortedGroups.map(g =>
    calcGroupStandings(g, matches).slice(0, 2).map(r => r.id)
  )

  const r16Round = bracketRounds.find(r => r.position === 0)
  if (!r16Round) throw new Error('Struktura playoff nenalezena')
  const r16Slots = slotsOf(bracketSlots, r16Round.id)
  const n = sortedGroups.length

  // Cross-seed: 1st of group i vs 2nd of group (n-1-i)
  // e.g. 8 groups: 1A vs 2H, 1B vs 2G, 1C vs 2F, 1D vs 2E, 1E vs 2D, 1F vs 2C, 1G vs 2B, 1H vs 2A
  const pairs: { home: string | null; away: string | null }[] = []
  for (let i = 0; i < n; i++) {
    const mirror = n - 1 - i
    pairs.push({
      home: fill(grouped[i] ?? [], 0),
      away: fill(grouped[mirror] ?? [], 1),
    })
  }

  for (let i = 0; i < pairs.length; i++) {
    const slot = r16Slots[i]; if (!slot) continue
    const { error } = await supabase.from('bracket_slots')
      .update({ home_id: pairs[i].home, away_id: pairs[i].away }).eq('id', slot.id)
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
  const slotAt = (pos: number, idx: number) => {
    const r = roundAt(pos); return r ? slotsOf(allSlots, r.id)[idx] : null
  }
  const firstSlotOf = (pos: number) => slotAt(pos, 0)

  switch (currentRound.position) {
    case 0: {
      // R16 → QF
      const target = slotAt(1, Math.floor(slot.position / 2))
      if (target) await supabase.from('bracket_slots').update({ [field]: winner }).eq('id', target.id)
      return { toast: 'Uloženo ✓ — vítěz postoupil do čtvrtfinále' }
    }
    case 1: {
      // QF → SF
      const target = slotAt(2, Math.floor(slot.position / 2))
      if (target) await supabase.from('bracket_slots').update({ [field]: winner }).eq('id', target.id)
      return { toast: 'Uloženo ✓ — vítěz postoupil do semifinále' }
    }
    case 2: {
      // SF → Final (pos 4) + O3 (pos 3)
      const finalSlot = firstSlotOf(4)
      const o3Slot    = firstSlotOf(3)
      const ops: Promise<unknown>[] = []
      if (finalSlot) ops.push(supabase.from('bracket_slots').update({ [field]: winner }).eq('id', finalSlot.id))
      if (o3Slot)    ops.push(supabase.from('bracket_slots').update({ [field]: loser  }).eq('id', o3Slot.id))
      await Promise.all(ops)
      return { toast: 'Uloženo ✓ — vítěz postoupil do finále' }
    }
    default:
      return { toast: 'Uloženo ✓' }
  }
}

export const formatRO16Def: TournamentFormatDef = {
  id: 'groups_ro16',
  label: 'Skupiny + Osmifinále (R16)',
  description: '8 skupin × top-2 = 16 týmů → Osmifinále → QF → SF → O 3. + Finále (mini Světový pohár)',
  groupConfig: { tournamentFormat: 'groups', defaultGroups: 8, defaultAdvancingPerGroup: 2 },
  fns: { generate, seed, autoAdvance },
}
