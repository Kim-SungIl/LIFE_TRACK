/**
 * T67 성장 둔화 원인 — 분해(기록)와 판정의 계약.
 *
 * 세 층을 따로 잠근다:
 *   ① 분해 — applyActivity가 남긴 장부가 **실제 계산과 맞는가**. 요인마다 그 요인만 걸리는 양성
 *      픽스처로 값을 착지시키고(어느 요인이 얼마), 장부 불변식(ideal − applied = Σdrag)과
 *      "applied = 스탯에 실제로 더해진 양"(100 클램프 포함)을 본다 — fatigueChange가 클램프 전
 *      값을 적던 함정(T53)과 같은 구멍을 막는다.
 *   ② 판정 — 임계·간격·재발 간격은 **양방향**(경계 바로 아래는 안 뜨고, 경계에서 뜬다). 고르는 건
 *      "가장 많이 깎은 요인"이지 배열 첫 요인이 아니다(항상 같은 요인을 내는 판정을 잡는다).
 *   ③ 배선 — processWeek이 판정 결과를 로그에 박고 기억을 갱신한다(순수함수만 잠그면 기능이
 *      아예 안 도는 상태도 초록이다 — #381).
 */
import { describe, expect, it } from 'vitest';
import { applyActivity, createInitialState, getDiminishingReturn, processWeek } from '../gameEngine';
import {
  GROWTH_DRAG_FACTORS,
  GROWTH_REASON_GAP_WEEKS,
  GROWTH_REASON_MIN_LOSS,
  GROWTH_REASON_SITUATIONAL_REPEAT_WEEKS,
  GROWTH_REASON_STRUCTURAL_REPEAT_WEEKS,
  GOOD_WEEK_AXIS_GAIN,
  STRUCTURAL_GROWTH_DRAGS,
  advanceGrowthReasonMemo,
  dominantGrowthDrag,
  growthReasonCell,
  pickGrowthReason,
  sumDrag,
  type GrowthDragFactor,
  type GrowthLedger,
  type GrowthReasonMemo,
} from '../growthDrag';
import type { GameState, StatKey, WeekLog } from '../types';

function emptyLog(): WeekLog {
  return {
    statChanges: {}, fatigueChange: 0, moneyChange: 0,
    messages: [], skipped: [], milestoneMessages: [], parentBonusesApplied: [],
  };
}

/** 성장식에 손대는 부모 보정이 없는 판(emotional·freedom은 활동 효율·피로 증가를 안 건드린다). */
function baseState(over: Partial<GameState> = {}): GameState {
  const s = createInitialState('male', ['emotional', 'freedom'], { rngSeed: 1 });
  s.year = 4; s.week = 10; s.isVacation = false; s.money = 9999;
  s.fatigue = 0; s.mentalState = 'normal';
  s.consecutiveTiredWeeks = 0; s.idleWeeks = 0; s.activeBuffs = [];
  s.stats = { academic: 20, social: 20, health: 20, talent: 20, mental: 50 };
  return Object.assign(s, over);
}

function dragOf(log: WeekLog): Record<GrowthDragFactor, number> {
  const l = log.growthLedger!;
  return Object.fromEntries(GROWTH_DRAG_FACTORS.map(f => [f, sumDrag(l, f)])) as Record<GrowthDragFactor, number>;
}

/** 지정한 요인 외에는 0이어야 한다 */
function onlyThese(log: WeekLog, allowed: GrowthDragFactor[]): void {
  const d = dragOf(log);
  for (const f of GROWTH_DRAG_FACTORS) {
    if (!allowed.includes(f)) expect(d[f], `${f}는 이 픽스처에서 안 걸려야 한다`).toBe(0);
  }
}

function expectLedgerBalanced(log: WeekLog): void {
  const l = log.growthLedger!;
  const total = GROWTH_DRAG_FACTORS.reduce((s, f) => s + sumDrag(l, f), 0);
  expect(l.ideal - l.applied, '장부 불변식: ideal − applied = Σdrag').toBeCloseTo(total, 9);
}

