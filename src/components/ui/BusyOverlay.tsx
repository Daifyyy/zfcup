import { createPortal } from 'react-dom'
import { useBusy } from '../../lib/busy'

/** Překryv při ukládání výsledku — zachytí všechna kliknutí, dokud se data neuloží. */
export function BusyOverlay() {
  const label = useBusy()
  if (!label) return null
  return createPortal(
    <div className="busy" role="alertdialog" aria-busy="true" aria-live="assertive" aria-label={label}
      onClick={e => { e.preventDefault(); e.stopPropagation() }}>
      <div className="busy__panel">
        <div className="spinner" />
        <div className="busy__text">{label}</div>
        <div className="busy__hint">Nezavírejte stránku, za chvíli je hotovo.</div>
      </div>
    </div>,
    document.body,
  )
}
