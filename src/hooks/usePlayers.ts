import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

export interface Player {
  id: string
  team_id: string
  name: string
  number: number | null
  role: string | null  // 'captain' | 'goalkeeper' | 'both' | null
  avatar_url: string | null
}

export function usePlayers(teamId?: string) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function fetch() {
      let q = supabase.from('players').select('*').order('number')
      if (teamId) q = q.eq('team_id', teamId)
      const { data } = await q
      setPlayers(data ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()

    let poll: ReturnType<typeof setInterval> | null = null
    const startPoll = () => { poll = setInterval(() => fetchRef.current(), 120_000) }
    const stopPoll = () => { if (poll) clearInterval(poll); poll = null }
    const onVisibility = () => document.hidden ? stopPoll() : (fetchRef.current(), startPoll())

    startPoll()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stopPoll()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [teamId])

  return { players, loading, refetch: () => fetchRef.current() }
}
