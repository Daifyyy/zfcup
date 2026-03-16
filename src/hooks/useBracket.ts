import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface BracketRound {
  id: string
  name: string
  position: number
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
}

export function useBracket() {
  const [rounds, setRounds] = useState<BracketRound[]>([])
  const [slots, setSlots] = useState<BracketSlot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const [{ data: r }, { data: s }] = await Promise.all([
        supabase.from('bracket_rounds').select('*').order('position'),
        supabase.from('bracket_slots').select('*').order('position'),
      ])
      setRounds(r ?? [])
      setSlots(s ?? [])
      setLoading(false)
    }
    fetch()

    const subR = supabase
      .channel('bracket_rounds')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bracket_rounds' }, fetch)
      .subscribe()
    const subS = supabase
      .channel('bracket_slots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bracket_slots' }, fetch)
      .subscribe()

    const poll = setInterval(fetch, 10_000)
    return () => {
      supabase.removeChannel(subR)
      supabase.removeChannel(subS)
      clearInterval(poll)
    }
  }, [])

  return { rounds, slots, loading }
}
