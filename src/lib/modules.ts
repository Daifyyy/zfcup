// Systém modulů (Vlna 5, bod 5.0) — čisté funkce, bez Supabase.
// Dvě úrovně:
//  1. Platforma (platform_settings.modules, mění správce): off | internal | beta | sunset | on
//  2. Turnaj (tournament.modules, mění pořadatel): { [klíč]: true | false }
// Pravidla pro zapnutí/vypnutí uprostřed turnaje: docs/ROADMAP-PREMIUM.md, Vlna 5.
// Bez migrace 21 jsou oba sloupce prázdné → všechny moduly vypnuté.

/** Stav modulu na platformě. */
export type ModuleStage =
  /** Není nikde vidět. */
  | 'off'
  /** Vidí a používá jen správce platformy (vlastní testy, validační turnaj). */
  | 'internal'
  /** Vidí všichni pořadatelé se štítkem Beta, zapínají si ho sami. */
  | 'beta'
  /** Ukončuje se: nově zapnout nejde, kde je zapnutý, vydrží do konce dne, kdy turnaj hraje. */
  | 'sunset'
  /** Hotový modul bez štítku. */
  | 'on'

export const MODULE_STAGES: { value: ModuleStage; label: string; hint: string }[] = [
  { value: 'off', label: 'Vypnuto', hint: 'Modul není nikde vidět.' },
  { value: 'internal', label: 'Interně', hint: 'Jen správce platformy na vlastních testech.' },
  { value: 'beta', label: 'Beta', hint: 'Všichni pořadatelé se štítkem Beta, zapínají si ho sami.' },
  { value: 'sunset', label: 'Doběh', hint: 'Nově zapnout nejde; kde je zapnutý, vydrží do konce dne, kdy turnaj hraje.' },
  { value: 'on', label: 'Hotovo', hint: 'Hotový modul bez štítku.' },
]

export interface ModuleDef {
  key: string
  name: string
  /** Popis pro pořadatele (Nastavení → Volitelné moduly) */
  description: string
  /** Zapnuto u turnaje, který o něm ještě nerozhodl — jen ve stavu `on` (Beta si pořadatel zapíná sám). */
  defaultEnabled: boolean
  /** false = modul se teprve připravuje; na platformě ho nejde zapnout. */
  ready: boolean
}

/**
 * Registr modulů. Nový modul = řádek zde (klíč se nesmí měnit — je uložený v DB).
 * `ready: true` nastavit až s hotovou implementací (každý modul nejdřív `internal`).
 */
export const MODULES: ModuleDef[] = [
  { key: 'player_card', name: 'Karta hráče', description: 'Sběratelská karta hráče ke sdílení a osobní stránka hráče s příštím zápasem.', defaultEnabled: true, ready: false },
  { key: 'goal_animation', name: 'Animace gólu na TV', description: 'Při gólu se v TV režimu i na TV tabuli na 5 s ukáže „GÓL!“ s logem týmu a střelcem; s generálním partnerem „Gól vám přináší…“.', defaultEnabled: true, ready: true },
  { key: 'announcer', name: 'Hlasatel', description: 'TV režim nahlas hlásí góly se střelcem, začátek a konec zápasu, dohranou skupinu a vítěze (hlas prohlížeče), volitelně se zmínkou partnera. Na TV se zapíná tlačítkem Hlas.', defaultEnabled: false, ready: true },
  { key: 'smart_director', name: 'Chytrá režie TV', description: 'TV režim reaguje na dění: po gólu ukáže zápasy, po dohrání skupiny tabulku, po finále pavouka — pak se vrátí ke střídání.', defaultEnabled: false, ready: true },
  { key: 'tv_spots', name: 'Spoty na TV', description: 'V rotaci TV režimu se střídají partneři přes celou obrazovku (generální 3×, hlavní 2×) a oznámení pořadatele.', defaultEnabled: true, ready: true },
  { key: 'fan_vote', name: 'Hlasování diváků', description: 'Diváci hlasují o hráči zápasu přes QR kód na TV, výsledek se ukáže živě.', defaultEnabled: false, ready: false },
  { key: 'ai_reporter', name: 'AI zpravodaj', description: 'Článek a text na sítě po každém zápase, souhrn dne a reportáž po turnaji — pořadatel text schválí.', defaultEnabled: false, ready: false },
  { key: 'diplomas', name: 'Diplomy', description: 'Diplomy za umístění, nejlepšího střelce a hráče turnaje jedním klikem k tisku.', defaultEnabled: true, ready: false },
  { key: 'partner_reach', name: 'Dosah partnera', description: 'QR akce partnera na TV a v grafikách s počítáním skenů a reportem pro partnera.', defaultEnabled: false, ready: false },
]

