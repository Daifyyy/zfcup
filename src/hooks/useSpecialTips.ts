import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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

  useEffect(() => {
    if (!tipsterId) { setSpecialTips([]); return }

    async function fetch() {
      const { data } = await supabase
        .from('special_tips')
        .select('*')
        .eq('tipster_id', tipsterId)
      setSpecialTips(data ?? [])
    }
    fetch()

    const sub = supabase
      .channel(`special_tips-${tipsterId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_tips' }, fetch)
      .subscribe()

    const poll = setInterval(fetch, 10_000)
    return () => { supabase.removeChannel(sub); clearInterval(poll) }
  }, [tipsterId])

  return { specialTips }
}
