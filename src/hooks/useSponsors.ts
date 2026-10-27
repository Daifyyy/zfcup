import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable, byTournament } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'

export interface Sponsor {
  id: string
  tournament_id: string
  name: string
  logo_url: string
  website_url: string
  position: number
  /** Úroveň partnera — chybí, dokud není spuštěna migrace 08 */
  tier?: 'title' | 'main' | 'partner' | 'supplier' | 'media'
}

export function useSponsors(tournamentId: string) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setSponsors([])
    setLoading(true)
    async function fetch() {
      if (!tournamentId) { setLoading(false); return }
      const { data, error } = await supabase
        .from('sponsors').select('*').eq('tournament_id', tournamentId).order('position')
      if (cancelled) return
      if (!error) setSponsors(data ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('sponsors', () => fetchRef.current(), byTournament(tournamentId))

    const unpoll = onPoll(() => fetchRef.current())

    return () => {
      cancelled = true
      unsub()
      unpoll()
    }
  }, [tournamentId])

  return { sponsors, loading, refetch: () => fetchRef.current() }
}
