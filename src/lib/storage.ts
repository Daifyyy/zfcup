import { supabase } from './supabase'

/** Bucket pro všechna loga a fotky. */
export const ASSETS_BUCKET = 'team-logos'

/**
 * Cesta souboru turnaje ve Storage: `tournaments/{turnajId}/{druh}/{id}.{ext}`.
 * Prefix turnaje umožňuje RLS ověřit, že nahrává jeho vlastník (migrace 11, can_edit_storage_path).
 */
export function tournamentAssetPath(tournamentId: string, kind: 'teams' | 'sponsors' | 'players' | 'announcements' | 'share', id: string, ext: 'png' | 'jpg' | 'webp'): string {
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

/** Největší rozměr obrázku podle druhu (loga stačí 512 px, fotka hráče 256 px, oznámení 1600 px, pozadí grafik 1920 px). */
function maxSideFor(path: string): number {
  if (path.includes('/players/')) return 256
  if (path.includes('/share/')) return 1920
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

/** Nejvyšší velikost zdrojové fotky, kterou vůbec zkusíme zpracovat (dekódování obří fotky zahltí telefon). */
export const PHOTO_MAX_INPUT_BYTES = 25 * 1024 * 1024
/** Cílová velikost fotky pro grafiky (pod limitem bucketu 1 MB z auditu). */
export const PHOTO_MAX_BYTES = 950 * 1024

/**
 * Fotka pro pozadí grafik: zmenší na `maxSide` a převede na JPEG; když je pořád velká,
 * snižuje kvalitu. Nikdy nevrací původní soubor — při neúspěchu `{ error }` s hláškou pro uživatele.
 */
export async function photoToJpeg(file: File, maxSide = 1920): Promise<{ file: File } | { error: string }> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return { error: 'Fotka musí být JPG, PNG nebo WebP' }
  if (file.size > PHOTO_MAX_INPUT_BYTES) return { error: 'Fotka je příliš velká (max. 25 MB)' }
  if (typeof createImageBitmap !== 'function') return { error: 'Prohlížeč neumí fotku zpracovat' }
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bmp.width * scale))
    canvas.height = Math.max(1, Math.round(bmp.height * scale))
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#000' // průhledné PNG → černé pozadí místo náhodného
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
    for (const q of [0.85, 0.75, 0.65, 0.55]) {
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', q))
      if (blob && blob.size <= PHOTO_MAX_BYTES) {
        return { file: new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) }
      }
    }
    return { error: 'Fotku se nepodařilo zmenšit pod 1 MB — zkuste jinou' }
  } catch {
    return { error: 'Fotku se nepodařilo načíst' }
  }
}

/**
 * Nahraje soubor a vrátí veřejnou URL s cache-bustem, nebo chybovou zprávu.
 * `cacheSeconds`: výchozí rok (adresa nese ?v=…); kratší jen pro soubory, na které
 * se odkazuje bez ?v= (náhled odkazu og.jpg).
 */
export async function uploadAsset(path: string, file: File, cacheSeconds = 31536000): Promise<{ url: string } | { error: string }> {
  const optimized = await optimizeImage(file, maxSideFor(path))
  // URL nese ?v=… → soubor se smí cachovat dlouho (nová verze = nová adresa)
  const { error } = await supabase.storage.from(ASSETS_BUCKET).upload(path, optimized, { upsert: true, contentType: optimized.type, cacheControl: String(cacheSeconds) })
  if (error) return { error: error.message }
  const { data } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(path)
  return { url: `${data.publicUrl}?v=${Date.now()}` }
}

/** Smaže soubor podle jeho veřejné URL (ignoruje cizí URL). Chyba mazání souboru neblokuje další kroky. */
export async function removeAssetByUrl(url: string | null | undefined): Promise<void> {
  const path = storagePathFromUrl(url)
  if (path) await supabase.storage.from(ASSETS_BUCKET).remove([path])
}