/** self-study(학업 1.5·무료)를 스탯 20에서 — 구간 감쇠가 1 초과(가속)라 익숙함 손실이 없는 자리 */
const G = 1.5 * getDiminishingReturn(20);

describe('① 분해 — 요인별 양성 픽스처', () => {
  it('전제: 스탯 20의 구간 감쇠는 가속(>1)이다 — 아니면 아래 픽스처가 익숙함을 섞는다', () => {
    expect(getDiminishingReturn(20)).toBeGreaterThan(1);
  });

  it('막힘이 없으면 손실 0 — 장부는 있되 비어 있다 (음성 대조)', () => {
    const s = baseState();
    const log = emptyLog();
    applyActivity(s, 'self-study', log);
    expect(log.growthLedger!.ideal).toBeCloseTo(G, 9);
    expect(log.growthLedger!.applied).toBeCloseTo(G, 9);
    onlyThese(log, []);
  });

  it('피로: 피로 85(배율 0.3)면 0.7만큼이 피로 몫이다', () => {
    const s = baseState({ fatigue: 85 });
    const log = emptyLog();
    applyActivity(s, 'self-study', log);
    onlyThese(log, ['fatigue']);
    expect(dragOf(log).fatigue).toBeCloseTo(G * 0.7, 9);
    expect(log.growthLedger!.applied).toBeCloseTo(G * 0.3, 9);
    expectLedgerBalanced(log);
  });

  it('멘탈 상태: 번아웃(배율 0.35)은 mood 몫이다', () => {
    const s = baseState({ mentalState: 'burnout' });
    const log = emptyLog();
    applyActivity(s, 'self-study', log);
    onlyThese(log, ['mood']);
    expect(dragOf(log).mood).toBeCloseTo(G * 0.65, 9);
    expectLedgerBalanced(log);
  });

  it('같은 축 중복: 이미 0.6 오른 축이면 0.7 — crowded 몫이다', () => {
    const s = baseState();
    const log = emptyLog();
    log.statChanges.academic = 0.6;   // priorGain 0.5 초과 → ×0.7 (상한에는 안 닿게)
    applyActivity(s, 'self-study', log);
    onlyThese(log, ['crowded']);
    expect(dragOf(log).crowded).toBeCloseTo(G * 0.3, 9);
    expectLedgerBalanced(log);
  });

  it('주당 상한: 이미 1.9 오른 축이면 0.1만 더해지고 나머지는 상한 몫이다', () => {
    const s = baseState();
    const log = emptyLog();
    log.statChanges.academic = 1.9;   // priorGain 2 이하라 중복은 ×0.7, 그 뒤 상한이 0.1로 자른다
    applyActivity(s, 'self-study', log);
    onlyThese(log, ['crowded', 'weeklyCap']);
    expect(log.growthLedger!.applied).toBeCloseTo(0.1, 9);
    expect(dragOf(log).crowded).toBeCloseTo(G * 0.3, 9);
    expect(dragOf(log).weeklyCap).toBeCloseTo(G * 0.7 - 0.1, 9);
    expectLedgerBalanced(log);
  });

  it('구간 감쇠: 스탯 50(배율 0.8)이면 familiar 몫만 있다', () => {
    const s = baseState({ stats: { academic: 50, social: 20, health: 20, talent: 20, mental: 50 } });
    const log = emptyLog();
    applyActivity(s, 'self-study', log);
    onlyThese(log, ['familiar']);
    expect(dragOf(log).familiar).toBeCloseTo(1.5 * 0.2, 9);
    expectLedgerBalanced(log);
  });

  it('무료 소프트캡: 85의 무료 활동은 익숙함과 소프트캡을 −ln 비율로 나눠 진다', () => {
    const s = baseState({ stats: { academic: 85, social: 20, health: 20, talent: 20, mental: 50 } });
    const log = emptyLog();
    applyActivity(s, 'self-study', log);
    onlyThese(log, ['familiar', 'freeCeiling']);
    const d = dragOf(log);
    // 85의 감쇠 0.3, 소프트캡 0.1 → 비율 ln0.3 : ln0.1
    expect(d.familiar / d.freeCeiling).toBeCloseTo(Math.log(0.3) / Math.log(0.1), 9);
    expectLedgerBalanced(log);
  });

  it('최저 보장이 끌어올린 몫은 손실에서 빠진다 (applied = 실제로 더해진 양)', () => {
    // 피로 95(0.2) × 번아웃(0.35) → G × 0.07 ≈ 0.11 < 바닥 0.15
    const s = baseState({ fatigue: 95, mentalState: 'burnout' });
    const before = s.stats.academic;
    const log = emptyLog();
    applyActivity(s, 'self-study', log);
    expect(s.stats.academic - before).toBeCloseTo(0.15, 9);
    expect(log.growthLedger!.applied).toBeCloseTo(s.stats.academic - before, 12);
    expectLedgerBalanced(log);
  });

  it('스탯 100 클램프로 잘린 몫도 기록한다 — applied는 클램프 **후** 값이다', () => {
    const s = baseState({ stats: { academic: 99.99, social: 20, health: 20, talent: 20, mental: 50 } });
    const log = emptyLog();
    applyActivity(s, 'academy', log);   // 유료라 소프트캡 없음
    expect(s.stats.academic).toBe(100);
    const l = log.growthLedger!;
    const academicApplied = l.applied - (s.stats.social - 20);
    expect(academicApplied, '클램프 전 값을 적으면 여기서 갈린다').toBeCloseTo(0.01, 9);
    expectLedgerBalanced(log);
  });

  it('멘탈 축은 장부에 없다 (회복 전용 감쇠라 분해 밖)', () => {
    const s = baseState({ fatigue: 85 });
    const log = emptyLog();
    applyActivity(s, 'light-exercise', log);   // health 1.5 + mental 1
    const axes = new Set(Object.values(log.growthLedger!.drag).flatMap(r => Object.keys(r ?? {})));
    expect(axes.has('mental')).toBe(false);
    expect(axes.has('health')).toBe(true);
  });
});

