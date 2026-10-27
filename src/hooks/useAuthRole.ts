import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/**
 * Přihlášení a role uživatele.
 * - `isPlatformAdmin` = správce platformy (tabulka platform_admins, migrace 11) — smí vše.
 * - Organizátor smí spravovat jen turnaje, kde `tournament.owner_id` = jeho účet → `canEditTournament`.
 * Bez migrace 11 funkce `is_platform_admin` neexistuje → `isPlatformAdmin = false`.
 */
export function useAuthRole() {
  const [session, setSession] = useState<Session | null>(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setReady(true) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null
  useEffect(() => {
    let cancelled = false
    if (!userId) { setIsPlatformAdmin(false); return }
    supabase.rpc('is_platform_admin').then(({ data, error }) => {
      if (cancelled) return
      setIsPlatformAdmin(!error && data === true)
      setReady(true)
    })
    return () => { cancelled = true }
  }, [userId])

  /** Smí přihlášený uživatel spravovat turnaj s daným vlastníkem? */
  const canEditTournament = (ownerId: string | null | undefined) =>
    !!userId && (isPlatformAdmin || ownerId === userId)

  return { session, userId, isPlatformAdmin, ready, canEditTournament }
}
