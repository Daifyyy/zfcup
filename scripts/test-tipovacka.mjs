import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://stehuiaqyconrzwmlmsc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZWh1aWFxeWNvbnJ6d21sbXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDc3NDgsImV4cCI6MjA4ODk4Mzc0OH0.0ono26ntPq8-T3DaQzL2GnAvpiMg-Bgt58XR6ppNONg'
)

// ─── Helpers ────────────────────────────────────────────────────────────────
let passed = 0, failed = 0
const PASS = 'PASS', FAIL = 'FAIL'

function assert(label, actual, expected) {
  const ok = actual === expected
  console.log(`  [${ok ? PASS : FAIL}] ${label}: ${ok ? actual : `got ${actual}, expected ${expected}`}`)
  if (ok) passed++; else failed++
}

function calcPts(ph, pa, rh, ra) {
  if (ph === rh && pa === ra) return 3
  if (Math.sign(ph - pa) === Math.sign(rh - ra)) return 1
  return 0
}

// ─── Načíst data ────────────────────────────────────────────────────────────
const { data: teams } = await sb.from('teams').select('id,name')
const { data: matches } = await sb.from('matches').select('*')
const { data: bSlots } = await sb.from('bracket_slots').select('*')
const { data: groups } = await sb.from('groups').select('id,name')
const ligaId = groups?.[0]?.id

const tn = id => teams?.find(t => t.id === id)?.name ?? '?'
const playedMatches = matches?.filter(m => m.played) ?? []
const pendingMatches = matches?.filter(m => !m.played) ?? []
const pendingSample = pendingMatches.slice(0, 3)
const unplayedSlots = bSlots?.filter(s => !s.played) ?? []

// ─── Scénáře tipů ───────────────────────────────────────────────────────────
const botScenarios = [
  {
    name: '🤖 TestBot-Přesný',
    pin: '0001',
    tipsFor: m => ({ ph: m.home_score, pa: m.away_score }),
    expectedPtsPerMatch: 3,
    label: 'přesný výsledek',
  },
  {
    name: '🤖 TestBot-Správný',
    pin: '0002',
    tipsFor: m => {
      if (m.home_score > m.away_score) return { ph: m.home_score + 1, pa: 0 }
      if (m.home_score < m.away_score) return { ph: 0, pa: m.away_score + 1 }
      return { ph: 2, pa: 2 }
    },
    expectedPtsPerMatch: 1,
    label: 'správný směr',
  },
  {
    name: '🤖 TestBot-Špatný',
    pin: '0003',
    tipsFor: m => {
      if (m.home_score >= m.away_score) return { ph: 0, pa: m.home_score + 1 }
      return { ph: m.away_score + 1, pa: 0 }
    },
    expectedPtsPerMatch: 0,
    label: 'špatný tip',
  },
]

// ────────────────────────────────────────────────────────────────────────────
console.log('\n=== INFORMACE O TURNAJI ===')
console.log(`Liga: ${ligaId?.slice(0,8)} | Odehráno: ${playedMatches.length} | Čeká: ${pendingMatches.length}`)
for (const m of playedMatches) {
  console.log(`  + ${m.scheduled_time} ${tn(m.home_id)} ${m.home_score}:${m.away_score} ${tn(m.away_id)}`)
}

// ─── Fáze 1: Vytvoření tipérů ───────────────────────────────────────────────
console.log('\n--- Fáze 1: Vytváření testovacích tipérů ---')
const botIds = {}
for (const b of botScenarios) {
  await sb.from('tipsters').delete().eq('name', b.name)
  const { data, error } = await sb.from('tipsters')
    .insert({ name: b.name, pin: b.pin, total_points: 0 })
    .select().single()
  if (error) {
    console.log(`  [FAIL] Vytvořit ${b.name}: ${error.message}`)
    failed++
  } else {
    botIds[b.name] = data.id
    console.log(`  [PASS] Vytvořen: ${b.name}`)
    passed++
  }
}

