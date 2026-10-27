// Knihovna klubů a hráčů organizátora (migrace 13).
// Klub = identita týmu napříč turnaji a soutěžemi jednoho organizátora; osoba = identita hráče.
// Bez migrace 13 vrací `libraryAvailable() === false` a UI knihovnu skryje.
import { supabase } from './supabase'
import { normalizeName } from './history'
import { slugify } from './editions'

export interface LibraryClub {
  id: string
  owner_id: string | null
  competition_id: string | null
  name: string
  slug: string | null
  color: string | null
  logo_url: string | null
}

export interface LibraryPerson {
  id: string
  owner_id: string | null
  club_id: string | null
  name: string
  number: number | null
  role: string | null
  avatar_url: string | null
}

let availability: Promise<boolean> | null = null

/** Je spuštěná migrace 13? (výsledek se drží po dobu běhu stránky) */
export function libraryAvailable(): Promise<boolean> {
  availability ??= (async () => {
    const { error } = await supabase.from('clubs').select('owner_id,slug').limit(1)
    if (!error) return true
    availability = null // příště zkusit znovu (např. po spuštění migrace)
    return false
  })()
  return availability
}

/** Volný slug pro URL /k/{slug} — kolize dostanou číselnou příponu. */
export async function uniqueClubSlug(name: string, exceptId?: string): Promise<string> {
  const base = slugify(name).slice(0, 50).replace(/-+$/, '') || 'klub'
  const { data } = await supabase.from('clubs').select('id,slug').like('slug', `${base}%`)
  const taken = new Set((data ?? []).filter(c => c.id !== exceptId).map(c => c.slug as string))
  if (!taken.has(base)) return base
  for (let i = 2; i < 1000; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`
  return `${base}-${Date.now().toString(36)}`
}

/** Knihovna klubů organizátora (+ jejich hráči). */
export async function fetchLibrary(ownerId: string): Promise<{ clubs: LibraryClub[]; persons: LibraryPerson[] }> {
  const { data: clubs, error } = await supabase.from('clubs')
    .select('id,owner_id,competition_id,name,slug,color,logo_url').eq('owner_id', ownerId).order('name')
  if (error) throw new Error(error.message)
  const { data: persons, error: pErr } = await supabase.from('persons')
    .select('id,owner_id,club_id,name,number,role,avatar_url').eq('owner_id', ownerId).not('club_id', 'is', null)
  if (pErr) throw new Error(pErr.message)
  return { clubs: (clubs ?? []) as LibraryClub[], persons: (persons ?? []) as LibraryPerson[] }
}

export function rosterOfClub(persons: LibraryPerson[], clubId: string): LibraryPerson[] {
  return persons
    .filter(p => p.club_id === clubId)
    .sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, 'cs'))
}

export async function createClub(ownerId: string, c: { name: string; color?: string | null; logo_url?: string | null; competition_id?: string | null }): Promise<LibraryClub> {
  const slug = await uniqueClubSlug(c.name)
  const { data, error } = await supabase.from('clubs')
    .insert({ owner_id: ownerId, name: c.name.trim(), color: c.color ?? null, logo_url: c.logo_url ?? null, competition_id: c.competition_id ?? null, slug })
    .select('id,owner_id,competition_id,name,slug,color,logo_url').single()
  if (error) throw new Error(error.message)
  return data as LibraryClub
}

/**
 * Přidá klub z knihovny do turnaje: nový tým (club_id) + soupiska z knihovny (person_id).
 * Pokud už v turnaji tým tohoto klubu je, nic nevytvoří.
 */
export async function addClubToTournament(tournamentId: string, club: LibraryClub, roster: LibraryPerson[]): Promise<{ created: boolean; players: number }> {
  const { data: existing, error: e1 } = await supabase.from('teams').select('id').eq('tournament_id', tournamentId).eq('club_id', club.id).limit(1)
  if (e1) throw new Error(e1.message)
  if (existing?.length) return { created: false, players: 0 }
  const { data: team, error } = await supabase.from('teams')
    .insert({ tournament_id: tournamentId, name: club.name, color: club.color || '#1d4ed8', logo_url: club.logo_url, club_id: club.id })
    .select('id').single()
  if (error) throw new Error(error.message)
  if (roster.length) {
    const { error: pErr } = await supabase.from('players').insert(roster.map(p => ({
      tournament_id: tournamentId, team_id: team.id, name: p.name, number: p.number, role: p.role,
      avatar_url: p.avatar_url, person_id: p.id,
    })))
    if (pErr) throw new Error(pErr.message)
  }
  return { created: true, players: roster.length }
}

interface TeamLike { id: string; name: string; color: string; logo_url: string | null; club_id?: string | null }
interface PlayerLike { id: string; name: string; number: number | null; role: string | null; avatar_url: string | null; person_id?: string | null }

/**
 * Uloží tým turnaje do knihovny: klub (nový, nebo existující se stejným jménem) a hráče jako osoby klubu.
 * Tým a hráči se s knihovnou propojí (club_id / person_id). Lze spustit opakovaně.
 */
export async function saveTeamToLibrary(ownerId: string, team: TeamLike, players: PlayerLike[]): Promise<{ club: LibraryClub; newClub: boolean; persons: number }> {
  let club: LibraryClub | null = null
  if (team.club_id) {
    const { data } = await supabase.from('clubs').select('id,owner_id,competition_id,name,slug,color,logo_url').eq('id', team.club_id).maybeSingle()
    club = data as LibraryClub | null
    // Starší klub ze soutěže bez slugu/vlastníka → doplnit
    if (club && (!club.slug || !club.owner_id)) {
      const patch: Partial<LibraryClub> = {}
      if (!club.slug) patch.slug = await uniqueClubSlug(club.name, club.id)
      if (!club.owner_id) patch.owner_id = ownerId
      const { error } = await supabase.from('clubs').update(patch).eq('id', club.id)
      if (error) throw new Error(error.message)
      club = { ...club, ...patch }
    }
  }
  let newClub = false
  if (!club) {
    const { data } = await supabase.from('clubs').select('id,owner_id,competition_id,name,slug,color,logo_url').eq('owner_id', ownerId)
    club = ((data ?? []) as LibraryClub[]).find(c => normalizeName(c.name) === normalizeName(team.name)) ?? null
    if (!club) { club = await createClub(ownerId, { name: team.name, color: team.color, logo_url: team.logo_url }); newClub = true }
    const { error } = await supabase.from('teams').update({ club_id: club.id }).eq('id', team.id)
    if (error) throw new Error(error.message)
  }

  // Hráči → osoby klubu (podle person_id, jinak podle jména v klubu)
  const { data: libPersons, error: lpErr } = await supabase.from('persons').select('id,name,club_id').eq('club_id', club.id)
  if (lpErr) throw new Error(lpErr.message)
  const byName = new Map((libPersons ?? []).map(p => [normalizeName(p.name), p.id as string]))
  const libIds = new Set((libPersons ?? []).map(p => p.id as string))
  let created = 0
  for (const p of players) {
    let personId = p.person_id && libIds.has(p.person_id) ? p.person_id : byName.get(normalizeName(p.name))
    if (personId) {
      // Aktualizovat číslo/roli v knihovně podle poslední soupisky
      const { error } = await supabase.from('persons').update({ number: p.number, role: p.role, ...(p.avatar_url ? { avatar_url: p.avatar_url } : {}) }).eq('id', personId)
      if (error) throw new Error(error.message)
    } else if (p.person_id) {
      // Osoba existuje (např. ze soutěže), jen ještě není v klubu
      personId = p.person_id
      const { error } = await supabase.from('persons').update({ club_id: club.id, owner_id: ownerId, number: p.number, role: p.role }).eq('id', personId)
      if (error) throw new Error(error.message)
    } else {
      const { data, error } = await supabase.from('persons')
        .insert({ owner_id: ownerId, club_id: club.id, name: p.name, number: p.number, role: p.role, avatar_url: p.avatar_url })
        .select('id').single()
      if (error) throw new Error(error.message)
      personId = data.id as string
      created++
    }
    byName.set(normalizeName(p.name), personId)
    if (p.person_id !== personId) {
      const { error } = await supabase.from('players').update({ person_id: personId }).eq('id', p.id)
      if (error) throw new Error(error.message)
    }
  }
  return { club, newClub, persons: created }
}

/**
 * Sloučí klub `removeId` do `keepId`: týmy a osoby přejdou pod ponechaný klub,
 * osoby se stejným jménem se spojí (hráči ukážou na ponechanou osobu), sloučený klub se smaže.
 */
export async function mergeClubs(keepId: string, removeId: string): Promise<{ teams: number; persons: number }> {
  if (keepId === removeId) return { teams: 0, persons: 0 }
  const [{ data: keepPersons, error: e1 }, { data: removePersons, error: e2 }, { data: teams, error: e3 }] = await Promise.all([
    supabase.from('persons').select('id,name').eq('club_id', keepId),
    supabase.from('persons').select('id,name').eq('club_id', removeId),
    supabase.from('teams').select('id').eq('club_id', removeId),
  ])
  if (e1 || e2 || e3) throw new Error((e1 ?? e2 ?? e3)!.message)

  const keepByName = new Map((keepPersons ?? []).map(p => [normalizeName(p.name), p.id as string]))
  const duplicates: { from: string; to: string }[] = []
  const moved: string[] = []
  for (const p of removePersons ?? []) {
    const twin = keepByName.get(normalizeName(p.name))
    if (twin) duplicates.push({ from: p.id, to: twin })
    else moved.push(p.id)
  }

  const teamIds = (teams ?? []).map(t => t.id as string)
  if (teamIds.length) {
    const { error } = await supabase.from('teams').update({ club_id: keepId }).in('id', teamIds)
    if (error) throw new Error(error.message)
  }
  if (moved.length) {
    const { error } = await supabase.from('persons').update({ club_id: keepId }).in('id', moved)
    if (error) throw new Error(error.message)
  }
  for (const d of duplicates) {
    const { error } = await supabase.from('players').update({ person_id: d.to }).eq('person_id', d.from)
    if (error) throw new Error(error.message)
  }
  if (duplicates.length) {
    const { error } = await supabase.from('persons').delete().in('id', duplicates.map(d => d.from))
    if (error) throw new Error(error.message)
  }
  const { error } = await supabase.from('clubs').delete().eq('id', removeId)
  if (error) throw new Error(error.message)
  return { teams: teamIds.length, persons: moved.length + duplicates.length }
}