describe('① 분해 — 실플레이 전 구간 불변식', () => {
  it('7년 한 판 내내 매주 장부가 맞고, applied는 0 이상이다', () => {
    let s = createInitialState('female', ['strict', 'info'], { rngSeed: 4242 });
    s.routineSlot2 = 'academy'; s.routineSlot3 = 'self-study';
    let weeksWithLedger = 0;
    let reasons = 0;
    for (let i = 0; i < 400 && s.phase !== 'ending'; i++) {
      s.weekendChoices = ['self-study', 'club'];
      s.vacationChoices = ['self-study', 'club', 'rest'];
      s = processWeek(s);
      const log = s.weekLog!;
      if (log.growthLedger) {
        weeksWithLedger++;
        expectLedgerBalanced(log);
        expect(log.growthLedger.applied).toBeGreaterThanOrEqual(0);
        for (const row of Object.values(log.growthLedger.drag)) {
          for (const v of Object.values(row ?? {})) expect(v).toBeGreaterThan(0);
        }
      }
      if (log.growthReason) reasons++;
      s = { ...s, currentEvent: null };
      if (s.phase === 'year-end') { s = { ...s, week: 1, year: s.year + 1 }; }
      s = { ...s, phase: 'weekday' };
    }
    expect(weeksWithLedger, '장부가 거의 매주 있어야 한다 — 0이면 기록이 빠진 것').toBeGreaterThan(300);
    expect(reasons, '한 판에 문장이 몇 번은 떠야 한다').toBeGreaterThan(5);
    expect(reasons, '잔소리 상한 — 간격이 살아 있으면 400주에 100번을 못 넘는다').toBeLessThan(400 / GROWTH_REASON_GAP_WEEKS);
  });
});

