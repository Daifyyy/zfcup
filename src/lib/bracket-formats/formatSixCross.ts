import { supabase } from '../supabase'
import { calcGroupStandings } from '../standings'
import { createRound, slotsOf, fill } from './bracketHelpers'
import type { TournamentFormatDef, SeedParams, AutoAdvanceParams, AutoAdvanceResult } from '../formats'

async function generate(): Promise<void> {
  await createRound('Čtvrtfinále', 3, 0)
  await createRound('Semifinále',  1, 1)
  await createRound('O 3. místo',  1, 2)
  await createRound('Finále',      1, 3)
}

async function seed({ groups, matches, bracketRounds, bracketSlots }: SeedParams): Promise<void> {
  const firstRound = bracketRounds.find(r => r.position === 0)
  if (!firstRound) throw new Error('Struktura playoff nenalezena')
  const firstSlots = slotsOf(bracketSlots, firstRound.id)

  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name))
  const grpStandings = sortedGroups.map(g =>
    calcGroupStandings(g, matches).slice(0, 3).map(r => r.id)
  )
  const grpA = grpStandings[0] ?? []
  const grpB = grpStandings[1] ?? []
  const grpC = grpStandings[2] ?? []

  const qfPairs = sortedGroups.length >= 3
    ? [
        { home: fill(grpA, 0), away: fill(grpB, 1) },  // 1A vs 2B
        { home: fill(grpB, 0), away: fill(grpC, 1) },  // 1B vs 2C
        { home: fill(grpC, 0), away: fill(grpA, 1) },  // 1C vs 2A
      ]
    : [
        { home: fill(grpA, 0), away: fill(grpB, 2) },  // 1A vs 3B
        { home: fill(grpA, 1), away: fill(grpB, 1) },  // 2A vs 2B
        { home: fill(grpB, 0), away: fill(grpA, 2) },  // 1B vs 3A
      ]
  for (let i = 0; i < qfPairs.length; i++) {
    const slot = firstSlots[i]; if (!slot) continue
    const { error } = await supabase.from('bracket_slots')
      .update({ home_id: qfPairs[i].home, away_id: qfPairs[i].away }).eq('id', slot.id)
    if (error) throw error
  }
}

async function autoAdvance({ slot, data, currentRound, allRounds, allSlots }: AutoAdvanceParams): Promise<AutoAdvanceResult> {
  const maxPos = Math.max(...allRounds.map(r => r.position))
  const homeWins = (data.home_score ?? 0) > (data.away_score ?? 0)
  const winner = homeWins ? data.home_id! : data.away_id!
  const loser  = homeWins ? data.away_id! : data.home_id!

  // QF round (pos 0) — custom routing per slot position
  if (currentRound.position === 0) {
    if (slot.position === 1) {
      // Middle match (2A vs 2B) → winner direct to Final home_id, loser to O3 home_id
      const finalRound = allRounds.find(r => r.position === maxPos)
      const thirdRound = allRounds.find(r => r.position === maxPos - 1)
      const finalSlot  = finalRound ? slotsOf(allSlots, finalRound.id)[0] : null
      const thirdSlot  = thirdRound ? slotsOf(allSlots, thirdRound.id)[0] : null
      const ops: Promise<unknown>[] = []
      if (finalSlot) ops.push(supabase.from('bracket_slots').update({ home_id: winner }).eq('id', finalSlot.id))
      if (thirdSlot) ops.push(supabase.from('bracket_slots').update({ home_id: loser  }).eq('id', thirdSlot.id))
      await Promise.all(ops)
      return { toast: 'Uloženo ✓ — vítěz přímo do finále' }
    } else {
      // Slot 0 (1A vs 2B) → SF home_id; Slot 2 (1C vs 2A) → SF away_id
      const sfRound = allRounds.find(r => r.position === 1)
      if (sfRound) {
        const sfSlot = slotsOf(allSlots, sfRound.id)[0]
        if (sfSlot) {
          const field = slot.position === 0 ? 'home_id' : 'away_id'
          await supabase.from('bracket_slots').update({ [field]: winner }).eq('id', sfSlot.id)
          return { toast: 'Uloženo ✓ — vítěz postoupil do semifinále' }
        }
      }
      return { toast: 'Uloženo ✓' }
    }
  }

  // SF (pos 1) → winner to Final away_id, loser to O3 away_id
  if (currentRound.position === 1) {
    const finalRound = allRounds.find(r => r.position === maxPos)
    const thirdRound = allRounds.find(r => r.position === maxPos - 1)
    const finalSlot  = finalRound ? slotsOf(allSlots, finalRound.id)[0] : null
    const thirdSlot  = thirdRound ? slotsOf(allSlots, thirdRound.id)[0] : null
    const ops: Promise<unknown>[] = []
    if (finalSlot) ops.push(supabase.from('bracket_slots').update({ away_id: winner }).eq('id', finalSlot.id))
    if (thirdSlot) ops.push(supabase.from('bracket_slots').update({ away_id: loser  }).eq('id', thirdSlot.id))
    await Promise.all(ops)
    return { toast: 'Uloženo ✓ — vítěz postoupil do finále' }
  }
  return { toast: 'Uloženo ✓' }
}

export const formatSixCrossDef: TournamentFormatDef = {
  id: 'groups_six_cross',
  label: 'Skupiny + Křížový QF',
  description: '6 postupujících: 3 QF bez bye — vítěz prostředního zápasu přímo do finále',
  groupConfig: { tournamentFormat: 'groups', defaultGroups: 3, defaultAdvancingPerGroup: 2 },
  fns: { generate, seed, autoAdvance },
}
