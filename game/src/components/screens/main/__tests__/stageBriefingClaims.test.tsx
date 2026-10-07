// @vitest-environment jsdom
// T64 — 진학 브리핑 카드의 문장은 엔진 규칙 변화의 "고지"다. 고지가 엔진과 어긋나면 거짓말이 된다.
// 실제 사례: Y5 "학원비도 한 단계 더 올랐다" — academy yearlyCost는 중·고 3만 동일이었다.
//
// 구조: stageBriefings.ts가 문장마다 claim(무엇이 어떻게 달라지는가)을 들고 있고, 이 테스트가
//   ① claim ↔ 엔진 값 (verifyClaim)
//   ② 문장 표현 ↔ claim (auditText — "올랐"이 있는데 rises claim이 없으면 실패)
// 두 층을 본다. ①만 있으면 claim 없이 문장만 바꾼 거짓이 통과하고, ②만 있으면 claim을 지어내면 통과한다.
// 두 검사기 모두 합성 거짓 문장/거짓 claim으로 자기검사한다(검사기가 공허하면 실데이터가 초록이어도 의미 없다).
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BRIEFINGS, type BriefingClaim, type BriefingLine } from '../stageBriefings';
import { StageBriefingCard } from '../StageBriefingCard';
import { ACTIVITIES, getActivityCost } from '../../../../engine/activities';
import {
  getExamSchedule, generateExamResult, generateMockExamResult, generateSuneungResult,
} from '../../../../engine/examSystem';
import { createInitialState, getAcademicDecay, getWeekInfo } from '../../../../engine/gameEngine';
import type { ExamResult, ExamType, GameState } from '../../../../engine/types';

// ===== 상태 픽스처 =====
// academic 60 — 점수 clamp(0~100)에 안 닿는 중간값이라 컨디션 차이가 깎이지 않고 그대로 드러난다.
function stateAt(year: number, patch: Partial<GameState> = {}): GameState {
  const s = createInitialState('male', ['wealth', 'wealth'], { rngSeed: 7 });
  s.year = year;
  s.week = 1;
  s.money = 9999;
  s.stats = { ...s.stats, academic: 60, mental: 50 };
  s.fatigue = 10;
  s.mentalState = 'normal';
  return { ...s, ...patch };
}

function scheduleTypes(year: number): ExamType[] {
  return Object.values(getExamSchedule(year));
}

const activity = (id: string) => {
  const a = ACTIVITIES.find(x => x.id === id);
  if (!a) throw new Error(`없는 활동 id: ${id}`);
  return a;
};

// 같은 시드에서 잘 쉰 상태 vs 무너진 상태의 평균 점수 차 — 컨디션이 성적을 깎는 폭
function conditionGap(year: number): number {
  const examType = scheduleTypes(year).find(t => t === 'midterm' || t === 'unit-test') ?? 'midterm';
  const good = generateExamResult(stateAt(year), examType).average;
  const bad = generateExamResult(stateAt(year, { fatigue: 90, mentalState: 'burnout' }), examType).average;
  return good - bad;
}

