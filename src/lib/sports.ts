export type SportId = 'football' | 'hockey'

export interface SportDef {
  id: SportId
  label: string
  icon: string
  terms: {
    scorersLabel: string
    pitchLabel: string
    kickoffLabel: string
    periodOptions: { value: number; label: string }[]
  }
  standings: {
    winPts: number
    drawPts: number | null
    lossPts: number
    allowDraws: boolean
  }
  discipline: 'cards' | 'penaltyMinutes'
}

const football: SportDef = {
  id: 'football',
  label: 'Fotbal',
  icon: '⚽',
  terms: {
    scorersLabel: 'Střelci',
    pitchLabel: 'Hřiště',
    kickoffLabel: 'Výkop',
    periodOptions: [
      { value: 1, label: '1 poločas' },
      { value: 2, label: '2 poločasy' },
    ],
  },
  standings: {
    winPts: 3,
    drawPts: 1,
    lossPts: 0,
    allowDraws: true,
  },
  discipline: 'cards',
}

const hockey: SportDef = {
  id: 'hockey',
  label: 'Hokej',
  icon: '🏒',
  terms: {
    scorersLabel: 'Střelci',
    pitchLabel: 'Kluziště',
    kickoffLabel: 'Vhazování',
    periodOptions: [
      { value: 1, label: '1 třetina' },
      { value: 3, label: '3 třetiny' },
    ],
  },
  standings: {
    winPts: 3,
    drawPts: null,
    lossPts: 0,
    allowDraws: false,
  },
  discipline: 'penaltyMinutes',
}

export const SPORTS: SportDef[] = [football, hockey]

export function getSportDef(sportId?: string | null): SportDef {
  return SPORTS.find(s => s.id === sportId) ?? football
}