// ===== ② 판정 =====

function ledgerOf(drag: Partial<Record<GrowthDragFactor, Partial<Record<'academic' | 'talent' | 'health' | 'social', number>>>>): GrowthLedger {
  return { ideal: 10, applied: 1, drag };
}
const memoAt = (lastShownAt: number, lastByFactor: GrowthReasonMemo['lastByFactor'] = {}): GrowthReasonMemo =>
  ({ lastShownAt, lastByFactor, shown: {} });

describe('② 판정 — 임계 양방향', () => {
  it('임계 바로 아래는 안 뜨고, 임계에서 뜬다', () => {
    const below = ledgerOf({ fatigue: { academic: GROWTH_REASON_MIN_LOSS - 0.01 } });
    const at = ledgerOf({ fatigue: { academic: GROWTH_REASON_MIN_LOSS } });
    expect(pickGrowthReason(below, {}, undefined, 100)).toBeNull();
    expect(pickGrowthReason(at, {}, undefined, 100)?.factor).toBe('fatigue');
  });

  // 위 단언은 상수에서 파생해서 상수를 옮겨도 따라간다(1.0→1.01·0.99 뮤테이션이 둘 다 살아남았다).
  // 임계는 실측 분포에서 고른 **설계값**이라 리터럴 경계로 착지시킨다 — 옮기려면 sim을 다시 돌리고
  // 이 숫자를 같이 고칠 것(scripts/sim/sim-growth-reason.ts).
  it('실측 설계값: 손실 1.0은 뜨고 0.995는 안 뜬다', () => {
    expect(pickGrowthReason(ledgerOf({ fatigue: { academic: 1.0 } }), {}, undefined, 100)?.factor).toBe('fatigue');
    expect(pickGrowthReason(ledgerOf({ fatigue: { academic: 0.995 } }), {}, undefined, 100)).toBeNull();
  });

  it('실측 설계값: 간격 4주 · 날씨 재발 8주 · 지형 재발 48주 · 잘 는 주 1.5', () => {
    expect([GROWTH_REASON_GAP_WEEKS, GROWTH_REASON_SITUATIONAL_REPEAT_WEEKS, GROWTH_REASON_STRUCTURAL_REPEAT_WEEKS, GOOD_WEEK_AXIS_GAIN])
      .toEqual([4, 8, 48, 1.5]);
  });

  it('임계는 여러 축의 합으로 잰다', () => {
    const half = GROWTH_REASON_MIN_LOSS / 2;
    const l = ledgerOf({ fatigue: { academic: half, health: half } });
    expect(pickGrowthReason(l, {}, undefined, 100)?.factor).toBe('fatigue');
  });

  it('장부가 없으면(구세이브) 판정하지 않는다', () => {
    expect(pickGrowthReason(undefined, {}, undefined, 100)).toBeNull();
  });
});

describe('② 판정 — 가장 많이 깎은 요인을 고른다', () => {
  // 각 요인이 혼자 최대일 때 그 요인이 나와야 한다 — 판정이 늘 같은 요인을 내면 여기서 잡힌다.
  for (const target of GROWTH_DRAG_FACTORS) {
    it(`${target}가 가장 크면 ${target}`, () => {
      const drag: Partial<Record<GrowthDragFactor, { academic: number }>> = {};
      for (const f of GROWTH_DRAG_FACTORS) drag[f] = { academic: f === target ? 3 : 2 };
      expect(pickGrowthReason(ledgerOf(drag), {}, undefined, 100)?.factor).toBe(target);
    });
  }

  it('동률이면 배열 순서(플레이어가 바꿀 수 있는 것부터)', () => {
    const l = ledgerOf({ familiar: { academic: 2 }, fatigue: { academic: 2 } });
    expect(pickGrowthReason(l, {}, undefined, 100)?.factor).toBe('fatigue');
  });

  it('축은 그 요인에서 가장 많이 깎인 축', () => {
    const l = ledgerOf({ familiar: { academic: 0.5, talent: 1.5 } });
    expect(pickGrowthReason(l, {}, undefined, 100)?.axis).toBe('talent');
  });

  it('원시 판정(dominantGrowthDrag)도 최대를 고른다', () => {
    const l = ledgerOf({ familiar: { academic: 1 }, mood: { social: 2 } });
    expect(dominantGrowthDrag(l)).toEqual({ factor: 'mood', loss: 2 });
  });
});

