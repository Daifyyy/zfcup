// Vyhodnocení modulů pro otevřený turnaj (Vlna 5, bod 5.0).
// App.tsx dodá turnaj, stavy z platformy a „hraje dnes“; komponenty se ptají jen přes useModule(klíč).
// Změna u turnaje i na platformě přijde realtime → projeví se bez obnovení stránky.
import { createContext, useContext, type ReactNode } from 'react'
import { isModuleEnabled } from './modules'

interface ModulesValue {
  tournament: { modules?: unknown } | null
  platformModules: unknown
  isPlatformAdmin: boolean
  playingToday: boolean
}

const Ctx = createContext<ModulesValue>({ tournament: null, platformModules: {}, isPlatformAdmin: false, playingToday: false })

export function ModulesProvider({ value, children }: { value: ModulesValue; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Platí modul v otevřeném turnaji pro tohoto uživatele? (mimo turnaj vždy false) */
export function useModule(key: string): boolean {
  const v = useContext(Ctx)
  return isModuleEnabled(key, v.tournament, v.platformModules, { isPlatformAdmin: v.isPlatformAdmin, playingToday: v.playingToday })
}
