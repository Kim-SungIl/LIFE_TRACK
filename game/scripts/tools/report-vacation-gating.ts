// 방학 게이팅 진단 — "방학이 심심하다"의 코드적 원인을 정량화
//
// 가설: GAME_EVENTS 다수가 `!s.isVacation` 가드를 갖고 있어,
//      방학 주(W20~24, W43~48)에는 발화 가능 풀 자체가 작다.
//
// 측정:
//   1. 정적 — 각 이벤트의 condition.toString()을 스캔하여 분류
//   2. 동적 — 모든 NPC를 met/intimacy=50으로 채운 합성 state로
//             각 (year, week)에서 condition(state)를 통과하는 이벤트 수 집계
//
// 실행: cd game && npx tsx scripts/report-vacation-gating.ts

import { GAME_EVENTS } from '../../src/engine/events';
import { createInitialState } from '../../src/engine/gameEngine';
import type { GameState, GameEvent } from '../../src/engine/types';

// ===== 학사 일정 (gameEngine.ts:110-113) =====
// W1-19: 1학기, W20-24: 여름방학, W25-42: 2학기, W43-48: 겨울방학
function isVacationWeek(week: number): boolean {
  return (week >= 20 && week <= 24) || (week >= 43 && week <= 48);
}
function semesterInfo(week: number) {
  if (week <= 19) return { semester: 1 as const, isVacation: false };
  if (week <= 24) return { semester: 1 as const, isVacation: true };
  if (week <= 42) return { semester: 2 as const, isVacation: false };
  return { semester: 2 as const, isVacation: true };
}

// ===== 1. 정적 분석 — condition 함수 본문 스캔 =====
type VacationKind = 'blocks-vacation' | 'requires-vacation' | 'agnostic' | 'no-condition';

function classifyVacation(e: GameEvent): VacationKind {
  if (!e.condition) return 'no-condition';
  const src = e.condition.toString();
  // `!s.isVacation` 또는 `!state.isVacation` 또는 `s.isVacation === false`
  const blocks = /!\s*\w+\.isVacation/.test(src) || /\.isVacation\s*===\s*false/.test(src);
  // `s.isVacation` (negation 없이) — 방학 전용
  const requiresMatch = /(?<![!])\b\w+\.isVacation\b/.test(src);
  if (blocks && !requiresMatch) return 'blocks-vacation';
  if (blocks && requiresMatch) return 'blocks-vacation'; // negation이 우선
  if (requiresMatch) return 'requires-vacation';
  return 'agnostic';
}

function staticReport() {
  const counts: Record<VacationKind, number> = {
    'blocks-vacation': 0,
    'requires-vacation': 0,
    'agnostic': 0,
    'no-condition': 0,
  };
  const fixedWeekStats = { semester: 0, vacation: 0, anyTime: 0 };
  for (const e of GAME_EVENTS) {
    counts[classifyVacation(e)]++;
    if (e.week !== undefined) {
      if (isVacationWeek(e.week)) fixedWeekStats.vacation++;
      else fixedWeekStats.semester++;
    } else {
      fixedWeekStats.anyTime++;
    }
  }
  console.log('===== [정적] 이벤트 condition 분류 =====');
  console.log(`총 이벤트: ${GAME_EVENTS.length}`);
  console.log(`  blocks-vacation (!isVacation 가드): ${counts['blocks-vacation']}`);
  console.log(`  requires-vacation (방학 전용):       ${counts['requires-vacation']}`);
  console.log(`  agnostic (방학 언급 없음):           ${counts['agnostic']}`);
  console.log(`  no-condition (항상 조건 통과):       ${counts['no-condition']}`);
  console.log('');
  console.log('===== [정적] 고정 주차(week 필드) 분포 =====');
  console.log(`  학기 중 고정 주(W1-19, W25-42): ${fixedWeekStats.semester}`);
  console.log(`  방학 중 고정 주(W20-24, W43-48): ${fixedWeekStats.vacation}`);
  console.log(`  주차 미지정 (조건부 발화):       ${fixedWeekStats.anyTime}`);
  console.log('');
}

// ===== 2. 동적 분석 — 합성 state로 (year, week)별 발화 가능 풀 측정 =====
function makeSyntheticState(year: number, week: number): GameState {
  // "최적 NPC 만남 시나리오" — 모든 NPC met, intimacy 50
  const s = createInitialState('male', ['info', 'emotional']);
  s.year = year;
  s.week = week;
  const info = semesterInfo(week);
  s.semester = info.semester;
  s.isVacation = info.isVacation;
  // 모든 NPC met + 친밀도 충분
  s.npcs = s.npcs.map(n => ({
    ...n,
    met: true,
    intimacy: 50,
    weeksSinceContact: 0,
  }));
  // 스탯 50
  s.stats = { academic: 50, social: 50, talent: 50, mental: 50, health: 50 };
  s.fatigue = 30;
  s.money = 30;
  // 진척용
  s.totalWeeksPlayed = (year - 1) * 48 + week - 1;
  s.events = []; // 모든 이벤트가 "아직 미발동"이라고 가정
  return s;
}

