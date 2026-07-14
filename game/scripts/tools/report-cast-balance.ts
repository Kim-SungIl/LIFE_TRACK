/**
 * 캐스트 밸런스 정적 리포트 — balance-review-brief.md 항목 ①③④⑤⑥의 데이터 기반.
 * reach/reachMid/reachHigh/reachNew tier 사다리, mini 이벤트 임계, memorySlotDraft 분포,
 * 학년별 reach 부하(주당 1픽 대비), 데뷔/시작 친밀도를 GAME_EVENTS·miniEvents에서 추출해 표로 출력.
 *
 * 실행: cd game && npx tsx scripts/tools/report-cast-balance.ts
 */
import { GAME_EVENTS } from '../../src/engine/events';
import { NPC_MINI_EVENTS } from '../../src/engine/talkData/miniEvents';
import { createInitialState } from '../../src/engine/gameEngine';
import type { EventChoice } from '../../src/engine/types';

const NPC_ORDER = ['jihun', 'subin', 'minjae', 'yuna', 'doyun', 'haeun', 'seoa', 'junha', 'siwoo', 'yerin'];

// ===== 0. 로스터 (데뷔·시작 친밀도) =====
const init = createInitialState('male', ['emotional', 'freedom'], { rngSeed: 1 });
console.log('=== 0. 로스터 — 시작 친밀도/met ===');
for (const id of NPC_ORDER) {
  const n = init.npcs.find(x => x.id === id);
  if (n) console.log(`  ${id.padEnd(7)} intimacy=${String(n.intimacy).padStart(3)}  met=${n.met}`);
}

// ===== 1. reach tier 사다리 (npc × year) =====
const reachEvents = GAME_EVENTS.filter(e => e.reach);
console.log(`\n=== 1. reach tier 사다리 (총 ${reachEvents.length}컷) ===`);
for (const id of NPC_ORDER) {
  const rows = reachEvents
    .filter(e => e.reach!.npc === id)
    .sort((a, b) => (a.reach!.year - b.reach!.year) || (a.reach!.tier - b.reach!.tier));
  if (rows.length === 0) continue;
  const byYear: Record<number, number[]> = {};
  for (const r of rows) (byYear[r.reach!.year] ??= []).push(r.reach!.tier);
  const line = Object.entries(byYear).map(([y, ts]) => `Y${y}:[${ts.join(',')}]`).join(' ');
  console.log(`  ${id.padEnd(7)} (${String(rows.length).padStart(2)}컷) ${line}`);
}

// ===== 2. 학년별 reach 부하 — 주당 1픽 + 학기 주 수 대비 =====
console.log('\n=== 2. 학년별 reach 총량 (주당 1픽, 학기 ~37주/년 대비) ===');
const perYear: Record<number, { total: number; byNpc: Record<string, number> }> = {};
for (const e of reachEvents) {
  const y = e.reach!.year;
  perYear[y] ??= { total: 0, byNpc: {} };
  perYear[y].total++;
  perYear[y].byNpc[e.reach!.npc] = (perYear[y].byNpc[e.reach!.npc] ?? 0) + 1;
}
for (let y = 1; y <= 7; y++) {
  const p = perYear[y];
  if (!p) continue;
  const detail = NPC_ORDER.filter(n => p.byNpc[n]).map(n => `${n}:${p.byNpc[n]}`).join(' ');
  console.log(`  Y${y}: ${String(p.total).padStart(2)}컷  (${detail})`);
}

// ===== 3. mini 이벤트 임계 사다리 (npc × intimacyMin, 학년 게이트) =====
console.log('\n=== 3. mini 이벤트 임계 (npc × intimacyMin [yearMin~yearMax]) ===');
for (const id of NPC_ORDER) {
  const rows = NPC_MINI_EVENTS.filter(e => e.npcId === id)
    .sort((a, b) => (a.intimacyMin ?? 0) - (b.intimacyMin ?? 0));
  if (rows.length === 0) { console.log(`  ${id.padEnd(7)} (0개) ⚠`); continue; }
  const line = rows.map(e => {
    const yr = e.yearMin || e.yearMax ? `[Y${e.yearMin ?? 1}~${e.yearMax ?? 7}]` : '';
    const g = e.gender ? `(${e.gender[0]})` : '';
    return `${e.intimacyMin ?? 0}${yr}${g}`;
  }).join(' ');
  console.log(`  ${id.padEnd(7)} (${rows.length}개) ${line}`);
}

