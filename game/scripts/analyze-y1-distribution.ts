/**
 * 학년별 이벤트 분포 분석 (Y1~Y7)
 *  - 고정 이벤트 (week 정해짐)
 *  - 조건부 이벤트 (week 없음, condition으로 발동)
 *  - NPC별 발동 가능 이벤트 수
 *  - intimacy 임계점 분포
 *
 * 실행:
 *   cd game && npx tsx scripts/analyze-y1-distribution.ts          # 전 학년 요약
 *   cd game && npx tsx scripts/analyze-y1-distribution.ts 1        # Y1 상세
 *   cd game && npx tsx scripts/analyze-y1-distribution.ts 1 7      # Y1~Y7 상세
 */

import { GAME_EVENTS } from '../src/engine/events';
import { createInitialState } from '../src/engine/gameEngine';
import type { GameState } from '../src/engine/types';

const NPC_IDS = ['jihun', 'subin', 'minjae', 'yuna', 'doyun', 'haeun', 'junha'];

function makeState(year: number, intimacyAll = 100): GameState {
  const s = createInitialState('male', ['emotional', 'wealth']);
  s.year = year;
  s.week = 20;
  for (const npc of s.npcs) {
    npc.met = true;
    npc.intimacy = intimacyAll;
  }
  return s;
}

