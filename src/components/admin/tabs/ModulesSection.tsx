// Admin → Nastavení → Nové funkce: moduly ze systému modulů (Vlna 5, src/lib/modules.ts).
// Přepínač mění jen tournament.modules — data modulu se nikdy nemažou (pravidlo 1).
import { useState } from 'react'
import { MessageSquare, Star } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { isMissingColumnError } from '../../../lib/partners'
import { visibleModuleSettings, withModuleChoice, type ModuleSetting } from '../../../lib/modules'
import { BetaBadge } from '../../ui/Badge'
import type { Tournament } from '../../../hooks/useTournament'

interface Props {
  tournament: Tournament | null
  platformModules: Record<string, string>
  isPlatformAdmin: boolean
  refetchTournament: () => void
  showToast: (msg: string) => void
}

export default function ModulesSection({ tournament, platformModules, isPlatformAdmin, refetchTournament, showToast }: Props) {
  const [saving, setSaving] = useState<string | null>(null)
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null)
  const settings = visibleModuleSettings(tournament, platformModules, isPlatformAdmin)
  if (!tournament || settings.length === 0) return null

  async function toggle(s: ModuleSetting) {
    if (!tournament || saving) return
    const next = !s.checked
    if (next && !s.canEnable) { showToast('Funkce se ukončuje — znovu ji zapnout nejde'); return }
    setSaving(s.def.key)
    try {
      const { error } = await supabase.from('tournament')
        .update({ modules: withModuleChoice(tournament.modules, s.def.key, next) })
        .eq('id', tournament.id)
      if (error) {
        showToast(isMissingColumnError(error, 'modules') ? 'Chybí migrace 21 (db-backup/21_modules.sql)' : 'Chyba: ' + error.message)
        return
      }
      showToast(next ? `${s.def.name} zapnuto ✓` : `${s.def.name} vypnuto`)
      refetchTournament()
    } finally {
      setSaving(null)
    }
  }

  return (
    <>
      <hr className="divider" />
      <div className="sub-title">Nové funkce</div>
      <p style={{ fontSize: '.75rem', color: 'var(--ink-muted)', margin: '0 0 .6rem' }}>
        Zapnout i vypnout jde kdykoli, i během turnaje — data turnaje se nemění, po vypnutí se jen skryjí.
      </p>
      {settings.map(s => {
        const testing = s.stage === 'beta' || s.stage === 'internal'
        return (
          <div key={s.def.key} style={{ marginBottom: '.55rem' }}>
            <div className="lp-switch-row">
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.45rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: '.88rem' }}>{s.def.name}</span>
                  {testing && <BetaBadge internal={s.stage === 'internal'} />}
                </div>
                <div style={{ fontSize: '.74rem', color: 'var(--ink-muted)', marginTop: 3 }}>{s.def.description}</div>
                {s.stage === 'beta' && (
                  <div style={{ fontSize: '.72rem', color: 'var(--ink-muted)', marginTop: 3, fontStyle: 'italic' }}>
                    Funkce ve zkušebním provozu, může se ještě měnit.
                  </div>
                )}
                {s.stage === 'sunset' && (
                  <div style={{ fontSize: '.72rem', color: 'var(--warn)', marginTop: 3 }}>
                    Funkce se ukončuje: v den, kdy turnaj hraje, ještě poběží, pak se vypne.
                  </div>
                )}
                {testing && (
                  <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" style={{ marginTop: '.4rem', paddingLeft: 0 }}
                    onClick={() => setFeedbackFor(feedbackFor === s.def.key ? null : s.def.key)}>
                    <MessageSquare size={14} /> Poslat zpětnou vazbu
                  </button>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={s.checked}
                aria-label={s.def.name}
                className={s.checked ? 'lp-switch lp-switch--on' : 'lp-switch'}
                style={{ opacity: saving === s.def.key || (!s.checked && !s.canEnable) ? 0.5 : 1 }}
                onClick={() => toggle(s)}
              ><span /></button>
            </div>
            {feedbackFor === s.def.key && (
              <FeedbackForm moduleKey={s.def.key} tournamentId={tournament.id} showToast={showToast} onDone={() => setFeedbackFor(null)} />
            )}
          </div>
        )
      })}
    </>
  )
}

function FeedbackForm({ moduleKey, tournamentId, showToast, onDone }: { moduleKey: string; tournamentId: string; showToast: (m: string) => void; onDone: () => void }) {
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [sending, setSending] = useState(false)

  async function send() {
    if (sending) return
    const text = message.trim()
    if (!text) { showToast('Napište, co funguje a co ne'); return }
    setSending(true)
    try {
      const { error } = await supabase.from('module_feedback').insert({ module: moduleKey, tournament_id: tournamentId, message: text.slice(0, 2000), rating })
      if (error) {
        showToast(error.code === '42P01' || /module_feedback/.test(error.message) ? 'Chybí migrace 21 (db-backup/21_modules.sql)' : 'Chyba: ' + error.message)
        return
      }
      showToast('Díky, zpětná vazba odeslána ✓')
      onDone()
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderTop: 'none', borderRadius: '0 0 var(--radius) var(--radius)', padding: '.7rem .9rem', background: 'var(--surface-1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: '.5rem' }}>
        <span style={{ fontSize: '.75rem', color: 'var(--ink-muted)', marginRight: 6 }}>Hodnocení</span>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" aria-label={`${n} z 5`} onClick={() => setRating(rating === n ? null : n)}
            style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: rating && n <= rating ? 'var(--gold)' : 'var(--line)' }}>
            <Star size={20} fill={rating && n <= rating ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      <textarea className="field-input" rows={3} maxLength={2000} value={message} onChange={e => setMessage(e.target.value)}
        placeholder="Co funguje, co nefunguje, co byste chtěli jinak…" style={{ width: '100%', resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end', marginTop: '.5rem' }}>
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={onDone}>Zrušit</button>
        <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" style={{ opacity: sending ? 0.5 : 1 }} onClick={send}>Odeslat</button>
      </div>
    </div>
  )
}
