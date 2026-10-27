import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'

export interface Group {
  id: string
  name: string
  team_ids: string[]
  schedule: 'once' | 'twice'
  tiebreaker: 'score_first' | 'h2h_first' | 'score_then_h2h'
  start_time: string
  match_duration: number
  break_between: number
}

export function useGroups(tournamentId: string) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setGroups([])
    setLoading(true)
    async function fetch() {
      if (!tournamentId) { setLoading(false); return }
      const { data, error } = await supabase.from('groups').select('*').eq('tournament_id', tournamentId).order('name')
      if (cancelled) return
      if (!error) setGroups(data ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()

    let poll: ReturnType<typeof setInterval> | null = null
    const startPoll = () => { poll = setInterval(() => fetchRef.current(), 120_000) }
    const stopPoll = () => { if (poll) clearInterval(poll); poll = null }
    const onVisibility = () => document.hidden ? stopPoll() : (fetchRef.current(), startPoll())

    const unsub = subscribeTable('groups', () => fetchRef.current())

    startPoll()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      unsub()
      stopPoll()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [tournamentId])

  return { groups, loading, refetch: () => fetchRef.current() }
}
