import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchTable } from '../lib/bundle'
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
  const fetchRef = useRef<(viaBundle?: boolean) => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setBracketAssists([])
    async function fetch(viaBundle = false) {
      if (!tournamentId) return
      const { data, error } = await fetchTable(tournamentId, 'bracket_assists', () => supabase.from('bracket_assists').select('*').eq('tournament_id', tournamentId), viaBundle)
      if (cancelled) return
      if (!error) setBracketAssists(data ?? [])
    }
    fetchRef.current = fetch
    // otevření turnaje: sdílený dotaz se všemi tabulkami (migrace 25)
    fetch(true)

    const unsub = subscribeTable('bracket_assists', () => fetchRef.current(), byTournament(tournamentId))

    const unpoll = onPoll(() => fetchRef.current(true))

    return () => {
      cancelled = true
      unsub()
      unpoll()
    }
  }, [tournamentId])

  return { bracketAssists, refetch: () => fetchRef.current() }
}