// ===== ① claim ↔ 엔진 =====
// 반환: 위반 사유 목록(빈 배열 = 참). 직전 학년(year-1)과 비교하는 claim은 "달라지는 것"의 기준점이다.
function verifyClaim(year: number, claim: BriefingClaim): string[] {
  const prev = year - 1;
  const errs: string[] = [];
  switch (claim.kind) {
    case 'examCount': {
      const types = scheduleTypes(year);
      if (types.length !== claim.count) errs.push(`Y${year} 시험 ${types.length}회 ≠ 주장 ${claim.count}회`);
      for (const [t, n] of Object.entries(claim.byType ?? {})) {
        const got = types.filter(x => x === t).length;
        if (got !== n) errs.push(`Y${year} ${t} ${got}회 ≠ 주장 ${n}회`);
      }
      break;
    }
    case 'examTypeNew':
      if (!scheduleTypes(year).includes(claim.type)) errs.push(`Y${year}에 ${claim.type} 없음`);
      if (scheduleTypes(prev).includes(claim.type)) errs.push(`Y${prev}에도 ${claim.type}가 있어 "새로"가 아님`);
      break;
    case 'gradeAndRankShown': {
      const now = generateExamResult(stateAt(year), 'midterm');
      const before = generateExamResult(stateAt(prev), scheduleTypes(prev)[0]);
      if (now.schoolLevel === 'elementary' || now.rank === null) errs.push(`Y${year} 성적표에 등급/등수 없음`);
      if (before.schoolLevel !== 'elementary' || before.rank !== null) errs.push(`Y${prev}에도 등급/등수가 있어 "달라짐"이 아님`);
      break;
    }
    case 'conditionPenaltyStronger': {
      const now = conditionGap(year), before = conditionGap(prev);
      if (!(now > before)) errs.push(`컨디션 손실 Y${year} ${now} ≤ Y${prev} ${before}`);
      break;
    }
    case 'decayFaster':
      for (const vac of [false, true]) {
        const now = Math.abs(getAcademicDecay(year, vac)), before = Math.abs(getAcademicDecay(prev, vac));
        if (!(now > before)) errs.push(`${vac ? '방학' : '학기'} 감쇠 Y${year} ${now} ≤ Y${prev} ${before}`);
      }
      break;
    case 'vacationDecayHarsher': {
      const vac = Math.abs(getAcademicDecay(year, true));
      const sem = Math.abs(getAcademicDecay(year, false));
      const vacBefore = Math.abs(getAcademicDecay(prev, true));
      if (!(vac > sem)) errs.push(`Y${year} 방학 감쇠 ${vac} ≤ 학기 ${sem}`);
      if (!(vac > vacBefore)) errs.push(`Y${year} 방학 감쇠 ${vac} ≤ Y${prev} 방학 ${vacBefore}`);
      break;
    }
    case 'unlocked':
      for (const id of claim.activityIds) {
        const a = activity(id);
        if (a.unlockYear !== year) errs.push(`${id} unlockYear ${a.unlockYear} ≠ Y${year}`);
        // 실제 게이트로도 본다 — 돈은 충분히 줘서 학년 조건만 남긴다.
        if (a.requires && !a.requires(stateAt(year))) errs.push(`${id}가 Y${year}에 게이트를 못 넘음`);
        if (!a.requires || a.requires(stateAt(prev))) errs.push(`${id}가 Y${prev}에도 열려 있어 "새로"가 아님`);
      }
      break;
    case 'payRises':
      for (const id of claim.activityIds) {
        const a = activity(id);
        const now = -getActivityCost(a, year), before = -getActivityCost(a, prev);
        if (!(now > 0)) errs.push(`${id}는 Y${year}에 수입 활동이 아님 (${now})`);
        if (!(now > before)) errs.push(`${id} 벌이 Y${year} ${now} ≤ Y${prev} ${before}`);
      }
      break;
    case 'costRises':
      for (const id of claim.activityIds) {
        const a = activity(id);
        const now = getActivityCost(a, year), before = getActivityCost(a, prev);
        if (!(now > 0)) errs.push(`${id}는 Y${year}에 유료 활동이 아님 (${now})`);
        if (!(now > before)) errs.push(`${id} 비용 Y${year} ${now} ≤ Y${prev} ${before}`);
      }
      break;
    case 'suneungWeek': {
      const sched = getExamSchedule(year);
      if (sched[claim.week] !== 'suneung') errs.push(`Y${year} W${claim.week}는 수능이 아님 (${sched[claim.week]})`);
      const info = getWeekInfo(claim.week);
      if (info.semester !== claim.semester || info.isVacation) errs.push(`W${claim.week}는 ${claim.semester}학기 학기 중이 아님 (${info.label})`);
      break;
    }
    case 'mockCount': {
      const n = scheduleTypes(year).filter(t => t === 'mock').length;
      if (n !== claim.count) errs.push(`Y${year} 모의고사 ${n}회 ≠ 주장 ${claim.count}회`);
      break;
    }
    case 'mocksDecideSuneung': {
      // (a) 이 학년 모의고사가 전부 수능 전에 있고, 수능은 정확히 "직전 모의 N회"를 읽는다(N = 이 학년 모의 수).
      const sched = getExamSchedule(year);
      const suneungWeek = Number(Object.keys(sched).find(w => sched[Number(w)] === 'suneung'));
      const mockWeeks = Object.keys(sched).map(Number).filter(w => sched[w] === 'mock');
      if (!suneungWeek) errs.push(`Y${year}에 수능 없음`);
      if (mockWeeks.some(w => w > suneungWeek)) errs.push('수능 뒤에 모의고사가 있음');
      const base = generateMockExamResult(stateAt(year));
      const mk = (avg: number): ExamResult => ({ ...base, average: avg });
      const score = (avgs: number[]) =>
        generateSuneungResult(stateAt(year, { examResults: avgs.map(mk) })).average;
      const ref = [60, 60, 60];
      const reads = ref.map((_, i) => score(ref.map((v, j) => (j === i ? v + 30 : v))) !== score(ref));
      // 뒤에서부터 mockWeeks.length개만 읽혀야 한다 — 더 앞(작년) 모의는 수능에 안 닿는다.
      const expected = ref.map((_, i) => i >= ref.length - mockWeeks.length);
      if (reads.join() !== expected.join()) errs.push(`수능이 읽는 모의 [${reads}] ≠ 이 학년 모의 [${expected}]`);
      // (b) 그 모의고사는 컨디션에 깎인다
      const good = generateMockExamResult(stateAt(year)).average;
      const bad = generateMockExamResult(stateAt(year, { fatigue: 90, mentalState: 'burnout' })).average;
      if (!(good > bad)) errs.push(`모의고사가 컨디션에 안 깎임 (${good} vs ${bad})`);
      break;
    }
  }
  return errs;
}

