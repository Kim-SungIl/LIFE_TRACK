// @vitest-environment jsdom
// 주간 결산의 **피로 축**이 실제로 일어난 변화를 말하는가. (T53)
//
// #442(스탯)·#448(이벤트 몫)·#453(주 확정 전 효과)이 차례로 "결산은 그 주 모든 것"을 잠갔지만
// 피로 축만 열려 있었다. 이유는 클램프다: 회복·수업·활동·상태전환이 각자 **원값**을
// `log.fatigueChange`에 더했는데 `state.fatigue`는 매번 0~100으로 잘렸다.
//
//   · 피로 5에서 휴식 두 칸을 넣은 방학 주 → 실제 -5인데 로그는 **-25**
//   · 피로 97에서 갈아넣은 방학 주       → 실제 -2인데 로그는 **+29**(결산이 "피로 누적"을 그린다)
//
// 게다가 장기 tired 자력 탈출의 피로 -3(gameEngine checkMentalStateTransition)은 로그에 아예
// 안 적히던 쓰기였다 — 더하는 자리를 일일이 맞추는 방식 자체가 새는 구조였다.
//
// 그래서 지금은 `processWeek`이 클램프·반올림이 끝난 뒤 **주 시작값 대비 실제 차이**를 한 번에
// 적는다. 이 파일이 잠그는 계약은 하나다:
//
//     round1(확정후 피로 − 주 시작 피로) === weekLog.fatigueChange
//
// 이벤트 몫(store `foldOutcomeIntoWeekLog`)과 주 확정 전 효과(`foldPendingIntoLog`)는 **이미
// 실제 델타**라 그 줄 뒤에 더해진다 — 순서가 뒤집히면 둘이 지워진다. 아래 마지막 두 describe가
// 그 순서를 잠근다.
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store';
import { processWeek } from '../gameEngine';
import { ACTIVITIES, canApplyActivity, getActivityCost } from '../activities';
import { makeState } from '../../test/fixtures';
import type { GameState, GameEvent, ParentStrength } from '../types';

const round1 = (n: number) => Math.round(n * 10) / 10;

// 엔진이 주차에서 방학을 재계산한다(prepareWeekContext) — 픽스처의 isVacation과 week은 짝을 맞춘다.
const SEMESTER_WEEK = 10;
const VACATION_WEEK = 22;

/** 피로 로그가 실제 변화와 어긋나면 사람이 읽을 수 있는 사유, 맞으면 null. */
function fatigueLie(before: GameState, after: GameState): string | null {
  const actual = round1(after.fatigue - before.fatigue);
  const logged = round1(after.weekLog?.fatigueChange ?? 0);
  return actual === logged ? null : `실제 ${actual}인데 로그는 ${logged}`;
}

/** 돈 축도 같은 질문 — 주 시작 잔액 + 로그 = 확정 후 잔액. */
function moneyLie(before: GameState, after: GameState): string | null {
  const actual = round1(after.money - before.money);
  const logged = round1(after.weekLog?.moneyChange ?? 0);
  return actual === logged ? null : `실제 ${actual}인데 로그는 ${logged}`;
}

function week(patch: Partial<GameState>): { before: GameState; after: GameState } {
  const before = makeState(patch);
  return { before, after: processWeek(before) };
}