// ===== 4. memorySlotDraft 분포 (후회카드 풀 쏠림) =====
console.log('\n=== 4. memorySlotDraft 분포 — 이벤트 선택지 + 미니톡 ===');
type DraftRow = { npc: string; importance: number; tone: string; category: string; src: string };
const drafts: DraftRow[] = [];
for (const e of GAME_EVENTS) {
  const allChoices: EventChoice[] = [...(e.choices ?? []), ...(e.femaleChoices ?? [])];
  for (const c of allChoices) {
    const d = c.memorySlotDraft;
    if (!d) continue;
    for (const npc of (d.npcIds?.length ? d.npcIds : ['(none)'])) {
      drafts.push({ npc, importance: d.importance, tone: d.toneTag ?? '-', category: d.category, src: e.reach ? 'reach' : 'event' });
    }
  }
}
for (const m of NPC_MINI_EVENTS) {
  // 미니톡 choices의 memorySlotDraft
  for (const c of (m.choices ?? []) as { memorySlotDraft?: { importance: number; toneTag?: string; category: string; npcIds?: string[] } }[]) {
    const d = c.memorySlotDraft;
    if (!d) continue;
    for (const npc of (d.npcIds?.length ? d.npcIds : [m.npcId ?? '(none)'])) {
      drafts.push({ npc, importance: d.importance, tone: d.toneTag ?? '-', category: d.category, src: 'mini' });
    }
  }
}
console.log(`  총 draft ${drafts.length}개 (reach ${drafts.filter(d => d.src === 'reach').length} / event ${drafts.filter(d => d.src === 'event').length} / mini ${drafts.filter(d => d.src === 'mini').length})`);
for (const id of [...NPC_ORDER, '(none)']) {
  const rows = drafts.filter(d => d.npc === id);
  if (rows.length === 0) continue;
  const avgImp = (rows.reduce((a, r) => a + r.importance, 0) / rows.length).toFixed(1);
  const hi = rows.filter(r => r.importance >= 7).length;
  const tones: Record<string, number> = {};
  for (const r of rows) tones[r.tone] = (tones[r.tone] ?? 0) + 1;
  const toneStr = Object.entries(tones).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t}:${c}`).join(' ');
  console.log(`  ${id.padEnd(7)} n=${String(rows.length).padStart(3)}  평균imp=${avgImp}  imp7+=${String(hi).padStart(2)}  [${toneStr}]`);
}

// ===== 5. NPC별 이벤트 친밀도 수입원 (선택지 최대 intimacyChange 합, 학년별) =====
console.log('\n=== 5. 이벤트 친밀도 수입 상한 — 학년별 Σmax(intimacyChange) (감쇠 전 raw) ===');
for (const id of NPC_ORDER) {
  const byYear: Record<string, number> = {};
  for (const e of GAME_EVENTS) {
    const allChoices: EventChoice[] = [...(e.choices ?? []), ...(e.femaleChoices ?? [])];
    let best = 0;
    for (const c of allChoices) {
      for (const ne of c.npcEffects ?? []) {
        if (ne.npcId === id) best = Math.max(best, ne.intimacyChange ?? 0);
      }
    }
    if (best <= 0) continue;
    // 발동 학년 추정: reach.year > 고정 week+condition 학년은 미상 → 'any'
    const yKey = e.reach ? `Y${e.reach.year}` : 'any';
    byYear[yKey] = (byYear[yKey] ?? 0) + best;
  }
  const line = Object.entries(byYear).sort().map(([y, v]) => `${y}:+${v}`).join(' ');
  if (line) console.log(`  ${id.padEnd(7)} ${line}`);
}
