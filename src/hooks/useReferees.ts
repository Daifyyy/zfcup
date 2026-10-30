import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchTable } from '../lib/bundle'
import { subscribeTable, byTournament } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'

export interface Referee {
  id: string
  name: string
}

export function useReferees(tournamentId: string) {
  const [referees, setReferees] = useState<Referee[]>([])
  const fetchRef = useRef<(viaBundle?: boolean) => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setReferees([])
    async function fetch(viaBundle = false) {
      if (!tournamentId) return
      const { data, error } = await fetchTable(tournamentId, 'referees', () => supabase.from('referees').select('*').eq('tournament_id', tournamentId).order('name'), viaBundle)
      if (cancelled) return
      if (!error) setReferees(data ?? [])
    }
    fetchRef.current = fetch
    // otevření turnaje: sdílený dotaz se všemi tabulkami (migrace 25)
    fetch(true)

    const unsub = subscribeTable('referees', () => fetchRef.current(), byTournament(tournamentId))
    const unpoll = onPoll(() => fetchRef.current(true))

    return () => {
      cancelled = true
      unsub()
      unpoll()
    }
  }, [tournamentId])

  return { referees, refetch: () => fetchRef.current() }
}
