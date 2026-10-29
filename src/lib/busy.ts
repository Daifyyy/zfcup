// Stav „probíhá důležité ukládání“ (výsledek zápasu / play-off).
// Dokud běží: přes obrazovku je překryv (nejde kliknout jinam), admin nejde zavřít,
// krok Zpět se zruší a zavření karty prohlížeč nejdřív potvrdí. Viz BusyOverlay, App.tsx.
import { useSyncExternalStore } from 'react'

let label: string | null = null
const listeners = new Set<() => void>()

function onBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault()
  e.returnValue = ''
}

export function setBusy(next: string | null) {
  if (next === label) return
  if (next && !label) window.addEventListener('beforeunload', onBeforeUnload)
  if (!next && label) window.removeEventListener('beforeunload', onBeforeUnload)
  label = next
  listeners.forEach(l => l())
}

export function isBusy(): boolean {
  return label !== null
}

export function useBusy(): string | null {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => label,
  )
}

/** Spustí `fn` jako blokující ukládání; stav se uvolní i při chybě. */
export async function withBusy<T>(text: string, fn: () => Promise<T>): Promise<T> {
  setBusy(text)
  try {
    return await fn()
  } finally {
    setBusy(null)
  }
}
