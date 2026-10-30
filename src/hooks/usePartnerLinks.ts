// QR akce partnerů (modul partner_reach, migrace 24). Načítá se jen při zapnutém modulu.
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable, byTournament } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'
import type { PartnerLink } from '../lib/partnerReach'

export function usePartnerLinks(tournamentId: string, enabled: boolean) {
  const [links, setLinks] = useState<PartnerLink[]>([])
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    let cancelled = false
    setLinks([])
    if (!tournamentId || !enabled) return
    async function fetch() {
      const { data, error } = await supabase.from('partner_links').select('*').eq('tournament_id', tournamentId)
      if (!cancelled && !error) setLinks((data ?? []) as PartnerLink[])
    }
    fetchRef.current = fetch
    fetch()
    const unsub = subscribeTable('partner_links', () => fetchRef.current(), byTournament(tournamentId))
    const unpoll = onPoll(() => fetchRef.current())
    return () => { cancelled = true; unsub(); unpoll() }
  }, [tournamentId, enabled])

  return { links, refetch: () => fetchRef.current() }
}
