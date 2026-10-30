import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchTable } from '../lib/bundle'
import { subscribeTable, byTournament } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'

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
  /** Hráč zápasu (MVP) — migrace 22; bez ní undefined */
  mvp_player_id?: string | null
}

export function useMatches(tournamentId: string) {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<(viaBundle?: boolean) => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setMatches([])
    setLoading(true)
    async function fetch(viaBundle = false) {
      if (!tournamentId) { setLoading(false); return }
      const { data, error } = await fetchTable(tournamentId, 'matches', () => supabase.from('matches').select('*')
        .eq('tournament_id', tournamentId)
        .order('scheduled_time', { nullsFirst: false })
        .order('id'), viaBundle)
      if (cancelled) return
      if (!error) setMatches(data ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    // otevření turnaje: sdílený dotaz se všemi tabulkami (migrace 25)
    fetch(true)

    const unsub = subscribeTable('matches', () => fetchRef.current(), byTournament(tournamentId))

    const unpoll = onPoll(() => fetchRef.current(true))

    return () => {
      cancelled = true
      unsub()
      unpoll()
    }
  }, [tournamentId])

  return { matches, loading, refetch: () => fetchRef.current() }
}
