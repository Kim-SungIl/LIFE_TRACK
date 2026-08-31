import { describe, expect, it } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import type { GameState, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const RNG_SEED = 42;

function fixture(overrides: Partial<GameState> = {}): GameState {
  const state = createInitialState('male', PARENTS, { rngSeed: RNG_SEED });
  state.weekendChoices = ['self-study'];
  return Object.assign(state, overrides);
}

describe('processWeek', () => {
  it('does not mutate the input state (deep equality vs structuredClone)', () => {
    const state = fixture();
    const before = structuredClone(state);

    processWeek(state);

    expect(state).toEqual(before);
  });

  it('is deterministic for the same rngSeed and choices', () => {
    const a = processWeek(fixture());
    const b = processWeek(fixture());

    expect(a).toEqual(b);
  });

  it('advances rngSeed (seededRandom call order is a contract)', () => {
    // gameEngine.ts prepareWeekContext: seededRandom 2회 호출 순서는 rngSeed 전진 계약.
    // 시드 전진 + 시드 순서 의존 필드를 스냅샷으로 고정해 회귀를 잡는다.
    const input = fixture();
    const inputSeed = input.rngSeed;
    const after = processWeek(input);

    expect(after.rngSeed).not.toBe(inputSeed);

    // 시드 순서에 의존하는 주 시작 필드를 스냅샷으로 고정
    expect({
      rngSeed: after.rngSeed,
      npcEventPendingThisWeek: after.npcEventPendingThisWeek,
      parentEventPendingThisWeek: after.parentEventPendingThisWeek,
      currentEventId: after.currentEvent?.id ?? null,
      phase: after.phase,
    }).toMatchInlineSnapshot(`
      {
        "currentEventId": "first-week",
        "npcEventPendingThisWeek": false,
        "parentEventPendingThisWeek": false,
        "phase": "event",
        "rngSeed": 378494188,
      }
    `);
  });

  // 궤적 적립의 임계는 **경계에서** 잠근다. 예전엔 mental 12(저멘탈)와 80(정상)으로 재서
  // 경계에서 멀었고, 그래서 `< 40`을 `<= 40`·`< 39`·`< 80` 어느 쪽으로 바꿔도 전 스위트가
  // 통과했다(검수 실측 LEAKED). 아래 입력값은 processWeek 후 mental이 정확히 39/40/24/25에
  // 착지하도록 손으로 뽑은 값이다 — 착지값 자체를 toBe로 단언하므로, 엔진이 바뀌어 경계에서
  // 벗어나면 조용히 통과하는 대신 이 테스트가 먼저 깨진다.
  function weekEndingAtMental(mentalIn: number, year = 3) {
    return processWeek(fixture({
      year,
      week: 10,
      stats: { academic: 40, social: 40, talent: 20, mental: mentalIn, health: 40 },
      weekendChoices: ['rest'],
    }));
  }

  it('low(mental<40) 경계: 39는 저멘탈 주, 40은 아니다', () => {
    const at39 = weekEndingAtMental(37);
    expect(at39.stats.mental, '픽스처가 경계 39에 착지해야 이 테스트가 의미를 가진다').toBe(39);
    expect(at39.lowMentalWeeksByYear).toEqual([0, 0, 1, 0, 0, 0, 0]);

    const at40 = weekEndingAtMental(38);
    expect(at40.stats.mental, '픽스처가 경계 40에 착지해야 한다').toBe(40);
    expect(at40.lowMentalWeeksByYear).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('veryLow(mental<25) 경계: 24는 바닥 주, 25는 아니다 (저멘탈로는 둘 다 셈)', () => {
    const at24 = weekEndingAtMental(22, 1);
    expect(at24.stats.mental, '픽스처가 경계 24에 착지해야 한다').toBe(24);
    expect(at24.veryLowMentalWeeksByYear).toEqual([1, 0, 0, 0, 0, 0, 0]);
    expect(at24.lowMentalWeeksByYear[0], '24는 저멘탈이기도 하다').toBe(1);

    const at25 = weekEndingAtMental(23, 1);
    expect(at25.stats.mental, '픽스처가 경계 25에 착지해야 한다').toBe(25);
    expect(at25.veryLowMentalWeeksByYear).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(at25.lowMentalWeeksByYear[0], '25는 바닥은 아니지만 여전히 저멘탈이다').toBe(1);
  });

  it('burnout increments burnoutCountByYear on the year it happens, not a neighbor', () => {
    const before = fixture({
      year: 5,
      week: 8,
      mentalState: 'tired',
      fatigue: 80,
      burnoutCooldown: 0,
      consecutiveTiredWeeks: 0,
      stats: { academic: 40, social: 40, talent: 20, mental: 15, health: 40 },
      weekendChoices: ['self-study'],
    });
    const after = processWeek(before);
    expect(after.burnoutCount).toBe(before.burnoutCount + 1);
    expect(after.burnoutCountByYear).toEqual([0, 0, 0, 0, 1, 0, 0]);
    expect(after.burnoutCountByYear.reduce((a, b) => a + b, 0)).toBe(1);
  });

  // 번아웃 진입 경로는 **둘**이다. 위 테스트는 일반 진입만 덮어서, 만성 탈진 경로의
  // 학년 적립을 통째로 지워도 전 스위트가 통과했다(검수 실측 LEAKED). 여기서 그 경로를 잠근다.
  it('만성 탈진(연속 tired 24주) 강제 번아웃도 학년 슬롯에 적립한다', () => {
    const chronic = (consecutiveTiredWeeks: number) => fixture({
      year: 6,
      week: 20,
      mentalState: 'tired',
      fatigue: 60,
      burnoutCooldown: 0,
      consecutiveTiredWeeks,
      // 멘탈 26 → 그 주 최종 29. 일반 게이트(mental<20, 또는 <25 && 피로>70)에 안 걸리는 값이라
      // 여기서 번아웃이 나면 그건 만성 경로뿐이다.
      stats: { academic: 40, social: 40, talent: 20, mental: 26, health: 40 },
      weekendChoices: ['self-study'],
    });

    // 음성 대조 — 23주면 안 터진다. 이게 없으면 "일반 경로가 터진 것"과 구분이 안 된다.
    const notYet = processWeek(chronic(23));
    expect(notYet.mentalState, '23주는 아직 강제 번아웃이 아니다').not.toBe('burnout');
    expect(notYet.burnoutCountByYear.reduce((a, b) => a + b, 0)).toBe(0);

    const before = chronic(24);
    const after = processWeek(before);
    expect(after.mentalState, '24주에서 만성 탈진이 강제 번아웃으로 전환한다').toBe('burnout');
    expect(after.burnoutCount, '누적 카운터도 오른다').toBe(before.burnoutCount + 1);
    expect(after.burnoutCountByYear, '그 해 슬롯(Y6)에만 적립된다').toEqual([0, 0, 0, 0, 0, 1, 0]);
    // 두 카운터가 갈리면 진로 축(burnoutCount)과 행복 축(배열)이 어긋난다 — 그게 이 기능의 결함이었다.
    expect(after.burnoutCountByYear.reduce((a, b) => a + b, 0)).toBe(after.burnoutCount);
  });
});
