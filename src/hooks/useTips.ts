import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'

export interface Tip {
  id: string
  tipster_id: string
  match_id: string
  predicted_home: number
  predicted_away: number
  points_earned: number
  evaluated: boolean
}

export function useTips(tipsterId: string | null, tournamentId: string) {
  const [tips, setTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(false)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!tipsterId || !tournamentId) { setTips([]); setLoading(false); return }

    setLoading(true)
    async function fetch() {
      const { data } = await supabase
        .from('tips')
        .select('*')
        .eq('tipster_id', tipsterId)
        .eq('tournament_id', tournamentId)
      setTips(data ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('tips', () => fetchRef.current(), `tipster_id=eq.${tipsterId}`)

    const unpoll = onPoll(() => fetchRef.current(), 180_000)

    return () => {
      unsub()
      unpoll()
    }
  }, [tipsterId, tournamentId])

  return { tips, loading }
}
