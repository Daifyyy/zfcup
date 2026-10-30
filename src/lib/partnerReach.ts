// Měřený dosah partnera (modul `partner_reach`, migrace 24).
// QR akce: krátká adresa /r/{kód}?s={zdroj} → server (edge/core.ts reachRedirect) započte sken
// a přesměruje na cíl partnera. Statistiky jsou jen součty po hodinách (žádné údaje o lidech).
import { supabase } from './supabase'

export type ReachSource = 'tv' | 'social' | 'print' | 'web'
export const REACH_SOURCE_LABEL: Record<string, string> = { tv: 'TV obrazovka', social: 'Grafiky na sítích', print: 'Tisk', web: 'Web turnaje', other: 'Ostatní' }

export interface PartnerLink {
  id: string
  tournament_id: string
  sponsor_id: string | null
  code: string
  target_url: string
  cta: string | null
}

/** Krátká adresa QR akce (vždy na doménu, kde aplikace právě běží). */
export function reachUrl(code: string, source: ReachSource, origin = window.location.origin): string {
  return `${origin}/r/${code}?s=${source}`
}

/** Náhodný kód 8 znaků (a-z0-9). */
export function newReachCode(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789' // bez 0/o/1/l (čitelnost)
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('')
}

/** Normalizace cílové adresy od pořadatele: doplní https://, jinak null (neplatná). */
export function normalizeTarget(input: string): string | null {
  const t = input.trim()
  if (!t) return null
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`
  try {
    const u = new URL(withScheme)
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null
    return u.toString()
  } catch {
    return null
  }
}

// ── Sledování (úsporně: součty, jeden zápis na návštěvu / spot / 5 minut TV) ──

/** Návštěva webu turnaje — jednou za relaci prohlížeče a turnaj. */
export function trackVisitOnce(tournamentId: string) {
  const key = `turnajnik_visit_${tournamentId}`
  try {
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch { /* bez úložiště: počítat i tak, jednou za načtení */ }
  void supabase.rpc('track_reach', { p_tournament: tournamentId, p_kind: 'visit' })
}

export function trackTvSpot(tournamentId: string, sponsorId: string) {
  void supabase.rpc('track_reach', { p_tournament: tournamentId, p_kind: 'tv_spot', p_sponsor: sponsorId })
}

export function trackTvMinutes(tournamentId: string, minutes: number) {
  void supabase.rpc('track_reach', { p_tournament: tournamentId, p_kind: 'tv_minutes', p_amount: minutes })
}

// ── Report ──

export interface StatRow { sponsor_id: string | null; kind: 'scan' | 'tv_spot' | 'tv_minutes' | 'visit'; source: string; hour: string; amount: number }

export interface PartnerReach {
  scans: number
  scansBySource: { source: string; count: number }[]
  /** Skeny po hodinách (pro graf), seřazeno */
  scansByHour: { hour: string; count: number }[]
  tvSpots: number
}

export interface ReachReport {
  /** Období měření (první a poslední hodina s daty) */
  from: string | null
  to: string | null
  visits: number
  tvMinutes: number
  partners: Map<string, PartnerReach>
}

export function buildReport(rows: StatRow[]): ReachReport {
  const partners = new Map<string, PartnerReach>()
  const of = (id: string) => {
    let p = partners.get(id)
    if (!p) { p = { scans: 0, scansBySource: [], scansByHour: [], tvSpots: 0 }; partners.set(id, p) }
    return p
  }
  let visits = 0, tvMinutes = 0
  let from: string | null = null, to: string | null = null
  for (const r of rows) {
    if (!from || r.hour < from) from = r.hour
    if (!to || r.hour > to) to = r.hour
    if (r.kind === 'visit') visits += r.amount
    else if (r.kind === 'tv_minutes') tvMinutes += r.amount
    else if (r.sponsor_id && r.kind === 'tv_spot') of(r.sponsor_id).tvSpots += r.amount
    else if (r.sponsor_id && r.kind === 'scan') {
      const p = of(r.sponsor_id)
      p.scans += r.amount
      const src = p.scansBySource.find(x => x.source === r.source)
      if (src) src.count += r.amount
      else p.scansBySource.push({ source: r.source, count: r.amount })
      const h = p.scansByHour.find(x => x.hour === r.hour)
      if (h) h.count += r.amount
      else p.scansByHour.push({ hour: r.hour, count: r.amount })
    }
  }
  for (const p of partners.values()) {
    p.scansBySource.sort((a, b) => b.count - a.count)
    p.scansByHour.sort((a, b) => a.hour.localeCompare(b.hour))
  }
  return { from, to, visits, tvMinutes, partners }
}

export async function fetchReport(tournamentId: string): Promise<ReachReport | { error: string }> {
  const { data, error } = await supabase.rpc('partner_report', { p_tournament: tournamentId })
  if (error) return { error: /partner_report|function|schema cache/i.test(error.message) ? 'Chybí migrace 24 (db-backup/24_partner_reach.sql)' : error.message }
  return buildReport((data ?? []) as StatRow[])
}