// ===== ② 문장 표현 ↔ claim =====
// 문장이 쓰는 단서마다 그걸 뒷받침하는 claim이 있어야 한다. 단서 목록은 현재 카드의 어휘 + T64 사고 어휘("비도").
const has = (claims: BriefingClaim[], ...kinds: BriefingClaim['kind'][]) => claims.some(c => kinds.includes(c.kind));
const CUES: { re: RegExp; ok: (c: BriefingClaim[]) => boolean; need: string }[] = [
  { re: /올랐|올라|인상|비싸/, ok: c => has(c, 'payRises', 'costRises'), need: 'payRises|costRises' },
  { re: /시급|벌이|수입/, ok: c => has(c, 'payRises'), need: 'payRises' },
  { re: /[가-힣]비[도가는\s]|비용|값이/, ok: c => has(c, 'costRises'), need: 'costRises' },
  { re: /열렸|생겼|새로/, ok: c => has(c, 'unlocked', 'examTypeNew'), need: 'unlocked|examTypeNew' },
  { re: /등급|등수/, ok: c => has(c, 'gradeAndRankShown'), need: 'gradeAndRankShown' },
  { re: /잊|유지가/, ok: c => has(c, 'decayFaster'), need: 'decayFaster' },
  { re: /방학/, ok: c => has(c, 'vacationDecayHarsher'), need: 'vacationDecayHarsher' },
  { re: /컨디션/, ok: c => has(c, 'conditionPenaltyStronger', 'mocksDecideSuneung'), need: 'conditionPenaltyStronger|mocksDecideSuneung' },
  { re: /수능/, ok: c => has(c, 'suneungWeek', 'mocksDecideSuneung'), need: 'suneungWeek|mocksDecideSuneung' },
  { re: /모의고사/, ok: c => has(c, 'examTypeNew', 'mockCount'), need: 'examTypeNew|mockCount' },
  { re: /시험이 1년에/, ok: c => has(c, 'examCount'), need: 'examCount' },
];
// 활동 명사 → 그 문장의 claim 어딘가에 이 id가 있어야 한다("학원"이라 써 놓고 근거는 다른 활동이면 거짓).
const ACTIVITY_NOUNS: Record<string, string> = {
  학원: 'academy', 과외: 'private-tutoring', 알바: 'part-time',
  보충수업: 'supplementary-class', 자율학습: 'night-study', 독서실: 'study-room',
};