describe('② 판정 — 간격과 재발 간격(양방향)', () => {
  const l = ledgerOf({ fatigue: { academic: 3 } });

  it('어떤 문장이든 낸 뒤 GAP주 안에는 안 뜬다', () => {
    expect(pickGrowthReason(l, {}, memoAt(100), 100 + GROWTH_REASON_GAP_WEEKS - 1)).toBeNull();
    expect(pickGrowthReason(l, {}, memoAt(100), 100 + GROWTH_REASON_GAP_WEEKS)?.factor).toBe('fatigue');
  });

  it('같은 날씨 요인은 SITUATIONAL_REPEAT주 안에는 안 뜬다', () => {
    const memo = memoAt(0, { fatigue: 100 });
    expect(pickGrowthReason(l, {}, memo, 100 + GROWTH_REASON_SITUATIONAL_REPEAT_WEEKS - 1)).toBeNull();
    expect(pickGrowthReason(l, {}, memo, 100 + GROWTH_REASON_SITUATIONAL_REPEAT_WEEKS)?.factor).toBe('fatigue');
  });

  it('같은 지형 요인은 STRUCTURAL_REPEAT주 안에는 안 뜬다', () => {
    const lf = ledgerOf({ familiar: { academic: 3 } });
    const memo = memoAt(0, { familiar: 100 });
    expect(pickGrowthReason(lf, {}, memo, 100 + GROWTH_REASON_STRUCTURAL_REPEAT_WEEKS - 1)).toBeNull();
    expect(pickGrowthReason(lf, {}, memo, 100 + GROWTH_REASON_STRUCTURAL_REPEAT_WEEKS)?.factor).toBe('familiar');
  });

  it('쉬는 요인 대신 다음으로 큰 요인을 말한다', () => {
    const both = ledgerOf({ familiar: { academic: 3 }, fatigue: { academic: 1.5 } });
    const memo = memoAt(0, { familiar: 100 });
    expect(pickGrowthReason(both, {}, memo, 110)?.factor).toBe('fatigue');
  });

  it('지형/날씨 구분은 familiar·freeCeiling = 지형', () => {
    expect([...STRUCTURAL_GROWTH_DRAGS].sort()).toEqual(['familiar', 'freeCeiling']);
  });
});

describe('② 판정 — 잘 는 주', () => {
  it(`어느 축이 ${GOOD_WEEK_AXIS_GAIN} 이상 오른 주에는 피로 문장을 내지 않는다 (경계 양방향)`, () => {
    const l = ledgerOf({ fatigue: { academic: 3 } });
    expect(pickGrowthReason(l, { academic: GOOD_WEEK_AXIS_GAIN }, undefined, 100)).toBeNull();
    expect(pickGrowthReason(l, { academic: GOOD_WEEK_AXIS_GAIN - 0.01 }, undefined, 100)?.factor).toBe('fatigue');
  });

  it('멘탈 축이 많이 오른 건 잘 는 주가 아니다 (성장 축만 본다)', () => {
    const l = ledgerOf({ fatigue: { academic: 3 } });
    expect(pickGrowthReason(l, { mental: 5 }, undefined, 100)?.factor).toBe('fatigue');
  });

  it('주당 상한은 잘 는 주에도 말한다 — 상한은 다 오른 주에만 걸린다', () => {
    const l = ledgerOf({ weeklyCap: { academic: 1.2 }, fatigue: { academic: 3 } });
    expect(pickGrowthReason(l, { academic: 2 }, undefined, 100)?.factor).toBe('weeklyCap');
  });
});

