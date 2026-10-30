import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { usePlatformSettings } from '../../hooks/usePlatformSettings'
import { useBackClose } from '../../lib/useBackClose'
import { supabase } from '../../lib/supabase'
import { MODULES, MODULE_STAGES, getModuleDef, platformStage, type ModuleStage } from '../../lib/modules'
import { confirmDialog } from '../ui/ConfirmDialog'
import { BetaBadge } from '../ui/Badge'

interface FeedbackRow {
  id: string
  module: string
  message: string
  rating: number | null
  created_at: string
  tournament: { name: string } | null
}

/** Správa platformy (jen správce): globální vypínače, stavy modulů, zpětná vazba k Betě. */
export default function PlatformModal({ onClose }: { onClose: () => void }) {
  useBackClose(true, onClose, 'platform')
  const platform = usePlatformSettings()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState<FeedbackRow[] | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.from('module_feedback')
      .select('id, module, message, rating, created_at, tournament:tournament_id(name)')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        // bez migrace 21 tabulka chybí → sekci jen nezobrazit
        if (!cancelled && !error) setFeedback((data ?? []) as unknown as FeedbackRow[])
      })
    return () => { cancelled = true }
  }, [])

  async function changeStage(key: string, from: ModuleStage, to: ModuleStage) {
    if (saving || from === to) return
    const name = getModuleDef(key)?.name ?? key
    // Vypnutí běžícího modulu = nouzová brzda (pravidlo 7); běžné ukončení je Doběh
    if (to === 'off' && (from === 'beta' || from === 'on' || from === 'sunset')) {
      const ok = await confirmDialog(
        `${name} okamžitě zmizí všem turnajům, i těm, které právě hrají.\n\nJe to nouzová brzda pro případ chyby. Pro běžné ukončení zvolte „Doběh“ — turnajům, které dnes hrají, funkce vydrží do konce dne.`,
        { title: 'Nouzově vypnout?', confirmLabel: 'Vypnout hned', danger: true },
      )
      if (!ok) return
    }
    setSaving(true); setError('')
    try {
      const err = await platform.setModuleStage(key, to)
      if (err) setError(err)
    } finally { setSaving(false) }
  }

  return (
    <div className="lp-modal" onClick={onClose}>
      <div className="lp-modal__panel" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
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

        <h3 style={{ fontSize: '.95rem', margin: '1.3rem 0 .3rem' }}>Moduly</h3>
        <p style={{ fontSize: '.78rem', color: 'var(--ink-muted)', margin: '0 0 .7rem' }}>
          Nový modul nejdřív Interně (validační turnaj), pak Beta (ochotní pořadatelé), Hotovo až po ověření na ostré akci.
        </p>
        {!platform.modulesAvailable && platform.loaded && (
          <p style={{ fontSize: '.8rem', color: 'var(--warn)', margin: '0 0 .7rem' }}>Chybí migrace 21 (db-backup/21_modules.sql) — moduly jsou vypnuté.</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem' }}>
          {MODULES.map(def => {
            const stage = platformStage(def.key, platform.modules)
            const hint = MODULE_STAGES.find(s => s.value === stage)?.hint
            return (
              <div key={def.key} className="lp-switch-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '.5rem', opacity: def.ready ? 1 : 0.6 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.45rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '.9rem' }}>{def.name}</span>
                    {(stage === 'beta' || stage === 'internal') && <BetaBadge internal={stage === 'internal'} />}
                    {!def.ready && <span className="ui-badge ui-badge--outline">Připravuje se</span>}
                  </div>
                  <div style={{ fontSize: '.76rem', color: 'var(--ink-muted)', marginTop: 2 }}>{def.description}</div>
                </div>
                {def.ready && (
                  <>
                    <div className="ui-seg" role="radiogroup" aria-label={`Stav: ${def.name}`} style={{ flexWrap: 'wrap', opacity: saving ? 0.5 : 1 }}>
                      {MODULE_STAGES.map(s => (
                        <button key={s.value} type="button" role="radio" aria-checked={s.value === stage}
                          className={s.value === stage ? 'ui-seg__btn ui-seg__btn--active' : 'ui-seg__btn'}
                          style={{ flex: '1 1 auto', paddingLeft: '.5rem', paddingRight: '.5rem' }}
                          title={s.hint}
                          onClick={() => changeStage(def.key, stage, s.value)}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: '.74rem', color: 'var(--ink-muted)' }}>{hint}</div>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {error && <p style={{ color: 'var(--loss)', fontSize: '.8rem', marginTop: '.6rem' }}>{error}</p>}

        {feedback && (
          <>
            <h3 style={{ fontSize: '.95rem', margin: '1.3rem 0 .5rem' }}>Zpětná vazba k modulům</h3>
            {feedback.length === 0 && <p style={{ fontSize: '.8rem', color: 'var(--ink-muted)' }}>Zatím žádná.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              {feedback.map(f => (
                <div key={f.id} style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '.6rem .75rem', background: 'var(--surface-1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap', fontSize: '.74rem', color: 'var(--ink-muted)' }}>
                    <strong style={{ color: 'var(--ink)' }}>{getModuleDef(f.module)?.name ?? f.module}</strong>
                    <span>{f.tournament?.name ?? 'turnaj'}</span>
                    <span>{new Date(f.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    {f.rating && (
                      <span style={{ display: 'inline-flex', color: 'var(--gold)' }} aria-label={`${f.rating} z 5`}>
                        {Array.from({ length: f.rating }, (_, i) => <Star key={i} size={12} fill="currentColor" />)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '.85rem', marginTop: '.3rem', whiteSpace: 'pre-wrap' }}>{f.message}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <button type="button" className="ui-btn ui-btn--ghost" style={{ width: '100%', marginTop: '1.2rem' }} onClick={onClose}>Zavřít</button>
      </div>
    </div>
  )
}
