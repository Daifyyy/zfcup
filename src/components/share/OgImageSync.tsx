// Náhled odkazu na turnaj (og:image) vytvořený v prohlížeči organizátora.
// Server (edge/) nic nevykresluje — bezplatný Cloudflare má limit 10 ms CPU na požadavek.
// Běží na pozadí, když je organizátor ve svém turnaji: změní-li se název, logo, barvy
// nebo generální partner, náhled se za pár sekund vytvoří znovu a nahraje do Storage.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toCanvas } from 'html-to-image'
import type { Tournament } from '../../hooks/useTournament'
import type { Sponsor } from '../../hooks/useSponsors'
import { OgGraphic, OG_SIZE } from './templates'
import { ogImagePath, ogSignature, ogStorageKey } from '../../lib/og'
import { uploadAsset, ASSETS_BUCKET } from '../../lib/storage'
import { supabase } from '../../lib/supabase'

/** Prodleva po poslední změně (organizátor často upravuje víc polí za sebou). */
const DEBOUNCE_MS = 4000
/** Náhled se odkazuje bez ?v= v aplikaci → kratší cache ve Storage. */
const OG_CACHE_SECONDS = 3600

function readStored(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function writeStored(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch { /* soukromý režim prohlížeče — příště se náhled vytvoří znovu */ }
}

/** Počká na načtení obrázků v uzlu (loga), jinak by v náhledu chyběla. */
async function imagesReady(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll('img'))
  await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise<void>(res => {
    img.addEventListener('load', () => res(), { once: true })
    img.addEventListener('error', () => res(), { once: true })
  })))
}

export default function OgImageSync({ tournament, sponsors }: { tournament: Tournament | null; sponsors: Sponsor[] }) {
  const id = tournament?.id ?? ''
  const isPrivate = tournament?.visibility === 'private'
  const sig = tournament ? ogSignature(tournament, sponsors) : ''
  /** Podpis, pro který se právě vytváří náhled (null = nic neběží). */
  const [job, setJob] = useState<string | null>(null)
  const nodeRef = useRef<HTMLDivElement>(null)

  // Rozhodnout, jestli je potřeba nový náhled (s prodlevou po poslední změně)
  useEffect(() => {
    if (!id || job) return
    const key = ogStorageKey(id)
    if (isPrivate) {
      // Soukromý turnaj nemá mít veřejný náhled — dříve nahraný smazat
      if (readStored(key) !== null) {
        supabase.storage.from(ASSETS_BUCKET).remove([ogImagePath(id)]).then(({ error }) => { if (!error) writeStored(key, null) })
      }
      return
    }
    if (readStored(key) === sig) return
    const t = setTimeout(() => setJob(sig), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [id, sig, isPrivate, job])

  // Vytvořit JPEG ze šablony a nahrát
  useEffect(() => {
    if (!job || !id) return
    let cancelled = false
    const run = async () => {
      try {
        await new Promise(r => setTimeout(r, 60))
        await document.fonts?.ready
        const node = nodeRef.current
        if (!node || cancelled) return
        await imagesReady(node)
        const opts = { width: OG_SIZE.w, height: OG_SIZE.h, pixelRatio: 1, cacheBust: true }
        // Safari první průchod někdy vynechá obrázky → 2×, stejně jako ShareModal
        await toCanvas(node, opts)
        const canvas = await toCanvas(node, opts)
        const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.88))
        if (!blob || cancelled) return
        const res = await uploadAsset(ogImagePath(id), new File([blob], 'og.jpg', { type: 'image/jpeg' }), OG_CACHE_SECONDS)
        if (!cancelled && 'url' in res) writeStored(ogStorageKey(id), job)
      } catch {
        // Na pozadí — při chybě se náhled zkusí znovu při další návštěvě
      } finally {
        if (!cancelled) setJob(null)
      }
    }
    run()
    return () => { cancelled = true }
  }, [job, id])

  // Při přepnutí turnaje rozpracovaný náhled zahodit
  useEffect(() => { setJob(null) }, [id])

  if (!job || !tournament) return null
  return createPortal(
    <div className="shr__render" aria-hidden="true">
      <div ref={nodeRef} style={{ width: OG_SIZE.w, height: OG_SIZE.h }}>
        <OgGraphic tournament={tournament} sponsors={sponsors} />
      </div>
    </div>,
    document.body,
  )
}
