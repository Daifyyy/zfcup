import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable, byTournament } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'

export interface Tipster {
  id: string
  name: string
  total_points: number
}

export function useTipsters(tournamentId: string) {
  const [tipsters, setTipsters] = useState<Tipster[]>([])
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setTipsters([])
    async function fetch() {
      if (!tournamentId) return
      const { data } = await supabase
        .from('tipsters')
        .select('id, name, total_points')
        .eq('tournament_id', tournamentId)
        .order('total_points', { ascending: false })
      if (cancelled) return
      setTipsters(data ?? [])
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('tipsters', () => fetchRef.current(), byTournament(tournamentId))

    const unpoll = onPoll(() => fetchRef.current())

    return () => {
      cancelled = true
      unsub()
      unpoll()
    }
  }, [tournamentId])

  return { tipsters }
}
