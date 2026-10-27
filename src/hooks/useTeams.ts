import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'

export interface Team {
  id: string
  name: string
  color: string
  logo_url: string | null
  /** Klub napříč ročníky soutěže — migrace 09 */
  club_id?: string | null
}

export function useTeams(tournamentId: string) {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setTeams([])
    setLoading(true)
    async function fetch() {
      if (!tournamentId) { setLoading(false); return }
      const { data, error } = await supabase.from('teams').select('*').eq('tournament_id', tournamentId).order('name')
      if (cancelled) return
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
      cancelled = true
      unsub()
      stopPoll()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [tournamentId])

  return { teams, loading, refetch: () => fetchRef.current() }
}