function eligibleAt(year: number, week: number): GameEvent[] {
  const s = makeSyntheticState(year, week);
  return GAME_EVENTS.filter(e => {
    if (e.week !== undefined && e.week !== week) return false;
    if (!e.condition) return e.week === week; // 주차 고정만 통과
    try {
      return e.condition(s);
    } catch {
      return false;
    }
  });
}

function dynamicReport() {
  console.log('===== [동적] 학년별 × 주차별 발화 가능 이벤트 수 =====');
  console.log('  (모든 NPC met / intimacy 50 / 스탯 50 / 미발동 가정의 상한)');
  console.log('');
  console.log('학년 | 1학기평균 | 여름방학평균 | 2학기평균 | 겨울방학평균 | (방학/학기 비)');
  console.log('-----|-----------|--------------|-----------|--------------|---------------');

  for (let year = 1; year <= 7; year++) {
    const buckets = { sem1: [] as number[], sumVac: [] as number[], sem2: [] as number[], winVac: [] as number[] };
    for (let w = 1; w <= 48; w++) {
      const n = eligibleAt(year, w).length;
      if (w <= 19) buckets.sem1.push(n);
      else if (w <= 24) buckets.sumVac.push(n);
      else if (w <= 42) buckets.sem2.push(n);
      else buckets.winVac.push(n);
    }
    const avg = (a: number[]) => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : '0';
    const semAvg = ([...buckets.sem1, ...buckets.sem2].reduce((x, y) => x + y, 0)) / 37;
    const vacAvg = ([...buckets.sumVac, ...buckets.winVac].reduce((x, y) => x + y, 0)) / 11;
    const ratio = semAvg > 0 ? (vacAvg / semAvg * 100).toFixed(0) : '—';
    console.log(`Y${year}   |   ${avg(buckets.sem1).padStart(5)}   |    ${avg(buckets.sumVac).padStart(5)}     |   ${avg(buckets.sem2).padStart(5)}   |    ${avg(buckets.winVac).padStart(5)}     | ${ratio}%`);
  }
  console.log('');

  // 가장 빈약한 방학 주 TOP 10
  const allVacWeeks: { year: number; week: number; n: number; ids: string[] }[] = [];
  for (let year = 1; year <= 7; year++) {
    for (let w = 1; w <= 48; w++) {
      if (!isVacationWeek(w)) continue;
      const events = eligibleAt(year, w);
      allVacWeeks.push({ year, week: w, n: events.length, ids: events.map(e => e.id) });
    }
  }
  allVacWeeks.sort((a, b) => a.n - b.n);
  console.log('===== [동적] 가장 빈약한 방학 주 TOP 10 =====');
  for (const w of allVacWeeks.slice(0, 10)) {
    const seg = w.week <= 24 ? '여름방학' : '겨울방학';
    console.log(`  Y${w.year} W${w.week} (${seg} ${w.week <= 24 ? w.week - 19 : w.week - 42}주차) — ${w.n}개  ${w.ids.length ? '[' + w.ids.slice(0, 3).join(', ') + (w.ids.length > 3 ? '...' : '') + ']' : ''}`);
  }
  console.log('');

  // 방학에 발화 가능한 이벤트 ID 목록 (전 학년 합집합)
  const vacIds = new Set<string>();
  for (let year = 1; year <= 7; year++) {
    for (let w = 1; w <= 48; w++) {
      if (!isVacationWeek(w)) continue;
      eligibleAt(year, w).forEach(e => vacIds.add(e.id));
    }
  }
  console.log(`===== [동적] 방학 주에 한 번이라도 발화 가능한 이벤트 ID (${vacIds.size}개) =====`);
  Array.from(vacIds).sort().forEach(id => console.log(`  - ${id}`));
  console.log('');
}

// ===== 3. 권고 =====
function recommendation() {
  const total = GAME_EVENTS.length;
  const blocks = GAME_EVENTS.filter(e => classifyVacation(e) === 'blocks-vacation').length;
  const requires = GAME_EVENTS.filter(e => classifyVacation(e) === 'requires-vacation').length;
  console.log('===== 진단 요약 =====');
  console.log(`전체 ${total}개 중 ${blocks}개(${(blocks / total * 100).toFixed(0)}%)가 방학 차단 가드를 가짐.`);
  console.log(`방학 전용 이벤트는 ${requires}개.`);
  if (blocks / total > 0.3 && requires < 5) {
    console.log('→ 가설 확인: 방학 주에 발화 가능 풀이 의도된 것보다 더 작을 가능성. 방학 전용 분기/마이크로 이벤트 신설 검토.');
  } else {
    console.log('→ 방학 게이팅이 가설만큼 광범위하지 않음. 다른 원인(텍스트 변주, 활동 단조로움) 의심.');
  }
}

// 실행
staticReport();
dynamicReport();
recommendation();
