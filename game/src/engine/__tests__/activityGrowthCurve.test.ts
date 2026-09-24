/**
 * 성장 곡선의 **연속성** 락 (T29).
 *
 * 문제였던 것: 활동 성장률이 스탯 85에서 두 번 끊겼다 — 감쇠 계단(0.5→0.3, 무료·유료 공통)과
 * 최저 보장 절벽(baseValue×0.1 → 없음, 무료 기준 ×0.33)이 같은 좌표에서 겹쳤다. 그 결과 7년을
 * 어떻게 살든 성취 bestAxis가 85 한 점으로 빨려 들어갔다 — QA 360판에서 84.8~85.35에 89판이
 * 몰렸고(그 중 33판은 소수점까지 똑같은 84.9), **그 89판은 전부 특기 축**이었다. 50~79 구간은
 * 0판. 등급표를 옮겨도 소용없는 이유가 여기 있다 — 옮길 자리에 판이 없다.
 *
 * 그래서 이 파일은 **임계값이 아니라 곡선의 모양**을 잠근다. 등급 임계(S≥85 등)와
 * `Math.max` 합성은 #435가 정한 설계라 여기서 건드리지 않는다(ending.test.ts가 잠근다).
 *
 * 규약: 경계 좌표를 리터럴로 쓰지 않는다 — 전부 `DIMINISHING_TIERS`에서 파생한다.
 * 표를 옮기면 이 테스트가 옮겨간 자리를 검사한다.
 */
import { describe, expect, it } from 'vitest';
import {
  DIMINISHING_TIERS,
  FREE_SOFTCAP_FACTOR,
  FREE_SOFTCAP_STAT,
  GROWTH_FLOOR_RATIO,
  GROWTH_FLOOR_TAPER_FROM,
  GROWTH_FLOOR_TAPER_TO,
  applyActivity,
  createInitialState,
  getDiminishingReturn,
  growthFloorRatio,
  processWeek,
} from '../gameEngine';
import { ACTIVITIES, getActivityCost } from '../activities';
import type { GameState, StatKey, WeekLog } from '../types';

const FREE = 'self-study';   // 학업 1.5 · 무료
const PAID = 'academy';      // 학업 1.5 · 유료 (기본값이 같아야 곡선을 나란히 잴 수 있다)

function emptyLog(): WeekLog {
  return {
    statChanges: {}, fatigueChange: 0, moneyChange: 0,
    messages: [], skipped: [], milestoneMessages: [], parentBonusesApplied: [],
  } as unknown as WeekLog;
}

/**
 * 스탯 x에서 활동 1회의 실효 증가량 g(x).
 *
 * **processWeek로 감싸 재면 안 된다** — 학교 수업(학업 전용 +0.3/일)·자연 감쇠·피로 회복이
 * 섞여서 활동 곡선만 떼어볼 수 없다. 여기서는 엔진이 실제로 부르는 그 함수를 같은 인자로
 * 직접 부른다(아래 "배선" 블록이 processWeek 경로도 따로 잠근다).
 */
function gainAt(
  stat: number,
  activityId: string,
  opts: { fatigue?: number; statKey?: StatKey; mentalState?: GameState['mentalState'] } = {},
): number {
  const key: StatKey = opts.statKey ?? 'academic';
  const s: GameState = createInitialState('male', ['info', 'wealth'], { rngSeed: 1 });
  s.year = 4; s.week = 10; s.isVacation = false; s.money = 9999;
  s.fatigue = opts.fatigue ?? 0;
  s.mentalState = opts.mentalState ?? 'normal';
  s.consecutiveTiredWeeks = 0; s.idleWeeks = 0; s.activeBuffs = [];
  s.stats = { academic: 50, social: 50, talent: 50, mental: 50, health: 50, [key]: stat };
  const log = emptyLog();
  applyActivity(s, activityId, log, 0, 1.0);
  return log.statChanges[key] ?? 0;
}

