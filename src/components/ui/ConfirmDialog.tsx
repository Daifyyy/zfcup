// Vlastní potvrzovací dialog místo window.confirm() (systémový dialog blokuje stránku
// i automatizované testy a nevypadá jako aplikace).
// Použití: if (!(await confirmDialog('Smazat tým?', { danger: true }))) return
// <ConfirmHost /> musí být jednou v aplikaci (App.tsx).
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import { useBackClose } from '../../lib/useBackClose'

export interface ConfirmOptions {
  /** Nadpis (výchozí podle `danger`) */
  title?: string
  /** Text potvrzovacího tlačítka */
  confirmLabel?: string
  cancelLabel?: string
  /** Nevratná / mazací akce → červené tlačítko */
  danger?: boolean
  /** Hromadné nevratné akce: potvrdit až po opsání tohoto textu (např. názvu turnaje) */
  requireText?: string
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
  const [typed, setTyped] = useState('')
  useEffect(() => { setTyped('') }, [pending])
  const norm = (x: string) => x.trim().replace(/\s+/g, ' ').toLowerCase()
  const textOk = !pending?.requireText || norm(typed) === norm(pending.requireText)
  // Zpět (gesto / tlačítko) = Zrušit
  useBackClose(!!pending, () => close(false), 'confirm')

  useEffect(() => {
    if (!pending) return
    if (!pending.requireText) okRef.current?.focus()
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
        {pending.requireText && (
          <div className="cfm__confirm">
            <label className="field-label" htmlFor="cfm-text">Pro potvrzení napište: <strong>{pending.requireText}</strong></label>
            <input id="cfm-text" className="field-input" value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && textOk) close(true) }} />
          </div>
        )}
        <div className="cfm__actions">
          <button type="button" className="ui-btn ui-btn--secondary" onClick={() => close(false)}>{pending.cancelLabel ?? 'Zrušit'}</button>
          <button
            type="button"
            ref={okRef}
            className={`ui-btn ${pending.danger ? 'ui-btn--danger-solid' : 'ui-btn--primary'}`}
            style={{ opacity: textOk ? 1 : 0.45 }}
            onClick={() => { if (textOk) close(true) }}
          >
            {pending.confirmLabel ?? (pending.danger ? 'Smazat' : 'Potvrdit')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
