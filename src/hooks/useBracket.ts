import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable, byTournament } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'

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
  decided_in?: 'regulation' | 'ot' | 'so' | null
  /** Datum zápasu (YYYY-MM-DD) — jen sezónní režim, migrace 09 */
  match_date?: string | null
  /** Hráč zápasu (MVP) — migrace 22; bez ní undefined */
  mvp_player_id?: string | null
}

export function useBracket(tournamentId: string) {
  const [rounds, setRounds] = useState<BracketRound[]>([])
  const [slots, setSlots] = useState<BracketSlot[]>([])
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setRounds([])
    setSlots([])
    setLoading(true)
    async function fetch() {
      if (!tournamentId) { setLoading(false); return }
      const [{ data: r, error: rErr }, { data: s, error: sErr }] = await Promise.all([
        supabase.from('bracket_rounds').select('*').eq('tournament_id', tournamentId).order('position'),
        supabase.from('bracket_slots').select('*').eq('tournament_id', tournamentId).order('position'),
      ])
      if (cancelled) return
      if (!rErr) setRounds(r ?? [])
      if (!sErr) setSlots(s ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()

    const unsubR = subscribeTable('bracket_rounds', () => fetchRef.current(), byTournament(tournamentId))
    const unsubS = subscribeTable('bracket_slots', () => fetchRef.current(), byTournament(tournamentId))

    const unpoll = onPoll(() => fetchRef.current())

    return () => {
      cancelled = true
      unsubR()
      unsubS()
      unpoll()
    }
  }, [tournamentId])

  return { rounds, slots, loading, refetch: () => fetchRef.current() }
}
