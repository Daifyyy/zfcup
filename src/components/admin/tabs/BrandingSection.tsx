import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Tournament } from '../../../hooks/useTournament'
import { BRAND_PRESETS, DEFAULT_BRAND, DEFAULT_BRAND_2, brandVars, contrastRatio, isHex } from '../../../lib/theme'
import { isMissingColumnError } from '../../../lib/partners'

interface Props {
  tournament: Tournament | null
  refetchTournament: () => void
  showToast: (msg: string) => void
}

/** Admin → Nastavení → Vzhled turnaje: barvy brandingu s živým náhledem. */
export default function BrandingSection({ tournament, refetchTournament, showToast }: Props) {
  const [primary, setPrimary] = useState(DEFAULT_BRAND)
  const [secondary, setSecondary] = useState(DEFAULT_BRAND_2)
  const [custom, setCustom] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tournament) return
    const has = isHex(tournament.brand_primary)
    setCustom(has)
    setPrimary(has ? tournament.brand_primary! : DEFAULT_BRAND)
    setSecondary(isHex(tournament.brand_secondary) ? tournament.brand_secondary! : DEFAULT_BRAND_2)
  }, [tournament?.id, tournament?.brand_primary, tournament?.brand_secondary])

  const preview = brandVars(primary, secondary) ?? {}
  const lowContrast = isHex(primary) && contrastRatio(primary, '#ffffff') < 3

  async function save(reset = false) {
    if (saving || !tournament) return
    if (!reset && (!isHex(primary) || !isHex(secondary))) { showToast('Barva musí být ve tvaru #RRGGBB'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('tournament').update({
        brand_primary: reset ? null : primary,
        brand_secondary: reset ? null : secondary,
      }).eq('id', tournament.id)
      if (error) {
        showToast(isMissingColumnError(error, 'brand_')
          ? 'Branding vyžaduje migraci db-backup/08_partners_branding_media.sql'
          : 'Chyba: ' + error.message)
        return
      }
      refetchTournament()
      showToast(reset ? 'Obnoven výchozí vzhled' : 'Vzhled uložen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="sub-title">Vzhled turnaje</div>
      <div className="info-box">
        Barvy turnaje (např. podle loga pořadatele nebo generálního partnera). Použijí se na tlačítka,
        zvýraznění a akcenty na webu i na TV tabuli. Text se automaticky přizpůsobí, aby zůstal čitelný.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginBottom: '.9rem' }}>
        {BRAND_PRESETS.map(p => (
          <button
            key={p.name}
            type="button"
            title={p.name}
            onClick={() => { setPrimary(p.primary); setSecondary(p.secondary); setCustom(true) }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '.4rem', padding: '.3rem .55rem',
              border: `1px solid ${primary === p.primary && secondary === p.secondary ? 'var(--ink)' : 'var(--line-strong)'}`,
              borderRadius: 'var(--radius)', background: 'var(--surface-1)', cursor: 'pointer', fontSize: '.74rem', fontWeight: 600,
            }}
          >
            <span style={{ width: 14, height: 14, borderRadius: 3, background: p.primary }} />
            <span style={{ width: 14, height: 14, borderRadius: 3, background: p.secondary, marginLeft: -6, boxShadow: '0 0 0 2px #fff' }} />
            {p.name}
          </button>
        ))}
      </div>

      <div className="field-row">
        <div className="field-group">
          <label className="field-label">Hlavní barva</label>
          <div style={{ display: 'flex', gap: '.4rem' }}>
            <input type="color" value={isHex(primary) ? primary : DEFAULT_BRAND} onChange={e => { setPrimary(e.target.value); setCustom(true) }}
              style={{ width: 44, height: 38, border: '1px solid var(--line-strong)', borderRadius: 'var(--radius)', padding: 2, background: '#fff', cursor: 'pointer' }} />
            <input className="field-input" value={primary} onChange={e => { setPrimary(e.target.value); setCustom(true) }} placeholder="#1d4ed8" maxLength={7} />
          </div>
        </div>
        <div className="field-group">
          <label className="field-label">Doplňková barva</label>
          <div style={{ display: 'flex', gap: '.4rem' }}>
            <input type="color" value={isHex(secondary) ? secondary : DEFAULT_BRAND_2} onChange={e => { setSecondary(e.target.value); setCustom(true) }}
              style={{ width: 44, height: 38, border: '1px solid var(--line-strong)', borderRadius: 'var(--radius)', padding: 2, background: '#fff', cursor: 'pointer' }} />
            <input className="field-input" value={secondary} onChange={e => { setSecondary(e.target.value); setCustom(true) }} placeholder="#e11d48" maxLength={7} />
          </div>
        </div>
      </div>
      {lowContrast && (
        <div className="warn-box">Hlavní barva je velmi světlá — pro text a čáry ji automaticky ztmavíme, aby zůstala čitelná.</div>
      )}

      {/* Živý náhled */}
      <div style={{ ...(preview as React.CSSProperties), border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '.9rem' }}>
        <div style={{ background: 'var(--chrome)', color: '#fff', padding: '.6rem .9rem', display: 'flex', alignItems: 'center', gap: '.6rem', borderBottom: '2px solid var(--brand)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem' }}>{tournament?.name || 'Turnaj'}</span>
          <span style={{ marginLeft: 'auto', fontSize: '.7rem', padding: '.15rem .45rem', borderRadius: 3, background: 'var(--brand-2)', color: '#fff', fontWeight: 700 }}>ŽIVĚ</span>
        </div>
        <div style={{ padding: '.8rem .9rem', background: 'var(--surface-1)', display: 'flex', alignItems: 'center', gap: '.7rem', flexWrap: 'wrap' }}>
          <span className="ui-btn ui-btn--primary ui-btn--sm">Tlačítko</span>
          <span className="ui-badge ui-badge--brand">Vítěz</span>
          <span style={{ color: 'var(--brand)', fontWeight: 700 }}>Odkaz / zvýraznění</span>
          <span style={{ height: 3, width: 60, background: 'var(--brand)', borderRadius: 2 }} />
        </div>
      </div>

      <div className="btn-row">
        <button type="button" className="btn btn-p" onClick={() => save(false)} style={{ opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Ukládám…' : 'Uložit vzhled'}
        </button>
        {custom && (
          <button type="button" className="btn btn-s" onClick={() => save(true)} style={{ opacity: saving ? 0.6 : 1 }}>
            Výchozí vzhled
          </button>
        )}
      </div>
    </div>
  )
}
