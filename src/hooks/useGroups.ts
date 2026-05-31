import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

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
    async function fetch() {
      if (!tournamentId) { setLoading(false); return }
      const { data } = await supabase.from('groups').select('*').eq('tournament_id', tournamentId).order('name')
      setGroups(data ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()

    let poll: ReturnType<typeof setInterval> | null = null
    const startPoll = () => { poll = setInterval(() => fetchRef.current(), 120_000) }
    const stopPoll = () => { if (poll) clearInterval(poll); poll = null }
    const onVisibility = () => document.hidden ? stopPoll() : (fetchRef.current(), startPoll())

    startPoll()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stopPoll()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [tournamentId])

  return { groups, loading, refetch: () => fetchRef.current() }
}