function claimNumbers(claims: BriefingClaim[]): number[] {
  return claims.flatMap(c => {
    if (c.kind === 'examCount') return [c.count, ...Object.values(c.byType ?? {})];
    if (c.kind === 'mockCount') return [c.count];
    if (c.kind === 'suneungWeek') return [c.week, c.semester];
    return [];
  });
}

function auditText(line: BriefingLine): string[] {
  const errs: string[] = [];
  const { text, claims } = line;
  if (claims.length === 0) errs.push(`근거 없는 문장: "${text}"`);
  for (const cue of CUES) {
    if (cue.re.test(text) && !cue.ok(claims)) errs.push(`"${text}" — ${cue.re} 표현에 ${cue.need} claim이 없음`);
  }
  const ids = claims.flatMap(c => ('activityIds' in c ? c.activityIds : []));
  for (const [noun, id] of Object.entries(ACTIVITY_NOUNS)) {
    if (text.includes(noun) && !ids.includes(id)) errs.push(`"${text}" — "${noun}"(${id})가 claim에 없음`);
  }
  // 문장 속 숫자(N번·N학기·WN)는 전부 claim 값이어야 한다.
  const nums = [...text.matchAll(/(\d+)\s*(?:번|학기)|W(\d+)/g)].map(m => Number(m[1] ?? m[2]));
  const backed = claimNumbers(claims);
  for (const n of nums) if (!backed.includes(n)) errs.push(`"${text}" — 숫자 ${n}의 근거 claim이 없음`);
  return errs;
}

// ===== 테스트 =====
const ALL = Object.entries(BRIEFINGS).flatMap(([y, b]) => b.lines.map(line => ({ year: Number(y), line })));

describe('진학 브리핑 — 문장이 엔진과 맞는다 (T64)', () => {
  it('커버리지 하한 — 카드 3장·문장 11줄·claim 14개를 전부 지나간다', () => {
    // corpus가 비면 아래 it.each가 0건으로 초록이 된다. 착지값을 먼저 박는다.
    expect(Object.keys(BRIEFINGS).map(Number)).toEqual([2, 5, 7]);
    expect(ALL).toHaveLength(11);
    expect(ALL.flatMap(x => x.line.claims)).toHaveLength(14);
  });

  it.each(ALL.map(x => [x.year, x.line.text, x] as const))('Y%i "%s" — claim이 엔진 값과 맞는다', (_y, _t, { year, line }) => {
    expect(line.claims.flatMap(c => verifyClaim(year, c))).toEqual([]);
  });

  it.each(ALL.map(x => [x.year, x.line.text, x] as const))('Y%i "%s" — 문장 표현이 claim으로 뒷받침된다', (_y, _t, { line }) => {
    expect(auditText(line)).toEqual([]);
  });

  it('카드가 SSOT의 문장을 그대로 렌더한다', () => {
    for (const [year, b] of Object.entries(BRIEFINGS)) {
      const { unmount } = render(<StageBriefingCard state={stateAt(Number(year), { week: 1 })} />);
      expect(screen.getByText(b.title)).toBeInTheDocument();
      for (const { text } of b.lines) expect(screen.getByText(`· ${text}`)).toBeInTheDocument();
      unmount();
    }
  });
});

