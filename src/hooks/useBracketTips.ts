import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'

export interface BracketTip {
  id: string
  tipster_id: string
  slot_id: string
  predicted_home: number
  predicted_away: number
  points_earned: number
  evaluated: boolean
}

export function useBracketTips(tipsterId: string | null, tournamentId: string) {
  const [bracketTips, setBracketTips] = useState<BracketTip[]>([])
  const [loading, setLoading] = useState(false)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!tipsterId || !tournamentId) { setBracketTips([]); setLoading(false); return }

    setLoading(true)
    async function fetch() {
      const { data } = await supabase
        .from('bracket_tips')
        .select('*')
        .eq('tipster_id', tipsterId)
        .eq('tournament_id', tournamentId)
      setBracketTips(data ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('bracket_tips', () => fetchRef.current(), `tipster_id=eq.${tipsterId}`)

    const unpoll = onPoll(() => fetchRef.current(), 180_000)

    return () => {
      unsub()
      unpoll()
    }
  }, [tipsterId, tournamentId])

  return { bracketTips, loading }
}
