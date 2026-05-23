import { supabase } from './supabase'

type Handler = () => void

const tableHandlers = new Map<string, Set<Handler>>()
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
let channel: ReturnType<typeof supabase.channel> | null = null
let buildTimer: ReturnType<typeof setTimeout> | null = null

function buildChannel() {
  if (channel) {
    supabase.removeChannel(channel)
    channel = null
  }
  const tables = Array.from(tableHandlers.keys())
  if (tables.length === 0) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ch: any = supabase.channel('app-realtime')
  for (const table of tables) {
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      // 80ms debounce per tabulka — koalescuje burst eventů (např. při seedTeams 8+ insertů)
      if (debounceTimers.has(table)) clearTimeout(debounceTimers.get(table)!)
      debounceTimers.set(table, setTimeout(() => {
        debounceTimers.delete(table)
        tableHandlers.get(table)?.forEach(h => h())
      }, 80))
    })
  }
  channel = ch.subscribe()
}

function scheduleRebuild() {
  if (buildTimer) clearTimeout(buildTimer)
  buildTimer = setTimeout(buildChannel, 100)
}

export function subscribeTable(table: string, handler: Handler): () => void {
  if (!tableHandlers.has(table)) tableHandlers.set(table, new Set())
  tableHandlers.get(table)!.add(handler)
  scheduleRebuild()
  return () => {
    tableHandlers.get(table)?.delete(handler)
    if ((tableHandlers.get(table)?.size ?? 0) === 0) tableHandlers.delete(table)
    scheduleRebuild()
  }
}
