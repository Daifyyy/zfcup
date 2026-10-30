import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchTable } from '../lib/bundle'
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
  const fetchRef = useRef<(viaBundle?: boolean) => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setPlayers([])
    setLoading(true)
    async function fetch(viaBundle = false) {
      if (!tournamentId) { setLoading(false); return }
      const direct = () => {
        let q = supabase.from('players').select('*').eq('tournament_id', tournamentId).order('number')
        if (teamId) q = q.eq('team_id', teamId)
        return q
      }
      // sdílený dotaz jen pro celý turnaj (filtr podle týmu jde napřímo)
      const { data, error } = await fetchTable(tournamentId, 'players', direct, viaBundle && !teamId)
      if (cancelled) return
      if (!error) setPlayers(data ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    // otevření turnaje: sdílený dotaz se všemi tabulkami (migrace 25)
    fetch(true)

    const unsub = subscribeTable('players', () => fetchRef.current(), byTournament(tournamentId))

    const unpoll = onPoll(() => fetchRef.current(true))

    return () => {
      cancelled = true
      unsub()
      unpoll()
    }
  }, [tournamentId, teamId])

  return { players, loading, refetch: () => fetchRef.current() }
}
