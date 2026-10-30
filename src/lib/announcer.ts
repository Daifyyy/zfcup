// Hlasatel v TV režimu (modul `announcer`): hlas prohlížeče (speechSynthesis), čeština.
// Bez serveru a nákladů. Prohlížeče pustí zvuk až po kliknutí na stránce → TV má tlačítko „Zapnout hlas“.
import type { TvEvent } from './tvEvents'

export interface AnnouncerSettings {
  goals: boolean
  starts: boolean
  ends: boolean
  /** Dohraná skupina a vítěz turnaje */
  milestones: boolean
  /** Zmínka generálního partnera u gólu („gól vám přináší…“) */
  partner: boolean
}

export const DEFAULT_ANNOUNCER: AnnouncerSettings = { goals: true, starts: true, ends: true, milestones: true, partner: true }

/** Nastavení je per zařízení (TV) — uvedeno na stránce Cookies. */
const KEY = 'turnajnik_announcer'

export function loadAnnouncerSettings(): AnnouncerSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_ANNOUNCER, ...JSON.parse(raw) } : DEFAULT_ANNOUNCER
  } catch {
    return DEFAULT_ANNOUNCER
  }
}
export function saveAnnouncerSettings(s: AnnouncerSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* soukromý režim — platí jen do zavření */ }
}

export interface AnnounceContext {
  teamName: (id: string | null | undefined) => string
  playerName: (id: string) => string
  game: (id: string) => { home_id: string | null; away_id: string | null; h: number; a: number; label: string } | undefined
  groupName: (id: string) => string
  /** Generální partner (jen když je zapnutá zmínka partnera) */
  partner?: string | null
}

/** „3:1“ se čte špatně → „3 1“ hlasatel přečte „tři jedna“. */
const score = (h: number, a: number) => `${h} ${a}`

/** Text hlášení, nebo null (typ události je v nastavení vypnutý). */
export function announcementText(e: TvEvent, ctx: AnnounceContext, s: AnnouncerSettings): string | null {
  switch (e.type) {
    case 'goal': {
      if (!s.goals) return null
      const g = ctx.game(e.gameId)
      const names = [...new Set(e.scorers)].map(ctx.playerName).filter(Boolean)
      const who = names.length ? `, ${names.length > 1 ? 'střelci' : 'střelec'} ${names.join(' a ')}` : ''
      const state = g ? ` Stav ${ctx.teamName(g.home_id)} ${ctx.teamName(g.away_id)}, ${score(e.h, e.a)}.` : ''
      const partner = s.partner && ctx.partner ? ` Gól vám přináší ${ctx.partner}.` : ''
      return `${e.count > 1 ? `${e.count} góly` : 'Gól'}! ${ctx.teamName(e.teamId)}${who}.${state}${partner}`
    }
    case 'match_start': {
      if (!s.starts) return null
      const g = ctx.game(e.gameId)
      if (!g) return null
      return `Začíná zápas ${ctx.teamName(g.home_id)} proti ${ctx.teamName(g.away_id)}${g.label ? `, ${g.label}` : ''}.`
    }
    case 'match_end': {
      if (!s.ends) return null
      const g = ctx.game(e.gameId)
      if (!g) return null
      if (g.h === g.a) return `Konec zápasu. ${ctx.teamName(g.home_id)} a ${ctx.teamName(g.away_id)} remizovali ${score(g.h, g.a)}.`
      const homeWon = g.h > g.a
      return `Konec zápasu. ${ctx.teamName(homeWon ? g.home_id : g.away_id)} vyhrává nad ${ctx.teamName(homeWon ? g.away_id : g.home_id)} ${score(Math.max(g.h, g.a), Math.min(g.h, g.a))}.`
    }
    case 'group_done':
      return s.milestones ? `${ctx.groupName(e.groupId)} je dohraná. Podívejte se na konečnou tabulku.` : null
    case 'champion':
      return s.milestones ? `Vítězem turnaje je ${ctx.teamName(e.teamId)}! Gratulujeme!` : null
  }
}

// ── Hlas prohlížeče ──

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

function czechVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  return voices.find(v => v.lang?.toLowerCase().startsWith('cs')) ?? null
}

/** Je v zařízení český hlas? (bez něj čte anglický hlas česky — špatně) */
export function hasCzechVoice(): boolean {
  return speechAvailable() && czechVoice() !== null
}

export function speak(text: string) {
  if (!speechAvailable()) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'cs-CZ'
  const v = czechVoice()
  if (v) u.voice = v
  u.rate = 1
  window.speechSynthesis.speak(u)
}

/** Okamžité ztišení (vypnutí modulu, odchod z TV). */
export function cancelSpeech() {
  if (speechAvailable()) window.speechSynthesis.cancel()
}
