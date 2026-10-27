// Soutěže (competitions) a historie jejich ročníků — migrace 09.
// Bez migrace vrací `available: false` a prázdná data (UI sekce soutěží skryje).
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'
import type { Tournament } from './useTournament'
import type { Team } from './useTeams'
import type { Player } from './usePlayers'
import type { Group } from './useGroups'
import type { Match } from './useMatches'
import type { BracketRound, BracketSlot } from './useBracket'
import type { Goal } from './useGoals'
import type { BracketGoal } from './useBracketGoals'
import type { SportId } from '../lib/sports'

export interface Competition {
  id: string
  name: string
  slug: string
  sport: SportId
  logo_url: string | null
  description: string
  owner_id: string | null
  created_at: string
}

export interface Club { id: string; competition_id: string; name: string; color: string | null; logo_url: string | null }
export interface Person { id: string; competition_id: string; name: string; avatar_url: string | null }

/** Chybí tabulka po nespuštěné migraci? (PostgREST PGRST205 / Postgres 42P01) */
function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  return err.code === 'PGRST205' || err.code === '42P01' || /does not exist|schema cache/i.test(err.message ?? '')
}

/** Všechny soutěže (pro úvodní stránku a výběr v adminu). */
export function useCompetitions() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [available, setAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function fetch() {
      const { data, error } = await supabase.from('competitions').select('*').order('name')
      if (!error) { setCompetitions((data ?? []) as Competition[]); setAvailable(true) }
      else if (isMissingTable(error)) setAvailable(false)
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()
    const unsub = subscribeTable('competitions', () => fetchRef.current())
    return () => unsub()
  }, [])

  return { competitions, available, loading, refetch: () => fetchRef.current() }
}

/** Ročníky soutěže (turnaje s competition_id), seřazené podle čísla ročníku. */
export function useCompetitionEditions(competitionId: string) {
  const [editions, setEditions] = useState<Tournament[]>([])
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function fetch() {
      if (!competitionId) { setEditions([]); return }
      const { data, error } = await supabase
        .from('tournament').select('*').eq('competition_id', competitionId).order('edition', { ascending: true })
      if (!error) setEditions((data ?? []) as Tournament[])
    }
    fetchRef.current = fetch
    fetch()
    const unsub = subscribeTable('tournament', () => fetchRef.current(), `competition_id=eq.${competitionId}`)
    return () => unsub()
  }, [competitionId])

  return { editions, refetch: () => fetchRef.current() }
}

