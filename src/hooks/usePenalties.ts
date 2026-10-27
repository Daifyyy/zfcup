import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable, byTournament } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'

export type PenaltyMinutes = 2 | 5 | 10

export interface Penalty {
  id: string
  player_id: string
  match_id: string
  minutes: PenaltyMinutes
}

export function usePenalties(tournamentId: string) {
  const [penalties, setPenalties] = useState<Penalty[]>([])
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setPenalties([])
    async function fetch() {
      if (!tournamentId) return
      const { data, error } = await supabase.from('penalties').select('*').eq('tournament_id', tournamentId)
      if (cancelled) return
      if (!error) setPenalties(data ?? [])
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('penalties', () => fetchRef.current(), byTournament(tournamentId))

    const unpoll = onPoll(() => fetchRef.current())

    return () => {
      cancelled = true
      unsub()
      unpoll()
    }
  }, [tournamentId])

  return { penalties, refetch: () => fetchRef.current() }
}
