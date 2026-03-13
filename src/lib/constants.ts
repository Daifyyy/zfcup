export const TEAM_COLORS = [
  '#2563eb', // modrá
  '#16a34a', // zelená
  '#d97706', // zlatá
  '#dc2626', // červená
  '#7c3aed', // fialová
  '#0891b2', // cyan
  '#ea580c', // oranžová
  '#db2777', // růžová
  '#65a30d', // limetková
  '#475569', // šedá
]

export function addMinutes(time: string, minutes: number): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

export function matchCount(n: number, schedule: 'once' | 'twice'): number {
  return schedule === 'twice' ? n * (n - 1) : (n * (n - 1)) / 2
}
