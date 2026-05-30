import { supabase } from '../supabase'
import { calcGroupStandings } from '../standings'
import { createRound, slotsOf, fill } from './bracketHelpers'
import type { TournamentFormatDef, SeedParams, AutoAdvanceParams, AutoAdvanceResult } from '../formats'

async function generate(): Promise<void> {
  await createRound('Čtvrtfinále', 4, 0)
  await createRound('Semifinále',  2, 1)
  await createRound('O 3. místo',  1, 2)
  await createRound('Finále',      1, 3)
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
      qfPairs.push({ home: fill(H, 1), away: fill(G, 2) })
      qfPairs.push({ home: fill(H, 0), away: fill(G, 3) })
      qfPairs.push({ home: fill(G, 1), away: fill(H, 2) })
    } else {
      // 2 per group: cross-seed 1A vs 2B, 1B vs 2A
      qfPairs.push({ home: fill(G, 0), away: fill(H, 1) })
      qfPairs.push({ home: fill(H, 0), away: fill(G, 1) })
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

export const formatQFDef: TournamentFormatDef = {
  id: 'groups_qf',
  label: 'Skupiny + Čtvrtfinále',
  description: '8 postupujících (4 skupiny nebo 2 skupiny × top-4): QF → SF → O 3. → Finále',
  groupConfig: { tournamentFormat: 'groups', defaultGroups: 4, defaultAdvancingPerGroup: 2 },
  fns: { generate, seed, autoAdvance },
}
