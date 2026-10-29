import { supabase } from './supabase'

// Sdílený realtime kanál pro celou aplikaci.
//
// Hooky odebírají změny tabulky přes subscribeTable(table, handler, filter).
// Filtr (např. `tournament_id=eq.{id}`) zajistí, že DB posílá jen změny
// aktuálního turnaje — bez něj by každá změna v jakémkoli turnaji donutila
// všechny otevřené prohlížeče stáhnout data znovu.
//
// Supabase nedoručuje DELETE události u filtrovaného odběru (smazaný řádek nese
// jen primární klíč), proto má každá tabulka navíc nefiltrovaný odběr DELETE.
// Mazání je vzácné, takže zbytečné refetche z cizích turnajů nevadí.
//
// Kanál se přestaví jen když se změní sada (tabulka, filtr) — typicky při
// přepnutí turnaje — ne při každém přihlášení/odhlášení hooku.

type Handler = () => void

/** klíč `${table}|${filter}` → handlery */
const bindings = new Map<string, Set<Handler>>()
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
let channel: ReturnType<typeof supabase.channel> | null = null
let channelKeys = ''
let buildTimer: ReturnType<typeof setTimeout> | null = null
let wasSubscribed = false

// ── Stav spojení (pro přizpůsobení pollingu, src/lib/poller.ts) ──
let healthy = false
const healthListeners = new Set<() => void>()
function setHealthy(v: boolean) {
  if (v === healthy) return
  healthy = v
  healthListeners.forEach(l => l())
}
/** Realtime je připojený a doručuje změny. */
export function isRealtimeHealthy(): boolean { return healthy }
export function onRealtimeHealthChange(cb: () => void): () => void {
  healthListeners.add(cb)
  return () => { healthListeners.delete(cb) }
}

// ── Skrytá karta uvolní spojení (Supabase Free: max. 200 souběžných) ──
const HIDDEN_DISCONNECT_MS = 60_000
let hiddenTimer: ReturnType<typeof setTimeout> | null = null
let pausedForHidden = false
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenTimer = setTimeout(() => {
        hiddenTimer = null
        if (!channel) return
        pausedForHidden = true
        supabase.removeChannel(channel)
        channel = null
        channelKeys = ''
        setHealthy(false)
      }, HIDDEN_DISCONNECT_MS)
    } else {
      if (hiddenTimer) { clearTimeout(hiddenTimer); hiddenTimer = null }
      if (pausedForHidden) {
        pausedForHidden = false
        // Data obnoví poller při návratu na kartu; kanál se jen znovu připojí
        scheduleRebuild()
      }
    }
  })
}

const keyOf = (table: string, filter?: string) => `${table}|${filter ?? ''}`
const splitKey = (key: string) => {
  const i = key.indexOf('|')
  return { table: key.slice(0, i), filter: key.slice(i + 1) || undefined }
}

/** Spustí handlery daných klíčů s 80ms debounce (koalescuje dávky, např. 8+ insertů při nasazení). */
function fire(keys: string[]) {
  for (const key of keys) {
    if (debounceTimers.has(key)) clearTimeout(debounceTimers.get(key)!)
    debounceTimers.set(key, setTimeout(() => {
      debounceTimers.delete(key)
      bindings.get(key)?.forEach(h => h())
    }, 80))
  }
}

function buildChannel() {
  buildTimer = null
  const keys = Array.from(bindings.keys()).sort()
  const signature = keys.join(',')
  if (signature === channelKeys && channel) return
  channelKeys = signature

  if (channel) {
    supabase.removeChannel(channel)
    channel = null
  }
  setHealthy(false)
  if (keys.length === 0 || pausedForHidden) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ch: any = supabase.channel(`app-realtime-${Date.now()}`)
  const tables = new Set<string>()
  for (const key of keys) {
    const { table, filter } = splitKey(key)
    tables.add(table)
    if (filter) {
      ch = ch
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, () => fire([key]))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter }, () => fire([key]))
    } else {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => fire([key]))
    }
  }
  // DELETE nejde filtrovat → jeden nefiltrovaný odběr na tabulku pro filtrované klíče
  for (const table of tables) {
    const filteredKeys = keys.filter(k => k.startsWith(`${table}|`) && splitKey(k).filter)
    if (filteredKeys.length === 0) continue
    ch = ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, () => fire(filteredKeys))
  }

  wasSubscribed = false
  channel = ch.subscribe((status: string) => {
    if (status === 'SUBSCRIBED') {
      // Po výpadku spojení mohly změny utéct → jednou vše obnovit
      if (wasSubscribed) fire(Array.from(bindings.keys()))
      wasSubscribed = true
      setHealthy(true)
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      // Výpadek nebo odmítnuté spojení (limit) → poller přejde na častější obnovu
      setHealthy(false)
    }
  })
}

function scheduleRebuild() {
  if (buildTimer) clearTimeout(buildTimer)
  buildTimer = setTimeout(buildChannel, 100)
}

/**
 * Odebírat změny tabulky. `filter` ve tvaru PostgREST, např. `tournament_id=eq.{uuid}`
 * (podporováno i `in.(a,b)`). Bez filtru = všechny změny tabulky.
 */
export function subscribeTable(table: string, handler: Handler, filter?: string): () => void {
  // Filtr s prázdnou hodnotou (hook bez tournamentId) by shodil celý kanál → neodebírat
  if (filter !== undefined && /=(eq|in)\.$/.test(filter)) return () => {}
  const key = keyOf(table, filter)
  if (!bindings.has(key)) bindings.set(key, new Set())
  bindings.get(key)!.add(handler)
  scheduleRebuild()
  return () => {
    const set = bindings.get(key)
    set?.delete(handler)
    if (set && set.size === 0) bindings.delete(key)
    scheduleRebuild()
  }
}

/** Filtr pro tabulky s `tournament_id`. */
export const byTournament = (tournamentId: string) => `tournament_id=eq.${tournamentId}`
