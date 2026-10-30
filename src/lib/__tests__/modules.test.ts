import { beforeAll, describe, expect, it } from 'vitest'
import { MODULES, isModuleEnabled, isPlayingToday, platformStage, tournamentChoice, visibleModuleSettings, withModuleChoice, withModuleStage } from '../modules'

// Testy nezávisí na tom, které moduly jsou v registru hotové: podstrčíme vlastní registr.
beforeAll(() => {
  MODULES.splice(0, MODULES.length,
    { key: 'card', name: 'Karta', description: '', defaultEnabled: true, ready: true },
    { key: 'voice', name: 'Hlas', description: '', defaultEnabled: false, ready: true },
    { key: 'todo', name: 'Připravuje se', description: '', defaultEnabled: true, ready: false },
  )
})

const admin = { isPlatformAdmin: true, playingToday: false }
const user = { isPlatformAdmin: false, playingToday: false }
const t = (modules?: unknown) => ({ modules })

describe('stav na platformě', () => {
  it('chybějící migrace / neznámá hodnota / nehotový modul = off', () => {
    expect(platformStage('card', undefined)).toBe('off')
    expect(platformStage('card', null)).toBe('off')
    expect(platformStage('card', { card: 'zapnuto' })).toBe('off')
    expect(platformStage('neexistuje', { neexistuje: 'on' })).toBe('off')
    expect(platformStage('todo', { todo: 'on' })).toBe('off')
    expect(platformStage('card', { card: 'beta' })).toBe('beta')
  })
  it('volba turnaje jen boolean', () => {
    expect(tournamentChoice('card', { card: true })).toBe(true)
    expect(tournamentChoice('card', { card: 'true' })).toBeUndefined()
    expect(tournamentChoice('card', undefined)).toBeUndefined()
  })
})

describe('isModuleEnabled', () => {
  it('off: nikde, ani když ho turnaj má zapnutý (nouzová brzda)', () => {
    expect(isModuleEnabled('card', t({ card: true }), { card: 'off' }, admin)).toBe(false)
  })
  it('internal: jen správce platformy', () => {
    const p = { card: 'internal' }
    expect(isModuleEnabled('card', t({ card: true }), p, admin)).toBe(true)
    expect(isModuleEnabled('card', t({ card: true }), p, user)).toBe(false)
    expect(isModuleEnabled('card', t({}), p, admin)).toBe(false)
  })
  it('beta: jen když si ho pořadatel zapnul (výchozí stav se neuplatní)', () => {
    const p = { card: 'beta' }
    expect(isModuleEnabled('card', t({}), p, user)).toBe(false)
    expect(isModuleEnabled('card', t({ card: true }), p, user)).toBe(true)
    expect(isModuleEnabled('card', t({ card: false }), p, user)).toBe(false)
  })
  it('sunset: zapnutý vydrží jen v den, kdy turnaj hraje', () => {
    const p = { card: 'sunset' }
    expect(isModuleEnabled('card', t({ card: true }), p, { ...user, playingToday: true })).toBe(true)
    expect(isModuleEnabled('card', t({ card: true }), p, user)).toBe(false)
    expect(isModuleEnabled('card', t({}), p, { ...user, playingToday: true })).toBe(false)
  })
  it('on: výchozí stav z registru, pořadatel ho může změnit', () => {
    expect(isModuleEnabled('card', t({}), { card: 'on' }, user)).toBe(true)
    expect(isModuleEnabled('voice', t({}), { voice: 'on' }, user)).toBe(false)
    expect(isModuleEnabled('card', t({ card: false }), { card: 'on' }, user)).toBe(false)
    expect(isModuleEnabled('voice', t({ voice: true }), { voice: 'on' }, user)).toBe(true)
  })
  it('bez turnaje nic', () => {
    expect(isModuleEnabled('card', null, { card: 'on' }, admin)).toBe(false)
  })
  it('zapnout → vypnout → zapnout: rozhoduje jen aktuální volba (data turnaje se nemění)', () => {
    const p = { card: 'beta' }
    let m: unknown = {}
    m = withModuleChoice(m, 'card', true)
    expect(isModuleEnabled('card', t(m), p, user)).toBe(true)
    m = withModuleChoice(m, 'card', false)
    expect(isModuleEnabled('card', t(m), p, user)).toBe(false)
    m = withModuleChoice(m, 'card', true)
    expect(isModuleEnabled('card', t(m), p, user)).toBe(true)
  })
})

describe('nastavení pořadatele', () => {
  const keys = (s: ReturnType<typeof visibleModuleSettings>) => s.map(x => x.def.key)
  it('beta a on vidí všichni, internal jen správce, off a nehotové nikdo', () => {
    const p = { card: 'beta', voice: 'internal', todo: 'beta' }
    expect(keys(visibleModuleSettings(t({}), p, false))).toEqual(['card'])
    expect(keys(visibleModuleSettings(t({}), p, true))).toEqual(['card', 'voice'])
    expect(visibleModuleSettings(t({}), {}, true)).toEqual([])
  })
  it('sunset jen tam, kde je zapnutý, a nejde znovu zapnout', () => {
    const p = { card: 'sunset' }
    expect(visibleModuleSettings(t({}), p, false)).toEqual([])
    const [s] = visibleModuleSettings(t({ card: true }), p, false)
    expect(s.checked).toBe(true)
    expect(s.canEnable).toBe(false)
  })
  it('on ukazuje výchozí stav jako zapnutý přepínač', () => {
    const [s] = visibleModuleSettings(t({}), { card: 'on' }, false)
    expect(s.checked).toBe(true)
  })
})

describe('pomocné', () => {
  it('změna volby a stavu nemaže ostatní klíče', () => {
    expect(withModuleChoice({ a: true }, 'b', false)).toEqual({ a: true, b: false })
    expect(withModuleChoice(null, 'b', true)).toEqual({ b: true })
    expect(withModuleStage({ a: 'beta' }, 'b', 'on')).toEqual({ a: 'beta', b: 'on' })
  })
  it('hraje dnes: den turnaje nebo dnešní zápas sezóny', () => {
    expect(isPlayingToday({ tips_lock_from: '2026-10-30' }, [], '2026-10-30')).toBe(true)
    expect(isPlayingToday({ tips_lock_from: '2026-10-29' }, ['2026-10-30'], '2026-10-30')).toBe(true)
    expect(isPlayingToday({ tips_lock_from: '' }, [null, '2026-11-02'], '2026-10-30')).toBe(false)
  })
})