/** 감쇠표에서 파생한 내부 경계들. 0과 100(표의 양 끝)은 경계가 아니다. */
const TIER_EDGES = DIMINISHING_TIERS.slice(0, -1).map(t => t.upTo);
/** 무료 활동 소프트캡이 켜지는 좌표 — 여기만은 **의도된 절벽**이라 연속성 검사에서 뺀다. */
const FREE_SOFT_CAP_AT: number = FREE_SOFTCAP_STAT;
const EPS = 0.01;

describe('성장 곡선 연속성 — 85에 벽이 없다', () => {
  it('전제 — 무료/유료 대조 활동의 기본값이 같다 (곡선을 나란히 재려면 필요)', () => {
    const free = ACTIVITIES.find(a => a.id === FREE)!;
    const paid = ACTIVITIES.find(a => a.id === PAID)!;
    expect(free.effects.academic).toBe(paid.effects.academic);
    expect(getActivityCost(free, 4)).toBe(0);
    expect(getActivityCost(paid, 4)).toBeGreaterThan(0);
    // 소프트캡 좌표는 activities/engine 쪽 설계값이다. 이 테스트가 그 좌표를 "예외"로 빼고
    // 있으므로, 좌표가 표의 경계와 겹치면(예: 85로 이동) 예외가 엉뚱한 데를 가린다.
    expect(TIER_EDGES).not.toContain(FREE_SOFT_CAP_AT);
  });

  it('무료 활동은 85 앞뒤에서 성장률이 거의 같다 (요구된 핵심 단언)', () => {
    // 85는 성취 S 임계이자 예전 최저 보장 절벽의 좌표다. 이 두 값의 비가 1에서 멀어지면
    // 평형점이 다시 한 점으로 빨려 들어간다.
    const lo = gainAt(85 - EPS, FREE);
    const hi = gainAt(85 + EPS, FREE);
    expect(lo, '85 바로 아래에서 무료 활동이 아예 안 오르면 비가 무의미해진다').toBeGreaterThan(0);
    expect(hi / lo).toBeGreaterThan(0.95);
    expect(hi / lo).toBeLessThan(1.05);
  });

  it('유료 활동도 85 앞뒤에서 성장률이 거의 같다', () => {
    const lo = gainAt(85 - EPS, PAID);
    const hi = gainAt(85 + EPS, PAID);
    expect(lo).toBeGreaterThan(0);
    expect(hi / lo).toBeGreaterThan(0.95);
    expect(hi / lo).toBeLessThan(1.05);
  });

  it('85만이 아니라 감쇠표의 모든 경계에서 연속이다 (무료 소프트캡 좌표만 예외)', () => {
    // 85 하나만 이으면 옆 경계로 벽이 이사 간다. 표에서 파생한 경계 전부를 본다.
    for (const edge of TIER_EDGES) {
      for (const id of [FREE, PAID]) {
        if (id === FREE && edge === FREE_SOFT_CAP_AT) continue;
        const lo = gainAt(edge - EPS, id);
        const hi = gainAt(edge + EPS, id);
        expect(lo, `${id} x=${edge}-`).toBeGreaterThan(0);
        expect(hi / lo, `${id} 경계 ${edge}`).toBeGreaterThan(0.95);
        expect(hi / lo, `${id} 경계 ${edge}`).toBeLessThan(1.05);
      }
    }
  });

  it('유·무료 갈림은 그대로 — 무료는 80에서 여전히 절벽이다 (음성 대조)', () => {
    // 위 테스트들이 "전부 평평하게 밀어서" 통과하는 게 아님을 보인다.
    // 80+ 무료 ×0.1 캡은 유료를 85+ 통로로 만드는 설계라 **유지되어야** 한다.
    const before = gainAt(FREE_SOFT_CAP_AT - EPS, FREE);
    const after = gainAt(FREE_SOFT_CAP_AT + EPS, FREE);
    expect(after / before, '무료 소프트캡이 사라졌다').toBeLessThan(0.5);
    // 같은 좌표에서 유료는 안 끊긴다 — 캡이 무료 전용임을 같이 잠근다.
    const paidBefore = gainAt(FREE_SOFT_CAP_AT - EPS, PAID);
    const paidAfter = gainAt(FREE_SOFT_CAP_AT + EPS, PAID);
    expect(paidAfter / paidBefore).toBeGreaterThan(0.95);
    // 그리고 고구간에서 유료가 무료보다 확실히 크다(성취 85+ 통로).
    expect(gainAt(88, PAID)).toBeGreaterThan(gainAt(88, FREE) * 3);
  });

  it('감쇠 곡선은 단조 감소이고 계단이 아니다 (양방향)', () => {
    let prev = Infinity;
    for (let x = 0; x <= 100; x += 0.5) {
      const v = getDiminishingReturn(x);
      expect(v, `x=${x} 감쇠가 증가했다`).toBeLessThanOrEqual(prev + 1e-9);
      prev = v;
    }
    // 계단으로 되돌리면 잡힌다 — 경계 양옆 값이 같으면 그건 계단이다.
    for (const edge of TIER_EDGES) {
      const jump = getDiminishingReturn(edge - EPS) / getDiminishingReturn(edge + EPS);
      expect(jump, `감쇠 경계 ${edge}가 계단이다`).toBeLessThan(1.02);
    }
    // 표의 값을 버리지도 않는다 — 각 구간이 **시작하는 좌표**에서 계단값 그대로다.
    DIMINISHING_TIERS.forEach((t, i) => {
      const start = i === 0 ? 0 : DIMINISHING_TIERS[i - 1].upTo;
      expect(getDiminishingReturn(start), `구간 시작 ${start}`).toBeCloseTo(t.factor, 9);
    });
    // 그리고 **어느 좌표에서도 계단보다 커지지 않는다**. 이 방향성이 T29의 안전장치다 —
    // 구간 중앙에 마디를 두는 판본(=계단값의 평균을 보존하는 판본)은 각 구간 윗절반에서
    // 계단을 넘었고, 그 여유분이 고스란히 "무료 플레이가 85를 넘는 힘"이 돼서 성취 S를
    // 87.5% → 96.7%로 **악화**시켰다(360판 실측). 연속화가 완화로 새면 안 된다.
    const stepAt = (x: number): number => {
      for (const t of DIMINISHING_TIERS) if (x < t.upTo) return t.factor;
      return DIMINISHING_TIERS[DIMINISHING_TIERS.length - 1].factor;
    };
    for (let x = 0; x <= 100; x += 0.25) {
      expect(getDiminishingReturn(x), `x=${x} 감쇠가 계단보다 커졌다`)
        .toBeLessThanOrEqual(stepAt(x) + 1e-12);
    }
  });
});

