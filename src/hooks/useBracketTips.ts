import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'

export interface BracketTip {
  id: string
  tipster_id: string
  slot_id: string
  predicted_home: number
  predicted_away: number
  points_earned: number
  evaluated: boolean
}

export function useBracketTips(tipsterId: string | null) {
  const [bracketTips, setBracketTips] = useState<BracketTip[]>([])
  const [loading, setLoading] = useState(false)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!tipsterId) { setBracketTips([]); setLoading(false); return }

    setLoading(true)
    async function fetch() {
      const { data } = await supabase
        .from('bracket_tips')
        .select('*')
        .eq('tipster_id', tipsterId)
      setBracketTips(data ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('bracket_tips', () => fetchRef.current())

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

  return { bracketTips, loading }
}
