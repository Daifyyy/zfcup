import { lazy, Suspense, type ComponentProps, type ComponentType, type ReactNode } from 'react'

/**
 * Líně načtená komponenta s vlastním Suspense — stejné použití jako běžný import.
 * Pro části, které divák nepotřebuje hned (admin, TV tabule, kiosk, bulletin).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyComponent<T extends ComponentType<any>>(load: () => Promise<{ default: T }>, fallback: ReactNode = null) {
  const Lazy = lazy(load)
  return function LazyWrapper(props: ComponentProps<T>) {
    return (
      <Suspense fallback={fallback}>
        <Lazy {...props} />
      </Suspense>
    )
  }
}