describe('성장 최저 보장 — 절벽이 아니라 경사로', () => {
  it('테이퍼 구간이 두 표에서 파생된다 (세 숫자가 각자 놀지 않는다)', () => {
    // 시작은 감쇠표의 마디, 끝은 무료 소프트캡 문턱. 둘 다 리터럴이 아니라 파생이라
    // 어느 한쪽을 옮기면 테이퍼가 따라온다.
    expect(DIMINISHING_TIERS.map(t => t.upTo)).toContain(GROWTH_FLOOR_TAPER_FROM);
    expect(GROWTH_FLOOR_TAPER_TO).toBe(FREE_SOFTCAP_STAT);
    expect(GROWTH_FLOOR_TAPER_FROM).toBeLessThan(GROWTH_FLOOR_TAPER_TO);
    // 그리고 **딱 한 구간**만 쓴다 — 소프트캡 바로 아래 마디에서 시작한다.
    // 더 넓히면(예: 50) 중반 성장까지 바닥이 얇아지고, 더 좁히면 절벽에 가까워진다.
    // 이 단언이 없으면 시작점을 50으로 옮기는 변형이 조용히 통과한다(실측: 바닥은 80 미만에서
    // 거의 구속하지 않으므로 다른 단언으로는 안 잡힌다).
    const boundaryBelowCap = Math.max(
      ...DIMINISHING_TIERS.map(t => t.upTo as number).filter(u => u < FREE_SOFTCAP_STAT),
    );
    expect(GROWTH_FLOOR_TAPER_FROM, '테이퍼가 한 구간보다 넓거나 좁다').toBe(boundaryBelowCap);
  });

  it('70까지 전액, 80에서 0, 사이는 단조 감소 — 어디에도 절벽이 없다', () => {
    expect(growthFloorRatio(0)).toBe(GROWTH_FLOOR_RATIO);
    expect(growthFloorRatio(GROWTH_FLOOR_TAPER_FROM)).toBe(GROWTH_FLOOR_RATIO);
    expect(growthFloorRatio(GROWTH_FLOOR_TAPER_TO)).toBe(0);
    expect(growthFloorRatio(100)).toBe(0);
    let prev = Infinity;
    for (let x = 0; x <= 100; x += 0.25) {
      const v = growthFloorRatio(x);
      expect(v).toBeLessThanOrEqual(prev + 1e-12);
      expect(v).toBeGreaterThanOrEqual(0);
      prev = v;
    }
  });

  it('바닥은 무료 소프트캡 문턱을 **넘겨 살지 않는다** (양방향 고정)', () => {
    // 이게 T29의 핵심 계약이다. 바닥은 감쇠·피로·소프트캡을 하나도 안 맞는 상수 수입이라,
    // 소프트캡 구간까지 살아 있으면 "유료 = 고구간 통로"가 지워지고 무료 플레이가 캡을 타고
    // 넘어간다 — 70→95로 늘린 판본이 성취 S를 87.5% → 96.7%로 악화시킨 실측이 그 증거다.
    expect(growthFloorRatio(FREE_SOFTCAP_STAT), '캡 문턱에서 바닥이 남아 있다').toBe(0);
    expect(growthFloorRatio(FREE_SOFTCAP_STAT + 5), '캡 위에 바닥이 있다').toBe(0);
    expect(growthFloorRatio(85), '옛 절벽 좌표에도 바닥이 없어야 한다').toBe(0);
    // 그렇다고 문턱 **앞에서** 통째로 0이면 그건 절벽을 앞당긴 것일 뿐이다.
    const mid = (GROWTH_FLOOR_TAPER_FROM + GROWTH_FLOOR_TAPER_TO) / 2;
    expect(growthFloorRatio(mid), '테이퍼 중간이 0 = 절벽이 앞으로 옮겨갔다').toBeGreaterThan(0);
    expect(growthFloorRatio(mid), '테이퍼 중간이 전액 = 테이퍼가 없다').toBeLessThan(GROWTH_FLOOR_RATIO);
    // 선형인지도 잠근다: 중간점은 정확히 절반.
    expect(growthFloorRatio(mid)).toBeCloseTo(GROWTH_FLOOR_RATIO / 2, 12);
  });

  it('평형점이 투입량에 **비례해 흩어진다** — 벽이 사라진 진짜 이유', () => {
    // 절벽이면 슬롯을 몇 칸 붓든 평형점이 같은 좌표(=옛 85)에 박힌다. 경사로면 투입량이
    // 커질수록 평형점이 위로 밀린다. 이 단조성이 50~84 구간에 판이 놓이는 메커니즘이다.
    const base = 1.5;             // self-study 학업 기본값
    const decay = 0.3;            // 고등 학업 자연 감쇠 /주
    const equilibrium = (slots: number): number => {
      for (let x = 100; x >= 0; x -= 0.1) {
        if (slots * base * growthFloorRatio(x) >= decay) return Math.round(x * 10) / 10;
      }
      return 0;
    };
    const e2 = equilibrium(2), e3 = equilibrium(3), e4 = equilibrium(4);
    expect(e2, '2슬롯').toBeLessThan(e3);
    expect(e3, '3슬롯').toBeLessThan(e4);
    // 그리고 그 평형점들이 옛 벽(85)에 몰려 있지 않아야 한다.
    expect(e4, '바닥만으로 캡 문턱을 넘는다').toBeLessThan(FREE_SOFTCAP_STAT);
  });
});