function inferIntimacyThreshold(condStr: string): number | null {
  const m = condStr.match(/intimacy\s*>=?\s*(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function inferNpc(event: { speakers?: string[] }, condStr: string): string | null {
  if (event.speakers && event.speakers.length > 0) {
    const npc = event.speakers.find((s: string) => NPC_IDS.includes(s));
    if (npc) return npc;
  }
  for (const npc of NPC_IDS) {
    if (condStr.includes(`'${npc}'`) || condStr.includes(`"${npc}"`)) return npc;
  }
  return null;
}

interface YearStats {
  year: number;
  fixed: Array<{ id: string; title: string; week: number; npc: string | null }>;
  conditional: Array<{ id: string; title: string; npc: string | null; threshold: number | null }>;
  conditionalNonNpc: Array<{ id: string; title: string }>;
}

function analyzeYear(year: number): YearStats {
  const sHi = makeState(year, 100);
  const fixed: YearStats['fixed'] = [];
  const conditional: YearStats['conditional'] = [];
  const conditionalNonNpc: YearStats['conditionalNonNpc'] = [];

  for (const ev of GAME_EVENTS) {
    if (ev.week !== undefined) {
      let firesThisYear = true;
      if (ev.condition) {
        try { firesThisYear = ev.condition(sHi); } catch { firesThisYear = false; }
      }
      if (firesThisYear) {
        const condStr = ev.condition ? ev.condition.toString().replace(/\s+/g, ' ') : '';
        fixed.push({ id: ev.id, title: ev.title, week: ev.week, npc: inferNpc(ev, condStr) });
      }
    } else if (ev.condition) {
      const condStr = ev.condition.toString().replace(/\s+/g, ' ');
      let firesThisYear = false;
      try { firesThisYear = ev.condition(sHi); } catch { /* 의도적으로 비움: 조건 평가 실패 시 미발동으로 간주 */ }
      if (firesThisYear) {
        const npc = inferNpc(ev, condStr);
        const threshold = inferIntimacyThreshold(condStr);
        if (npc) conditional.push({ id: ev.id, title: ev.title, npc, threshold });
        else conditionalNonNpc.push({ id: ev.id, title: ev.title });
      }
    }
  }
  return { year, fixed, conditional, conditionalNonNpc };
}

function printDetailed(stats: YearStats) {
  const { year, fixed, conditional, conditionalNonNpc } = stats;
  console.log(`\n=== Y${year} 상세 ===`);

  console.log(`\n[고정 이벤트] ${fixed.length}개`);
  const fixedByNpc: Record<string, typeof fixed> = {};
  for (const f of fixed) {
    const key = f.npc ?? '(공통)';
    (fixedByNpc[key] ??= []).push(f);
  }
  for (const [npc, list] of Object.entries(fixedByNpc).sort()) {
    console.log(`  ${npc}: ${list.length}개`);
    for (const f of list.sort((a, b) => a.week - b.week)) {
      console.log(`    W${f.week.toString().padStart(2)}  ${f.id}  — ${f.title}`);
    }
  }

  console.log(`\n[NPC 도달형] ${conditional.length}개`);
  const condByNpc: Record<string, typeof conditional> = {};
  for (const c of conditional) (condByNpc[c.npc!] ??= []).push(c);
  for (const npc of NPC_IDS) {
    const list = condByNpc[npc] || [];
    if (list.length === 0) continue;
    console.log(`  ${npc}: ${list.length}개`);
    for (const c of list.sort((a, b) => (a.threshold ?? 0) - (b.threshold ?? 0))) {
      console.log(`    intimacy≥${(c.threshold ?? '?').toString().padStart(3)}  ${c.id}  — ${c.title}`);
    }
  }

  if (conditionalNonNpc.length > 0) {
    console.log(`\n[NPC 무관 조건부] ${conditionalNonNpc.length}개`);
    for (const c of conditionalNonNpc.slice(0, 20)) {
      console.log(`    ${c.id}  — ${c.title}`);
    }
    if (conditionalNonNpc.length > 20) console.log(`    ... +${conditionalNonNpc.length - 20}`);
  }
}

function printAllYearsSummary(allStats: YearStats[]) {
  console.log('=== 전 학년 분포 요약 ===\n');

  // 헤더
  const header = ['Year', '고정', '도달형', '기타조건', '합계', ...NPC_IDS];
  const widths = [4, 4, 6, 8, 4, ...NPC_IDS.map(() => 7)];
  console.log(header.map((h, i) => h.padEnd(widths[i])).join(' | '));
  console.log(widths.map(w => '-'.repeat(w)).join('-+-'));

  for (const s of allStats) {
    const fixedCount = s.fixed.length;
    const condCount = s.conditional.length;
    const nonNpcCount = s.conditionalNonNpc.length;
    const total = fixedCount + condCount + nonNpcCount;

    const npcCounts: Record<string, number> = {};
    for (const n of NPC_IDS) npcCounts[n] = 0;
    for (const f of s.fixed) if (f.npc) npcCounts[f.npc]++;
    for (const c of s.conditional) if (c.npc) npcCounts[c.npc]++;

    const row = [
      `Y${s.year}`,
      String(fixedCount),
      String(condCount),
      String(nonNpcCount),
      String(total),
      ...NPC_IDS.map(n => npcCounts[n] === 0 ? '-' : String(npcCounts[n])),
    ];
    console.log(row.map((c, i) => c.padEnd(widths[i])).join(' | '));
  }

  console.log('\n--- 학년별 도달형 임계점 분포 ---');
  for (const s of allStats) {
    const tBuckets: Record<string, number> = {};
    for (const c of s.conditional) {
      const key = c.threshold === null ? '?' : `≥${c.threshold}`;
      tBuckets[key] = (tBuckets[key] || 0) + 1;
    }
    const summary = Object.entries(tBuckets)
      .sort((a, b) => parseInt(a[0].replace(/[^\d]/g, '')) - parseInt(b[0].replace(/[^\d]/g, '')))
      .map(([k, v]) => `${k}:${v}`).join(' ');
    console.log(`  Y${s.year}: ${summary || '(도달형 없음)'}`);
  }
}

// === 실행 ===
const args = process.argv.slice(2);
if (args.length === 0) {
  // 전 학년 요약
  const allStats = [1, 2, 3, 4, 5, 6, 7].map(analyzeYear);
  printAllYearsSummary(allStats);
} else if (args.length === 1) {
  const year = parseInt(args[0], 10);
  printDetailed(analyzeYear(year));
} else {
  const [from, to] = args.map(a => parseInt(a, 10));
  for (let y = from; y <= to; y++) {
    printDetailed(analyzeYear(y));
  }
}
