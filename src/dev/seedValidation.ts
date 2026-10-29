// Validační (zátěžový) turnaj pro kontrolu funkcí a vzhledu.
// NENÍ součástí aplikace (nic ho neimportuje). Spouští se ručně v prohlížeči
// na localhostu s přihlášeným organizátorem (zápisy jdou přes RLS jeho účtu):
//
//   const m = await import('/src/dev/seedValidation.ts'); await m.seedValidationTournament()
//
// Vytvoří fotbalový turnaj 16 týmů (4 skupiny → čtvrtfinále → semifinále → o 3. místo → finále)
// se všemi moduly: asistence, karty, partneři (všechny úrovně), média, branding, oznámení, pravidla,
// rozhodčí, loga, dlouhé názvy. Výsledky jsou deterministické (stejné při každém spuštění).

import { supabase } from '../lib/supabase'
import { formatColumns, getFormatDef } from '../lib/formats'
import { getSportDef } from '../lib/sports'
import { todayISO } from '../lib/dates'
import type { Group } from '../hooks/useGroups'
import type { Match } from '../hooks/useMatches'
import type { BracketRound, BracketSlot } from '../hooks/useBracket'

export const VALIDATION_SLUG = 'validacni-pohar-2026'

// ── Deterministická náhoda ──────────────────────────────────────────────────
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = rng(20261029)
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data as T
}

// ── Loga jako SVG (data URI) ───────────────────────────────────────────────
function crest(initials: string, bg: string, fg = '#ffffff', shape: 'shield' | 'circle' | 'hex' = 'shield'): string {
  const path = shape === 'circle'
    ? '<circle cx="50" cy="50" r="46" />'
    : shape === 'hex'
      ? '<polygon points="50,4 92,27 92,73 50,96 8,73 8,27" />'
      : '<path d="M50 4 L92 16 V50 C92 74 72 90 50 96 C28 90 8 74 8 50 V16 Z" />'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="${bg}" stroke="${fg}" stroke-width="4">${path}</g><text x="50" y="62" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${initials.length > 2 ? 26 : 34}" fill="${fg}">${initials}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function wordmark(name: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 90"><rect x="2" y="2" width="236" height="86" rx="12" fill="#ffffff" stroke="${color}" stroke-width="4"/><circle cx="40" cy="45" r="22" fill="${color}"/><text x="72" y="55" font-family="Arial, sans-serif" font-weight="800" font-size="26" fill="${color}">${name}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// ── Data ───────────────────────────────────────────────────────────────────
const TEAMS: { name: string; color: string; logo?: [string, 'shield' | 'circle' | 'hex'] }[] = [
  { name: 'Validace FC Severní Dráha', color: '#1d4ed8', logo: ['SD', 'shield'] },
  { name: 'Validace SK Lokomotiva', color: '#b91c1c', logo: ['LOK', 'circle'] },
  { name: 'Validace Dynamo', color: '#0f766e', logo: ['DY', 'hex'] },
  { name: 'Validace AC Sokolovna Horní Počernice a Klánovice', color: '#7c3aed', logo: ['ACS', 'shield'] },
  { name: 'Validace Jiskra', color: '#ea580c' },
  { name: 'Validace FK Účetní & Daňoví Poradci', color: '#0369a1', logo: ['ÚDP', 'circle'] },
  { name: 'Validace Tatran', color: '#15803d', logo: ['TA', 'hex'] },
  { name: 'Validace Slavoj', color: '#be185d' },
  { name: 'Validace IT Oddělení United', color: '#4338ca', logo: ['IT', 'shield'] },
  { name: 'Validace Rapid', color: '#a16207', logo: ['RA', 'circle'] },
  { name: 'Validace Logistika Expres Mladá Boleslav', color: '#334155', logo: ['LEX', 'hex'] },
  { name: 'Validace Viktorie', color: '#dc2626' },
  { name: 'Validace Olympia', color: '#0891b2', logo: ['OL', 'shield'] },
  { name: 'Validace HR & Marketing Spojené Síly', color: '#c026d3', logo: ['HRM', 'circle'] },
  { name: 'Validace Baník', color: '#171717', logo: ['BA', 'hex'] },
  { name: 'Validace Start', color: '#65a30d' },
]

const FIRST = ['Jan', 'Petr', 'Tomáš', 'Martin', 'Lukáš', 'Jakub', 'David', 'Ondřej', 'Michal', 'Filip', 'Adam', 'Vojtěch', 'Matěj', 'Daniel', 'Marek', 'Jiří', 'Radek', 'Pavel', 'Šimon', 'Štěpán']
const LAST = ['Novák', 'Svoboda', 'Dvořák', 'Černý', 'Procházka', 'Kučera', 'Veselý', 'Horák', 'Němec', 'Pokorný', 'Marek', 'Pospíšil', 'Hájek', 'Jelínek', 'Král', 'Růžička', 'Beneš', 'Fiala', 'Sedláček', 'Doležal', 'Zeman', 'Kolář', 'Navrátil', 'Čermák']
const LONG_NAMES = ['Maximilián Konstantin Vondráček-Šťastný', 'Bartoloměj Kryštof Novotný-Pražák']

const REFEREES = ['Karel Rozhodný', 'Lenka Píšťalková', 'Josef Spravedlivý', 'Ivana Přísná', 'Miroslav Čárový', 'Zdeněk Ofsajdový-Dlouhopraporkový']

const SPONSORS: { name: string; tier: string; color: string }[] = [
  { name: 'MegaBank', tier: 'title', color: '#0f766e' },
  { name: 'AutoMoto', tier: 'main', color: '#1d4ed8' },
  { name: 'EnergoPlus', tier: 'main', color: '#ca8a04' },
  { name: 'Pekárna U Mlýna', tier: 'partner', color: '#9a3412' },
  { name: 'SportShop', tier: 'partner', color: '#be123c' },
  { name: 'TechSoft', tier: 'partner', color: '#4338ca' },
  { name: 'Voda Pramen', tier: 'supplier', color: '#0284c7' },
  { name: 'Grill Bar', tier: 'supplier', color: '#b45309' },
  { name: 'Rádio Sport', tier: 'media', color: '#7e22ce' },
]

/** Kruhový rozpis (circle method), kola za sebou */
function roundRobin(ids: string[]): [string, string][][] {
  const list = [...ids]
  if (list.length % 2) list.push('')
  const n = list.length
  const rounds: [string, string][][] = []
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = []
    for (let i = 0; i < n / 2; i++) {
      const a = list[i], b = list[n - 1 - i]
      if (a && b) pairs.push(r % 2 ? [b, a] : [a, b])
    }
    rounds.push(pairs)
    list.splice(1, 0, list.pop()!)
  }
  return rounds
}

