import { describe, it, expect } from 'vitest'
import { standingsZones } from '../zones'
import { brandChrome, brandVars, contrastRatio, readableOnDark, DARK_SURFACE } from '../theme'

/* eslint-disable @typescript-eslint/no-explicit-any */
const t = (format_id: string, extra: any = {}) => ({ format: 'groups', format_id, advancing_per_group: 2, ...extra }) as any

describe('pásma postupu', () => {
  it('liga + play-off: 1–2 SF, 3–6 QF', () => {
    const z = standingsZones(t('league_playoff', { format: 'league' }))
    expect([0, 1, 2, 5, 6].map(i => z.zoneAt(i)?.label ?? null)).toEqual(['SF', 'SF', 'QF', 'QF', null])
    expect(z.legend.map(l => l.short)).toEqual(['1–2 → semifinále', '3–6 → čtvrtfinále'])
  })
  it('liga + SF: 1–4 SF bez čtvrtfinále', () => {
    const z = standingsZones(t('league_sf', { format: 'league' }))
    expect([0, 3, 4].map(i => z.zoneAt(i)?.label ?? null)).toEqual(['SF', 'SF', null])
    expect(z.legend).toHaveLength(1)
  })
  it('liga bez play-off: první = vítěz ligy (ne postup do play-off)', () => {
    const z = standingsZones(t('league', { format: 'league' }))
    expect(z.zoneAt(0)?.label).toBe('Vítěz')
    expect(z.zoneAt(1)).toBeNull()
    expect(z.legend.map(l => l.text)).toEqual(['1. místo = vítěz ligy'])
  })
  it('skupiny + útěcha', () => {
    const z = standingsZones(t('groups_full_placement'))
    expect([0, 3, 4, 5, 6].map(i => z.zoneAt(i)?.kind ?? null)).toEqual(['a', 'a', 'b', 'b', null])
  })
})

describe('značka na tmavém pozadí', () => {
  it('tmavá značka se zesvětlí na kontrast ≥ 4,5', () => {
    for (const c of ['#0f2a5c', '#111827', '#1d4ed8', '#9f1239']) {
      expect(contrastRatio(readableOnDark(c), DARK_SURFACE)).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('světlá značka zůstává', () => {
    expect(readableOnDark('#facc15')).toBe('#facc15')
  })
  it('brandVars vrací --brand-on-dark', () => {
    expect(brandVars('#0f2a5c', '#f59e0b')?.['--brand-on-dark']).toMatch(/^#[0-9a-f]{6}$/)
  })
  it('výrazný styl: plochy ve značce s kontrastem bílého textu ≥ 10 (navigace ≥ 8)', () => {
    for (const c of ['#1d4ed8', '#facc15', '#0f7b3f', '#ea580c', '#ffffff']) {
      const { chrome, chrome2 } = brandChrome(c)
      expect(contrastRatio(chrome, '#ffffff')).toBeGreaterThanOrEqual(10)
      expect(contrastRatio(chrome2, '#ffffff')).toBeGreaterThanOrEqual(8)
    }
    expect(brandVars('#0f7b3f', '#facc15', 'bold')?.['--chrome']).toBeTruthy()
    expect(brandVars('#0f7b3f', '#facc15', 'subtle')?.['--chrome']).toBeUndefined()
  })
})
