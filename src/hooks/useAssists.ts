import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable, byTournament } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'

export interface Assist {
  id: string
  player_id: string
  match_id: string
  count: number
}

export function useAssists(tournamentId: string) {
  const [assists, setAssists] = useState<Assist[]>([])
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setAssists([])
    async function fetch() {
      if (!tournamentId) return
      const { data, error } = await supabase.from('assists').select('*').eq('tournament_id', tournamentId)
      if (cancelled) return
      if (!error) setAssists(data ?? [])
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('assists', () => fetchRef.current(), byTournament(tournamentId))

    const unpoll = onPoll(() => fetchRef.current())

    return () => {
      cancelled = true
      unsub()
      unpoll()
    }
  }, [tournamentId])

  return { assists, refetch: () => fetchRef.current() }
}
