import { supabase } from '../supabase'
import type { BracketSlot } from '../../hooks/useBracket'

export async function createRound(name: string, slotCount: number, position: number): Promise<void> {
  const { data: round, error } = await supabase
    .from('bracket_rounds').insert({ name, position }).select().single()
  if (error) throw error
  const slots = Array.from({ length: slotCount }, (_, i) => ({
    round_id: round.id, position: i,
    home_id: null, away_id: null,
    home_score: 0, away_score: 0, played: false,
  }))
  const { error: se } = await supabase.from('bracket_slots').insert(slots)
  if (se) throw se
}

export function slotsOf(bracketSlots: BracketSlot[], roundId: string): BracketSlot[] {
  return [...bracketSlots].filter(s => s.round_id === roundId).sort((a, b) => a.position - b.position)
}

export function fill(arr: (string | null | undefined)[], i: number): string | null {
  return arr[i] ?? null
}
