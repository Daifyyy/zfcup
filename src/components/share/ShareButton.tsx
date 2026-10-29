import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Mail, Share2 } from 'lucide-react'
import { copyText, nativeShare, prefersNativeShare, shareTargets, type ShareData, type ShareTarget } from '../../lib/share'

export interface ShareExtra {
  key: string
  label: string
  icon: ReactNode
  onClick: () => void
}

interface Props {
  data: ShareData
  /** Další položky nabídky (např. „Grafika výsledku“) */
  extras?: ShareExtra[]
  /** Vzhled tlačítka */
  className?: string
  label?: string
  iconSize?: number
  title?: string
}

const NETWORK_MARK: Record<ShareTarget['key'], string> = { facebook: 'f', x: 'X', whatsapp: 'W', linkedin: 'in', email: '' }

/**
 * Tlačítko Sdílet. Mobil bez doplňků → rovnou systémová nabídka (Facebook, Instagram, WhatsApp, Kopírovat…).
 * Jinak vlastní nabídka: na mobilu „Sdílet odkaz“ (systémová nabídka), na počítači odkazy sítí; vždy Kopírovat.
 */
export default function ShareButton({ data, extras = [], className = 'ui-btn ui-btn--ghost ui-btn--sm', label, iconSize = 16, title = 'Sdílet' }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [fallbackUrl, setFallbackUrl] = useState('')
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const native = prefersNativeShare()

  async function onButton(e: React.MouseEvent) {
    e.stopPropagation()
    if (native && extras.length === 0) {
      if (await nativeShare(data)) return
    }
    setOpen(o => !o)
  }

  // Pozice nabídky pod tlačítkem (portál → nic ji neořízne), přitažená k okraji obrazovky
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const width = 240
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8))
    setPos({ top: r.bottom + 6, left })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return
      if (e.type === 'mousedown' && (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node))) return
      setOpen(false)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', close)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  async function copy() {
    if (await copyText(data.url)) {
      setCopied(true)
      setTimeout(() => { setCopied(false); setOpen(false) }, 1200)
    } else {
      setFallbackUrl(data.url)
    }
  }

  return (
    <>
      <button ref={btnRef} type="button" className={className} onClick={onButton} title={title} aria-label={title} aria-haspopup="menu" aria-expanded={open}>
        <Share2 size={iconSize} />{label && <span>{label}</span>}
      </button>
      {open && pos && createPortal(
        <div ref={menuRef} className="shm" role="menu" style={{ top: pos.top, left: pos.left }} onClick={e => e.stopPropagation()}>
          {extras.map(x => (
            <button key={x.key} type="button" role="menuitem" className="shm__item" onClick={() => { setOpen(false); x.onClick() }}>
              <span className="shm__icon">{x.icon}</span>{x.label}
            </button>
          ))}
          {extras.length > 0 && <div className="shm__sep" />}
          {native ? (
            <button type="button" role="menuitem" className="shm__item" onClick={async () => { setOpen(false); await nativeShare(data) }}>
              <span className="shm__icon"><Share2 size={15} /></span>Sdílet odkaz…
            </button>
          ) : shareTargets(data).map(t => (
            <a key={t.key} role="menuitem" className="shm__item" href={t.href} target={t.key === 'email' ? undefined : '_blank'} rel="noopener noreferrer" onClick={() => setOpen(false)}>
              <span className={`shm__icon shm__icon--${t.key}`}>{t.key === 'email' ? <Mail size={15} /> : NETWORK_MARK[t.key]}</span>{t.label}
            </a>
          ))}
          <button type="button" role="menuitem" className="shm__item" onClick={copy}>
            <span className="shm__icon">{copied ? <Check size={15} /> : <Copy size={15} />}</span>{copied ? 'Zkopírováno' : 'Kopírovat odkaz'}
          </button>
          {fallbackUrl && (
            <input className="field-input shm__url" readOnly value={fallbackUrl} onFocus={e => e.currentTarget.select()} aria-label="Odkaz" autoFocus />
          )}
          {native && <p className="shm__hint">Instagram, Facebook a další najdete v nabídce „Sdílet odkaz“.</p>}
        </div>,
        document.body,
      )}
    </>
  )
}
