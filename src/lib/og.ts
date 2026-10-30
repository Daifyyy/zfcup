// Náhled odkazu (Open Graph) — sdílené mezi aplikací a serverem (edge/).
// Bez importů z prohlížeče ani Supabase klienta, aby šlo použít i ve Workeru/middlewaru.

/** Bucket a cesta náhledu turnaje ve Storage (RLS: prefix tournaments/{id}/, migrace 11). */
export const OG_BUCKET = 'team-logos'
export function ogImagePath(tournamentId: string): string {
  return `tournaments/${tournamentId}/share/og.jpg`
}

/** Veřejná adresa náhledu (bez cache-bustu). */
export function ogImagePublicUrl(supabaseUrl: string, tournamentId: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${OG_BUCKET}/${ogImagePath(tournamentId)}`
}

/** Zvýšit při změně šablony OgGraphic → organizátorům se náhled vytvoří znovu. */
export const OG_TEMPLATE_VERSION = 1

/** Klíč v localStorage s podpisem posledního nahraného náhledu (uvedeno na stránce Cookies). */
export function ogStorageKey(tournamentId: string): string {
  return `turnajnik_og_${tournamentId}`
}

interface OgTournament {
  id: string
  name?: string | null
  subtitle?: string | null
  date?: string | null
  venue?: string | null
  logo_url?: string | null
  sport?: string | null
  brand_primary?: string | null
  brand_secondary?: string | null
  brand_style?: string | null
}
interface OgSponsor { id: string; logo_url?: string | null; tier?: string | null; position?: number }

/**
 * Podpis všeho, co je na náhledu vidět. Stejný podpis = náhled je aktuální, nic se nenahrává.
 * Partneři: jen generální (první s tier title podle pozice — stejně jako getTitlePartner).
 */
export function ogSignature(t: OgTournament, sponsors: OgSponsor[]): string {
  const title = [...sponsors]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .find(s => s.tier === 'title')
  return JSON.stringify([
    OG_TEMPLATE_VERSION, t.id, t.name ?? '', t.subtitle ?? '', t.date ?? '', t.venue ?? '', t.logo_url ?? '',
    t.sport ?? '', t.brand_primary ?? '', t.brand_secondary ?? '', t.brand_style ?? '', title?.logo_url ?? '',
  ])
}
