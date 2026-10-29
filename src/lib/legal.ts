// Právní údaje platformy — JEDINÉ místo, kde se vyplňuje provozovatel.
// Prázdná pole se na právních stránkách zobrazí jako zvýrazněné „[doplnit: …]“.
// Před vypnutím maintenance režimu musí být všechna povinná pole vyplněná.

export const OPERATOR = {
  /** Jméno a příjmení (fyzická osoba) nebo název firmy */
  name: '',
  /** IČO */
  ico: '',
  /** DIČ — jen pokud jste plátce DPH, jinak nechat prázdné */
  dic: '',
  /** Adresa sídla / místa podnikání, např. „Ulice 1, 110 00 Praha 1“ */
  address: '',
  /** Kontaktní e-mail (dotazy, žádosti podle GDPR) */
  email: '',
  /** Telefon — nepovinné */
  phone: '',
  /** Zápis v rejstříku, např. „Fyzická osoba podnikající podle živnostenského zákona, zapsaná v živnostenském rejstříku“ */
  registry: '',
}

/** Datum, od kterého platí aktuální znění dokumentů (RRRR-MM-DD). Při změně textů posunout. */
export const LEGAL_EFFECTIVE_DATE = '2026-10-29'

/** Povinná pole provozovatele, která zatím chybí (pro upozornění na stránkách). */
export function missingOperatorFields(): string[] {
  const labels: [keyof typeof OPERATOR, string][] = [
    ['name', 'jméno / název'], ['ico', 'IČO'], ['address', 'adresa'], ['email', 'e-mail'], ['registry', 'zápis v rejstříku'],
  ]
  return labels.filter(([k]) => !OPERATOR[k].trim()).map(([, l]) => l)
}

/** Zpracovatelé (podzpracovatelé), kteří s daty pracují. */
export const SUBPROCESSORS = [
  { name: 'Supabase, Inc.', role: 'databáze, přihlašování, úložiště souborů, odesílání systémových e-mailů', country: 'USA (data uložena v datovém centru dle nastavení projektu)' },
  { name: 'Vercel, Inc.', role: 'hosting webové aplikace a doručování obsahu', country: 'USA' },
  { name: 'Google Ireland Ltd. (YouTube)', role: 'přehrání videa vloženého organizátorem do oznámení (režim bez cookies youtube-nocookie.com)', country: 'Irsko / USA' },
] as const

export type LegalDoc = 'podminky' | 'ochrana-osobnich-udaju' | 'cookies' | 'provozovatel'

export const LEGAL_DOCS: { id: LegalDoc; title: string; short: string }[] = [
  { id: 'podminky', title: 'Podmínky používání', short: 'Podmínky' },
  { id: 'ochrana-osobnich-udaju', title: 'Zásady ochrany osobních údajů', short: 'Ochrana osobních údajů' },
  { id: 'cookies', title: 'Informace o cookies', short: 'Cookies' },
  { id: 'provozovatel', title: 'Provozovatel', short: 'Provozovatel' },
]

export function legalPath(doc: LegalDoc): string {
  return `/pravni/${doc}`
}

/** /pravni/{doc} → doc; jinak '' */
export function detectLegalDocFromUrl(pathname: string = window.location.pathname): LegalDoc | '' {
  const seg = pathname.split('/').filter(Boolean)
  if (seg[0] !== 'pravni') return ''
  const doc = LEGAL_DOCS.find(d => d.id === seg[1])
  return doc ? doc.id : 'podminky'
}
