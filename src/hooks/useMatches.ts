import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'

export interface Match {
  id: string
  group_id: string | null
  round: string
  home_id: string
  away_id: string
  home_score: number
  away_score: number
  played: boolean
  scheduled_time: string
  referee_id?: string | null
}

export function useMatches() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from('matches').select('*')
        .order('scheduled_time', { nullsFirst: false })
        .order('id')
      setMatches(data ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('matches', () => fetchRef.current())

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

  return { matches, loading, refetch: () => fetchRef.current() }
}
