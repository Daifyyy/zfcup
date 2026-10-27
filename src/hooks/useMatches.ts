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
  decided_in?: 'regulation' | 'ot' | 'so' | null
  /** Datum zápasu (YYYY-MM-DD) — jen sezónní režim, migrace 09 */
  match_date?: string | null
}

export function useMatches(tournamentId: string) {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setMatches([])
    setLoading(true)
    async function fetch() {
      if (!tournamentId) { setLoading(false); return }
      const { data, error } = await supabase.from('matches').select('*')
        .eq('tournament_id', tournamentId)
        .order('scheduled_time', { nullsFirst: false })
        .order('id')
      if (cancelled) return
      if (!error) setMatches(data ?? [])
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
      cancelled = true
      unsub()
      stopPoll()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [tournamentId])

  return { matches, loading, refetch: () => fetchRef.current() }
}