describe('② 판정 — 문장 회전 칸', () => {
  it('지형 요인은 (요인, 축) 칸으로, 날씨 요인은 요인 칸으로 센다', () => {
    expect(growthReasonCell('familiar', 'academic')).not.toBe(growthReasonCell('familiar', 'talent'));
    expect(growthReasonCell('fatigue', 'academic')).toBe(growthReasonCell('fatigue', 'talent'));
  });

  it('축이 번갈아 나와도 각 칸의 variant는 0,1,2… 로 1씩 오른다 (모듈로 퇴화 방지)', () => {
    let memo: GrowthReasonMemo | undefined;
    const seen: Record<string, number[]> = {};
    for (let i = 0; i < 8; i++) {
      const axis = i % 2 === 0 ? 'academic' : 'talent';
      const l = ledgerOf({ familiar: { [axis]: 3 } });
      const week = i * GROWTH_REASON_STRUCTURAL_REPEAT_WEEKS;
      const r = pickGrowthReason(l, {}, memo, week)!;
      (seen[axis] ??= []).push(r.variant);
      memo = advanceGrowthReasonMemo(memo, r, week);
    }
    expect(seen.academic).toEqual([0, 1, 2, 3]);
    expect(seen.talent).toEqual([0, 1, 2, 3]);
  });
});

// ===== ③ 배선 =====

describe('③ processWeek 배선', () => {
  function tiredWeekState(): GameState {
    const s = baseState({ fatigue: 92 });
    s.routineSlot2 = 'self-study'; s.routineSlot3 = 'school-sports';
    s.weekendChoices = ['club', 'self-study'];
    return s;
  }

  it('지친 주에는 엔진이 원인을 로그에 박고 기억을 남긴다', () => {
    const s0 = tiredWeekState();
    const s1 = processWeek(s0);
    const r = s1.weekLog!.growthReason;
    expect(r, '판정이 배선돼 있지 않으면 여기서 undefined').toBeDefined();
    expect(r!.factor).toBe('fatigue');
    expect(s1.growthReasonMemo?.lastShownAt).toBe(s0.totalWeeksPlayed);
    expect(s1.growthReasonMemo?.lastByFactor.fatigue).toBe(s0.totalWeeksPlayed);
  });

  it('바로 다음 주에는 같은 조건이어도 안 뜬다 (간격이 processWeek 경로에서 산다)', () => {
    const s1 = processWeek(tiredWeekState());
    const s2in: GameState = { ...s1, fatigue: 92, weekendChoices: ['club', 'self-study'], currentEvent: null, phase: 'weekday' };
    const s2 = processWeek(s2in);
    expect(s2.weekLog!.growthLedger, '전제: 장부는 찼다').toBeDefined();
    expect(sumDrag(s2.weekLog!.growthLedger!, 'fatigue'), '전제: 피로 손실은 임계 이상').toBeGreaterThanOrEqual(GROWTH_REASON_MIN_LOSS);
    expect(s2.weekLog!.growthReason).toBeUndefined();
  });

  it('입력 state를 바꾸지 않는다 (기억은 새 state에만)', () => {
    const s0 = tiredWeekState();
    processWeek(s0);
    expect(s0.growthReasonMemo).toBeUndefined();
  });

  it('스탯 키 전부가 성장 축 또는 mental이다 (축 목록 드리프트 가드)', () => {
    const keys = Object.keys(baseState().stats) as StatKey[];
    expect(keys.filter(k => k !== 'mental').sort()).toEqual(['academic', 'health', 'social', 'talent']);
  });
});