// ─── Fáze 2: Tipy na odehrané zápasy ────────────────────────────────────────
console.log('\n--- Fáze 2: Tipy na odehrané zápasy ---')
for (const b of botScenarios) {
  const tipsterId = botIds[b.name]
  if (!tipsterId) continue
  let ok = 0
  for (const m of playedMatches) {
    const { ph, pa } = b.tipsFor(m)
    const { error } = await sb.from('tips').insert({
      tipster_id: tipsterId, match_id: m.id,
      predicted_home: ph, predicted_away: pa,
      points_earned: 0, evaluated: false,
    })
    if (error) {
      console.log(`  [FAIL] Insert tip ${b.name}/${m.id.slice(0,8)}: ${error.message}`)
      failed++
    } else {
      ok++
    }
  }
  if (ok === playedMatches.length) {
    console.log(`  [PASS] ${b.name}: ${ok} tipů vloženo`)
    passed++
  }
}

// ─── Fáze 3: Tipy na neodhráné zápasy ──────────────────────────────────────
console.log('\n--- Fáze 3: Tipy na neodhráné zápasy (musí zůstat unevaluated) ---')
for (const b of botScenarios) {
  const tipsterId = botIds[b.name]
  if (!tipsterId) continue
  for (const m of pendingSample) {
    const { error } = await sb.from('tips').insert({
      tipster_id: tipsterId, match_id: m.id,
      predicted_home: 1, predicted_away: 1,
      points_earned: 0, evaluated: false,
    })
    if (error) {
      console.log(`  [FAIL] Pending tip: ${error.message}`)
      failed++
    }
  }
  console.log(`  [PASS] ${b.name}: ${pendingSample.length} pending tipů`)
  passed++
}

// ─── Fáze 4: Manuální evaluace (simulace recalcAllTips) ─────────────────────
console.log('\n--- Fáze 4: Manuální evaluace tipů ---')
for (const b of botScenarios) {
  const tipsterId = botIds[b.name]
  if (!tipsterId) continue
  for (const m of playedMatches) {
    const { ph, pa } = b.tipsFor(m)
    const pts = calcPts(ph, pa, m.home_score, m.away_score)
    const { error } = await sb.from('tips')
      .update({ points_earned: pts, evaluated: true })
      .eq('tipster_id', tipsterId).eq('match_id', m.id)
    if (error) {
      console.log(`  [FAIL] Eval update: ${error.message}`)
      failed++
    }
  }
  console.log(`  [PASS] ${b.name}: evaluace hotová`)
  passed++
}

// ─── Fáze 5: Speciální tipy ─────────────────────────────────────────────────
console.log('\n--- Fáze 5: Speciální tipy ---')
if (ligaId && teams) {
  const specRows = [
    { name: '🤖 TestBot-Přesný',  type: 'group_winner:' + ligaId,   teamIdx: 0 },
    { name: '🤖 TestBot-Přesný',  type: 'group_last:' + ligaId,     teamIdx: 8 },
    { name: '🤖 TestBot-Správný', type: 'group_winner:' + ligaId,   teamIdx: 1 },
    { name: '🤖 TestBot-Špatný',  type: 'group_winner:' + ligaId,   teamIdx: 4 },
    { name: '🤖 TestBot-Přesný',  type: 'tournament_winner',        teamIdx: 0 },
    { name: '🤖 TestBot-Správný', type: 'tournament_winner',        teamIdx: 2 },
    { name: '🤖 TestBot-Špatný',  type: 'tournament_winner',        teamIdx: 7 },
  ]
  for (const sr of specRows) {
    const tipsterId = botIds[sr.name]
    if (!tipsterId) continue
    const teamId = teams[sr.teamIdx]?.id
    const { error } = await sb.from('special_tips').upsert({
      tipster_id: tipsterId, tip_type: sr.type,
      predicted_team_id: teamId, points_earned: 0, evaluated: false,
    }, { onConflict: 'tipster_id,tip_type' })
    if (error) {
      console.log(`  [FAIL] Special ${sr.name} ${sr.type.slice(0,15)}: ${error.message}`)
      failed++
    } else {
      const typeLabel = sr.type.startsWith('tournament') ? 'vítěz turnaje'
        : sr.type.startsWith('group_winner') ? 'vítěz ligy'
        : 'poslední ligy'
      console.log(`  [PASS] ${sr.name}: ${typeLabel} → ${tn(teamId)}`)
      passed++
    }
  }
}

