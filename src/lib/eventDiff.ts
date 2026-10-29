// Ukládání událostí zápasu (góly, asistence, karty, tresty) — posílat jen změny a hromadně.
// Dřív se pro každého hráče obou týmů posílal samostatný dotaz (2 × 22 hráčů = 44 požadavků).

export interface CountDiff {
  /** Hráči s nenulovým počtem, kterým se počet změnil → jeden hromadný upsert */
  upserts: { player_id: string; count: number }[]
  /** Hráči, kterým počet klesl na 0 → jedno hromadné smazání */
  deletes: string[]
}

/** Rozdíl počtů (góly, asistence) proti stavu při otevření editoru. */
export function diffCounts(initial: Record<string, number>, current: Record<string, number>): CountDiff {
  const upserts: CountDiff['upserts'] = []
  const deletes: string[] = []
  const ids = new Set([...Object.keys(initial), ...Object.keys(current)])
  for (const id of ids) {
    const before = initial[id] ?? 0
    const after = current[id] ?? 0
    if (before === after) continue
    if (after > 0) upserts.push({ player_id: id, count: after })
    else deletes.push(id)
  }
  return { upserts, deletes }
}

/** Změnil se obsah (karty, tresty)? Porovnání podle hodnot, ne podle reference. */
export function changed<T>(initial: Record<string, T>, current: Record<string, T>): boolean {
  const ids = new Set([...Object.keys(initial), ...Object.keys(current)])
  for (const id of ids) {
    if (JSON.stringify(initial[id] ?? null) !== JSON.stringify(current[id] ?? null)) return true
  }
  return false
}
