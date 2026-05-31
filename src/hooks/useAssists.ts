import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'

export interface Assist {
  id: string
  player_id: string
  match_id: string
  count: number
}

export function useAssists(tournamentId: string) {
  const [assists, setAssists] = useState<Assist[]>([])
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function fetch() {
      if (!tournamentId) return
      const { data, error } = await supabase.from('assists').select('*').eq('tournament_id', tournamentId)
      if (!error) setAssists(data ?? [])
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('assists', () => fetchRef.current())

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

  return { assists, refetch: () => fetchRef.current() }
}
