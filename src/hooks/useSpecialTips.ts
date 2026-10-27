import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'

export interface SpecialTip {
  id: string
  tipster_id: string
  tip_type: string
  predicted_team_id: string | null
  predicted_player_id: string | null
  points_earned: number
  evaluated: boolean
}

export function useSpecialTips(tipsterId: string | null, tournamentId: string) {
  const [specialTips, setSpecialTips] = useState<SpecialTip[]>([])
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!tipsterId || !tournamentId) { setSpecialTips([]); return }

    async function fetch() {
      const { data } = await supabase
        .from('special_tips')
        .select('*')
        .eq('tipster_id', tipsterId)
        .eq('tournament_id', tournamentId)
      setSpecialTips(data ?? [])
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('special_tips', () => fetchRef.current(), `tipster_id=eq.${tipsterId}`)

    const unpoll = onPoll(() => fetchRef.current(), 180_000)

    return () => {
      unsub()
      unpoll()
    }
  }, [tipsterId, tournamentId])

  return { specialTips }
}
