import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'

export interface Tipster {
  id: string
  name: string
  total_points: number
}

export function useTipsters() {
  const [tipsters, setTipsters] = useState<Tipster[]>([])
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('tipsters')
        .select('id, name, total_points')
        .order('total_points', { ascending: false })
      setTipsters(data ?? [])
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('tipsters', () => fetchRef.current())

    let poll: ReturnType<typeof setInterval> | null = null
    const startPoll = () => { poll = setInterval(() => fetchRef.current(), 120_000) }
    const stopPoll = () => { if (poll) clearInterval(poll); poll = null }
    const onVisibility = () => document.hidden ? stopPoll() : (fetchRef.current(), startPoll())

    startPoll()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      unsub()
      stopPoll()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return { tipsters }
}
