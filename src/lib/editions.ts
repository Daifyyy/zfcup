// Navazování ročníků soutěže: identita klubů/hráčů, převzetí týmů a soupisek.
// Vyžaduje migraci 09 (tabulky clubs, persons; sloupce teams.club_id, players.person_id).
import { supabase } from './supabase'
import { normalizeName } from './history'

interface TeamRow { id: string; name: string; color: string; logo_url: string | null; club_id: string | null }
interface PlayerRow { id: string; team_id: string; name: string; number: number | null; role: string | null; avatar_url: string | null; person_id: string | null }
interface ClubRow { id: string; name: string }
interface PersonRow { id: string; name: string }

const CHUNK = 25

async function inChunks<T>(items: T[], fn: (item: T) => PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  for (let i = 0; i < items.length; i += CHUNK) {
    const results = await Promise.all(items.slice(i, i + CHUNK).map(fn))
    const failed = results.find(r => r.error)
    if (failed?.error) throw new Error(failed.error.message)
  }
}

/**
 * Zajistí, že všechny týmy a hráči turnaje mají identitu v soutěži.
 * Tým bez club_id → existující klub se stejným (normalizovaným) jménem, jinak nový klub.
 * Hráč bez person_id → osoba se stejným jménem, která už hrála za tentýž klub, jinak nová osoba.
 * Vrací počty nově založených klubů/osob.
 */
export async function ensureIdentities(tournamentId: string, competitionId: string): Promise<{ clubs: number; persons: number }> {
  const [{ data: teams, error: tErr }, { data: players, error: pErr }, { data: clubs, error: cErr }] = await Promise.all([
    supabase.from('teams').select('id,name,color,logo_url,club_id').eq('tournament_id', tournamentId),
    supabase.from('players').select('id,team_id,name,number,role,avatar_url,person_id').eq('tournament_id', tournamentId),
    supabase.from('clubs').select('id,name').eq('competition_id', competitionId),
  ])
  if (tErr) throw new Error(tErr.message)
  if (pErr) throw new Error(pErr.message)
  if (cErr) throw new Error(cErr.message)

  const clubByName = new Map((clubs as ClubRow[] ?? []).map(c => [normalizeName(c.name), c.id]))
  let createdClubs = 0
  const teamClub = new Map<string, string>()
  const teamUpdates: { id: string; club_id: string }[] = []
  for (const t of (teams ?? []) as TeamRow[]) {
    if (t.club_id) { teamClub.set(t.id, t.club_id); continue }
    let clubId = clubByName.get(normalizeName(t.name))
    if (!clubId) {
      const { data: c, error } = await supabase.from('clubs')
        .insert({ competition_id: competitionId, name: t.name, color: t.color, logo_url: t.logo_url })
        .select('id').single()
      if (error) throw new Error(error.message)
      clubId = c.id as string
      clubByName.set(normalizeName(t.name), clubId)
      createdClubs++
    }
    teamClub.set(t.id, clubId)
    teamUpdates.push({ id: t.id, club_id: clubId })
  }
  await inChunks(teamUpdates, u => supabase.from('teams').update({ club_id: u.club_id }).eq('id', u.id))

  // Osoby, které už v soutěži hrály, indexované podle klubu + jména
  const clubIds = [...new Set(teamClub.values())]
  const personByClubName = new Map<string, string>()
  if (clubIds.length) {
    const { data: linkedTeams } = await supabase.from('teams').select('id,club_id').in('club_id', clubIds)
    const linkedTeamIds = (linkedTeams ?? []).map(t => t.id)
    const clubOfTeam = new Map((linkedTeams ?? []).map(t => [t.id, t.club_id as string]))
    if (linkedTeamIds.length) {
      const { data: linkedPlayers } = await supabase.from('players').select('team_id,name,person_id').in('team_id', linkedTeamIds).not('person_id', 'is', null)
      for (const p of linkedPlayers ?? []) {
        personByClubName.set(`${clubOfTeam.get(p.team_id)}|${normalizeName(p.name)}`, p.person_id as string)
      }
    }
  }

  let createdPersons = 0
  const playerUpdates: { id: string; person_id: string }[] = []
  for (const p of (players ?? []) as PlayerRow[]) {
    if (p.person_id) continue
    const club = teamClub.get(p.team_id)
    const k = `${club}|${normalizeName(p.name)}`
    let personId = personByClubName.get(k)
    if (!personId) {
      const { data: person, error } = await supabase.from('persons')
        .insert({ competition_id: competitionId, name: p.name, avatar_url: p.avatar_url })
        .select('id').single()
      if (error) throw new Error(error.message)
      personId = (person as PersonRow).id
      personByClubName.set(k, personId)
      createdPersons++
    }
    playerUpdates.push({ id: p.id, person_id: personId })
  }
  await inChunks(playerUpdates, u => supabase.from('players').update({ person_id: u.person_id }).eq('id', u.id))

  return { clubs: createdClubs, persons: createdPersons }
}

