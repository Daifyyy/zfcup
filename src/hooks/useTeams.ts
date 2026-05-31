import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'

export interface Team {
  id: string
  name: string
  color: string
  logo_url: string | null
}

export function useTeams(tournamentId: string) {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function fetch() {
      if (!tournamentId) { setLoading(false); return }
      const { data, error } = await supabase.from('teams').select('*').eq('tournament_id', tournamentId).order('name')
      if (!error) setTeams(data ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()

    let poll: ReturnType<typeof setInterval> | null = null
    const startPoll = () => { poll = setInterval(() => fetchRef.current(), 120_000) }
    const stopPoll = () => { if (poll) clearInterval(poll); poll = null }
    const onVisibility = () => document.hidden ? stopPoll() : (fetchRef.current(), startPoll())

    const unsub = subscribeTable('teams', () => fetchRef.current())

    startPoll()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      unsub()
      stopPoll()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [tournamentId])

  return { teams, loading, refetch: () => fetchRef.current() }
}
