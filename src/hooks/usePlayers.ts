import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable, byTournament } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'

export interface Player {
  id: string
  team_id: string
  name: string
  number: number | null
  role: string | null  // 'captain' | 'goalkeeper' | 'both' | null
  avatar_url: string | null
  /** Osoba napříč ročníky soutěže — migrace 09 */
  person_id?: string | null
}

export function usePlayers(tournamentId: string, teamId?: string) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setPlayers([])
    setLoading(true)
    async function fetch() {
      if (!tournamentId) { setLoading(false); return }
      let q = supabase.from('players').select('*').eq('tournament_id', tournamentId).order('number')
      if (teamId) q = q.eq('team_id', teamId)
      const { data, error } = await q
      if (cancelled) return
      if (!error) setPlayers(data ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('players', () => fetchRef.current(), byTournament(tournamentId))

    const unpoll = onPoll(() => fetchRef.current())

    return () => {
      cancelled = true
      unsub()
      unpoll()
    }
  }, [tournamentId, teamId])

  return { players, loading, refetch: () => fetchRef.current() }
}
