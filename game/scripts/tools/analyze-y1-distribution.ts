/**
 * Y1 (초6) 이벤트 분포 분석
 *  - 고정 이벤트 (week 정해짐)
 *  - 조건부 이벤트 (week 없음, condition으로 발동)
 *  - NPC별 발동 가능 이벤트 수
 *  - intimacy 임계점 분포
 *
 * 실행: cd game && npx tsx scripts/analyze-y1-distribution.ts
 */

import { GAME_EVENTS } from '../../src/engine/events';
import { createInitialState } from '../../src/engine/gameEngine';
import type { GameState } from '../../src/engine/types';

const NPC_IDS = ['jihun', 'subin', 'minjae', 'yuna', 'doyun', 'haeun', 'junha'];

function makeY1State(intimacyAll = 0): GameState {
  const s = createInitialState('male', ['emotional', 'wealth']);
  s.year = 1;
  s.week = 20;
  for (const npc of s.npcs) {
    npc.met = true;
    npc.intimacy = intimacyAll;
  }
  return s;
}

function inferIntimacyThreshold(condStr: string): number | null {
  // intimacy >= N 패턴 찾기
  const m = condStr.match(/intimacy\s*>=?\s*(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function inferNpc(event: any, condStr: string): string | null {
  if (event.speakers && event.speakers.length > 0) {
    const npc = event.speakers.find((s: string) => NPC_IDS.includes(s));
    if (npc) return npc;
  }
  for (const npc of NPC_IDS) {
    if (condStr.includes(`'${npc}'`) || condStr.includes(`"${npc}"`)) return npc;
  }
  return null;
}

// 1. 고정 (week 있음, Y1 발동)
const fixed: Array<{ id: string; title: string; week: number; npc: string | null }> = [];
const conditional: Array<{ id: string; title: string; npc: string | null; threshold: number | null; condRaw: string }> = [];
const conditionalNonNpc: Array<{ id: string; title: string; condRaw: string }> = [];

const sHi = makeY1State(100);

for (const ev of GAME_EVENTS) {
  if (ev.week !== undefined) {
    // 고정 — 조건이 있으면 Y1에서 통과하는지 확인
    let firesY1 = true;
    if (ev.condition) {
      try { firesY1 = ev.condition(sHi); } catch { firesY1 = false; }
    }
    if (firesY1) {
      const condStr = ev.condition ? ev.condition.toString().replace(/\s+/g, ' ') : '';
      fixed.push({ id: ev.id, title: ev.title, week: ev.week, npc: inferNpc(ev, condStr) });
    }
  } else if (ev.condition) {
    const condStr = ev.condition.toString().replace(/\s+/g, ' ');
    let firesY1 = false;
    try { firesY1 = ev.condition(sHi); } catch {}
    if (firesY1) {
      const npc = inferNpc(ev, condStr);
      const threshold = inferIntimacyThreshold(condStr);
      if (npc) conditional.push({ id: ev.id, title: ev.title, npc, threshold, condRaw: condStr.slice(0, 120) });
      else conditionalNonNpc.push({ id: ev.id, title: ev.title, condRaw: condStr.slice(0, 120) });
    }
  }
}

console.log('=== Y1 (초6) 이벤트 분포 ===\n');

console.log(`[1] 고정 이벤트 (week 지정, Y1 발동 가능): ${fixed.length}개`);
const fixedByNpc: Record<string, typeof fixed> = {};
for (const f of fixed) {
  const key = f.npc ?? '(NPC 없음)';
  (fixedByNpc[key] ??= []).push(f);
}
for (const [npc, list] of Object.entries(fixedByNpc).sort()) {
  console.log(`  ${npc}: ${list.length}개`);
  for (const f of list.sort((a, b) => a.week - b.week)) {
    console.log(`    W${f.week.toString().padStart(2)}  ${f.id}  — ${f.title}`);
  }
}

console.log(`\n[2] NPC별 조건부 도달형 이벤트 (Y1 풀): ${conditional.length}개`);
const condByNpc: Record<string, typeof conditional> = {};
for (const c of conditional) {
  (condByNpc[c.npc!] ??= []).push(c);
}
for (const npc of NPC_IDS) {
  const list = condByNpc[npc] || [];
  if (list.length === 0) continue;
  console.log(`  ${npc}: ${list.length}개`);
  for (const c of list.sort((a, b) => (a.threshold ?? 0) - (b.threshold ?? 0))) {
    console.log(`    intimacy≥${(c.threshold ?? '?').toString().padStart(3)}  ${c.id}  — ${c.title}`);
  }
}

console.log(`\n[3] NPC 무관 조건부 이벤트 (Y1 풀): ${conditionalNonNpc.length}개`);
for (const c of conditionalNonNpc.slice(0, 20)) {
  console.log(`    ${c.id}  — ${c.title}`);
}
if (conditionalNonNpc.length > 20) console.log(`    ... +${conditionalNonNpc.length - 20}`);

console.log('\n=== 요약 ===');
console.log(`고정 이벤트: ${fixed.length}개 (NPC별 분포 위 참조)`);
console.log(`도달형 이벤트 (NPC별): ${conditional.length}개`);
console.log(`기타 조건부: ${conditionalNonNpc.length}개`);
console.log(`Y1 총 발동 가능 풀 크기: ${fixed.length + conditional.length + conditionalNonNpc.length}개`);

console.log('\n--- NPC별 합산 (고정 + 도달형) ---');
for (const npc of NPC_IDS) {
  const fc = (fixedByNpc[npc] || []).length;
  const cc = (condByNpc[npc] || []).length;
  if (fc === 0 && cc === 0) continue;
  console.log(`  ${npc.padEnd(7)}: 고정 ${fc} + 도달형 ${cc} = ${fc + cc}개`);
}
