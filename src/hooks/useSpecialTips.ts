import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'

export interface SpecialTip {
  id: string
  tipster_id: string
  tip_type: string
  predicted_team_id: string
  points_earned: number
  evaluated: boolean
}

export function useSpecialTips(tipsterId: string | null) {
  const [specialTips, setSpecialTips] = useState<SpecialTip[]>([])
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!tipsterId) { setSpecialTips([]); return }

    async function fetch() {
      const { data } = await supabase
        .from('special_tips')
        .select('*')
        .eq('tipster_id', tipsterId)
      setSpecialTips(data ?? [])
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('special_tips', () => fetchRef.current())

    let poll: ReturnType<typeof setInterval> | null = null
    const startPoll = () => { poll = setInterval(() => fetchRef.current(), 180_000) }
    const stopPoll = () => { if (poll) clearInterval(poll); poll = null }
    const onVisibility = () => document.hidden ? stopPoll() : (fetchRef.current(), startPoll())

    startPoll()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      unsub()
      stopPoll()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [tipsterId])

  return { specialTips }
}
