// Veřejná stránka klubu /k/{slug} — klub z knihovny + všechny turnaje, kde hrál (migrace 13).
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { onPoll } from '../lib/poller'
import { subscribeTable } from '../lib/realtimeManager'
import type { ClubHistoryData } from '../lib/clubHistory'
import type { LibraryClub, LibraryPerson } from '../lib/clubs'
import type { Tournament } from './useTournament'
import type { CompetitionHistoryData } from './useCompetitions'

const EMPTY: ClubHistoryData = {
  club: null, roster: [], competition: null, editions: [], clubs: [], persons: [], teams: [], players: [], groups: [],
  matches: [], bracketRounds: [], bracketSlots: [], goals: [], bracketGoals: [], assists: [], bracketAssists: [],
  penalties: [], bracketPenalties: [], cards: [], bracketCards: [],
}

export function useClubPage(slug: string) {
  const [data, setData] = useState<ClubHistoryData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [available, setAvailable] = useState(true)
  const [scope, setScope] = useState<string[] | null>(null)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    let cancelled = false
    setData(EMPTY); setLoading(true); setNotFound(false)
    async function fetch() {
      if (!slug) { setLoading(false); return }
      const { data: club, error } = await supabase.from('clubs')
        .select('id,owner_id,competition_id,name,slug,color,logo_url').eq('slug', slug).maybeSingle()
      if (cancelled) return
      if (error) { setAvailable(false); setLoading(false); return } // bez migrace 13 sloupec slug chybí
      if (!club) { setNotFound(true); setLoading(false); return }

      const [{ data: ownTeams }, { data: roster }] = await Promise.all([
        supabase.from('teams').select('tournament_id').eq('club_id', club.id),
        supabase.from('persons').select('id,owner_id,club_id,name,number,role,avatar_url').eq('club_id', club.id),
      ])
      const ids = [...new Set((ownTeams ?? []).map(t => t.tournament_id as string))]

      const byTournament = async <T,>(table: string): Promise<T[]> => {
        if (!ids.length) return []
        const { data: rows, error: e } = await supabase.from(table).select('*').in('tournament_id', ids)
        return e ? [] : ((rows ?? []) as T[])
      }
      const H = {} as CompetitionHistoryData
      const [editions, teams, players, groups, matches, bracketRounds, bracketSlots, goals, bracketGoals,
        assists, bracketAssists, penalties, bracketPenalties, cards, bracketCards] = await Promise.all([
        ids.length
          ? supabase.from('tournament').select('*').in('id', ids).then(r => (r.error ? [] : (r.data ?? [])) as Tournament[])
          : Promise.resolve([] as Tournament[]),
        byTournament<(typeof H.teams)[number]>('teams'), byTournament<(typeof H.players)[number]>('players'),
        byTournament<(typeof H.groups)[number]>('groups'), byTournament<(typeof H.matches)[number]>('matches'),
        byTournament<(typeof H.bracketRounds)[number]>('bracket_rounds'), byTournament<(typeof H.bracketSlots)[number]>('bracket_slots'),
        byTournament<(typeof H.goals)[number]>('goals'), byTournament<(typeof H.bracketGoals)[number]>('bracket_goals'),
        byTournament<(typeof H.assists)[number]>('assists'), byTournament<(typeof H.bracketAssists)[number]>('bracket_assists'),
        byTournament<(typeof H.penalties)[number]>('penalties'), byTournament<(typeof H.bracketPenalties)[number]>('bracket_penalties'),
        byTournament<(typeof H.cards)[number]>('cards'), byTournament<(typeof H.bracketCards)[number]>('bracket_cards'),
      ])
      if (cancelled) return
      setScope(prev => (prev && prev.join() === ids.join() ? prev : ids))
      setData({
        club: club as LibraryClub, roster: (roster ?? []) as LibraryPerson[],
        competition: null, editions, clubs: [], persons: [], teams, players, groups, matches, bracketRounds, bracketSlots,
        goals, bracketGoals, assists, bracketAssists, penalties, bracketPenalties, cards, bracketCards,
      })
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()
    const unpoll = onPoll(() => fetchRef.current())
    return () => { cancelled = true; unpoll() }
  }, [slug])

  // Živé výsledky: jen turnaje klubu, dávka změn → jedno obnovení za 3 s
  useEffect(() => {
    if (!scope?.length) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const refresh = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => fetchRef.current(), 3000)
    }
    const filter = `tournament_id=in.(${scope.join(',')})`
    const unsubs = ['matches', 'bracket_slots'].map(t => subscribeTable(t, refresh, filter))
    return () => { if (timer) clearTimeout(timer); unsubs.forEach(u => u()) }
  }, [scope])

  return { ...data, loading, notFound, available }
}
