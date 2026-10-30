// Sdílený dotaz s daty turnaje (migrace 25): souběžné požadavky = 1 RPC, výpadky → původní dotazy.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('../supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }))

import { fetchTable, _resetBundleForTests } from '../bundle'

const direct = (data: unknown) => vi.fn(async () => ({ data, error: null }))

beforeEach(() => { rpc.mockReset(); _resetBundleForTests() })

describe('fetchTable', () => {
  it('souběžné požadavky hooků = jeden RPC, každý dostane svou tabulku', async () => {
    rpc.mockResolvedValue({ data: { teams: [{ id: 't' }], matches: [{ id: 'm' }], tournament: { id: 'T' } }, error: null })
    const d1 = direct('x'), d2 = direct('y')
    const [a, b] = await Promise.all([
      fetchTable('T', 'teams', d1, true),
      fetchTable('T', 'matches', d2, true),
    ])
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(a.data).toEqual([{ id: 't' }])
    expect(b.data).toEqual([{ id: 'm' }])
    expect(d1).not.toHaveBeenCalled()
  })

  it('bez sdílení (refetch po uložení, realtime) jde vždy napřímo', async () => {
    const d = direct([{ id: 'fresh' }])
    expect((await fetchTable('T', 'teams', d, false)).data).toEqual([{ id: 'fresh' }])
    expect(rpc).not.toHaveBeenCalled()
  })

  it('chybějící funkce (bez migrace 25) → původní dotaz a bundle se už nezkouší', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.tournament_bundle' } })
    const d = direct([{ id: 'x' }])
    expect((await fetchTable('T', 'teams', d, true)).data).toEqual([{ id: 'x' }])
    await new Promise(r => setTimeout(r, 2600))
    await fetchTable('T', 'teams', d, true)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(d).toHaveBeenCalledTimes(2)
  }, 5000)

  it('turnaj bez řádku (neexistuje / bez přístupu) → původní dotaz kvůli kódu chyby', async () => {
    rpc.mockResolvedValue({ data: { tournament: null, teams: [] }, error: null })
    const d = vi.fn(async () => ({ data: null, error: { code: 'PGRST116', message: 'no rows' } }))
    expect((await fetchTable('T', 'tournament', d, true)).error?.code).toBe('PGRST116')
  })
})
