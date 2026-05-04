import { supabase } from './supabase'
import { calcGroupStandings } from './standings'
import type { Group } from '../hooks/useGroups'
import type { BracketRound } from '../hooks/useBracket'

// Vrátí true pokud se skutečně změnil nějaký záznam
export async function evaluateSpecialTip(tipType: string, correctTeamId: string): Promise<boolean> {
  const pointsMap: Record<string, number> = {
    tournament_winner: 10,
    group_winner: 5,
    group_last: 3,
  }
  const key = tipType === 'tournament_winner' ? 'tournament_winner'
    : tipType.startsWith('group_winner:') ? 'group_winner'
    : tipType.startsWith('group_last:') ? 'group_last'
    : ''
  const pts = pointsMap[key] ?? 0

  const { data: allTips } = await supabase
    .from('special_tips').select('id, predicted_team_id, evaluated, points_earned').eq('tip_type', tipType)
  if (!allTips?.length) return false

  let anyChanged = false
  for (const t of allTips) {
    const earned = t.predicted_team_id === correctTeamId ? pts : 0
    if (!t.evaluated || t.points_earned !== earned) {
      await supabase.from('special_tips')
        .update({ evaluated: true, points_earned: earned })
        .eq('id', t.id)
      anyChanged = true
    }
  }
  return anyChanged
}

export async function recalcTipsterPoints(): Promise<void> {
  const { data: tipsters } = await supabase.from('tipsters').select('id')
  if (!tipsters?.length) return
  await Promise.all(tipsters.map(async (tipster) => {
    const [{ data: t1 }, { data: t2 }, { data: t3 }] = await Promise.all([
      supabase.from('tips').select('points_earned').eq('tipster_id', tipster.id),
      supabase.from('bracket_tips').select('points_earned').eq('tipster_id', tipster.id),
      supabase.from('special_tips').select('points_earned').eq('tipster_id', tipster.id),
    ])
    const total = [...(t1 ?? []), ...(t2 ?? []), ...(t3 ?? [])]
      .reduce((s, r) => s + (r.points_earned ?? 0), 0)
    await supabase.from('tipsters').update({ total_points: total }).eq('id', tipster.id)
  }))
}

// Zkontroluje zda je skupina dokončena a vyhodnotí group_winner + group_last special tipy.
// Fetches fresh matches from DB to avoid stale data after save.
export async function checkGroupSpecialTips(groupId: string, group: Group): Promise<boolean> {
  const { data: groupMatches } = await supabase
    .from('matches').select('*').eq('group_id', groupId)

  if (!groupMatches?.length || !groupMatches.every(m => m.played)) return false

  const rows = calcGroupStandings(group, groupMatches)
  if (rows.length < 2) return false

  const winnerId = rows[0].id
  const lastId = rows[rows.length - 1].id
  const [changedW, changedL] = await Promise.all([
    evaluateSpecialTip(`group_winner:${groupId}`, winnerId),
    evaluateSpecialTip(`group_last:${groupId}`, lastId),
  ])

  if (changedW || changedL) await recalcTipsterPoints()
  return changedW || changedL
}

// Zkontroluje zda je odehráno finále a vyhodnotí tournament_winner special tipy.
// Fetches fresh bracket_slots from DB to avoid stale data after save.
export async function checkTournamentWinner(bracketRounds: BracketRound[]): Promise<boolean> {
  if (!bracketRounds.length) return false

  const { data: bracketSlots } = await supabase.from('bracket_slots').select('*')
  if (!bracketSlots?.length) return false

  const maxPos = Math.max(...bracketRounds.map(r => r.position))
  const finalRound = bracketRounds.find(r =>
    r.position === maxPos && !/3|třet|bronze/i.test(r.name)
  )
  if (!finalRound) return false

  const finalSlot = bracketSlots.find(s => s.round_id === finalRound.id && s.played)
  if (!finalSlot || !finalSlot.home_id || !finalSlot.away_id) return false
  if (finalSlot.home_score === finalSlot.away_score) return false

  const winnerId = finalSlot.home_score > finalSlot.away_score
    ? finalSlot.home_id
    : finalSlot.away_id

  const changed = await evaluateSpecialTip('tournament_winner', winnerId)
  if (changed) await recalcTipsterPoints()
  return changed
}
