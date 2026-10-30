import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchTable } from '../lib/bundle'
import { subscribeTable, byTournament } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'

export type CardType = 'yellow' | 'red' | 'yellow_red'

export interface BracketCard {
  id: string
  player_id: string
  slot_id: string
  type: CardType
}

export function useBracketCards(tournamentId: string) {
  const [bracketCards, setBracketCards] = useState<BracketCard[]>([])
  const fetchRef = useRef<(viaBundle?: boolean) => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setBracketCards([])
    async function fetch(viaBundle = false) {
      if (!tournamentId) return
      const { data, error } = await fetchTable(tournamentId, 'bracket_cards', () => supabase.from('bracket_cards').select('*').eq('tournament_id', tournamentId), viaBundle)
      if (cancelled) return
      if (!error) setBracketCards(data ?? [])
    }
    fetchRef.current = fetch
    // otevření turnaje: sdílený dotaz se všemi tabulkami (migrace 25)
    fetch(true)

    const unsub = subscribeTable('bracket_cards', () => fetchRef.current(), byTournament(tournamentId))

    const unpoll = onPoll(() => fetchRef.current(true))

    return () => {
      cancelled = true
      unsub()
      unpoll()
    }
  }, [tournamentId])

  return { bracketCards, refetch: () => fetchRef.current() }
}
