import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Tournament } from '../../../hooks/useTournament'
import { BRAND_PRESETS, DEFAULT_BRAND, DEFAULT_BRAND_2, brandVars, contrastRatio, isHex, type BrandStyle } from '../../../lib/theme'
import { isMissingColumnError } from '../../../lib/partners'
import { getSportDef } from '../../../lib/sports'
import { photoToJpeg, removeAssetByUrl, storagePathFromUrl, tournamentAssetPath, uploadAsset } from '../../../lib/storage'
import { confirmDialog } from '../../ui/ConfirmDialog'

interface Props {
  tournament: Tournament | null
  refetchTournament: () => void
  showToast: (msg: string) => void
}

const STYLES: { value: BrandStyle; label: string; hint: string }[] = [
  { value: 'subtle', label: 'Jemná', hint: 'Tmavé lišty, barva značky v tlačítkách a akcentech.' },
  { value: 'bold', label: 'Výrazná', hint: 'Hlavička, úvod Přehledu a TV v tmavém odstínu značky, doplňková barva v pruzích.' },
]

/** Admin → Nastavení → Vzhled turnaje: barvy a intenzita brandingu s živým náhledem. */
export default function BrandingSection({ tournament, refetchTournament, showToast }: Props) {
  const [primary, setPrimary] = useState(DEFAULT_BRAND)
  const [secondary, setSecondary] = useState(DEFAULT_BRAND_2)
  const [style, setStyle] = useState<BrandStyle>('subtle')
  const [custom, setCustom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!tournament) return
    const has = isHex(tournament.brand_primary)
    setCustom(has)
    setPrimary(has ? tournament.brand_primary! : DEFAULT_BRAND)
    setSecondary(isHex(tournament.brand_secondary) ? tournament.brand_secondary! : DEFAULT_BRAND_2)
    setStyle(tournament.brand_style === 'bold' ? 'bold' : 'subtle')
  }, [tournament?.id, tournament?.brand_primary, tournament?.brand_secondary, tournament?.brand_style])

  const preview = (brandVars(primary, secondary, style) ?? {}) as React.CSSProperties
  const lowContrast = isHex(primary) && contrastRatio(primary, '#ffffff') < 3
  const SportIcon = getSportDef(tournament?.sport).Icon

  async function save(reset = false) {
    if (saving || !tournament) return
    if (!reset && (!isHex(primary) || !isHex(secondary))) { showToast('Barva musí být ve tvaru #RRGGBB'); return }
    setSaving(true)
    try {
      const colors = { brand_primary: reset ? null : primary, brand_secondary: reset ? null : secondary }
      let { error } = await supabase.from('tournament').update({ ...colors, brand_style: reset ? 'subtle' : style }).eq('id', tournament.id)
      let styleSaved = true
      // Bez migrace 14 sloupec brand_style chybí → uložit aspoň barvy
      if (error && isMissingColumnError(error, 'brand_style')) {
        styleSaved = false
        ;({ error } = await supabase.from('tournament').update(colors).eq('id', tournament.id))
      }
      if (error) {
        showToast(isMissingColumnError(error, 'brand_')
          ? 'Branding vyžaduje migraci db-backup/08_partners_branding_media.sql'
          : 'Chyba: ' + error.message)
        return
      }
      refetchTournament()
      if (!styleSaved && style === 'bold' && !reset) showToast('Barvy uloženy. Výrazný styl vyžaduje migraci db-backup/14_brand_style.sql')
      else showToast(reset ? 'Obnoven výchozí vzhled' : 'Vzhled uložen')
    } finally {
      setSaving(false)
    }
  }

  const pick = (p: string, s: string) => { setPrimary(p); setSecondary(s); setCustom(true) }

  /** Fotka z akce jako pozadí grafik ve stylu Foto (migrace 20). */
  async function uploadPhoto(file: File | undefined) {
    if (!file || !tournament || photoBusy) return
    setPhotoBusy(true)
    try {
      // vždy JPEG do 1920 px a pod 1 MB — původní soubor se nikdy nenahraje
      const jpeg = await photoToJpeg(file)
      if ('error' in jpeg) { showToast(jpeg.error); return }
      const path = tournamentAssetPath(tournament.id, 'share', 'photo', 'jpg')
      const up = await uploadAsset(path, jpeg.file)
      if ('error' in up) { showToast('Chyba nahrávání: ' + up.error); return }
      const { error } = await supabase.from('tournament').update({ share_photo_url: up.url }).eq('id', tournament.id)
      if (error) {
        await removeAssetByUrl(up.url)
        showToast(isMissingColumnError(error, 'share_photo_url') ? 'Fotka vyžaduje migraci db-backup/20_share_photo.sql' : 'Chyba: ' + error.message)
        return
      }
      // stará fotka s jinou příponou by zůstala ve Storage
      const old = tournament.share_photo_url
      if (old && storagePathFromUrl(old) !== path) await removeAssetByUrl(old)
      refetchTournament()
      showToast('Fotka uložena — grafiky ji použijí ve stylu Foto')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function removePhoto() {
    if (!tournament?.share_photo_url || photoBusy) return
    if (!await confirmDialog('Odebrat fotku pro grafiky?', { danger: true, confirmLabel: 'Odebrat' })) return
    setPhotoBusy(true)
    try {
      const { error } = await supabase.from('tournament').update({ share_photo_url: null }).eq('id', tournament.id)
      if (error) { showToast('Chyba: ' + error.message); return }
      await removeAssetByUrl(tournament.share_photo_url)
      refetchTournament()
      showToast('Fotka odebrána')
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <div>
      <div className="sub-title">Vzhled turnaje</div>
      <div className="info-box">
        Barvy turnaje (např. podle loga pořadatele nebo generálního partnera) se použijí na webu i na TV.
        Text se automaticky přizpůsobí, aby zůstal čitelný.
      </div>

      <div className="br-presets">
        {BRAND_PRESETS.map(p => {
          const on = primary === p.primary && secondary === p.secondary
          return (
            <button key={p.name} type="button" title={p.name} className={`br-preset${on ? ' br-preset--on' : ''}`} onClick={() => pick(p.primary, p.secondary)}>
              <span className="br-preset__sw" style={{ background: p.primary }} />
              <span className="br-preset__sw br-preset__sw--2" style={{ background: p.secondary }} />
              {p.name}
            </button>
          )
        })}
      </div>

      <div className="field-row">
        <div className="field-group">
          <label className="field-label">Hlavní barva</label>
          <div style={{ display: 'flex', gap: '.4rem' }}>
            <input type="color" className="br-color" value={isHex(primary) ? primary : DEFAULT_BRAND} onChange={e => { setPrimary(e.target.value); setCustom(true) }} aria-label="Hlavní barva" />
            <input className="field-input" value={primary} onChange={e => { setPrimary(e.target.value); setCustom(true) }} placeholder="#1d4ed8" maxLength={7} />
          </div>
        </div>
        <div className="field-group">
          <label className="field-label">Doplňková barva</label>
          <div style={{ display: 'flex', gap: '.4rem' }}>
            <input type="color" className="br-color" value={isHex(secondary) ? secondary : DEFAULT_BRAND_2} onChange={e => { setSecondary(e.target.value); setCustom(true) }} aria-label="Doplňková barva" />
            <input className="field-input" value={secondary} onChange={e => { setSecondary(e.target.value); setCustom(true) }} placeholder="#e11d48" maxLength={7} />
          </div>
        </div>
      </div>
      {lowContrast && (
        <div className="warn-box">Hlavní barva je velmi světlá — pro text a čáry ji automaticky ztmavíme, aby zůstala čitelná.</div>
      )}

      <div className="field-group">
        <label className="field-label">Intenzita</label>
        <div className="an-types" role="radiogroup" aria-label="Intenzita brandingu">
          {STYLES.map(s => (
            <button key={s.value} type="button" role="radio" aria-checked={style === s.value}
              className={`an-type${style === s.value ? ' an-type--on' : ''}`} onClick={() => { setStyle(s.value); setCustom(true) }}>
              {s.label}
            </button>
          ))}
        </div>
        <p className="br-hint">{STYLES.find(s => s.value === style)?.hint}</p>
      </div>

      {/* Živý náhled: hlavička, úvod Přehledu, TV */}
      <div className="br-preview" style={preview}>
        <div className="br-pv-label">Hlavička</div>
        <div className="br-pv-hdr">
          <span className="br-pv-crest"><SportIcon size={16} /></span>
          <span className="br-pv-name">{tournament?.name || 'Turnaj'}</span>
          <span className="br-pv-live">Živě</span>
        </div>
        <div className="br-pv-nav"><span className="br-pv-tab br-pv-tab--on">Přehled</span><span className="br-pv-tab">Zápasy</span><span className="br-pv-tab">Tabulka</span></div>

        <div className="br-pv-label">Přehled</div>
        <div className="br-pv-hero">
          <div className="br-pv-hero__name">{tournament?.name || 'Turnaj'}</div>
          <span className="ui-btn ui-btn--primary ui-btn--sm">Tlačítko</span>
          <span style={{ color: 'var(--brand)', fontWeight: 700, background: '#fff', padding: '.15rem .4rem', borderRadius: 4 }}>Odkaz</span>
        </div>

        <div className="br-pv-label">TV tabule</div>
        <div className="br-pv-tv">
          <div className="br-pv-tv__hdr">{tournament?.name || 'Turnaj'}<span>21:30</span></div>
          <div className="br-pv-tv__row"><b style={{ color: 'var(--brand-on-dark)' }}>1</b><span>Tým A</span><b style={{ color: 'var(--brand-on-dark)' }}>12</b></div>
          <div className="br-pv-tv__row"><b>2</b><span>Tým B</span><b>9</b></div>
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

      <div className="sub-title" style={{ marginTop: '1.5rem' }}>Fotka pro grafiky na sítě</div>
      <div className="info-box">
        Fotka z akce nebo hřiště se použije jako pozadí grafik ve stylu Foto (výsledky, tabulky, statistiky, grafika turnaje).
        Nejlépe na šířku, bez důležitých detailů uprostřed — přes střed jde výsledek. Diváci si při sdílení mohou vybrat i vlastní fotku.
      </div>
      <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
        onChange={e => { uploadPhoto(e.target.files?.[0]); e.target.value = '' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
        {tournament?.share_photo_url && (
          <img src={tournament.share_photo_url} alt="Fotka pro grafiky" style={{ width: 192, height: 108, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />
        )}
        <button type="button" className="btn btn-s btn-sm" onClick={() => { if (!photoBusy) photoInput.current?.click() }} style={{ opacity: photoBusy ? 0.6 : 1 }}>
          {photoBusy ? 'Ukládám…' : tournament?.share_photo_url ? 'Změnit fotku' : 'Nahrát fotku'}
        </button>
        {tournament?.share_photo_url && (
          <button type="button" className="btn btn-d btn-sm" onClick={removePhoto} style={{ opacity: photoBusy ? 0.6 : 1 }}>Odebrat</button>
        )}
      </div>
    </div>
  )
}
