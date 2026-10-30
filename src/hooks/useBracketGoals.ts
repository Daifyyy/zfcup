import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchTable } from '../lib/bundle'
import { subscribeTable, byTournament } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'

export interface BracketGoal {
  id: string
  player_id: string
  slot_id: string
  count: number
}

export function useBracketGoals(tournamentId: string) {
  const [bracketGoals, setBracketGoals] = useState<BracketGoal[]>([])
  const fetchRef = useRef<(viaBundle?: boolean) => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setBracketGoals([])
    async function fetch(viaBundle = false) {
      if (!tournamentId) return
      const { data, error } = await fetchTable(tournamentId, 'bracket_goals', () => supabase.from('bracket_goals').select('*').eq('tournament_id', tournamentId), viaBundle)
      if (cancelled) return
      if (!error) setBracketGoals(data ?? [])
    }
    fetchRef.current = fetch
    // otevření turnaje: sdílený dotaz se všemi tabulkami (migrace 25)
    fetch(true)

    const unsub = subscribeTable('bracket_goals', () => fetchRef.current(), byTournament(tournamentId))

    const unpoll = onPoll(() => fetchRef.current(true))

    return () => {
      cancelled = true
      unsub()
      unpoll()
    }
  }, [tournamentId])

  return { bracketGoals, refetch: () => fetchRef.current() }
}
