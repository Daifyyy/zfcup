import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'

export type CardType = 'yellow' | 'red' | 'yellow_red'

export interface Card {
  id: string
  player_id: string
  match_id: string
  type: CardType
}

export function useCards(tournamentId: string) {
  const [cards, setCards] = useState<Card[]>([])
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setCards([])
    async function fetch() {
      if (!tournamentId) return
      const { data, error } = await supabase.from('cards').select('*').eq('tournament_id', tournamentId)
      if (cancelled) return
      if (!error) setCards(data ?? [])
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('cards', () => fetchRef.current())

    let poll: ReturnType<typeof setInterval> | null = null
    const startPoll = () => { poll = setInterval(() => fetchRef.current(), 120_000) }
    const stopPoll = () => { if (poll) clearInterval(poll); poll = null }
    const onVisibility = () => document.hidden ? stopPoll() : (fetchRef.current(), startPoll())

    startPoll()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      unsub()
      stopPoll()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [tournamentId])

  return { cards, refetch: () => fetchRef.current() }
}
