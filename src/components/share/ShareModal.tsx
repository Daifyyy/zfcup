import { useEffect, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { Check, Download, ImageDown, Link2, Share2, X } from 'lucide-react'
import { toBlob } from 'html-to-image'
import { FORMAT_SIZE, type ShareFormat } from './templates'
import { Segmented } from '../ui/Tabs'
import { useBackClose } from '../../lib/useBackClose'
import { copyText } from '../../lib/share'

interface Props {
  title: string
  fileName: string
  /** Šablona pro daný formát */
  render: (format: ShareFormat) => ReactElement
  onClose: () => void
  showToast?: (msg: string) => void
  /** Odkaz pro „Kopírovat odkaz“ (doplňková volba) */
  url?: string
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
export default function ShareModal({ title, fileName, render, onClose, showToast, url }: Props) {
  useBackClose(true, onClose, 'share')
  const [format, setFormat] = useState<ShareFormat>('square')
  const [blobs, setBlobs] = useState<Partial<Record<ShareFormat, Blob>>>({})
  const [previews, setPreviews] = useState<Partial<Record<ShareFormat, string>>>({})
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
    if (blobs[format]) return
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
        setBlobs(b => ({ ...b, [format]: blob }))
        setPreviews(p => ({ ...p, [format]: URL.createObjectURL(blob) }))
      } catch {
        if (!cancelled) setError(true)
      }
    }
    run()
    return () => { cancelled = true }
  }, [format, blobs, w, h])

  useEffect(() => () => { Object.values(previews).forEach(u => u && URL.revokeObjectURL(u)) }, [previews])

  const blob = blobs[format]
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
    if (!url) return
    if (await copyText(url)) { flash('link'); showToast?.('Odkaz zkopírován') }
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
        </div>

        <div className={`shr__preview shr__preview--${format}`}>
          {previews[format]
            ? <img src={previews[format]} alt={`Náhled: ${title}`} />
            : <div className="shr__loading">{error ? 'Grafiku se nepodařilo vytvořit' : <><div className="spinner" />Připravuji obrázek…</>}</div>}
        </div>

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
          {url && (
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
        <div ref={nodeRef} style={{ width: w, height: h }}>{render(format)}</div>
      </div>
    </div>,
    document.body,
  )
}
