import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchTable } from '../lib/bundle'
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
  /** QR akce partnera (doplní App z partner_links při zapnutém modulu partner_reach) */
  reach?: { code: string; cta: string | null }
}

export function useSponsors(tournamentId: string) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<(viaBundle?: boolean) => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setSponsors([])
    setLoading(true)
    async function fetch(viaBundle = false) {
      if (!tournamentId) { setLoading(false); return }
      const { data, error } = await fetchTable(tournamentId, 'sponsors', () => supabase
        .from('sponsors').select('*').eq('tournament_id', tournamentId).order('position'), viaBundle)
      if (cancelled) return
      if (!error) setSponsors(data ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    // otevření turnaje: sdílený dotaz se všemi tabulkami (migrace 25)
    fetch(true)

    const unsub = subscribeTable('sponsors', () => fetchRef.current(), byTournament(tournamentId))

    const unpoll = onPoll(() => fetchRef.current(true))

    return () => {
      cancelled = true
      unsub()
      unpoll()
    }
  }, [tournamentId])

  return { sponsors, loading, refetch: () => fetchRef.current() }
}
