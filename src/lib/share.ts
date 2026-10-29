// Sdílení odkazů: na mobilu systémová nabídka (Kopírovat, Facebook, Instagram,
// WhatsApp, Zprávy…), na počítači vlastní nabídka se sdílecími odkazy sítí.

export interface ShareData {
  title: string
  /** Krátký doprovodný text (X, WhatsApp, e-mail) */
  text?: string
  url: string
}

export interface ShareTarget {
  key: 'facebook' | 'x' | 'whatsapp' | 'linkedin' | 'email'
  label: string
  href: string
}

/** Systémovou nabídku používáme jen na dotykových zařízeních — na počítači je nabídka sítí přehlednější. */
export function prefersNativeShare(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true
}

/** Otevře systémovou nabídku sdílení. Vrací false, když ji prohlížeč neumí (zrušení uživatelem = true). */
export async function nativeShare(d: ShareData): Promise<boolean> {
  if (typeof navigator.share !== 'function') return false
  try {
    await navigator.share({ title: d.title, text: d.text, url: d.url })
  } catch (e) {
    // AbortError = uživatel nabídku zavřel; jiná chyba → nabídnout náhradní menu
    if (!(e instanceof DOMException && e.name === 'AbortError')) return false
  }
  return true
}

export function shareTargets(d: ShareData): ShareTarget[] {
  const u = encodeURIComponent(d.url)
  const text = d.text ? `${d.title} — ${d.text}` : d.title
  const t = encodeURIComponent(text)
  return [
    { key: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { key: 'x', label: 'X (Twitter)', href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
    { key: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${text} ${d.url}`)}` },
    { key: 'linkedin', label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { key: 'email', label: 'E-mail', href: `mailto:?subject=${encodeURIComponent(d.title)}&body=${encodeURIComponent(`${text}\n${d.url}`)}` },
  ]
}

/** Zkopíruje text do schránky; false = bez přístupu (např. http mimo localhost). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Odkazy do veřejné části turnaje */
export function tournamentUrl(tournamentId: string): string {
  return `${window.location.origin}/${tournamentId}`
}
export function matchUrl(tournamentId: string, matchId: string): string {
  return `${tournamentUrl(tournamentId)}?zapas=${matchId}`
}
export function teamUrl(tournamentId: string, teamId: string): string {
  return `${tournamentUrl(tournamentId)}?tym=${teamId}`
}

interface CodeAware { id: string; visibility?: 'public' | 'private'; access_code?: string | null }

/** Adresa s přístupovým kódem (jen soukromý turnaj se známým kódem), jinak null. */
export function withAccessCode(url: string, t: CodeAware | null | undefined): string | null {
  if (!t || t.visibility !== 'private' || !t.access_code) return null
  return `${url}${url.includes('?') ? '&' : '?'}kod=${encodeURIComponent(t.access_code)}`
}

/**
 * Adresa pro QR kód na TV tabuli / v TV režimu / na Přehledu: soukromý turnaj s kódem
 * (kód vidí jen lidé na místě nebo ti, kdo turnaj už mají otevřený), veřejný bez kódu.
 */
export function tournamentQrUrl(t: CodeAware | null | undefined): string | undefined {
  if (!t?.id) return undefined
  const base = tournamentUrl(t.id)
  return withAccessCode(base, t) ?? base
}