describe('피로 로그 = 그 주에 실제로 일어난 변화', () => {
  // ── (i) 0 바닥에 **닿는** 주. 닿지 않으면 옛 방식도 맞았으므로 이 픽스처가 아무것도 못 본다.
  describe('0 바닥에 닿는 주 (회복이 남는 피로보다 크다)', () => {
    const REST_WEEK: Partial<GameState> = {
      year: 3, week: VACATION_WEEK, isVacation: true, fatigue: 5,
      vacationChoices: ['rest', 'rest'], routineSlot2: null, routineSlot3: null,
    };

    it('착지 피로가 0이고, 로그는 그 주에 실제로 빠진 5만 말한다', () => {
      const { before, after } = week(REST_WEEK);
      expect(after.fatigue, '전제: 이 주는 0 바닥에 닿아야 한다 — 안 닿으면 클램프를 안 지난다').toBe(0);
      expect(after.weekLog!.skipped, '전제: 스킵 없이 계획대로 다 돌았다').toEqual([]);
      expect(fatigueLie(before, after)).toBeNull();
      // 착지값을 박는다 — 원값 합산(회복 -7, 휴식 -10 -10 = -27)이 아니라 실제로 빠진 5다.
      expect(after.weekLog!.fatigueChange, '0에서 더 빠질 수 없는 만큼까지 로그에 적으면 거짓말이다').toBe(-5);
    });

    // 0 바닥이 **정말로 잘랐는가**를 구조로 증명한다: 휴식을 한 칸 더 넣어도 착지가 같다.
    it('휴식을 한 칸 더 넣어도 착지가 같다 — 바닥이 잘랐다는 증거', () => {
      const two = week(REST_WEEK).after;
      const three = week({ ...REST_WEEK, vacationChoices: ['rest', 'rest', 'rest'] }).after;
      expect(three.fatigue, '한 칸 더 쉬어도 같은 자리면 바닥에서 포화된 것이다').toBe(two.fatigue);
      expect(three.weekLog!.fatigueChange).toBe(two.weekLog!.fatigueChange);
    });

    // 음성 대조 — 여유가 있는 피로에서는 같은 한 칸이 **실제로** 차이를 만든다.
    // 없으면 위 테스트는 "휴식 칸이 아예 안 먹는" 엔진에서도 통과한다.
    it('여유가 있으면 같은 한 칸이 차이를 만든다 (포화가 아니라는 대조군)', () => {
      const two = week({ ...REST_WEEK, fatigue: 60 }).after;
      const three = week({ ...REST_WEEK, fatigue: 60, vacationChoices: ['rest', 'rest', 'rest'] }).after;
      expect(three.fatigue, '바닥에서 멀면 한 칸이 더 빠져야 한다').toBeLessThan(two.fatigue);
      expect(three.weekLog!.fatigueChange).toBeLessThan(two.weekLog!.fatigueChange);
      expect(fatigueLie(makeState({ ...REST_WEEK, fatigue: 60 }), two)).toBeNull();
    });
  });

  // ── (ii) 100 천장에 **닿는** 주. 옛 로그가 가장 크게 거짓말하던 구간이다.
  describe('100 천장에 닿는 주 (가산이 남은 여유보다 크다)', () => {
    // 방학 자유 슬롯을 갈아넣는 주 — 주중 수업·루틴이 없어 활동 가산만으로 천장을 친다.
    const GRIND: Partial<GameState> = {
      year: 6, week: VACATION_WEEK, isVacation: true, fatigue: 97, money: 100000,
      vacationChoices: Array.from({ length: 6 }, () => 'school-sports'),
      routineSlot2: null, routineSlot3: null,
    };

    it('천장을 친 주의 로그는 **음수**다 — 실제로는 피로가 내려갔다', () => {
      const { before, after } = week(GRIND);
      expect(after.weekLog!.skipped, '전제: 계획한 6칸이 전부 실제로 돌았다').toEqual([]);
      expect(after.fatigue, '전제: 주 시작보다 낮게 끝난다(회복 + tired 자동 회복)')
        .toBeLessThan(before.fatigue);
      expect(fatigueLie(before, after)).toBeNull();
      expect(after.weekLog!.fatigueChange,
        '원값을 더하면 +29가 된다 — 피로가 내려간 주에 결산이 "피로 누적"을 그린다').toBeLessThan(0);
    });

    it('활동을 한 칸 더 얹어도 착지가 같다 — 천장이 잘랐다는 증거', () => {
      const six = week(GRIND).after;
      const seven = week({
        ...GRIND,
        vacationChoices: Array.from({ length: 7 }, () => 'school-sports'),
      }).after;
      expect(seven.fatigue, '한 칸 더 갈아넣어도 같은 자리면 천장에서 포화된 것이다').toBe(six.fatigue);
      expect(seven.weekLog!.fatigueChange).toBe(six.weekLog!.fatigueChange);
    });

    // 음성 대조 — 여유가 있으면 같은 한 칸이 실제로 피로를 더 올린다.
    it('여유가 있으면 같은 한 칸이 피로를 더 올린다 (포화가 아니라는 대조군)', () => {
      const lowStart = { ...GRIND, fatigue: 20 };
      const six = week(lowStart).after;
      const seven = week({
        ...lowStart,
        vacationChoices: Array.from({ length: 7 }, () => 'school-sports'),
      }).after;
      expect(seven.fatigue, '천장에서 멀면 한 칸이 더 올라야 한다').toBeGreaterThan(six.fatigue);
      expect(seven.weekLog!.fatigueChange).toBeGreaterThan(six.weekLog!.fatigueChange);
      expect(fatigueLie(makeState(lowStart), six)).toBeNull();
    });

    // **`processWeek`만으로는 착지 100이 나오지 않는다**: 피로 85+는 그 주에 tired를 강제하고
    // (checkMentalStateTransition), tired는 같은 함수 안에서 피로를 -5 한다. 천장에 닿은 주는
    // 항상 그 아래로 내려앉는다. 착지 100은 이벤트 경로에만 있다(아래 describe).
    it('천장에 닿아도 착지는 100 아래다 — tired 강제 전환이 뒤따른다', () => {
      const { after } = week(GRIND);
      expect(after.mentalState, '피로 85+는 그 주에 tired를 강제한다').toBe('tired');
      expect(after.fatigue).toBeLessThan(100);
    });
  });

  // ── (iii) 클램프에 닿지 않는 평범한 주. 없으면 "항상 0을 적는" 구현도 위 둘을 통과한다.
  describe('클램프에 안 닿는 평범한 주', () => {
    it('오르는 주도 로그와 실제가 같다', () => {
      const { before, after } = week({
        year: 3, week: SEMESTER_WEEK, fatigue: 40, money: 100000,
        weekendChoices: ['school-sports'], routineSlot2: 'self-study', routineSlot3: 'light-exercise',
      });
      expect(after.fatigue, '전제: 클램프에 안 닿았다').toBeGreaterThan(0);
      expect(after.fatigue).toBeLessThan(100);
      expect(after.weekLog!.fatigueChange, '전제: 실제로 오른 주다').toBeGreaterThan(0);
      expect(fatigueLie(before, after)).toBeNull();
    });

    it('내려가는 주도 로그와 실제가 같다', () => {
      const { before, after } = week({
        year: 3, week: SEMESTER_WEEK, fatigue: 50,
        weekendChoices: ['rest'], routineSlot2: 'self-study', routineSlot3: 'self-study',
      });
      expect(after.fatigue).toBeGreaterThan(0);
      expect(after.fatigue).toBeLessThan(100);
      expect(after.weekLog!.fatigueChange, '전제: 실제로 내려간 주다').toBeLessThan(0);
      expect(fatigueLie(before, after)).toBeNull();
    });
  });

  // 로그에 아예 안 적히던 쓰기 — 8주+ 연속 tired의 자력 탈출 보조(피로 -3)가 그랬다.
  // 더하는 자리를 손으로 맞추는 방식이면 새 쓰기가 생길 때마다 같은 구멍이 다시 난다.
  it('장기 tired 자력 탈출의 피로 -3도 로그에 들어온다 (옛 방식에선 통째로 누락)', () => {
    const { before, after } = week({
      year: 3, week: SEMESTER_WEEK, fatigue: 30,
      mentalState: 'tired', consecutiveTiredWeeks: 10,
      stats: { academic: 40, social: 40, talent: 40, mental: 30, health: 40 },
      routineSlot2: 'self-study', routineSlot3: 'self-study',
    });
    expect(before.fatigue, '전제: 자력 탈출 보조 조건(8주+ 연속 tired, 피로<60)에 든다').toBeLessThan(60);
    expect(fatigueLie(before, after)).toBeNull();
  });
});

