import { useEffect, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { Download, Share2, X } from 'lucide-react'
import { toPng } from 'html-to-image'
import { FORMAT_SIZE, type ShareFormat } from './templates'
import { Segmented } from '../ui/Tabs'

interface Props {
  title: string
  fileName: string
  /** Šablona pro daný formát */
  render: (format: ShareFormat) => ReactElement
  onClose: () => void
  showToast?: (msg: string) => void
}


/** Modal s náhledem sdílecí grafiky, stažením PNG a nativním sdílením (mobil). */
export default function ShareModal({ title, fileName, render, onClose, showToast }: Props) {
  const [format, setFormat] = useState<ShareFormat>('square')
  const [busy, setBusy] = useState(false)
  const nodeRef = useRef<HTMLDivElement>(null)
  const { w, h } = FORMAT_SIZE[format]
  const previewW = format === 'story' ? 300 : 380
  const scale = previewW / w

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function makeBlob(): Promise<Blob | null> {
    const node = nodeRef.current
    if (!node) return null
    // Počkat na fonty a obrázky, aby PNG neobsahovalo náhradní písmo
    await document.fonts?.ready
    const dataUrl = await toPng(node, { width: w, height: h, pixelRatio: 1, cacheBust: true, style: { transform: 'none' } })
    const res = await fetch(dataUrl)
    return res.blob()
  }

  async function download() {
    if (busy) return
    setBusy(true)
    try {
      const blob = await makeBlob()
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileName}-${format === 'story' ? '1080x1920' : '1080x1080'}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch {
      showToast?.('Grafiku se nepodařilo vytvořit')
    } finally {
      setBusy(false)
    }
  }

  async function share() {
    if (busy) return
    setBusy(true)
    try {
      const blob = await makeBlob()
      if (!blob) return
      const file = new File([blob], `${fileName}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title })
      } else {
        showToast?.('Sdílení není v tomto prohlížeči podporováno — použijte Stáhnout')
      }
    } catch {
      /* uživatel sdílení zrušil */
    } finally {
      setBusy(false)
    }
  }

  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator

  return createPortal(
    <div className="shr" onClick={onClose}>
      <div className="shr__panel" onClick={e => e.stopPropagation()} role="dialog" aria-label={title}>
        <header className="shr__head">
          <div>
            <div className="shr__title">Sdílet grafiku</div>
            <div className="shr__sub">{title}</div>
          </div>
          <button type="button" className="shr__close" onClick={onClose} aria-label="Zavřít"><X size={18} /></button>
        </header>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '.9rem' }}>
          <Segmented value={format} onChange={setFormat} items={[
            { value: 'square', label: 'Příspěvek 1:1' },
            { value: 'story', label: 'Story 9:16' },
          ]} />
        </div>

        <div className="shr__preview" style={{ width: previewW, height: h * scale }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: w, height: h }}>
            <div ref={nodeRef}>{render(format)}</div>
          </div>
        </div>

        <div className="shr__actions">
          <button type="button" className="ui-btn ui-btn--primary" onClick={download} style={{ opacity: busy ? 0.6 : 1 }}>
            <Download size={16} />{busy ? 'Připravuji…' : 'Stáhnout PNG'}
          </button>
          {canNativeShare && (
            <button type="button" className="ui-btn ui-btn--secondary" onClick={share} style={{ opacity: busy ? 0.6 : 1 }}>
              <Share2 size={16} />Sdílet
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
