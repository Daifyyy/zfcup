import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchTable } from '../lib/bundle'
import { subscribeTable, byTournament } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'

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
  const fetchRef = useRef<(viaBundle?: boolean) => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setTeams([])
    setLoading(true)
    async function fetch(viaBundle = false) {
      if (!tournamentId) { setLoading(false); return }
      const { data, error } = await fetchTable(tournamentId, 'teams', () => supabase.from('teams').select('*').eq('tournament_id', tournamentId).order('name'), viaBundle)
      if (cancelled) return
      if (!error) setTeams(data ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    // otevření turnaje: sdílený dotaz se všemi tabulkami (migrace 25)
    fetch(true)

    const unsub = subscribeTable('teams', () => fetchRef.current(), byTournament(tournamentId))

    const unpoll = onPoll(() => fetchRef.current(true))

    return () => {
      cancelled = true
      unsub()
      unpoll()
    }
  }, [tournamentId])

  return { teams, loading, refetch: () => fetchRef.current() }
}