describe('검사기 자기검사 — 거짓을 실제로 잡는다', () => {
  // ⚠ 이 케이스(와 아래 표의 academy 거짓 짝)는 "학원 중·고 동일가"라는 현재 데이터에 기댄다.
  //   학원 고등가를 의도적으로 바꾸면 여기만 같이 고치면 된다 — 카드 문장 검사(위 it.each)는 영향 없다.
  it('T64 원문 "학원비도 한 단계 더 올랐다"는 claim이 없어도, 지어내도 걸린다', () => {
    const text = '학원비도 한 단계 더 올랐다';
    expect(auditText({ text, claims: [] }).length).toBeGreaterThan(0);
    // 표현층을 통과하도록 claim을 지어내면 엔진층이 잡는다 — academy는 중·고 동일가.
    const forged: BriefingClaim = { kind: 'costRises', activityIds: ['academy'] };
    expect(auditText({ text, claims: [forged] })).toEqual([]);
    expect(verifyClaim(5, forged).join()).toMatch(/academy 비용 Y5 3 ≤ Y4 3/);
  });

  it('엔진층 — 거짓 claim은 종류마다 걸린다 (참 claim과 짝으로)', () => {
    const cases: [number, BriefingClaim, boolean][] = [
      [5, { kind: 'examCount', count: 6 }, true],
      [5, { kind: 'examCount', count: 5 }, false],
      [2, { kind: 'examCount', count: 4, byType: { midterm: 2, final: 2 } }, true],
      [2, { kind: 'examCount', count: 4, byType: { midterm: 3 } }, false],
      [5, { kind: 'examTypeNew', type: 'mock' }, true],
      [6, { kind: 'examTypeNew', type: 'mock' }, false],
      [2, { kind: 'gradeAndRankShown' }, true],
      [5, { kind: 'gradeAndRankShown' }, false],
      [2, { kind: 'conditionPenaltyStronger' }, true],
      [6, { kind: 'conditionPenaltyStronger' }, false],
      [5, { kind: 'decayFaster' }, true],
      [6, { kind: 'decayFaster' }, false],
      [5, { kind: 'vacationDecayHarsher' }, true],
      [6, { kind: 'vacationDecayHarsher' }, false],
      [5, { kind: 'unlocked', activityIds: ['private-tutoring'] }, true],
      [6, { kind: 'unlocked', activityIds: ['private-tutoring'] }, false],
      [5, { kind: 'unlocked', activityIds: ['study-group'] }, false],
      [5, { kind: 'payRises', activityIds: ['part-time'] }, true],
      [6, { kind: 'payRises', activityIds: ['part-time'] }, false],
      [5, { kind: 'payRises', activityIds: ['academy'] }, false],
      [2, { kind: 'costRises', activityIds: ['academy'] }, true],
      [5, { kind: 'costRises', activityIds: ['academy'] }, false],
      [7, { kind: 'suneungWeek', week: 35, semester: 2 }, true],
      [7, { kind: 'suneungWeek', week: 36, semester: 2 }, false],
      [7, { kind: 'suneungWeek', week: 35, semester: 1 }, false],
      [7, { kind: 'mockCount', count: 2 }, true],
      [7, { kind: 'mockCount', count: 3 }, false],
      [7, { kind: 'mocksDecideSuneung' }, true],
      [6, { kind: 'mocksDecideSuneung' }, false],
    ];
    // 모든 claim 종류가 참·거짓 양쪽으로 한 번씩은 나온다
    const kinds = new Set<string>(ALL.flatMap(x => x.line.claims.map(c => c.kind)));
    kinds.add('costRises');
    for (const k of kinds) {
      expect(cases.some(([, c, ok]) => c.kind === k && ok), `${k} 참 짝`).toBe(true);
      expect(cases.some(([, c, ok]) => c.kind === k && !ok), `${k} 거짓 짝`).toBe(true);
    }
    for (const [year, claim, ok] of cases) {
      expect(verifyClaim(year, claim).length === 0, `Y${year} ${JSON.stringify(claim)}`).toBe(ok);
    }
  });

  it('표현층 — 단서마다 claim이 빠지면 걸린다', () => {
    const bad: BriefingLine[] = [
      { text: '알바 시급이 올랐다', claims: [{ kind: 'unlocked', activityIds: ['part-time'] }] },
      { text: '과외가 열렸다', claims: [{ kind: 'unlocked', activityIds: ['supplementary-class'] }] },
      { text: '시험이 1년에 5번', claims: [{ kind: 'examCount', count: 6 }] },
      { text: '2학기 W36, 수능', claims: [{ kind: 'suneungWeek', week: 35, semester: 2 }] },
      { text: '방학이 무섭다', claims: [{ kind: 'decayFaster' }] },
      { text: '성적표에 등수가 나온다', claims: [{ kind: 'decayFaster' }] },
      { text: '컨디션이 중요하다', claims: [{ kind: 'mockCount', count: 2 }] },
      { text: '독서실비가 올랐다', claims: [{ kind: 'payRises', activityIds: ['study-room'] }] },
    ];
    for (const line of bad) expect(auditText(line).length, line.text).toBeGreaterThan(0);
  });
});
