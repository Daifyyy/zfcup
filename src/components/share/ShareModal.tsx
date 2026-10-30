import { useEffect, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { Check, Download, ImageDown, ImagePlus, Link2, Share2, X } from 'lucide-react'
import { toBlob } from 'html-to-image'
import { FORMAT_SIZE, SHARE_STYLES, type ShareFormat, type ShareStyle } from './templates'
import { Segmented } from '../ui/Tabs'
import { useBackClose } from '../../lib/useBackClose'
import { copyText } from '../../lib/share'
import { photoToJpeg } from '../../lib/storage'

interface Props {
  title: string
  fileName: string
  /** Šablona pro daný formát a styl (withCode = vložit přístupový kód do QR) */
  render: (format: ShareFormat, withCode: boolean, style: ShareStyle, photo: string | null) => ReactElement
  /** Výchozí vizuální styl (podle vzhledu turnaje) */
  defaultStyle?: ShareStyle
  /** Fotka turnaje pro styl Foto (nastavuje organizátor) */
  defaultPhoto?: string | null
  onClose: () => void
  showToast?: (msg: string) => void
  /** Odkaz pro „Kopírovat odkaz“ (doplňková volba) */
  url?: string
  /** Soukromý turnaj: odkaz s přístupovým kódem (nabídne se jako volba, výchozí vypnuto) */
  codeUrl?: string | null
}

/** Umí prohlížeč sdílet soubor (mobil → Instagram, Facebook, WhatsApp…)? */
function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false
  try {
    return navigator.canShare({ files: [new File([new Blob(['x'], { type: 'image/png' })], 'x.png', { type: 'image/png' })] })
  } catch {
    return false
  }
}

/**
 * Sdílení hotového obrázku. Grafika se vygeneruje hned (pro každý formát jednou),
 * náhled ukazuje přesně výsledný obrázek. Mobil: „Sdílet obrázek“ → systémová nabídka;
 * počítač: Stáhnout / Kopírovat obrázek (vložit do FB, WhatsApp Web…) / Kopírovat odkaz.
 */
