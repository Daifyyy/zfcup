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

/** Největší rozměr obrázku podle druhu (loga stačí 512 px, fotka hráče 256 px, oznámení 1600 px). */
function maxSideFor(path: string): number {
  if (path.includes('/players/')) return 256
  if (path.includes('/announcements/')) return 1600
  return 512
}

/**
 * Zmenší obrázek v prohlížeči před nahráním (stejný formát, PNG zachová průhlednost).
 * Šetří úložiště i přenosy — loga se stahují každému divákovi. Když by výsledek nebyl menší, vrátí originál.
 */
export async function optimizeImage(file: File, maxSide: number): Promise<File> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type) || typeof createImageBitmap !== 'function') return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * scale))
    const h = Math.max(1, Math.round(bmp.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
    bmp.close()
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, file.type, 0.86))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name, { type: file.type })
  } catch {
    return file
  }
}

/** Nahraje soubor a vrátí veřejnou URL s cache-bustem, nebo chybovou zprávu. */
export async function uploadAsset(path: string, file: File): Promise<{ url: string } | { error: string }> {
  const optimized = await optimizeImage(file, maxSideFor(path))
  // URL nese ?v=… → soubor se smí cachovat dlouho (nová verze = nová adresa)
  const { error } = await supabase.storage.from(ASSETS_BUCKET).upload(path, optimized, { upsert: true, contentType: optimized.type, cacheControl: '31536000' })
  if (error) return { error: error.message }
  const { data } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(path)
  return { url: `${data.publicUrl}?v=${Date.now()}` }
}

/** Smaže soubor podle jeho veřejné URL (ignoruje cizí URL). Chyba mazání souboru neblokuje další kroky. */
export async function removeAssetByUrl(url: string | null | undefined): Promise<void> {
  const path = storagePathFromUrl(url)
  if (path) await supabase.storage.from(ASSETS_BUCKET).remove([path])
}
