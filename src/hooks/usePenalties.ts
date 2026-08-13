import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'

export type PenaltyMinutes = 2 | 5 | 10

export interface Penalty {
  id: string
  player_id: string
  match_id: string
  minutes: PenaltyMinutes
}

export function usePenalties(tournamentId: string) {
  const [penalties, setPenalties] = useState<Penalty[]>([])
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function fetch() {
      if (!tournamentId) return
      const { data, error } = await supabase.from('penalties').select('*').eq('tournament_id', tournamentId)
      if (!error) setPenalties(data ?? [])
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('penalties', () => fetchRef.current())

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
  }, [tournamentId])

  return { penalties, refetch: () => fetchRef.current() }
}