export default function ShareModal({ title, fileName, render, onClose, showToast, url, codeUrl, defaultStyle = 'dark', defaultPhoto = null }: Props) {
  useBackClose(true, onClose, 'share')
  const [format, setFormat] = useState<ShareFormat>('square')
  const [withCode, setWithCode] = useState(false)
  const [style, setStyle] = useState<ShareStyle>(defaultStyle)
  // Vlastní fotka zůstává jen v zařízení (data URL), nikam se nenahrává
  const [customPhoto, setCustomPhoto] = useState<string | null>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const photo = customPhoto ?? defaultPhoto ?? null
  // klíč mezipaměti náhledů: u fotky stačí délka + konec (celá data URL by byla zbytečně dlouhá)
  const photoKey = photo ? `${photo.length}:${photo.slice(-24)}` : '-'
  const key = `${format}|${style}|${withCode ? 1 : 0}|${style === 'photo' ? photoKey : ''}`
  const [blobs, setBlobs] = useState<Record<string, Blob>>({})
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [error, setError] = useState(false)
  const [done, setDone] = useState<'image' | 'link' | null>(null)
  const nodeRef = useRef<HTMLDivElement>(null)
  const { w, h } = FORMAT_SIZE[format]
  const shareFiles = canShareFiles()
  const canCopyImage = typeof window !== 'undefined' && 'ClipboardItem' in window && !!navigator.clipboard?.write
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Vygenerovat obrázek pro aktuální formát (jednou; Safari první render někdy vynechá obrázky → 2×)
  useEffect(() => {
    if (blobs[key]) return
    let cancelled = false
    setError(false)
    const run = async () => {
      // počkat, až se šablona vykreslí a načtou fonty a loga
      await new Promise(r => setTimeout(r, 60))
      await document.fonts?.ready
      const node = nodeRef.current
      if (!node || cancelled) return
      const opts = { width: w, height: h, pixelRatio: 1, cacheBust: true }
      try {
        await toBlob(node, opts)
        const blob = await toBlob(node, opts)
        if (cancelled || !blob) return
        setBlobs(b => ({ ...b, [key]: blob }))
        setPreviews(p => ({ ...p, [key]: URL.createObjectURL(blob) }))
      } catch {
        if (!cancelled) setError(true)
      }
    }
    run()
    return () => { cancelled = true }
  }, [key, blobs, w, h])

  // Náhledy uvolnit až při zavření okna — dřív se uvolňovaly při každém novém náhledu
  // a po návratu na už vygenerovaný formát/styl zůstal prázdný obrázek.
  const previewsRef = useRef(previews)
  previewsRef.current = previews
  useEffect(() => () => { Object.values(previewsRef.current).forEach(u => u && URL.revokeObjectURL(u)) }, [])
  async function pickPhoto(file: File | undefined) {
    if (!file) return
    // stejné omezení jako u fotky turnaje: JPEG do 1920 px a pod 1 MB, jinak odmítnout
    const jpeg = await photoToJpeg(file)
    if ('error' in jpeg) { showToast?.(jpeg.error); return }
    const small = jpeg.file
    // data URL, ne blob: — html-to-image přidává k adresám obrázků ?cache-bust a blob: adresu tím rozbije
    const dataUrl = await new Promise<string | null>(res => {
      const r = new FileReader()
      r.onload = () => res(typeof r.result === 'string' ? r.result : null)
      r.onerror = () => res(null)
      r.readAsDataURL(small)
    })
    if (dataUrl) setCustomPhoto(dataUrl)
    else showToast?.('Fotku se nepodařilo načíst')
  }

  const blob = blobs[key]
  const linkToCopy = withCode && codeUrl ? codeUrl : url
  const file = blob ? new File([blob], `${fileName}-${format === 'story' ? '1080x1920' : '1080x1080'}.png`, { type: 'image/png' }) : null

  function flash(kind: 'image' | 'link') {
    setDone(kind)
    setTimeout(() => setDone(null), 1600)
  }

  async function shareImage() {
    if (!file) return
    try {
      await navigator.share({ files: [file], title })
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) download()
    }
  }

  function download() {
    if (!file) return
    const href = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = href
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(href), 2000)
  }

  async function copyImage() {
    if (!blob) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      flash('image')
      showToast?.('Obrázek zkopírován — vložte ho do příspěvku (Ctrl+V)')
    } catch {
      showToast?.('Kopírování obrázku prohlížeč nedovolil — použijte Stáhnout')
    }
  }

  async function copyLink() {
    if (!linkToCopy) return
    if (await copyText(linkToCopy)) { flash('link'); showToast?.('Odkaz zkopírován') }
    else showToast?.('Odkaz se nepodařilo zkopírovat')
  }

  const ready = !!blob
  const busy = { opacity: ready ? 1 : 0.5 }

  return createPortal(
    <div className="shr" onClick={onClose}>
      <div className="shr__panel" onClick={e => e.stopPropagation()} role="dialog" aria-label={title}>
        <header className="shr__head">
          <div style={{ minWidth: 0 }}>
            <div className="shr__title">Sdílet</div>
            <div className="shr__sub">{title}</div>
          </div>
          <button type="button" className="shr__close" onClick={onClose} aria-label="Zavřít"><X size={18} /></button>
        </header>

        <div className="shr__formats">
          <Segmented value={format} onChange={setFormat} items={[
            { value: 'square', label: 'Příspěvek 1:1' },
            { value: 'story', label: 'Story 9:16' },
          ]} />
          <Segmented value={style} onChange={setStyle} items={SHARE_STYLES} />
        </div>

        {style === 'photo' && (
          <div className="shr__photo">
            <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
              onChange={e => { pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
            <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={() => photoInput.current?.click()}>
              <ImagePlus size={15} />{customPhoto ? 'Jiná fotka' : 'Vybrat vlastní fotku'}
            </button>
            {customPhoto && defaultPhoto && (
              <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setCustomPhoto(null)}>Fotka turnaje</button>
            )}
            <span className="shr__photo-hint">{photo ? 'Fotka se nikam nenahrává, použije se jen pro tento obrázek.' : 'Vyberte fotku z akce — zůstane jen ve vašem zařízení.'}</span>
          </div>
        )}

        <div className={`shr__preview shr__preview--${format}`}>
          {previews[key]
            ? <img src={previews[key]} alt={`Náhled: ${title}`} />
            : <div className="shr__loading">{error ? 'Grafiku se nepodařilo vytvořit' : <><div className="spinner" />Připravuji obrázek…</>}</div>}
        </div>

        {codeUrl && (
          <label className="shr__code">
            <input type="checkbox" checked={withCode} onChange={e => setWithCode(e.target.checked)} />
            <span>
              <b>Přidat přístupový kód</b> — soukromý turnaj pak otevře každý, kdo uvidí obrázek nebo odkaz.
              {withCode && <em> Nesdílejte veřejně (Instagram, veřejné skupiny).</em>}
            </span>
          </label>
        )}

        <div className="shr__actions">
          {shareFiles ? (
            <>
              <button type="button" className="ui-btn ui-btn--primary shr__main" onClick={shareImage} style={busy}>
                <Share2 size={17} />Sdílet obrázek
              </button>
              <button type="button" className="ui-btn ui-btn--secondary" onClick={download} style={busy}><Download size={16} />Stáhnout</button>
              {canCopyImage && !coarse && (
                <button type="button" className="ui-btn ui-btn--secondary" onClick={copyImage} style={busy}>
                  {done === 'image' ? <Check size={16} /> : <ImageDown size={16} />}Kopírovat obrázek
                </button>
              )}
            </>
          ) : (
            <>
              <button type="button" className="ui-btn ui-btn--primary shr__main" onClick={download} style={busy}>
                <Download size={17} />Stáhnout obrázek
              </button>
              {canCopyImage && (
                <button type="button" className="ui-btn ui-btn--secondary" onClick={copyImage} style={busy}>
                  {done === 'image' ? <Check size={16} /> : <ImageDown size={16} />}Kopírovat obrázek
                </button>
              )}
            </>
          )}
          {linkToCopy && (
            <button type="button" className="ui-btn ui-btn--ghost" onClick={copyLink}>
              {done === 'link' ? <Check size={16} /> : <Link2 size={16} />}Kopírovat odkaz
            </button>
          )}
        </div>
        <p className="shr__hint">
          {shareFiles && coarse
            ? 'Sdílet obrázek otevře nabídku telefonu — Instagram, Facebook, WhatsApp, Zprávy…'
            : 'Na počítači sítě nedovolují vložit obrázek přímo — stáhněte ho nebo zkopírujte a vložte do příspěvku.'}
        </p>
      </div>

      {/* Šablona v plné velikosti mimo obrazovku — z ní se dělá PNG */}
      <div className="shr__render" aria-hidden="true">
        <div ref={nodeRef} style={{ width: w, height: h }}>{render(format, withCode, style, style === 'photo' ? photo : null)}</div>
      </div>
    </div>,
    document.body,
  )
}
