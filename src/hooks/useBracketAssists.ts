import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable, byTournament } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'

export interface BracketAssist {
  id: string
  player_id: string
  slot_id: string
  count: number
}

export function useBracketAssists(tournamentId: string) {
  const [bracketAssists, setBracketAssists] = useState<BracketAssist[]>([])
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setBracketAssists([])
    async function fetch() {
      if (!tournamentId) return
      const { data, error } = await supabase.from('bracket_assists').select('*').eq('tournament_id', tournamentId)
      if (cancelled) return
      if (!error) setBracketAssists(data ?? [])
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('bracket_assists', () => fetchRef.current(), byTournament(tournamentId))

    const unpoll = onPoll(() => fetchRef.current())

    return () => {
      cancelled = true
      unsub()
      unpoll()
    }
  }, [tournamentId])

  return { bracketAssists, refetch: () => fetchRef.current() }
}
