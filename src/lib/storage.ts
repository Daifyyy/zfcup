import { supabase } from './supabase'

/** Bucket pro všechna loga a fotky. */
export const ASSETS_BUCKET = 'team-logos'

/**
 * Cesta souboru turnaje ve Storage: `tournaments/{turnajId}/{druh}/{id}.{ext}`.
 * Prefix turnaje umožňuje RLS ověřit, že nahrává jeho vlastník (migrace 11, can_edit_storage_path).
 */
export function tournamentAssetPath(tournamentId: string, kind: 'teams' | 'sponsors' | 'players' | 'announcements', id: string, ext: 'png' | 'jpg' | 'webp'): string {
  return `tournaments/${tournamentId}/${kind}/${id}.${ext}`
}

/** Logo klubu z knihovny: `clubs/{clubId}/logo.{ext}` (RLS: vlastník klubu, migrace 13). */
export function clubAssetPath(clubId: string, ext: 'png' | 'jpg'): string {
  return `clubs/${clubId}/logo.${ext}`
}

/** Z veřejné URL souboru (…/team-logos/{cesta}?v=…) vrátí cestu v bucketu, jinak null. */
export function storagePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const marker = `/${ASSETS_BUCKET}/`
  const i = url.indexOf(marker)
  if (i < 0) return null
  return decodeURIComponent(url.slice(i + marker.length).split('?')[0]) || null
}

/** Nahraje soubor a vrátí veřejnou URL s cache-bustem, nebo chybovou zprávu. */
export async function uploadAsset(path: string, file: File): Promise<{ url: string } | { error: string }> {
  const { error } = await supabase.storage.from(ASSETS_BUCKET).upload(path, file, { upsert: true, contentType: file.type })
  if (error) return { error: error.message }
  const { data } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(path)
  return { url: `${data.publicUrl}?v=${Date.now()}` }
}

/** Smaže soubor podle jeho veřejné URL (ignoruje cizí URL). Chyba mazání souboru neblokuje další kroky. */
export async function removeAssetByUrl(url: string | null | undefined): Promise<void> {
  const path = storagePathFromUrl(url)
  if (path) await supabase.storage.from(ASSETS_BUCKET).remove([path])
}
