import { Home } from 'lucide-react'
import AccessCodeForm from './AccessCodeForm'

interface Props {
  /** Turnaj nebyl nalezen (špatný odkaz / smazaný turnaj) */
  notFound?: boolean
  onHome: () => void
}

/** Načítací obrazovka turnaje — kostra hlavičky a Přehledu, ať stránka „neskáče“. */
export function TournamentSkeleton({ notFound, onHome }: Props) {
  if (notFound) {
    return (
      <div className="tsk tsk--center">
        <div className="tsk__msg">
          <div className="tsk__msg-title" style={{ fontFamily: 'var(--font-display)' }}>Turnaj nenalezen</div>
          <p>Odkaz je neplatný, turnaj byl odstraněn, nebo je soukromý. Máte-li od pořadatele přístupový kód, zadejte ho:</p>
          <AccessCodeForm
            autoFocus
            onUnlocked={id => {
              // Načíst znovu s kódem v hlavičce všech dotazů
              if (window.location.pathname.split('/').filter(Boolean)[0] === id) window.location.reload()
              else window.location.assign(`/${id}`)
            }}
          />
          <button type="button" className="ui-btn ui-btn--primary" onClick={onHome}>
            <Home size={16} /> Na úvodní stránku
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="tsk" aria-busy="true" aria-label="Načítám turnaj">
      <div className="tsk__hdr">
        <div className="tsk__hdr-inner">
          <span className="tsk__bone tsk__bone--dark" style={{ width: 40, height: 40, borderRadius: '50%' }} />
          <span className="tsk__bone tsk__bone--dark" style={{ width: 'min(260px, 50vw)', height: 20 }} />
        </div>
      </div>
      <main className="tsk__main">
        <span className="tsk__bone" style={{ height: 150 }} />
        <div className="tsk__kpis">
          {[0, 1, 2, 3].map(i => <span key={i} className="tsk__bone" style={{ height: 76 }} />)}
        </div>
        <div className="tsk__cols">
          <span className="tsk__bone" style={{ height: 260 }} />
          <span className="tsk__bone" style={{ height: 260 }} />
        </div>
      </main>
      <span className="sr-only">Načítám…</span>
    </div>
  )
}
