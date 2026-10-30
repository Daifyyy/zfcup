import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchTable } from '../lib/bundle'
import { subscribeTable, byTournament } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'

export interface Goal {
  id: string
  player_id: string
  match_id: string
  count: number
}

export interface ScorerRow {
  player_id: string
  player_name: string
  team_id: string
  team_name: string
  goals: number
}

export function useGoals(tournamentId: string) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<(viaBundle?: boolean) => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setGoals([])
    setLoading(true)
    async function fetch(viaBundle = false) {
      if (!tournamentId) { setLoading(false); return }
      const { data, error } = await fetchTable(tournamentId, 'goals', () => supabase.from('goals').select('*').eq('tournament_id', tournamentId), viaBundle)
      if (cancelled) return
      if (!error) setGoals(data ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    // otevření turnaje: sdílený dotaz se všemi tabulkami (migrace 25)
    fetch(true)

    const unsub = subscribeTable('goals', () => fetchRef.current(), byTournament(tournamentId))

    const unpoll = onPoll(() => fetchRef.current(true))

    return () => {
      cancelled = true
      unsub()
      unpoll()
    }
  }, [tournamentId])

  return { goals, loading, refetch: () => fetchRef.current() }
}
