// Formátování dat zápasů (YYYY-MM-DD) pro české UI.

const WEEKDAYS = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so']

function parts(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** „25. 10. 2026“ */
export function formatDate(iso: string | null | undefined): string {
  const p = iso ? parts(iso) : null
  return p ? `${p[2]}. ${p[1]}. ${p[0]}` : ''
}

/** „25. 10.“ */
export function formatDateShort(iso: string | null | undefined): string {
  const p = iso ? parts(iso) : null
  return p ? `${p[2]}. ${p[1]}.` : ''
}

/** „so 25. 10.“ */
export function formatDateWeekday(iso: string | null | undefined): string {
  const p = iso ? parts(iso) : null
  if (!p) return ''
  const wd = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()
  return `${WEEKDAYS[wd]} ${p[2]}. ${p[1]}.`
}

/** Dnešní datum v lokálním čase jako YYYY-MM-DD */
export function todayISO(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
