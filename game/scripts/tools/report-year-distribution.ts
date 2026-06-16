// 학년별 이벤트 분포 진단 — "Y1만 강하다"의 정량 검증
//
// 목적: 124개 이벤트가 Y1~Y7에 어떻게 흩어져 있는지 확인.
//       Y1 동결 후 다음 확장 대상(Y2 또는 Y4 같은 빈약 학년)을 식별.
//
// 실행: cd game && npx tsx scripts/report-year-distribution.ts

import { GAME_EVENTS } from '../../src/engine/events';
import { createInitialState } from '../../src/engine/gameEngine';
import type { GameState, GameEvent } from '../../src/engine/types';

// ===== 학년 적격성 분류 =====
interface EventClass {
  id: string;
  hasFixedWeek: boolean;
  fixedWeek?: number;
  yearsApplicable: number[];  // 어느 학년에서 발화 가능한가 (테스트로 검증)
  hasNpcRequirement: boolean;
  hasIntimacyRequirement: boolean;
  category: string;
}

function classifyEvent(e: GameEvent): EventClass {
  const src = e.condition?.toString() ?? '';
  const yearsApplicable: number[] = [];
  // 각 학년에서 condition 통과 가능한지 dry-run
  for (let y = 1; y <= 7; y++) {
    const s = makeSyntheticState(y, e.week ?? 10);
    let ok = true;
    if (e.condition) {
      try { ok = e.condition(s); } catch { ok = false; }
    }
    if (ok) yearsApplicable.push(y);
  }
  return {
    id: e.id,
    hasFixedWeek: e.week !== undefined,
    fixedWeek: e.week,
    yearsApplicable,
    hasNpcRequirement: /\.met/.test(src),
    hasIntimacyRequirement: /intimacy/.test(src),
    category: classifyCategory(e),
  };
}

function classifyCategory(e: GameEvent): string {
  if (/birthday|생일/.test(e.id)) return 'birthday';
  if (/burnout|crisis|jealousy|misunderstanding|panic/.test(e.id)) return 'crisis';
  if (/graduation|졸업/.test(e.id)) return 'graduation';
  if (/trip|수학여행|소풍/.test(e.id)) return 'trip';
  if (/exam|시험|test/.test(e.id)) return 'exam';
  if (/meet|만남|첫/.test(e.id)) return 'npc-intro';
  if (e.speakers && e.speakers.length > 0) return 'npc-relation';
  return 'other';
}

function makeSyntheticState(year: number, week: number): GameState {
  const s = createInitialState('male', ['info', 'emotional']);
  s.year = year;
  s.week = week;
  if (week <= 19) { s.semester = 1; s.isVacation = false; }
  else if (week <= 24) { s.semester = 1; s.isVacation = true; }
  else if (week <= 42) { s.semester = 2; s.isVacation = false; }
  else { s.semester = 2; s.isVacation = true; }
  s.npcs = s.npcs.map(n => ({ ...n, met: true, intimacy: 50, weeksSinceContact: 0 }));
  s.stats = { academic: 50, social: 50, talent: 50, mental: 50, health: 50 };
  s.fatigue = 30;
  s.money = 30;
  s.totalWeeksPlayed = (year - 1) * 48 + week - 1;
  s.events = [];
  return s;
}

