import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTable } from '../lib/realtimeManager'
import { isMissingColumnError } from '../lib/partners'
import { withModuleStage, type ModuleStage } from '../lib/modules'

/**
 * Globální nastavení platformy (tabulka platform_settings, migrace 11) — mění jen správce platformy.
 * `tipsEnabled` = globální vypínač tipovačky. `modules` = stavy modulů (migrace 21, `src/lib/modules.ts`).
 * Výchozí stav i bez migrace / při chybě: vše vypnuto.
 */
export function usePlatformSettings() {
  const [tipsEnabled, setTipsEnabled] = useState(false)
  const [modules, setModules] = useState<Record<string, ModuleStage>>({})
  /** false = chybí migrace 21 (sloupec modules) */
  const [modulesAvailable, setModulesAvailable] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const fetchRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function fetch() {
      // select('*'): funguje s migrací 21 i bez ní (sloupec modules pak v odpovědi chybí)
      const { data, error } = await supabase
        .from('platform_settings').select('*').eq('id', true).maybeSingle()
      if (!error) {
        setTipsEnabled(data?.tips_globally_enabled === true)
        const m = (data as { modules?: unknown } | null)?.modules
        setModulesAvailable(m !== undefined)
        setModules(m && typeof m === 'object' ? m as Record<string, ModuleStage> : {})
      }
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

  /** Změní stav modulu na platformě (jen správce). Vrací chybovou zprávu nebo null. */
  const setModuleStage = async (key: string, stage: ModuleStage): Promise<string | null> => {
    const next = withModuleStage(modules, key, stage)
    const { data, error } = await supabase
      .from('platform_settings')
      .update({ modules: next, updated_at: new Date().toISOString() })
      .eq('id', true)
      .select('id')
    if (error) return isMissingColumnError(error, 'modules') ? 'Chybí migrace 21 (db-backup/21_modules.sql).' : error.message
    if (!data?.length) return 'Nemáte oprávnění správce platformy.'
    setModules(next)
    return null
  }

  return { tipsEnabled, modules, modulesAvailable, loaded, setTipsGloballyEnabled, setModuleStage, refetch: () => fetchRef.current() }
}
