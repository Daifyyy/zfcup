import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable, byTournament } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'

export interface Referee {
  id: string
  name: string
}

export function useReferees(tournamentId: string) {
  const [referees, setReferees] = useState<Referee[]>([])
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setReferees([])
    async function fetch() {
      if (!tournamentId) return
      const { data, error } = await supabase.from('referees').select('*').eq('tournament_id', tournamentId).order('name')
      if (cancelled) return
      if (!error) setReferees(data ?? [])
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('referees', () => fetchRef.current(), byTournament(tournamentId))
    const unpoll = onPoll(() => fetchRef.current())

    return () => {
      cancelled = true
      unsub()
      unpoll()
    }
  }, [tournamentId])

  return { referees, refetch: () => fetchRef.current() }
}
