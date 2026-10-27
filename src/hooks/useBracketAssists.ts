import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'

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

    const unsub = subscribeTable('bracket_assists', () => fetchRef.current())

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

  return { bracketAssists, refetch: () => fetchRef.current() }
}
