// Úrovně partnerů (sponsors.tier) — viz db-backup/08_partners_branding_media.sql.
// Bez migrace 08 sloupec `tier` chybí → všichni partneři se berou jako 'partner'.
import type { Sponsor } from '../hooks/useSponsors'

export type PartnerTier = 'title' | 'main' | 'partner' | 'supplier' | 'media'

export const PARTNER_TIERS: { id: PartnerTier; label: string; plural: string; logoHeight: number }[] = [
  { id: 'title',    label: 'Generální partner', plural: 'Generální partner',   logoHeight: 96 },
  { id: 'main',     label: 'Hlavní partner',    plural: 'Hlavní partneři',     logoHeight: 72 },
  { id: 'partner',  label: 'Partner',           plural: 'Partneři',            logoHeight: 52 },
  { id: 'supplier', label: 'Dodavatel',         plural: 'Dodavatelé',          logoHeight: 44 },
  { id: 'media',    label: 'Mediální partner',  plural: 'Mediální partneři',   logoHeight: 44 },
]

const ORDER: Record<PartnerTier, number> = { title: 0, main: 1, partner: 2, supplier: 3, media: 4 }

export function tierOf(s: Sponsor): PartnerTier {
  const t = s.tier
  return t && t in ORDER ? t : 'partner'
}

export function tierLabel(t: PartnerTier): string {
  return PARTNER_TIERS.find(x => x.id === t)?.label ?? 'Partner'
}

/** Seřazení: úroveň → pořadí v adminu. */
export function sortByTier(sponsors: Sponsor[]): Sponsor[] {
  return [...sponsors].sort((a, b) => ORDER[tierOf(a)] - ORDER[tierOf(b)] || a.position - b.position)
}

/** Generální partner („presented by“) = první partner s úrovní title. */
export function getTitlePartner(sponsors: Sponsor[]): Sponsor | null {
  return sortByTier(sponsors).find(s => tierOf(s) === 'title') ?? null
}

export function groupByTier(sponsors: Sponsor[]): { tier: (typeof PARTNER_TIERS)[number]; items: Sponsor[] }[] {
  const sorted = sortByTier(sponsors)
  return PARTNER_TIERS
    .map(tier => ({ tier, items: sorted.filter(s => tierOf(s) === tier.id) }))
    .filter(g => g.items.length > 0)
}

/** Chybí sloupec po nespuštěné migraci? (PostgREST: PGRST204 / „column … does not exist“) */
export function isMissingColumnError(err: { message?: string; code?: string } | null | undefined, column: string): boolean {
  if (!err) return false
  const msg = err.message ?? ''
  return err.code === 'PGRST204' || err.code === '42703' || (msg.includes(column) && /column|schema cache/i.test(msg))
}