function hhmm(start: string, plusMin: number): string {
  const [h, m] = start.split(':').map(Number)
  const t = h * 60 + m + plusMin
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

type PlayerRow = { id: string; team_id: string }

/** Rozdělí góly týmu mezi hráče (útočníci častěji), vrací řádky goals/assists/cards. */
function events(teamPlayers: PlayerRow[], goals: number) {
  const scorers: Record<string, number> = {}
  const assisters: Record<string, number> = {}
  const field = teamPlayers.slice(1) // bez brankáře
  for (let g = 0; g < goals; g++) {
    const s = rand() < 0.55 ? field[int(0, Math.min(3, field.length - 1))] : pick(field)
    scorers[s.id] = (scorers[s.id] ?? 0) + 1
    if (rand() < 0.65) {
      const a = pick(field.filter(p => p.id !== s.id))
      assisters[a.id] = (assisters[a.id] ?? 0) + 1
    }
  }
  return { scorers, assisters }
}

function cardsFor(teamPlayers: PlayerRow[]): Record<string, 'yellow' | 'red' | 'yellow_red'> {
  const out: Record<string, 'yellow' | 'red' | 'yellow_red'> = {}
  const r = rand()
  if (r < 0.45) out[pick(teamPlayers).id] = 'yellow'
  if (r < 0.12) out[pick(teamPlayers).id] = 'yellow_red'
  if (r > 0.95) out[pick(teamPlayers).id] = 'red'
  return out
}

async function insertEvents(
  kind: 'match' | 'slot', id: string, tid: string,
  home: PlayerRow[], away: PlayerRow[], hs: number, as: number,
) {
  const key = kind === 'match' ? 'match_id' : 'slot_id'
  const prefix = kind === 'match' ? '' : 'bracket_'
  const h = events(home, hs), a = events(away, as)
  const goals = [...Object.entries(h.scorers), ...Object.entries(a.scorers)].map(([player_id, count]) => ({ player_id, [key]: id, count, tournament_id: tid }))
  const assists = [...Object.entries(h.assisters), ...Object.entries(a.assisters)].map(([player_id, count]) => ({ player_id, [key]: id, count, tournament_id: tid }))
  const cards = [...Object.entries(cardsFor(home)), ...Object.entries(cardsFor(away))].map(([player_id, type]) => ({ player_id, [key]: id, type, tournament_id: tid }))
  if (goals.length) must(await supabase.from(`${prefix}goals`).insert(goals), `${prefix}goals`)
  if (assists.length) must(await supabase.from(`${prefix}assists`).insert(assists), `${prefix}assists`)
  if (cards.length) must(await supabase.from(`${prefix}cards`).insert(cards), `${prefix}cards`)
}

/** Skóre bez remízy pro play-off */
function koScore(): [number, number] {
  const a = int(0, 4)
  let b = int(0, 4)
  if (a === b) b = a === 0 ? 1 : a - 1
  return [a, b]
}

// ── Hlavní funkce ──────────────────────────────────────────────────────────
export async function seedValidationTournament(log: (m: string) => void = console.log): Promise<string> {
  const user = (await supabase.auth.getUser()).data.user
  if (!user) throw new Error('Přihlaste se jako organizátor')

  const existing = await supabase.from('tournament').select('id').eq('slug', VALIDATION_SLUG).maybeSingle()
  if (existing.data) throw new Error(`Validační turnaj už existuje: /${existing.data.id}`)

  const today = todayISO()
  const [y, m, d] = today.split('-').map(Number)
  const fmt = getFormatDef('groups_qf')!

  // 1) Turnaj
  const t = must(await supabase.from('tournament').insert({
    name: 'Validační pohár 2026 — velký zátěžový turnaj firem a amatérských týmů',
    subtitle: '16 týmů · 4 skupiny · čtvrtfinále, semifinále, o 3. místo a finále',
    date: `${d}. ${m}. ${y}`,
    venue: 'Sportovní areál Na Dlouhé Louce, Praha 10 – Strašnice (hřiště A–D)',
    description: '<p><strong>Testovací turnaj pro validaci</strong> funkcí a vzhledu: dlouhé názvy týmů i hráčů, všechny úrovně partnerů, karty, asistence, rozhodčí a play-off.</p><p>Data jsou fiktivní.</p>',
    slug: VALIDATION_SLUG,
    sport: 'football',
    owner_id: user.id,
    ...formatColumns(fmt),
    num_pitches: 4,
    match_duration: 20,
    halves: 2,
    round_break: 10,
    playoff_kickoff: '12:00',
    tips_enabled: false,
    tips_lock_from: today,
    assists_enabled: true,
    cards_enabled: true,
    sponsors_enabled: true,
    press_enabled: true,
    press_contact_name: 'Tisková mluvčí turnaje (testovací kontakt)',
    press_contact_email: 'media@example.com',
    press_contact_phone: '+420 600 000 000',
    press_note: 'Akreditace u hlavního vstupu. Fotografování u hřišť povoleno mimo zónu střídaček.',
    brand_primary: '#0f766e',
    brand_secondary: '#f59e0b',
    brand_style: 'bold',
  }).select('id').single(), 'tournament') as { id: string }
  const tid = t.id
  log(`Turnaj ${tid}`)

  // 2) Týmy a hráči
  const teams = must(await supabase.from('teams').insert(TEAMS.map(x => ({
    name: x.name, color: x.color, tournament_id: tid,
    logo_url: x.logo ? crest(x.logo[0], x.color, '#ffffff', x.logo[1]) : null,
  }))).select('id,name'), 'teams') as { id: string; name: string }[]

  const playerRows: { team_id: string; name: string; number: number; role: string | null; tournament_id: string }[] = []
  teams.forEach((tm, ti) => {
    const used = new Set<number>()
    for (let i = 0; i < 11; i++) {
      let num = i === 0 ? 1 : int(2, 99)
      while (used.has(num)) num = int(2, 99)
      used.add(num)
      const long = (ti === 3 && i === 2) || (ti === 13 && i === 4)
      const name = long ? LONG_NAMES[ti === 3 ? 0 : 1] : `${pick(FIRST)} ${pick(LAST)}`
      playerRows.push({ team_id: tm.id, name, number: num, role: i === 0 ? 'goalkeeper' : i === 1 ? 'captain' : null, tournament_id: tid })
    }
  })
  const players = must(await supabase.from('players').insert(playerRows).select('id,team_id'), 'players') as PlayerRow[]
  const rosterOf = (teamId: string) => players.filter(p => p.team_id === teamId)
  log(`${teams.length} týmů, ${players.length} hráčů`)

  // 3) Rozhodčí, partneři, oznámení, pravidla
  const refs = must(await supabase.from('referees').insert(REFEREES.map(name => ({ name, tournament_id: tid }))).select('id'), 'referees') as { id: string }[]
  must(await supabase.from('sponsors').insert(SPONSORS.map((s, i) => ({
    name: s.name, tier: s.tier, position: i, tournament_id: tid,
    logo_url: wordmark(s.name, s.color), website_url: 'https://example.com',
  }))), 'sponsors')
  must(await supabase.from('announcements').insert([
    { icon: 'megaphone', title: 'Vítejte na Validačním poháru 2026', body: '<p>Skupiny se hrají souběžně na čtyřech hřištích. Výsledky sledujte živě na webu i na TV tabuli v hale.</p>', type: 'text', position: 0, tournament_id: tid },
    { icon: 'clock', title: 'Časový harmonogram', body: '<p><strong>09:00</strong> skupiny · <strong>12:00</strong> čtvrtfinále · <strong>13:00</strong> semifinále · <strong>14:10</strong> finále a vyhlášení.</p>', type: 'text', position: 1, tournament_id: tid },
    { icon: 'alert', title: 'Velmi dlouhý nadpis oznámení, který ověřuje zalamování textu na mobilu i na velké TV obrazovce v hale', body: '<p>Parkování pouze na vyznačených místech. Šatny B a C jsou uzavřené.</p>', type: 'text', position: 2, tournament_id: tid },
    { icon: 'trophy', title: 'Vyhlášení vítězů', body: '<p>Po finále na hlavní tribuně. Ceny předá generální partner.</p>', type: 'text', position: 3, tournament_id: tid },
  ]), 'announcements')
  must(await supabase.from('rule_items').insert([
    { title: 'Hrací doba', body: '2 × 10 minut, poločasová přestávka 2 minuty.', position: 0, tournament_id: tid },
    { title: 'Počet hráčů', body: '5 + 1 v poli, střídání hokejovým způsobem.', position: 1, tournament_id: tid },
    { title: 'Bodování ve skupině', body: 'Výhra 3 body, remíza 1 bod. Při rovnosti rozhoduje skóre, vstřelené góly a vzájemný zápas.', position: 2, tournament_id: tid },
    { title: 'Play-off', body: 'Do čtvrtfinále postupují první dva týmy z každé skupiny. Nerozhodný zápas rozhodují pokutové kopy.', position: 3, tournament_id: tid },
    { title: 'Karty', body: 'Žlutá = 2 minuty mimo hřiště. Červená = vyloučení do konce zápasu a stop na další zápas.', position: 4, tournament_id: tid },
    { title: 'Kopačky', body: 'Povolena pouze obuv na umělou trávu (turfy). Kolíky jsou zakázány.', position: 5, tournament_id: tid },
  ]), 'rule_items')

  // 4) Skupiny A–D (paralelně, každá na svém hřišti) + výsledky
  const groupNames = ['A', 'B', 'C', 'D']
  const groupRows: Group[] = []
  for (let gi = 0; gi < 4; gi++) {
    const ids = teams.slice(gi * 4, gi * 4 + 4).map(x => x.id)
    const g = must(await supabase.from('groups').insert({
      name: `Skupina ${groupNames[gi]}`, team_ids: ids, schedule: 'once', tiebreaker: 'score_then_h2h',
      start_time: '09:00', match_duration: 20, break_between: 5, tournament_id: tid,
    }).select().single(), 'group') as Group
    groupRows.push(g)
    const rounds = roundRobin(ids)
    let slot = 0
    for (const round of rounds) {
      for (const [home, away] of round) {
        // Skupina C: samé těsné výsledky a remízy → test tiebreakerů
        const hs = gi === 2 ? int(0, 2) : int(0, 5)
        const as = gi === 2 ? (rand() < 0.5 ? hs : int(0, 2)) : int(0, 4)
        const mres = must(await supabase.from('matches').insert({
          group_id: g.id, round: g.name, home_id: home, away_id: away,
          home_score: hs, away_score: as, played: true,
          scheduled_time: hhmm('09:00', slot * 25), referee_id: refs[(gi + slot) % refs.length].id, tournament_id: tid,
        }).select('id').single(), 'match') as { id: string }
        await insertEvents('match', mres.id, tid, rosterOf(home), rosterOf(away), hs, as)
        slot++
      }
    }
    log(`Skupina ${groupNames[gi]} hotová`)
  }

  // 5) Play-off přes funkce formátu (stejně jako Admin → Play-off)
  await fmt.fns.generate(tid)
  const loadBracket = async () => {
    const r = must(await supabase.from('bracket_rounds').select('*').eq('tournament_id', tid).order('position'), 'rounds') as BracketRound[]
    const s = must(await supabase.from('bracket_slots').select('*').eq('tournament_id', tid).order('position'), 'slots') as BracketSlot[]
    return { r, s }
  }
  let { r: rounds, s: slots } = await loadBracket()
  const matches = must(await supabase.from('matches').select('*').eq('tournament_id', tid), 'matches') as Match[]
  await fmt.fns.seed({ groups: groupRows, matches, bracketRounds: rounds, bracketSlots: slots, advancingPerGroup: 2, sportDef: getSportDef('football') })
  ;({ r: rounds, s: slots } = await loadBracket())

  // Časy kol
  const startOf: Record<string, string> = { 'Čtvrtfinále': '12:00', 'Semifinále': '13:00', 'O 3. místo': '13:40', 'Finále': '14:10' }
  for (const round of rounds) {
    const start = startOf[round.name] ?? '14:30'
    must(await supabase.from('bracket_rounds').update({ scheduled_start: start, break_after: 5 }).eq('id', round.id), 'round time')
    for (const s of slots.filter(x => x.round_id === round.id)) {
      must(await supabase.from('bracket_slots').update({ scheduled_time: hhmm(start, s.position * 25), referee_id: refs[s.position % refs.length].id }).eq('id', s.id), 'slot time')
    }
  }
  ;({ r: rounds, s: slots } = await loadBracket())

  // Odehrát: všechna čtvrtfinále + první semifinále (zbytek zůstane naplánovaný)
  const playRound = async (roundName: string, limit = Infinity) => {
    const round = rounds.find(x => x.name === roundName)
    if (!round) return
    const rs = slots.filter(x => x.round_id === round.id).sort((a, b) => a.position - b.position).slice(0, limit)
    for (const s of rs) {
      if (!s.home_id || !s.away_id) continue
      const [hs, as] = koScore()
      const data = { home_score: hs, away_score: as, played: true }
      must(await supabase.from('bracket_slots').update(data).eq('id', s.id), 'slot result')
      // autoAdvance bere vítěze z data (home_id/away_id) — stejně jako BracketTab
      await insertEvents('slot', s.id, tid, rosterOf(s.home_id), rosterOf(s.away_id), hs, as)
      const full = { home_id: s.home_id, away_id: s.away_id, ...data }
      await fmt.fns.autoAdvance({ slot: { ...s, ...full }, data: full, currentRound: round, allRounds: rounds, allSlots: slots })
      ;({ r: rounds, s: slots } = await loadBracket())
    }
  }
  await playRound('Čtvrtfinále')
  await playRound('Semifinále', 1)
  log('Play-off: čtvrtfinále odehrána, 1. semifinále odehráno')

  log(`Hotovo: /${tid}`)
  return tid
}

/** Oprava turnaje vytvořeného první verzí skriptu: postup z odehraných čtvrtfinále + 1. semifinále. */
export async function repairValidationBracket(tid: string) {
  const fmt = getFormatDef('groups_qf')!
  const load = async () => ({
    r: must(await supabase.from('bracket_rounds').select('*').eq('tournament_id', tid).order('position'), 'rounds') as BracketRound[],
    s: must(await supabase.from('bracket_slots').select('*').eq('tournament_id', tid).order('position'), 'slots') as BracketSlot[],
  })
  let { r, s } = await load()
  const qf = r.find(x => x.position === 0)!
  for (const slot of s.filter(x => x.round_id === qf.id && x.played)) {
    const data = { home_id: slot.home_id, away_id: slot.away_id, home_score: slot.home_score, away_score: slot.away_score, played: true }
    await fmt.fns.autoAdvance({ slot, data, currentRound: qf, allRounds: r, allSlots: s })
  }
  ;({ r, s } = await load())
  const sf = r.find(x => x.position === 1)!
  const sf1 = s.filter(x => x.round_id === sf.id).sort((a, b) => a.position - b.position)[0]
  if (sf1 && !sf1.played && sf1.home_id && sf1.away_id) {
    const players = must(await supabase.from('players').select('id,team_id').eq('tournament_id', tid), 'players') as PlayerRow[]
    const [hs, as] = koScore()
    const data = { home_id: sf1.home_id, away_id: sf1.away_id, home_score: hs, away_score: as, played: true }
    must(await supabase.from('bracket_slots').update({ home_score: hs, away_score: as, played: true }).eq('id', sf1.id), 'sf1')
    await insertEvents('slot', sf1.id, tid, players.filter(p => p.team_id === sf1.home_id), players.filter(p => p.team_id === sf1.away_id), hs, as)
    await fmt.fns.autoAdvance({ slot: { ...sf1, ...data }, data, currentRound: sf, allRounds: r, allSlots: s })
  }
}