describe('배선 — applyActivity가 실제로 이 두 함수를 쓴다', () => {
  it('보장이 구속하는 좌표에서 로그 증가량이 baseValue×growthFloorRatio와 정확히 같다', () => {
    // 감쇠·피로·번아웃을 다 맞아 바닥 아래로 내려간 좌표. 여기서 값이 바닥과 다르면
    // applyActivity가 growthFloorRatio를 안 부르고 있다는 뜻이다(순수함수만 잠그는 함정 회피).
    const stat = GROWTH_FLOOR_TAPER_FROM + 1;   // 테이퍼 초입 — 바닥이 아직 두껍다
    const base = ACTIVITIES.find(a => a.id === FREE)!.effects.academic!;
    const expected = base * growthFloorRatio(stat);
    expect(expected, '이 좌표에서 바닥이 0이면 검사가 무의미하다').toBeGreaterThan(0);
    const got = gainAt(stat, FREE, { fatigue: 95, mentalState: 'burnout' });
    expect(got).toBeCloseTo(expected, 9);
  });

  it('보장이 구속하지 않는 좌표에서는 바닥보다 크다 (바닥으로 고정된 게 아니다)', () => {
    const stat = 60;
    const base = ACTIVITIES.find(a => a.id === FREE)!.effects.academic!;
    expect(gainAt(stat, FREE)).toBeGreaterThan(base * growthFloorRatio(stat) * 2);
  });

  it('무료 소프트캡 계수 상수가 실제로 쓰인다 (리터럴로 되돌리면 잡힌다)', () => {
    // FREE_SOFTCAP_FACTOR를 상수로 꺼낸 이유는 바닥 테이퍼가 FREE_SOFTCAP_STAT을 파생해
    // 쓰기 때문이다. 상수만 만들고 applyActivity가 계속 리터럴을 쓰면 둘이 갈라진다.
    const above = FREE_SOFTCAP_STAT + 6;   // 바닥이 0인 구간 — 캡 효과만 남는다
    expect(growthFloorRatio(above)).toBe(0);
    expect(gainAt(above, FREE) / gainAt(above, PAID)).toBeCloseTo(FREE_SOFTCAP_FACTOR, 9);
  });

  it('제품 경로(processWeek)에도 벽이 없다 — 한 주를 실제로 돌려서 확인', () => {
    // 위 블록은 applyActivity를 직접 부른다. App이 부르는 경로는 processWeek다(#397 계열:
    // 함수는 잠겼는데 아무도 안 부르는 상태가 그린이었다).
    //
    // 측정은 **스탯이 아니라 weekLog**로 한다: processWeek는 최종 스탯을 0.1로 반올림하므로
    // 0.01 해상도의 경계를 스탯으로는 못 잰다(실측: 반올림 눈금이 비를 0.5로 만든다).
    // log.statChanges는 raw 누적이라 해상도가 살아 있다.
    //
    // 축은 **특기**를 쓴다. 학업에는 applySchoolClass가 평일마다 +0.3을 따로 얹어서
    // 활동 곡선의 점프를 희석한다 — 특기에는 그 채널이 없어 활동 몫만 남는다.
    // 자연 감쇠도 log에 들어가지만 두 좌표에서 같은 값이라 비에서 상쇄되지 않고 **남으므로**,
    // 아래 비는 오히려 보수적이다(점프를 과소평가한다).
    const weekLogged = (talent: number): number => {
      const s: GameState = createInitialState('male', ['info', 'wealth'], { rngSeed: 7 });
      s.year = 4; s.week = 10; s.isVacation = false; s.money = 9999; s.fatigue = 30;
      s.stats = { academic: 50, social: 50, talent, mental: 50, health: 50 };
      s.routineSlot2 = 'creative'; s.routineSlot3 = 'club'; s.weekendChoices = ['creative'];
      return processWeek(s).weekLog!.statChanges.talent!;
    };
    const lo = weekLogged(85 - EPS), hi = weekLogged(85 + EPS);
    expect(lo, '85 바로 아래 특기 순증이 0 이하 — 비가 무의미해진다').toBeGreaterThan(0);
    expect(hi / lo, '제품 경로에서 85 벽이 살아 있다').toBeGreaterThan(0.9);
    expect(hi / lo).toBeLessThan(1.1);
  });
});
