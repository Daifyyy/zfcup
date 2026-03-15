import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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

  useEffect(() => {
    if (!tipsterId) { setBracketTips([]); return }

    async function fetch() {
      const { data } = await supabase
        .from('bracket_tips')
        .select('*')
        .eq('tipster_id', tipsterId)
      setBracketTips(data ?? [])
    }
    fetch()

    const sub = supabase
      .channel(`bracket_tips-${tipsterId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bracket_tips' }, fetch)
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [tipsterId])

  return { bracketTips }
}