// 돈 축에는 같은 결함이 **없다** — 구조가 다르기 때문이다.
//   · 지출: `applyActivity`의 `state.money < 0 → 0` 클램프는 도달 불가다. 선택·루틴 슬롯 모두
//     적용 **전에** `state.money < cost`면 스킵하므로(gameEngine applyWeekendActivities/
//     applyRoutineActivities) 차감 결과가 음수가 될 수 없다.
//   · 수입: `applyAllowanceAndLiving`은 클램프 없이 더한다(생활비가 커도 잔액은 음수로 간다).
// 즉 돈은 "원값 == 실제 적용값"이라 옛 방식으로도 맞았다. 다만 **그 이유가 스킵 게이트**이므로
// 게이트가 사라지면 돈도 같은 거짓말을 시작한다 — 그 이유를 여기서 잠근다.
describe('돈 로그 = 그 주에 실제로 오간 액수 (스킵 게이트가 그 이유다)', () => {
  const YEAR = 3;
  const base: Partial<GameState> = {
    year: YEAR, week: SEMESTER_WEEK, fatigue: 40,
    routineSlot2: 'self-study', routineSlot3: 'self-study',
  };
  // 활동 id를 손으로 박지 않는다 — 카탈로그가 바뀌면 "게이트에 막혀 아무것도 안 한 주"를
  // 검사하는 테스트로 조용히 변한다(실측: private-tutoring은 중1에 아직 안 열린다).
  const paid = ACTIVITIES.find(a =>
    a.slots === 1 && !a.seasonGate && getActivityCost(a, YEAR) > 0
    && canApplyActivity(makeState({ ...base, money: 100000 }), a.id));

  it('전제: 그 학년에 실제로 할 수 있는 유료 활동이 있다', () => {
    expect(paid, `${YEAR}학년에 고를 수 있는 유료 1칸 활동이 없으면 이 축은 검사할 대상이 없다`)
      .toBeTruthy();
  });

  it('감당 못 하는 활동은 적용 전에 스킵되어 로그가 지출을 지어내지 않는다', () => {
    const cost = getActivityCost(paid!, YEAR);
    const { before, after } = week({
      ...base, money: round1(cost - 0.5), weekendChoices: [paid!.id],
    });
    expect(after.weekLog!.skipped.some(s => s.activityId === paid!.id && s.reason === 'money'),
      '전제: 잔액이 모자라 money 사유로 스킵됐다 — 이게 0 클램프를 도달 불가로 만드는 이유다')
      .toBe(true);
    expect(moneyLie(before, after)).toBeNull();
  });

  it('여유가 있으면 같은 활동이 실제로 돌고 그만큼만 로그에 적힌다', () => {
    const { before, after } = week({ ...base, money: 100000, weekendChoices: [paid!.id] });
    expect(after.weekLog!.skipped, '전제: 이번엔 스킵 없이 돌았다').toEqual([]);
    expect(round1(after.money - before.money),
      '전제: 유료 활동이 돈을 실제로 깎았다 — 용돈만 들어온 주면 이 테스트가 아무것도 못 본다')
      .toBeLessThan(round1(week({ ...base, money: 100000 }).after.money - 100000));
    expect(moneyLie(before, after)).toBeNull();
  });
});