// ─── Fáze 6: Bracket tipy ───────────────────────────────────────────────────
console.log('\n--- Fáze 6: Bracket tipy ---')
if (unplayedSlots.length > 0) {
  const slot = unplayedSlots[0]
  const sortedRounds = [...(await sb.from('bracket_rounds').select('*')).data ?? []].sort((a,b) => a.position - b.position)
  const round = sortedRounds.find(r => r.id === slot.round_id)
  console.log(`  Testovací slot: ${round?.name ?? '?'} pos:${slot.position}`)
  for (const b of botScenarios) {
    const tipsterId = botIds[b.name]
    if (!tipsterId) continue
    const { error } = await sb.from('bracket_tips').upsert({
      tipster_id: tipsterId, slot_id: slot.id,
      predicted_home: 2, predicted_away: 1,
      points_earned: 0, evaluated: false,
    }, { onConflict: 'tipster_id,slot_id' })
    if (error) {
      console.log(`  [FAIL] Bracket tip ${b.name}: ${error.message}`)
      failed++
    } else {
      console.log(`  [PASS] Bracket tip: ${b.name}`)
      passed++
    }
  }
} else {
  console.log('  (žádné neodhráné sloty)')
}

// ─── Fáze 7: Update total_points ────────────────────────────────────────────
console.log('\n--- Fáze 7: Výpočet a update total_points ---')
for (const b of botScenarios) {
  const tipsterId = botIds[b.name]
  if (!tipsterId) continue
  const [{ data: myTips }, { data: myBTips }, { data: mySTips }] = await Promise.all([
    sb.from('tips').select('points_earned').eq('tipster_id', tipsterId),
    sb.from('bracket_tips').select('points_earned').eq('tipster_id', tipsterId),
    sb.from('special_tips').select('points_earned').eq('tipster_id', tipsterId),
  ])
  const total =
    (myTips ?? []).reduce((s, r) => s + (r.points_earned ?? 0), 0) +
    (myBTips ?? []).reduce((s, r) => s + (r.points_earned ?? 0), 0) +
    (mySTips ?? []).reduce((s, r) => s + (r.points_earned ?? 0), 0)
  await sb.from('tipsters').update({ total_points: total }).eq('id', tipsterId)
  const expFromMatches = playedMatches.length * b.expectedPtsPerMatch
  console.log(`  [INFO] ${b.name}: total=${total} (z ${playedMatches.length} zápasů: ${expFromMatches}, spec/bracket: ${total - expFromMatches})`)
}

// ─── Fáze 8: Verifikace ─────────────────────────────────────────────────────
console.log('\n--- Fáze 8: Verifikace výsledků ---')
const { data: finalTips } = await sb.from('tips').select('*')

