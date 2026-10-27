import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'
import type { PenaltyMinutes } from './usePenalties'

export interface BracketPenalty {
  id: string
  player_id: string
  slot_id: string
  minutes: PenaltyMinutes
}

export function useBracketPenalties(tournamentId: string) {
  const [bracketPenalties, setBracketPenalties] = useState<BracketPenalty[]>([])
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setBracketPenalties([])
    async function fetch() {
      if (!tournamentId) return
      const { data, error } = await supabase.from('bracket_penalties').select('*').eq('tournament_id', tournamentId)
      if (cancelled) return
      if (!error) setBracketPenalties(data ?? [])
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('bracket_penalties', () => fetchRef.current())

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

  return { bracketPenalties, refetch: () => fetchRef.current() }
}