// 여기부터는 store 경로 — 이벤트 몫이 **그 줄 뒤에** 더해지는가.
// `log.fatigueChange = ...`가 `foldPendingIntoLog`/이벤트 접기보다 뒤로 가면 둘을 통째로 지운다.
describe('이벤트 몫과 합산된 뒤에도 로그 = 실제 변화', () => {
  const FREEDOM: [ParentStrength, ParentStrength] = ['freedom', 'info'];

  function synthetic(fatigueEffect: number): GameEvent {
    return {
      id: 'test_t53_fatigue_fold',
      title: '테스트',
      description: '테스트',
      choices: [{ text: '고른다', effects: {}, fatigueEffect }],
    } as GameEvent;
  }

  /** 한 주를 실제로 확정한 뒤, 그 주의 로그 위에 합성 이벤트를 해소한다. */
  function resolveAfterWeek(patch: Partial<GameState>, fatigueEffect: number) {
    const before = makeState(patch);
    const after = processWeek(before);
    expect(after.weekLog, '전제: 확정된 주의 로그가 있다').toBeTruthy();
    useGameStore.setState({
      state: { ...after, phase: 'event' as GameState['phase'], currentEvent: synthetic(fatigueEffect) },
    });
    const applied = useGameStore.getState().resolveEvent(0);
    return { before, afterWeek: after, applied, final: useGameStore.getState().state! };
  }

  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
  });

  it('이벤트가 올린 피로가 주간 로그에 더해진다 (주 몫을 덮어쓰지 않는다)', () => {
    const { before, afterWeek, applied, final } = resolveAfterWeek({
      year: 3, week: SEMESTER_WEEK, fatigue: 40,
      routineSlot2: 'self-study', routineSlot3: 'self-study',
    }, 8);
    expect(applied!.fatigue, '전제: 선택지가 실제로 피로를 8 올렸다(여유 구간이라 감쇠 없음)').toBe(8);
    expect(final.weekLog!.fatigueChange, '주 몫 + 이벤트 몫이어야 한다 — 덮어쓰면 주 몫이 사라진다')
      .toBe(round1(afterWeek.weekLog!.fatigueChange + 8));
    expect(fatigueLie(before, final), '주 시작값 대비 실제 차이와도 같아야 한다').toBeNull();
  });

  it('이벤트가 100 천장에 막히면 막힌 만큼만 들어온다 (착지 100)', () => {
    const { before, afterWeek, applied, final } = resolveAfterWeek({
      year: 6, week: VACATION_WEEK, isVacation: true, fatigue: 97, money: 100000,
      parents: FREEDOM,
      vacationChoices: Array.from({ length: 6 }, () => 'school-sports'),
      routineSlot2: null, routineSlot3: null,
    }, 60);
    expect(final.fatigue, '전제: 이벤트가 천장에 막혀 정확히 100에 착지한다').toBe(100);
    expect(applied!.fatigue, '적용값은 원본 60이 아니라 실제로 오른 만큼이다')
      .toBe(round1(100 - afterWeek.fatigue));
    expect(applied!.fatigue).toBeLessThan(60);
    expect(fatigueLie(before, final), '원본 60을 접으면 결산이 없는 피로를 지어낸다').toBeNull();
  });

  it('이벤트가 0 바닥에 막히면 아무것도 안 들어온다 (착지 0)', () => {
    const { before, afterWeek, applied, final } = resolveAfterWeek({
      year: 3, week: VACATION_WEEK, isVacation: true, fatigue: 5,
      vacationChoices: ['rest', 'rest'], routineSlot2: null, routineSlot3: null,
    }, -20);
    expect(afterWeek.fatigue, '전제: 주 확정 시점에 이미 0이다').toBe(0);
    expect(final.fatigue, '전제: 0에서 더 빠질 수 없다').toBe(0);
    expect(applied!.fatigue, '실제 적용이 0이면 접을 것도 없다').toBeUndefined();
    expect(final.weekLog!.fatigueChange, '원본 -20을 접으면 결산이 없는 회복을 지어낸다')
      .toBe(afterWeek.weekLog!.fatigueChange);
    expect(fatigueLie(before, final)).toBeNull();
  });
});