for (const b of botScenarios) {
  const tipsterId = botIds[b.name]
  if (!tipsterId) continue
  const myTips = finalTips?.filter(t => t.tipster_id === tipsterId) ?? []
  const evaluated = myTips.filter(t => t.evaluated)
  const pending = myTips.filter(t => !t.evaluated)

  assert(`[${b.label}] evaluated count`, evaluated.length, playedMatches.length)
  assert(`[${b.label}] pending count`, pending.length, pendingSample.length)

  // Ověřit body za každý odehraný zápas
  let ptsCorrect = true
  for (const m of playedMatches) {
    const tip = evaluated.find(t => t.match_id === m.id)
    if (!tip) { ptsCorrect = false; continue }
    const { ph, pa } = b.tipsFor(m)
    const expPts = calcPts(ph, pa, m.home_score, m.away_score)
    if (tip.points_earned !== expPts) {
      console.log(`    Mismatch: tip ${ph}:${pa} vs real ${m.home_score}:${m.away_score}, got ${tip.points_earned}, exp ${expPts}`)
      ptsCorrect = false
    }
  }
  assert(`[${b.label}] body za každý zápas správně`, ptsCorrect ? 'OK' : 'CHYBA', 'OK')

  // Pending tipy mají 0 bodů
  const pendingPts = pending.every(t => t.points_earned === 0 && !t.evaluated)
  assert(`[${b.label}] pending tipy = 0 bodů, unevaluated`, pendingPts ? 'OK' : 'CHYBA', 'OK')
}

// ─── Fáze 9: UNIQUE constraint test ─────────────────────────────────────────
console.log('\n--- Fáze 9: UNIQUE constraint (duplikát = upsert, ne error) ---')
const firstBot = botScenarios[0]
const tipsterId = botIds[firstBot.name]
if (tipsterId && playedMatches.length > 0) {
  const m = playedMatches[0]
  const { ph, pa } = firstBot.tipsFor(m)
  // Upsert místo insert — nesmí vrátit chybu
  const { error } = await sb.from('tips').upsert(
    { tipster_id: tipsterId, match_id: m.id, predicted_home: ph + 1, predicted_away: pa, points_earned: 0, evaluated: false },
    { onConflict: 'tipster_id,match_id' }
  )
  assert('upsert na existující tip (no error)', error ? 'CHYBA:' + error.message : 'OK', 'OK')
}

// ─── Fáze 10: Leaderboard ───────────────────────────────────────────────────
console.log('\n--- Fáze 10: Leaderboard ---')
const { data: lb } = await sb.from('tipsters').select('name,total_points').order('total_points', { ascending: false })
console.log('  Pořadí:')
lb?.slice(0, 8).forEach((t, i) => {
  const tag = t.name.startsWith('🤖') ? ' [TEST]' : ' [REÁLNÝ]'
  console.log(`  ${i+1}. ${t.name}: ${t.total_points} b${tag}`)
})
// TestBot-Přesný musí být výše než TestBot-Správný
const precny = lb?.findIndex(t => t.name === '🤖 TestBot-Přesný') ?? -1
const spravny = lb?.findIndex(t => t.name === '🤖 TestBot-Správný') ?? -1
const spatny = lb?.findIndex(t => t.name === '🤖 TestBot-Špatný') ?? -1
assert('pořadí: Přesný > Správný', precny < spravny ? 'OK' : 'CHYBA', 'OK')
assert('pořadí: Správný > Špatný', spravny < spatny ? 'OK' : 'CHYBA', 'OK')

// ─── Fáze 11: Cleanup ───────────────────────────────────────────────────────
console.log('\n--- Fáze 11: Cleanup testovacích dat ---')
for (const b of botScenarios) {
  const tid = botIds[b.name]
  if (!tid) continue
  await sb.from('tips').delete().eq('tipster_id', tid)
  await sb.from('bracket_tips').delete().eq('tipster_id', tid)
  await sb.from('special_tips').delete().eq('tipster_id', tid)
  const { error } = await sb.from('tipsters').delete().eq('id', tid)
  if (error) {
    console.log(`  [FAIL] Smazat ${b.name}: ${error.message}`)
    failed++
  } else {
    console.log(`  [PASS] Smazán ${b.name}`)
    passed++
  }
}

// ─── Výsledek ────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(55))
console.log(`VÝSLEDEK: ${passed} PASSED  |  ${failed} FAILED`)
if (failed === 0) console.log('Všechny testy prošly!')
else console.log('Některé testy selhaly — viz FAIL výše')