export function getModuleDef(key: string): ModuleDef | undefined {
  return MODULES.find(m => m.key === key)
}

const STAGES = new Set<ModuleStage>(['off', 'internal', 'beta', 'sunset', 'on'])

/** Stav z platform_settings.modules; neznámá hodnota, nehotový modul nebo chybějící migrace = off. */
export function platformStage(key: string, platformModules: unknown): ModuleStage {
  const def = getModuleDef(key)
  if (!def?.ready) return 'off'
  const raw = platformModules && typeof platformModules === 'object' ? (platformModules as Record<string, unknown>)[key] : undefined
  return typeof raw === 'string' && STAGES.has(raw as ModuleStage) ? (raw as ModuleStage) : 'off'
}

/** Rozhodnutí pořadatele u turnaje: true/false, nebo undefined = ještě nerozhodl. */
export function tournamentChoice(key: string, tournamentModules: unknown): boolean | undefined {
  const raw = tournamentModules && typeof tournamentModules === 'object' ? (tournamentModules as Record<string, unknown>)[key] : undefined
  return typeof raw === 'boolean' ? raw : undefined
}

export interface ModuleContext {
  /** Přihlášený je správce platformy (stav `internal`) */
  isPlatformAdmin: boolean
  /** Turnaj dnes hraje (den turnaje / dnešní zápas sezóny) — stav `sunset` */
  playingToday: boolean
}

/**
 * Platí modul v tomto turnaji pro tohoto uživatele?
 * Jediné místo rozhodnutí — UI i chování modulů volají jen tuto funkci (přes useModule).
 */
export function isModuleEnabled(
  key: string,
  tournament: { modules?: unknown } | null | undefined,
  platformModules: unknown,
  ctx: ModuleContext,
): boolean {
  if (!tournament) return false
  const stage = platformStage(key, platformModules)
  const choice = tournamentChoice(key, tournament.modules)
  switch (stage) {
    case 'off': return false
    case 'internal': return ctx.isPlatformAdmin && choice === true
    case 'beta': return choice === true
    case 'sunset': return choice === true && ctx.playingToday
    case 'on': return choice ?? getModuleDef(key)!.defaultEnabled
  }
}

/** Jak se má modul ukázat pořadateli v Nastavení. */
export interface ModuleSetting {
  def: ModuleDef
  stage: ModuleStage
  /** Aktuálně zapnuto u turnaje (bez ohledu na den — co ukazuje přepínač) */
  checked: boolean
  /** Smí ho teď zapnout (sunset: jen vypnout) */
  canEnable: boolean
}

/**
 * Moduly, které má pořadatel v Nastavení vidět: `beta`/`on` všichni, `internal` jen správce,
 * `sunset` jen tam, kde je zapnutý (aby šel vypnout).
 */
export function visibleModuleSettings(tournament: { modules?: unknown } | null | undefined, platformModules: unknown, isPlatformAdmin: boolean): ModuleSetting[] {
  if (!tournament) return []
  return MODULES.flatMap(def => {
    const stage = platformStage(def.key, platformModules)
    const choice = tournamentChoice(def.key, tournament.modules)
    const checked = stage === 'on' ? (choice ?? def.defaultEnabled) : choice === true
    const show = stage === 'beta' || stage === 'on' || (stage === 'internal' && isPlatformAdmin) || (stage === 'sunset' && checked)
    if (!show) return []
    return [{ def, stage, checked, canEnable: stage !== 'sunset' }]
  })
}

/** Nový obsah tournament.modules po přepnutí (ostatní klíče zůstávají). */
export function withModuleChoice(tournamentModules: unknown, key: string, enabled: boolean): Record<string, boolean> {
  const base = tournamentModules && typeof tournamentModules === 'object' ? { ...(tournamentModules as Record<string, boolean>) } : {}
  base[key] = enabled
  return base
}

/** Nový obsah platform_settings.modules po změně stavu (off se ukládá výslovně kvůli historii). */
export function withModuleStage(platformModules: unknown, key: string, stage: ModuleStage): Record<string, ModuleStage> {
  const base = platformModules && typeof platformModules === 'object' ? { ...(platformModules as Record<string, ModuleStage>) } : {}
  base[key] = stage
  return base
}

/** Hraje turnaj dnes? Den turnaje (tips_lock_from) nebo dnešní datum některého zápasu (sezóna). */
export function isPlayingToday(
  tournament: { tips_lock_from?: string | null } | null | undefined,
  matchDates: (string | null | undefined)[],
  today: string,
): boolean {
  if (tournament?.tips_lock_from === today) return true
  return matchDates.some(d => d === today)
}
