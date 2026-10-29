import { lazy, Suspense, type ComponentProps, type ComponentType, type ReactNode } from 'react'

/**
 * Líně načtená komponenta s vlastním Suspense — stejné použití jako běžný import.
 * Pro části, které divák nepotřebuje hned (admin, TV tabule, kiosk, bulletin).
 */
const RELOAD_KEY = 'turnajnik_chunk_reload'

/**
 * Po nasazení nové verze zmizí staré soubory líně načítaných částí → import selže.
 * Jednou obnovíme stránku (načte se nová verze); když selže znovu do minuty, chybu pustíme dál (ErrorBoundary).
 */
export function withReloadOnChunkError<T>(load: () => Promise<T>): () => Promise<T> {
  return () => load().then(mod => {
    try { sessionStorage.removeItem(RELOAD_KEY) } catch { /* ignorovat */ }
    return mod
  }, err => {
    let last = 0
    try { last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0) } catch { /* ignorovat */ }
    if (Date.now() - last > 60_000) {
      try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())) } catch { /* ignorovat */ }
      window.location.reload()
      return new Promise<T>(() => {}) // stránka se obnovuje
    }
    throw err
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyComponent<T extends ComponentType<any>>(load: () => Promise<{ default: T }>, fallback: ReactNode = null) {
  const Lazy = lazy(withReloadOnChunkError(load))
  return function LazyWrapper(props: ComponentProps<T>) {
    return (
      <Suspense fallback={fallback}>
        <Lazy {...props} />
      </Suspense>
    )
  }
}