// 주 확정 **전**에 적용된 효과(말걸기·상점)는 `pendingWeekDelta`로 들어와 `foldPendingIntoLog`가
// 접는다. 새 줄이 그보다 **뒤**로 가면 보류분이 통째로 지워진다 — 그 순서를 여기서 잠근다.
describe('보류분(주 확정 전 효과)이 로그에 남는다 — 새 줄이 그보다 앞이다', () => {
  it('보류분 피로가 주 몫에 더해진다', () => {
    const WEEK_START = 40;   // 상점에 들르기 전 잔여 피로
    const SNACK = -3;        // 주 확정 전에 이미 state.fatigue에 반영된 몫
    const base: Partial<GameState> = {
      year: 3, week: SEMESTER_WEEK, fatigue: WEEK_START + SNACK,
      routineSlot2: 'self-study', routineSlot3: 'self-study',
    };
    // **대조군은 "보류분만 뺀 같은 상태"다.** 시작 피로가 다르면 비례 회복(15%)까지 달라져
    // 그 주 동역학 차이가 섞인다(실측 -2.5 vs -3).
    const plain = processWeek(makeState(base));
    const withPending = processWeek(makeState({
      ...base,
      pendingWeekDelta: { stats: {}, fatigue: SNACK, money: 0 },
    }));
    expect(round1(withPending.weekLog!.fatigueChange - plain.weekLog!.fatigueChange),
      '새 줄이 foldPendingIntoLog 뒤로 가면 이 차이가 0이 된다').toBe(SNACK);
    // 주 시작(= 간식 먹기 전 40)에서 본 실제 변화와도 같아야 한다.
    expect(round1(withPending.fatigue - WEEK_START)).toBe(round1(withPending.weekLog!.fatigueChange));
  });
});
