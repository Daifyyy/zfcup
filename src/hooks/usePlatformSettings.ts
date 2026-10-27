import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'

/**
 * Globální nastavení platformy (tabulka platform_settings, migrace 11) — mění jen správce platformy.
 * `tipsEnabled` = globální vypínač tipovačky. Výchozí stav i bez migrace / při chybě: vypnuto.
 */
export function usePlatformSettings() {
  const [tipsEnabled, setTipsEnabled] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function fetch() {
      const { data, error } = await supabase
        .from('platform_settings').select('tips_globally_enabled').eq('id', true).maybeSingle()
      if (!error) setTipsEnabled(data?.tips_globally_enabled === true)
      setLoaded(true)
    }
    fetchRef.current = fetch
    fetch()
    const unsub = subscribeTable('platform_settings', () => fetchRef.current())
    return () => unsub()
  }, [])

  /** Uloží globální vypínač tipovačky (RLS pustí jen správce platformy). Vrací chybovou zprávu nebo null. */
  const setTipsGloballyEnabled = async (value: boolean): Promise<string | null> => {
    const { data, error } = await supabase
      .from('platform_settings')
      .update({ tips_globally_enabled: value, updated_at: new Date().toISOString() })
      .eq('id', true)
      .select('id')
    if (error) return error.message
    if (!data?.length) return 'Nemáte oprávnění správce platformy.'
    setTipsEnabled(value)
    return null
  }

  return { tipsEnabled, loaded, setTipsGloballyEnabled, refetch: () => fetchRef.current() }
}
