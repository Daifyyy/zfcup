import { supabase } from './supabase'
import { calcGroupStandings } from './standings'
import type { Group } from '../hooks/useGroups'
import type { BracketRound } from '../hooks/useBracket'
import type { Match } from '../hooks/useMatches'
import type { Team } from '../hooks/useTeams'

// Vrátí true pokud se skutečně změnil nějaký záznam
export async function evaluateSpecialTip(tipType: string, correctTeamId: string, tournamentId: string): Promise<boolean> {
  const pointsMap: Record<string, number> = {
    tournament_winner: 10,
    group_winner: 5,
    group_last: 3,
    most_goals_team: 5,
  }
  const key = tipType === 'tournament_winner' ? 'tournament_winner'
    : tipType.startsWith('group_winner:') ? 'group_winner'
    : tipType.startsWith('group_last:') ? 'group_last'
    : ''
  const pts = pointsMap[key] ?? 0

  const { data: allTips } = await supabase
    .from('special_tips').select('id, predicted_team_id, evaluated, points_earned')
    .eq('tip_type', tipType).eq('tournament_id', tournamentId)
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

export async function recalcTipsterPoints(tournamentId: string): Promise<void> {
  // Pokus o RPC funkci (1 dotaz místo 4N) — funguje po spuštění 06_indexes.sql
  const { error: rpcErr } = await supabase.rpc('recalc_all_tipster_points')
  if (!rpcErr) return

  // Fallback: 3 SELECT (vše najednou) + N paralelních UPDATE
  const { data: tipsters } = await supabase.from('tipsters').select('id').eq('tournament_id', tournamentId)
  if (!tipsters?.length) return
  const tipsterIds = tipsters.map(t => t.id)
  const [{ data: allTips }, { data: allBt }, { data: allSt }] = await Promise.all([
    supabase.from('tips').select('tipster_id, points_earned').in('tipster_id', tipsterIds),
    supabase.from('bracket_tips').select('tipster_id, points_earned').in('tipster_id', tipsterIds),
    supabase.from('special_tips').select('tipster_id, points_earned').in('tipster_id', tipsterIds),
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
export async function checkGroupSpecialTips(groupId: string, group: Group, tournamentId: string): Promise<boolean> {
  const { data: groupMatches } = await supabase
    .from('matches').select('*').eq('group_id', groupId)

  if (!groupMatches?.length || !groupMatches.every(m => m.played)) return false

  const rows = calcGroupStandings(group, groupMatches)
  if (rows.length < 2) return false

  const winnerId = rows[0].id
  const lastId = rows[rows.length - 1].id
  const [changedW, changedL] = await Promise.all([
    evaluateSpecialTip(`group_winner:${groupId}`, winnerId, tournamentId),
    evaluateSpecialTip(`group_last:${groupId}`, lastId, tournamentId),
  ])

  if (changedW || changedL) await recalcTipsterPoints(tournamentId)
  return changedW || changedL
}

// Liga bez playoff: zkontroluje zda jsou odehrány všechny liga zápasy a vyhodnotí tournament_winner dle tabulky.
export async function checkLeagueTournamentWinner(ligaGroup: Group, tournamentId: string): Promise<boolean> {
  const { data: allMatches } = await supabase
    .from('matches').select('*').eq('group_id', ligaGroup.id)
  if (!allMatches?.length || !(allMatches as Match[]).every(m => m.played)) return false

  const rows = calcGroupStandings(ligaGroup, allMatches as Match[])
  if (!rows.length) return false

  const changed = await evaluateSpecialTip('tournament_winner', rows[0].id, tournamentId)
  if (changed) await recalcTipsterPoints(tournamentId)
  return changed
}

// Evaluates player-based special tips (predicted_player_id).
// Handles ties: if multiple players share top scorer, all correct IDs are winners.
export async function evaluateSpecialTipPlayer(tipType: string, correctPlayerIds: string[], pts: number, tournamentId: string): Promise<boolean> {
  const { data: allTips } = await supabase
    .from('special_tips').select('id, predicted_player_id, evaluated, points_earned')
    .eq('tip_type', tipType).eq('tournament_id', tournamentId)
  if (!allTips?.length) return false

  const correctSet = new Set(correctPlayerIds)
  const correctIds = allTips
    .filter(t => t.predicted_player_id && correctSet.has(t.predicted_player_id) && (!t.evaluated || t.points_earned !== pts))
    .map(t => t.id)
  const wrongIds = allTips
    .filter(t => (!t.predicted_player_id || !correctSet.has(t.predicted_player_id)) && (!t.evaluated || t.points_earned !== 0))
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

// Vyhodnotí top_scorer: nejlepší střelec turnaje (skupiny + playoff).
export async function checkTopScorer(tournamentId: string): Promise<boolean> {
  const [{ data: goals }, { data: bracketGoals }] = await Promise.all([
    supabase.from('goals').select('player_id, count').eq('tournament_id', tournamentId),
    supabase.from('bracket_goals').select('player_id, count').eq('tournament_id', tournamentId),
  ])
  const agg: Record<string, number> = {}
  for (const g of [...(goals ?? []), ...(bracketGoals ?? [])]) {
    agg[g.player_id] = (agg[g.player_id] ?? 0) + g.count
  }
  const maxGoals = Math.max(...Object.values(agg), 0)
  if (maxGoals === 0) return false
  const topIds = Object.entries(agg).filter(([, v]) => v === maxGoals).map(([id]) => id)

  const changed = await evaluateSpecialTipPlayer('top_scorer', topIds, 10, tournamentId)
  if (changed) await recalcTipsterPoints(tournamentId)
  return changed
}

// Vyhodnotí most_goals_team: tým s nejvíce góly z celého turnaje.
// Batch implementace — 1 SELECT na special_tips místo N sekvenčních volání evaluateSpecialTip.
export async function checkMostGoalsTeam(teams: Team[], tournamentId: string): Promise<boolean> {
  const [{ data: goals }, { data: bracketGoals }, { data: players }] = await Promise.all([
    supabase.from('goals').select('player_id, count').eq('tournament_id', tournamentId),
    supabase.from('bracket_goals').select('player_id, count').eq('tournament_id', tournamentId),
    supabase.from('players').select('id, team_id').eq('tournament_id', tournamentId),
  ])
  const playerTeam: Record<string, string> = {}
  for (const p of (players ?? [])) playerTeam[p.id] = p.team_id

  const agg: Record<string, number> = {}
  for (const t of teams) agg[t.id] = 0
  for (const g of [...(goals ?? []), ...(bracketGoals ?? [])]) {
    const tid = playerTeam[g.player_id]
    if (tid) agg[tid] = (agg[tid] ?? 0) + g.count
  }
  const maxGoals = Math.max(...Object.values(agg), 0)
  if (maxGoals === 0) return false
  const topTeamIds = Object.entries(agg).filter(([, v]) => v === maxGoals).map(([id]) => id)
  if (topTeamIds.length === 0) return false

  // Batch: 1 SELECT + max 2 UPDATE místo N×(SELECT + 2×UPDATE)
  const { data: allTips } = await supabase
    .from('special_tips').select('id, predicted_team_id, evaluated, points_earned')
    .eq('tip_type', 'most_goals_team').eq('tournament_id', tournamentId)
  if (!allTips?.length) return false

  const topSet = new Set(topTeamIds)
  const pts = 5
  const correctIds = allTips
    .filter(t => t.predicted_team_id && topSet.has(t.predicted_team_id) && (!t.evaluated || t.points_earned !== pts))
    .map(t => t.id)
  const wrongIds = allTips
    .filter(t => (!t.predicted_team_id || !topSet.has(t.predicted_team_id)) && (!t.evaluated || t.points_earned !== 0))
    .map(t => t.id)

  if (!correctIds.length && !wrongIds.length) return false

  const ops: Promise<unknown>[] = []
  if (correctIds.length)
    ops.push(supabase.from('special_tips').update({ evaluated: true, points_earned: pts }).in('id', correctIds))
  if (wrongIds.length)
    ops.push(supabase.from('special_tips').update({ evaluated: true, points_earned: 0 }).in('id', wrongIds))
  await Promise.all(ops)
  await recalcTipsterPoints(tournamentId)
  return true
}

// Zkontroluje zda je odehráno finále a vyhodnotí tournament_winner special tipy.
// Fetches fresh bracket_slots from DB to avoid stale data after save.
export async function checkTournamentWinner(bracketRounds: BracketRound[], tournamentId: string): Promise<boolean> {
  if (!bracketRounds.length) return false

  const { data: bracketSlots } = await supabase
    .from('bracket_slots').select('*').eq('tournament_id', tournamentId)
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

  const changed = await evaluateSpecialTip('tournament_winner', winnerId, tournamentId)
  if (changed) await recalcTipsterPoints(tournamentId)
  return changed
}
