import { useState } from 'react'
import { usePlatformSettings } from '../../hooks/usePlatformSettings'
import { useBackClose } from '../../lib/useBackClose'

/** Správa platformy (jen správce): globální vypínače. */
export default function PlatformModal({ onClose }: { onClose: () => void }) {
  useBackClose(true, onClose, 'platform')
  const platform = usePlatformSettings()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  return (
    <div className="lp-modal" onClick={onClose}>
      <div className="lp-modal__panel" onClick={e => e.stopPropagation()}>
        <h2 className="lp-modal__title">Správa platformy</h2>
        <p style={{ fontSize: '.85rem', color: 'var(--ink-muted)', margin: '0 0 1rem' }}>
          Globální nastavení pro všechny turnaje a organizátory.
        </p>
        <div className="lp-switch-row">
          <div>
            <div style={{ fontWeight: 600, fontSize: '.9rem' }}>Tipovačka</div>
            <div style={{ fontSize: '.78rem', color: 'var(--ink-muted)', marginTop: 2 }}>
              {platform.tipsEnabled
                ? 'Povolena — organizátoři ji mohou zapnout u svých turnajů.'
                : 'Vypnuta — není vidět v žádném turnaji, v administraci ani na úvodní stránce.'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={platform.tipsEnabled}
            aria-label="Povolit tipovačku"
            className={platform.tipsEnabled ? 'lp-switch lp-switch--on' : 'lp-switch'}
            style={{ opacity: saving ? 0.5 : 1 }}
            onClick={async () => {
              if (saving) return
              setSaving(true); setError('')
              try {
                const err = await platform.setTipsGloballyEnabled(!platform.tipsEnabled)
                if (err) setError(err)
              } finally { setSaving(false) }
            }}
          ><span /></button>
        </div>
        {error && <p style={{ color: 'var(--loss)', fontSize: '.8rem', marginTop: '.6rem' }}>{error}</p>}
        <button type="button" className="ui-btn ui-btn--ghost" style={{ width: '100%', marginTop: '1.2rem' }} onClick={onClose}>Zavřít</button>
      </div>
    </div>
  )
}
