// Data turnaje jedním dotazem (migrace 25, RPC tournament_bundle).
// Hooky při otevření turnaje a při pravidelné obnově (poller) volají `fetchTable(..., viaBundle=true)`:
// souběžné požadavky během krátkého okna se slijí do jednoho RPC (místo ~19 dotazů).
// Po uložení (refetch) a při realtime změně hooky čtou jen svou tabulku napřímo (vždy čerstvá data).
// Bez migrace / při chybě RPC se použije původní dotaz a bundle se pro zbytek relace vypne.
import { supabase } from './supabase'

export type BundleKey =
  | 'tournament' | 'teams' | 'players' | 'groups' | 'matches' | 'goals' | 'assists' | 'cards' | 'penalties'
  | 'bracket_rounds' | 'bracket_slots' | 'bracket_goals' | 'bracket_assists' | 'bracket_cards' | 'bracket_penalties'
  | 'announcements' | 'rule_items' | 'referees' | 'sponsors'

type Bundle = Partial<Record<BundleKey, unknown>>

/** Jak dlouho se hotová / rozběhnutá odpověď sdílí (hooky startují v jednom vykreslení, poller do 1,5 s). */
const SHARE_MS = 2000

let unavailable = false
const cache = new Map<string, { at: number; promise: Promise<Bundle | null> }>()

function getBundle(tournamentId: string): Promise<Bundle | null> {
  const hit = cache.get(tournamentId)
  if (hit && Date.now() - hit.at < SHARE_MS) return hit.promise
  const promise = (async () => {
    const { data, error } = await supabase.rpc('tournament_bundle', { p_tournament: tournamentId })
    if (error) {
      // chybějící funkce (bez migrace 25) → už nezkoušet; jiná chyba (síť) → jen tentokrát přímo
      if (/tournament_bundle|function|schema cache|PGRST202/i.test(`${error.code} ${error.message}`)) unavailable = true
      return null
    }
    return (data ?? null) as Bundle | null
  })()
  cache.set(tournamentId, { at: Date.now(), promise })
  // uvolnit paměť po okně sdílení
  setTimeout(() => { if (cache.get(tournamentId)?.promise === promise) cache.delete(tournamentId) }, SHARE_MS + 500)
  return promise
}

interface Result<T> { data: T | null; error: { code?: string; message: string } | null }

/**
 * Data jedné tabulky turnaje: přes sdílený bundle (`viaBundle`), jinak / při selhání původním dotazem.
 * `direct` = původní dotaz hooku (se stejným řazením jako v migraci 25).
 */
export async function fetchTable<T>(
  tournamentId: string,
  key: BundleKey,
  direct: () => PromiseLike<Result<T>>,
  viaBundle: boolean,
): Promise<Result<T>> {
  if (viaBundle && !unavailable && tournamentId) {
    const b = await getBundle(tournamentId)
    // turnaj bez řádku (neexistuje / bez přístupu) řeší původní dotaz kvůli kódům chyb
    if (b && key in b && b[key] !== null) return { data: b[key] as T, error: null }
  }
  return direct()
}

/** Jen pro testy */
export function _resetBundleForTests() { unavailable = false; cache.clear() }