// ===== 메인 리포트 =====
function main() {
  const classified = GAME_EVENTS.map(classifyEvent);

  // 1. 학년별 적격 이벤트 수 (W=10 기준 — 학기 중 평균적 시점)
  console.log('===== [1] 학년별 적격 이벤트 수 (학기 중 W10 기준) =====\n');
  const perYear: Record<number, EventClass[]> = {};
  for (const c of classified) {
    for (const y of c.yearsApplicable) {
      if (!perYear[y]) perYear[y] = [];
      perYear[y].push(c);
    }
  }
  console.log('학년 | 적격 이벤트 | NPC 필요 | 친밀도 필요 | 카테고리 분포');
  console.log('-----|-------------|----------|-------------|----------------------------------');
  for (let y = 1; y <= 7; y++) {
    const list = perYear[y] ?? [];
    const npc = list.filter(c => c.hasNpcRequirement).length;
    const intim = list.filter(c => c.hasIntimacyRequirement).length;
    const catCount: Record<string, number> = {};
    for (const c of list) catCount[c.category] = (catCount[c.category] || 0) + 1;
    const catStr = Object.entries(catCount).sort(([, a], [, b]) => b - a)
      .map(([k, n]) => `${k}=${n}`).join(' ');
    console.log(`Y${y}   |     ${String(list.length).padStart(3)}     |    ${String(npc).padStart(3)}   |     ${String(intim).padStart(3)}     | ${catStr}`);
  }

  // 2. Y1 전용 이벤트 식별
  console.log('\n===== [2] Y1 전용 이벤트 (다른 학년에서 발화 불가) =====');
  const y1Only = classified.filter(c => c.yearsApplicable.length === 1 && c.yearsApplicable[0] === 1);
  console.log(`총 ${y1Only.length}개:`);
  y1Only.forEach(c => console.log(`  - ${c.id} (week=${c.fixedWeek ?? '조건부'}, cat=${c.category})`));

  // 3. 학년별 "전용" 이벤트 (single-year applicable)
  console.log('\n===== [3] 각 학년별 단독 발화 이벤트 수 (Y2~Y7 빈약도 진단) =====');
  for (let y = 1; y <= 7; y++) {
    const exclusive = classified.filter(c => c.yearsApplicable.length === 1 && c.yearsApplicable[0] === y);
    console.log(`  Y${y} 단독 이벤트: ${exclusive.length}개`);
    if (exclusive.length > 0 && y >= 2) {
      exclusive.forEach(c => console.log(`    - ${c.id} (week=${c.fixedWeek ?? '조건부'}, cat=${c.category})`));
    }
  }

  // 4. 빈약 학년 식별 — Y2~Y7 중 적격 이벤트 풀이 가장 작은 학년 TOP 3
  console.log('\n===== [4] 학년별 풀 크기 비교 — Y1 동결 후 우선 보강 대상 =====');
  const yearSizes = [1, 2, 3, 4, 5, 6, 7].map(y => ({ year: y, count: (perYear[y] ?? []).length }));
  yearSizes.sort((a, b) => a.count - b.count);
  console.log('하위 3개 학년 (Y1 제외):');
  yearSizes.filter(y => y.year !== 1).slice(0, 3).forEach(y => console.log(`  Y${y.year}: ${y.count}개`));

  // 5. NPC 진척 트리거 — 각 NPC × 각 학년에서 가능한 관계 이벤트
  console.log('\n===== [5] NPC × 학년 — 관계 이벤트 가용 매트릭스 =====');
  const npcIds = ['jihun', 'subin', 'yuna', 'minjae', 'haeun', 'junha', 'doyoon', 'sora'];
  console.log(`NPC      | Y1 | Y2 | Y3 | Y4 | Y5 | Y6 | Y7`);
  console.log('---------|----|----|----|----|----|----|----');
  for (const npcId of npcIds) {
    const counts: number[] = [];
    for (let y = 1; y <= 7; y++) {
      // 해당 학년에서 발화 가능 + speakers에 npcId 포함
      const cnt = GAME_EVENTS.filter(e => {
        if (!e.speakers?.includes(npcId)) return false;
        const s = makeSyntheticState(y, e.week ?? 10);
        if (e.condition) {
          try { return e.condition(s); } catch { return false; }
        }
        return true;
      }).length;
      counts.push(cnt);
    }
    const total = counts.reduce((a, b) => a + b, 0);
    const cells = counts.map(n => String(n).padStart(2)).join(' | ');
    console.log(`${npcId.padEnd(8)} | ${cells}   (총 ${total})`);
  }

  // 6. Y2 갭 — Y2 W28 수학여행 외 Y2 전용 콘텐츠 식별
  console.log('\n===== [6] Y2 분석 (커서가 "확장하기 좋다"고 한 다음 학년) =====');
  const y2Events = (perYear[2] ?? []);
  const y2Fixed = y2Events.filter(c => c.hasFixedWeek);
  const y2Conditional = y2Events.filter(c => !c.hasFixedWeek);
  console.log(`Y2 적격 풀 ${y2Events.length}개 (고정 ${y2Fixed.length} / 조건부 ${y2Conditional.length})`);
  console.log('Y2 고정 이벤트 (주차순):');
  y2Fixed.sort((a, b) => (a.fixedWeek ?? 0) - (b.fixedWeek ?? 0))
    .forEach(c => console.log(`  W${c.fixedWeek}: ${c.id} (${c.category})`));

  // Y2 빈 주차 — 1~48 중 Y2에서 가능한 이벤트가 0개인 주
  const y2EmptyWeeks: number[] = [];
  for (let w = 1; w <= 48; w++) {
    const fired = GAME_EVENTS.filter(e => {
      if (e.week !== undefined && e.week !== w) return false;
      const s = makeSyntheticState(2, w);
      if (e.condition) { try { return e.condition(s); } catch { return false; } }
      return true;
    });
    if (fired.length === 0) y2EmptyWeeks.push(w);
  }
  console.log(`\nY2 발화 가능 이벤트 0개인 주: ${y2EmptyWeeks.length}주`);
  console.log(`  주차: ${y2EmptyWeeks.join(', ')}`);

  // 7. 결론
  console.log('\n===== 결론 =====');
  const y1 = (perYear[1] ?? []).length;
  const y2 = (perYear[2] ?? []).length;
  console.log(`Y1 풀=${y1} vs Y2 풀=${y2} → ${y1 > y2 ? `Y2가 ${y1 - y2}개 빈약` : `Y2가 ${y2 - y1}개 더 풍부`}`);
  const weakest = yearSizes.filter(y => y.year !== 1)[0];
  console.log(`Y1 동결 후 가장 빈약한 학년: Y${weakest.year} (${weakest.count}개)`);
}

main();