/** Kompletní data všech ročníků pro výpočet historie (src/lib/history.ts). */
export interface CompetitionHistoryData {
  competition: Competition | null
  editions: Tournament[]
  clubs: Club[]
  persons: Person[]
  teams: Team[]
  players: Player[]
  groups: Group[]
  matches: Match[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  goals: Goal[]
  bracketGoals: BracketGoal[]
  assists: { player_id: string; match_id: string; count: number; tournament_id: string }[]
  bracketAssists: { player_id: string; slot_id: string; count: number; tournament_id: string }[]
  penalties: { player_id: string; match_id: string; minutes: number; tournament_id: string }[]
  bracketPenalties: { player_id: string; slot_id: string; minutes: number; tournament_id: string }[]
  cards: { player_id: string; match_id: string; type: string; tournament_id: string }[]
  bracketCards: { player_id: string; slot_id: string; type: string; tournament_id: string }[]
}

const EMPTY_HISTORY: CompetitionHistoryData = {
  competition: null, editions: [], clubs: [], persons: [], teams: [], players: [], groups: [], matches: [],
  bracketRounds: [], bracketSlots: [], goals: [], bracketGoals: [], assists: [], bracketAssists: [],
  penalties: [], bracketPenalties: [], cards: [], bracketCards: [],
}

/**
 * Načte soutěž podle slugu a všechna data jejích ročníků.
 * `notFound` = slug neexistuje; `available: false` = DB ještě nemá migraci 09.
 */
export function useCompetitionHistory(slug: string) {
  const [data, setData] = useState<CompetitionHistoryData>(EMPTY_HISTORY)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [available, setAvailable] = useState(true)
  const fetchRef = useRef<() => void>(() => {})
  // Pro realtime: id soutěže a ročníků (známé až po prvním načtení)
  const [scope, setScope] = useState<{ compId: string; ids: string[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetch() {
      if (!slug) { setLoading(false); return }
      const { data: comp, error } = await supabase.from('competitions').select('*').eq('slug', slug).maybeSingle()
      if (error) {
        if (isMissingTable(error)) setAvailable(false)
        setLoading(false)
        return
      }
      if (!comp) { setNotFound(true); setLoading(false); return }

      const { data: eds, error: edErr } = await supabase
        .from('tournament').select('*').eq('competition_id', comp.id).order('edition', { ascending: true })
      if (edErr) { setLoading(false); return }
      const ids = (eds ?? []).map(t => t.id)

      const byTournament = async <T,>(table: string): Promise<T[]> => {
        if (!ids.length) return []
        const { data: rows, error: e } = await supabase.from(table).select('*').in('tournament_id', ids)
        return e ? [] : ((rows ?? []) as T[])
      }
      const byCompetition = async <T,>(table: string): Promise<T[]> => {
        const { data: rows, error: e } = await supabase.from(table).select('*').eq('competition_id', comp.id)
        return e ? [] : ((rows ?? []) as T[])
      }

      const [clubs, persons, teams, players, groups, matches, bracketRounds, bracketSlots, goals, bracketGoals,
        assists, bracketAssists, penalties, bracketPenalties, cards, bracketCards] = await Promise.all([
        byCompetition<Club>('clubs'), byCompetition<Person>('persons'),
        byTournament<Team>('teams'), byTournament<Player>('players'), byTournament<Group>('groups'),
        byTournament<Match>('matches'), byTournament<BracketRound>('bracket_rounds'), byTournament<BracketSlot>('bracket_slots'),
        byTournament<Goal>('goals'), byTournament<BracketGoal>('bracket_goals'),
        byTournament<CompetitionHistoryData['assists'][number]>('assists'),
        byTournament<CompetitionHistoryData['bracketAssists'][number]>('bracket_assists'),
        byTournament<CompetitionHistoryData['penalties'][number]>('penalties'),
        byTournament<CompetitionHistoryData['bracketPenalties'][number]>('bracket_penalties'),
        byTournament<CompetitionHistoryData['cards'][number]>('cards'),
        byTournament<CompetitionHistoryData['bracketCards'][number]>('bracket_cards'),
      ])

      if (cancelled) return
      setScope(prev => (prev && prev.compId === comp.id && prev.ids.join() === ids.join()) ? prev : { compId: comp.id, ids })
      setData({
        competition: comp as Competition, editions: (eds ?? []) as Tournament[], clubs, persons, teams, players, groups,
        matches, bracketRounds, bracketSlots, goals, bracketGoals, assists, bracketAssists, penalties, bracketPenalties,
        cards, bracketCards,
      })
      setNotFound(false)
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()
    return () => { cancelled = true }
  }, [slug])

  // Realtime jen pro ročníky této soutěže a jejich výsledky. Historie se stahuje
  // celá (desítky dotazů), proto se dávka změn (živý zápas) sloučí do jednoho
  // obnovení za 3 s.
  useEffect(() => {
    if (!scope) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const refresh = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => fetchRef.current(), 3000)
    }
    const inIds = `tournament_id=in.(${scope.ids.join(',')})`
    const unsubs = [
      subscribeTable('tournament', refresh, `competition_id=eq.${scope.compId}`),
      ...(scope.ids.length ? ['matches', 'bracket_slots'].map(t => subscribeTable(t, refresh, inIds)) : []),
    ]
    return () => { if (timer) clearTimeout(timer); unsubs.forEach(u => u()) }
  }, [scope])

  return { ...data, loading, notFound, available, refetch: () => fetchRef.current() }
}
