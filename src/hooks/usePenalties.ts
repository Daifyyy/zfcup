import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchTable } from '../lib/bundle'
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
  const fetchRef = useRef<(viaBundle?: boolean) => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setPenalties([])
    async function fetch(viaBundle = false) {
      if (!tournamentId) return
      const { data, error } = await fetchTable(tournamentId, 'penalties', () => supabase.from('penalties').select('*').eq('tournament_id', tournamentId), viaBundle)
      if (cancelled) return
      if (!error) setPenalties(data ?? [])
    }
    fetchRef.current = fetch
    // otevření turnaje: sdílený dotaz se všemi tabulkami (migrace 25)
    fetch(true)

    const unsub = subscribeTable('penalties', () => fetchRef.current(), byTournament(tournamentId))

    const unpoll = onPoll(() => fetchRef.current(true))

    return () => {
      cancelled = true
      unsub()
      unpoll()
    }
  }, [tournamentId])

  return { penalties, refetch: () => fetchRef.current() }
}
