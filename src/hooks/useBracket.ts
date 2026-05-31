import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'

export interface BracketRound {
  id: string
  name: string
  position: number
  scheduled_start: string | null
  break_after: number | null
}

export interface BracketSlot {
  id: string
  round_id: string
  position: number
  home_id: string | null
  away_id: string | null
  home_score: number
  away_score: number
  played: boolean
  scheduled_time?: string | null
  referee_id?: string | null
}

export function useBracket(tournamentId: string) {
  const [rounds, setRounds] = useState<BracketRound[]>([])
  const [slots, setSlots] = useState<BracketSlot[]>([])
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function fetch() {
      if (!tournamentId) { setLoading(false); return }
      const [{ data: r, error: rErr }, { data: s, error: sErr }] = await Promise.all([
        supabase.from('bracket_rounds').select('*').eq('tournament_id', tournamentId).order('position'),
        supabase.from('bracket_slots').select('*').eq('tournament_id', tournamentId).order('position'),
      ])
      if (!rErr) setRounds(r ?? [])
      if (!sErr) setSlots(s ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()

    const unsubR = subscribeTable('bracket_rounds', () => fetchRef.current())
    const unsubS = subscribeTable('bracket_slots', () => fetchRef.current())

    let poll: ReturnType<typeof setInterval> | null = null
    const startPoll = () => { poll = setInterval(() => fetchRef.current(), 120_000) }
    const stopPoll = () => { if (poll) clearInterval(poll); poll = null }
    const onVisibility = () => document.hidden ? stopPoll() : (fetchRef.current(), startPoll())

    startPoll()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      unsubR()
      unsubS()
      stopPoll()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [tournamentId])

  return { rounds, slots, loading, refetch: () => fetchRef.current() }
}
