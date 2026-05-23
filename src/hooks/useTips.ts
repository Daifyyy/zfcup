import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'

export interface Tip {
  id: string
  tipster_id: string
  match_id: string
  predicted_home: number
  predicted_away: number
  points_earned: number
  evaluated: boolean
}

export function useTips(tipsterId: string | null) {
  const [tips, setTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(false)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!tipsterId) { setTips([]); setLoading(false); return }

    setLoading(true)
    async function fetch() {
      const { data } = await supabase
        .from('tips')
        .select('*')
        .eq('tipster_id', tipsterId)
      setTips(data ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('tips', () => fetchRef.current())

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

  return { tips, loading }
}
