import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'

export type CardType = 'yellow' | 'red' | 'yellow_red'

export interface BracketCard {
  id: string
  player_id: string
  slot_id: string
  type: CardType
}

export function useBracketCards() {
  const [bracketCards, setBracketCards] = useState<BracketCard[]>([])
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from('bracket_cards').select('*')
      setBracketCards(data ?? [])
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('bracket_cards', () => fetchRef.current())

    let poll: ReturnType<typeof setInterval> | null = null
    const startPoll = () => { poll = setInterval(() => fetchRef.current(), 120_000) }
    const stopPoll = () => { if (poll) clearInterval(poll); poll = null }
    const onVisibility = () => document.hidden ? stopPoll() : (fetchRef.current(), startPoll())

    startPoll()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      unsub()
      stopPoll()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return { bracketCards, refetch: () => fetchRef.current() }
}
