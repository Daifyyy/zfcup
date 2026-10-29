// Přístupové kódy soukromých turnajů (migrace 15).
// Kódy, které divák zadal, se pamatují v localStorage a posílají se v hlavičce
// `x-access-code` ke všem dotazům do Supabase (src/lib/supabase.ts) — RLS podle
// nich pustí čtení soukromého turnaje.

const STORAGE_KEY = 'turnajnik_access_codes'
const MAX_CODES = 20
/** Bez zaměnitelných znaků (0/O, 1/I/L) */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

type CodeMap = Record<string, string> // tournamentId → kód

function read(): CodeMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed as CodeMap : {}
  } catch {
    return {}
  }
}

function write(map: CodeMap) {
  try {
    const entries = Object.entries(map).slice(-MAX_CODES)
    if (entries.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)))
    else localStorage.removeItem(STORAGE_KEY)
  } catch { /* soukromý režim prohlížeče apod. */ }
}

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Hodnota hlavičky x-access-code ('' = žádná) */
export function accessHeader(): string {
  return Object.values(read()).filter(Boolean).join(',')
}

export function rememberCode(tournamentId: string, code: string) {
  const map = read()
  delete map[tournamentId] // přesunout na konec (nejnovější)
  map[tournamentId] = normalizeCode(code)
  write(map)
}

export function forgetCode(tournamentId: string) {
  const map = read()
  delete map[tournamentId]
  write(map)
}

export function hasCodeFor(tournamentId: string): boolean {
  return !!read()[tournamentId]
}

/** Nový náhodný kód (8 znaků, ~10^12 kombinací) */
export function generateAccessCode(length = 8): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('')
}

/** Zobrazení kódu po čtveřicích: ABCD-EFGH */
export function formatCode(code: string): string {
  return normalizeCode(code).replace(/(.{4})(?=.)/g, '$1-')
}

/** Odkaz, který turnaj rovnou odemkne */
export function accessLink(tournamentId: string, code: string): string {
  return `${window.location.origin}/${tournamentId}?kod=${normalizeCode(code)}`
}

/**
 * Ověří kód v DB (RPC z migrace 15) a zapamatuje ho.
 * Vrací id turnaje, null = neplatný kód, 'unavailable' = migrace 15 chybí.
 */
export async function unlockWithCode(code: string): Promise<string | null | 'unavailable'> {
  const { supabase } = await import('./supabase')
  const normalized = normalizeCode(code)
  if (normalized.length < 4) return null
  const { data, error } = await supabase.rpc('find_tournament_by_code', { code: normalized })
  if (error) return error.code === 'PGRST202' || error.code === '42883' ? 'unavailable' : null
  if (!data) return null
  rememberCode(data as string, normalized)
  return data as string
}

/** ?kod=XXXX v adrese turnaje → zapamatovat a z adresy odstranit (nezůstane v historii) */
export function consumeCodeFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('kod')
  if (!code) return
  const tid = window.location.pathname.split('/').filter(Boolean)[0]
  if (tid && /^[0-9a-f-]{36}$/i.test(tid)) rememberCode(tid, code)
  params.delete('kod')
  const qs = params.toString()
  window.history.replaceState(window.history.state, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)
}
