// Značka platformy — jediné místo, kde se mění název produktu.
// Název ještě není finální, proto ho nikde jinde nepiš natvrdo.
export const BRAND = {
  name: 'Turnajník',
  tagline: 'Profesionální platforma pro sportovní turnaje',
  supportEmail: 'denis.honzejk@gmail.com',
} as const

/** mailto: odkaz „Chci turnaj“ (null, když není vyplněný supportEmail). Ve Fázi 9 nahradí registrace. */
export function contactHref(subject = `Chci turnaj na platformě ${BRAND.name}`): string | null {
  return BRAND.supportEmail ? `mailto:${BRAND.supportEmail}?subject=${encodeURIComponent(subject)}` : null
}
