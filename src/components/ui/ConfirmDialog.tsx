// Vlastní potvrzovací dialog místo window.confirm() (systémový dialog blokuje stránku
// i automatizované testy a nevypadá jako aplikace).
// Použití: if (!(await confirmDialog('Smazat tým?', { danger: true }))) return
// <ConfirmHost /> musí být jednou v aplikaci (App.tsx).
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, HelpCircle } from 'lucide-react'

export interface ConfirmOptions {
  /** Nadpis (výchozí podle `danger`) */
  title?: string
  /** Text potvrzovacího tlačítka */
  confirmLabel?: string
  cancelLabel?: string
  /** Nevratná / mazací akce → červené tlačítko */
  danger?: boolean
}

interface Pending extends ConfirmOptions { message: string; resolve: (ok: boolean) => void }

let current: Pending | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

export function confirmDialog(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  // Předchozí neuzavřený dialog = zrušeno
  current?.resolve(false)
  return new Promise(resolve => {
    current = { ...options, message, resolve }
    emit()
  })
}

function close(ok: boolean) {
  const p = current
  current = null
  emit()
  p?.resolve(ok)
}

export function ConfirmHost() {
  const pending = useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => current,
  )
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!pending) return
    okRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false) }
    }
    // capture: Esc nesmí zavřít i panel pod dialogem
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [pending])

  if (!pending) return null
  const Icon = pending.danger ? AlertTriangle : HelpCircle
  return createPortal(
    <div className="cfm" onMouseDown={e => { if (e.target === e.currentTarget) close(false) }}>
      <div className={`cfm__panel${pending.danger ? ' cfm__panel--danger' : ''}`} role="alertdialog" aria-modal="true" aria-labelledby="cfm-title" aria-describedby="cfm-msg">
        <div className="cfm__head">
          <Icon size={22} className="cfm__icon" />
          <h2 id="cfm-title" className="cfm__title">{pending.title ?? (pending.danger ? 'Opravdu?' : 'Potvrzení')}</h2>
        </div>
        <p id="cfm-msg" className="cfm__msg">{pending.message}</p>
        <div className="cfm__actions">
          <button type="button" className="ui-btn ui-btn--secondary" onClick={() => close(false)}>{pending.cancelLabel ?? 'Zrušit'}</button>
          <button
            type="button"
            ref={okRef}
            className={`ui-btn ${pending.danger ? 'ui-btn--danger-solid' : 'ui-btn--primary'}`}
            onClick={() => close(true)}
          >
            {pending.confirmLabel ?? (pending.danger ? 'Smazat' : 'Potvrdit')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
