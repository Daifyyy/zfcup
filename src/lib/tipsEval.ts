import { supabase } from './supabase'
import { calcGroupStandings } from './standings'
import type { Group } from '../hooks/useGroups'
import type { BracketRound } from '../hooks/useBracket'
import type { Match } from '../hooks/useMatches'

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

  // Batch update: 2 dotazy místo N sekvenčních
  const correctIds = allTips
    .filter(t => t.predicted_team_id === correctTeamId && (!t.evaluated || t.points_earned !== pts))
    .map(t => t.id)
  const wrongIds = allTips
    .filter(t => t.predicted_team_id !== correctTeamId && (!t.evaluated || t.points_earned !== 0))
    .map(t => t.id)

  if (!correctIds.length && !wrongIds.length) return false

  const ops: Promise<unknown>[] = []
  if (correctIds.length)
    ops.push(supabase.from('special_tips').update({ evaluated: true, points_earned: pts }).in('id', correctIds))
  if (wrongIds.length)
    ops.push(supabase.from('special_tips').update({ evaluated: true, points_earned: 0 }).in('id', wrongIds))
  await Promise.all(ops)
  return true
}

export async function recalcTipsterPoints(): Promise<void> {
  // Pokus o RPC funkci (1 dotaz místo 4N) — funguje po spuštění 06_indexes.sql
  const { error: rpcErr } = await supabase.rpc('recalc_all_tipster_points')
  if (!rpcErr) return

  // Fallback: 3 SELECT (vše najednou) + N paralelních UPDATE
  const { data: tipsters } = await supabase.from('tipsters').select('id')
  if (!tipsters?.length) return
  const [{ data: allTips }, { data: allBt }, { data: allSt }] = await Promise.all([
    supabase.from('tips').select('tipster_id, points_earned'),
    supabase.from('bracket_tips').select('tipster_id, points_earned'),
    supabase.from('special_tips').select('tipster_id, points_earned'),
  ])
  type Row = { tipster_id: string; points_earned: number }
  const sumFor = (rows: Row[] | null, id: string) =>
    (rows ?? []).filter(r => r.tipster_id === id).reduce((s, r) => s + (r.points_earned ?? 0), 0)
  await Promise.all(tipsters.map(({ id }) =>
    supabase.from('tipsters')
      .update({ total_points: sumFor(allTips as Row[], id) + sumFor(allBt as Row[], id) + sumFor(allSt as Row[], id) })
      .eq('id', id)
  ))
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

// Liga bez playoff: zkontroluje zda jsou odehrány všechny liga zápasy a vyhodnotí tournament_winner dle tabulky.
export async function checkLeagueTournamentWinner(ligaGroup: Group): Promise<boolean> {
  const { data: allMatches } = await supabase
    .from('matches').select('*').eq('group_id', ligaGroup.id)
  if (!allMatches?.length || !(allMatches as Match[]).every(m => m.played)) return false

  const rows = calcGroupStandings(ligaGroup, allMatches as Match[])
  if (!rows.length) return false

  const changed = await evaluateSpecialTip('tournament_winner', rows[0].id)
  if (changed) await recalcTipsterPoints()
  return changed
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