/**
 * Převezme týmy a soupisky z předchozího ročníku do nového.
 * Zkopíruje jen týmy, jejichž klub v novém ročníku ještě není (lze spustit opakovaně).
 * Statistiky ani zápasy se nekopírují.
 */
export async function carryOverTeams(fromTournamentId: string, toTournamentId: string, competitionId: string): Promise<{ teams: number; players: number }> {
  await ensureIdentities(fromTournamentId, competitionId)

  const [{ data: srcTeams, error: e1 }, { data: srcPlayers, error: e2 }, { data: existing, error: e3 }] = await Promise.all([
    supabase.from('teams').select('id,name,color,logo_url,club_id').eq('tournament_id', fromTournamentId),
    supabase.from('players').select('id,team_id,name,number,role,avatar_url,person_id').eq('tournament_id', fromTournamentId),
    supabase.from('teams').select('club_id,name').eq('tournament_id', toTournamentId),
  ])
  if (e1) throw new Error(e1.message)
  if (e2) throw new Error(e2.message)
  if (e3) throw new Error(e3.message)

  const existingClubs = new Set((existing ?? []).map(t => t.club_id).filter(Boolean))
  const existingNames = new Set((existing ?? []).map(t => normalizeName(t.name)))
  const toCopy = ((srcTeams ?? []) as TeamRow[]).filter(t => !(t.club_id && existingClubs.has(t.club_id)) && !existingNames.has(normalizeName(t.name)))
  if (toCopy.length === 0) return { teams: 0, players: 0 }

  const { data: newTeams, error: insErr } = await supabase.from('teams')
    .insert(toCopy.map(t => ({ tournament_id: toTournamentId, name: t.name, color: t.color, logo_url: t.logo_url, club_id: t.club_id })))
    .select('id,club_id')
  if (insErr) throw new Error(insErr.message)

  // Hromadný INSERT vrací řádky ve stejném pořadí jako vstup → párovat podle indexu
  // (párování podle club_id kolidovalo u týmů bez klubu nebo se stejným klubem).
  if ((newTeams ?? []).length !== toCopy.length) throw new Error('Převzetí týmů: nesouhlasí počet vložených týmů')
  const oldToNew = new Map(toCopy.map((t, i) => [t.id, (newTeams ?? [])[i].id as string]))
  const playerRows = ((srcPlayers ?? []) as PlayerRow[])
    .filter(p => oldToNew.get(p.team_id))
    .map(p => ({
      tournament_id: toTournamentId, team_id: oldToNew.get(p.team_id)!, name: p.name, number: p.number,
      role: p.role, avatar_url: p.avatar_url, person_id: p.person_id,
    }))
  for (let i = 0; i < playerRows.length; i += 200) {
    const { error } = await supabase.from('players').insert(playerRows.slice(i, i + 200))
    if (error) throw new Error(error.message)
  }
  return { teams: toCopy.length, players: playerRows.length }
}

/** Nastavení, která nový ročník přebírá z posledního ročníku soutěže (formát, časy, moduly, vzhled). */
const EDITION_SETTING_COLUMNS = [
  'format', 'format_id', 'num_groups', 'advancing_per_group', 'league_has_playoff', 'playoff_style',
  'match_duration', 'halves', 'round_break', 'num_pitches',
  'assists_enabled', 'cards_enabled', 'penalty_minutes_enabled', 'sponsors_enabled',
  'brand_primary', 'brand_secondary', 'venue',
] as const

/** Poslední ročník soutěže (id + přenositelná nastavení), nebo null. */
export async function lastEdition(competitionId: string): Promise<{ id: string; settings: Record<string, unknown> } | null> {
  const { data, error } = await supabase.from('tournament')
    .select('*')
    .eq('competition_id', competitionId)
    .order('edition', { ascending: false })
    .limit(1)
  if (error || !data?.length) return null
  const row = data[0] as Record<string, unknown>
  const settings: Record<string, unknown> = {}
  // Kopírovat jen sloupce, které v DB opravdu jsou (frontend musí fungovat i bez novějších migrací)
  for (const col of EDITION_SETTING_COLUMNS) if (col in row && row[col] !== undefined) settings[col] = row[col]
  return { id: row.id as string, settings }
}

/** Další volné číslo ročníku v soutěži. */
export async function nextEditionNumber(competitionId: string): Promise<number> {
  const { data } = await supabase.from('tournament').select('edition').eq('competition_id', competitionId)
  const max = Math.max(0, ...(data ?? []).map(r => r.edition ?? 0))
  return max + 1
}

export function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}
