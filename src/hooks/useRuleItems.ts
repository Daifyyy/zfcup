import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable, byTournament } from '../lib/realtimeManager'
import { onPoll } from '../lib/poller'

export interface RuleItem {
  id: string
  title: string
  body: string
  position: number
}

export function useRuleItems(tournamentId: string) {
  const [ruleItems, setRuleItems] = useState<RuleItem[]>([])
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    // Přepnutí turnaje: hned zahodit stará data a ignorovat opožděné odpovědi
    let cancelled = false
    setRuleItems([])
    setLoading(true)
    async function fetch() {
      if (!tournamentId) { setLoading(false); return }
      const { data, error } = await supabase.from('rule_items').select('*').eq('tournament_id', tournamentId).order('position')
      if (cancelled) return
      if (!error) setRuleItems(data ?? [])
      setLoading(false)
    }
    fetchRef.current = fetch
    fetch()

    const unsub = subscribeTable('rule_items', () => fetchRef.current(), byTournament(tournamentId))

    const unpoll = onPoll(() => fetchRef.current())

    return () => {
      cancelled = true
      unsub()
      unpoll()
    }
  }, [tournamentId])

  const refetch = () => fetchRef.current()
  return { ruleItems, loading, refetch }
}
