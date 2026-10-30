import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchTable } from '../lib/bundle'
import { subscribeTable, byTournament } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'
import type { PenaltyMinutes } from './usePenalties'

export interface BracketPenalty {
  id: string
  player_id: string
  slot_id: string
  minutes: PenaltyMinutes
}

export function useBracketPenalties(tournamentId: string) {
  const [bracketPenalties, setBracketPenalties] = useState<BracketPenalty[]>([])
  const fetchRef = useRef<(viaBundle?: boolean) => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setBracketPenalties([])
    async function fetch(viaBundle = false) {
      if (!tournamentId) return
      const { data, error } = await fetchTable(tournamentId, 'bracket_penalties', () => supabase.from('bracket_penalties').select('*').eq('tournament_id', tournamentId), viaBundle)
      if (cancelled) return
      if (!error) setBracketPenalties(data ?? [])
    }
    fetchRef.current = fetch
    // otevření turnaje: sdílený dotaz se všemi tabulkami (migrace 25)
    fetch(true)

    const unsub = subscribeTable('bracket_penalties', () => fetchRef.current(), byTournament(tournamentId))

    const unpoll = onPoll(() => fetchRef.current(true))

    return () => {
      cancelled = true
      unsub()
      unpoll()
    }
  }, [tournamentId])

  return { bracketPenalties, refetch: () => fetchRef.current() }
}
