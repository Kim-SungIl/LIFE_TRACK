/**
 * QA 플레이스루 하네스(scripts/sim/sim-qa-playthrough.ts)의 **정직성** 락 — T47.
 *
 * 하네스는 밸런스 판정의 근거를 만드는 도구라, 자기 결함이 곧 밸런스 오판이 된다. 세 가지를 잠근다:
 *   1. 페르소나 유효성 판정기(validatePersona) — 부모 동일·루틴 슬롯 중복·카탈로그 부재 id.
 *   2. 페르소나 배열 자체 — `invalid` 표시와 판정이 **양방향**으로 일치한다(새 위반이 조용히 유효 표에
 *      섞이지 못하고, 낡은 표시가 유효 표본을 위반 표로 밀어내지도 못한다).
 *   3. 계측 순서 — 돈 계측(brokeWeeks·minMoney)이 이벤트 해결 **뒤**의 잔액을 읽는다. 순수 계측 함수가
 *      아니라 runPersona 배선을 주입 deps로 잠근다(#381: 순수함수만 잠그면 호출 순서가 빈다).
 *      같은 픽스처로 제품 확정 잠금 규칙 3종(UI①②③)이 runPersona에 배선돼 있는지도 본다.
 *
 * 임계·비용은 리터럴이 아니라 카탈로그(ACTIVITIES·getActivityCost)에서 파생한다.
 */
import { describe, expect, it } from 'vitest';
import { ACTIVITIES, getActivityCost } from '../activities';
import { createInitialState } from '../gameEngine';
import type { GameEvent, GameState, ParentStrength, WeekLog } from '../types';
import { validatePersona, personaMarkMismatches, type Persona } from '../../../scripts/sim/lib/qa-persona';
import {
  evaluateUiWeekGates, pickerCumulativeBlocked, previewMoneySkips, productViewOfWeek, routineTooExpensive,
} from '../../../scripts/sim/lib/qa-ui-week-gates';
import { PERSONAS, DEFAULT_DEPS, assertPersonaMarks, runPersona, type PlaythroughDeps } from '../../../scripts/sim/sim-qa-playthrough';

// ===== 카탈로그에서 파생한 픽스처 재료 =====
const routineCandidates = ACTIVITIES.filter(a => a.slots === 1 && a.category !== 'rest');   // SlotEditPopup 후보 규칙
const restActivity = ACTIVITIES.find(a => a.category === 'rest')!;
const paidRoutine = ACTIVITIES.find(a => a.id === 'academy')!;
const paidRoutine2 = ACTIVITIES.find(a => a.id === 'gym')!;
const paidWeekend = ACTIVITIES.find(a => a.id === 'art-lesson')!;
const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'freedom'];

function persona(over: Partial<Persona> = {}): Persona {
  return {
    name: 'fixture', label: '', gender: 'male', parents: PARENTS,
    routineSlot2: routineCandidates[0].id, routineSlot3: routineCandidates[1].id,
    weekend: ['rest', 'rest'], vacation: ['rest', 'rest', 'rest'], policy: 'first',
    ...over,
  };
}

describe('validatePersona — 제품이 만들 수 없는 조합', () => {
  it('재료 자체가 유효하다(전제)', () => {
    expect(routineCandidates.length).toBeGreaterThanOrEqual(2);
    expect(routineCandidates[0].id).not.toBe(routineCandidates[1].id);
    expect(validatePersona(persona())).toEqual([]);
  });

  it('부모 강점 동일 → 위반(TitleScreen toggle·lastSetup)', () => {
    const r = validatePersona(persona({ parents: ['freedom', 'freedom'] }));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatch(/부모 강점 동일/);
  });

  it('루틴 슬롯2 = 슬롯3 → 위반(SlotEditPopup 후보 제외)', () => {
    const id = routineCandidates[0].id;
    const r = validatePersona(persona({ routineSlot2: id, routineSlot3: id }));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatch(/슬롯2=슬롯3/);
  });

  it('루틴 슬롯3 비움은 유효, 슬롯2 비움은 위반(학기 중 확정 잠금)', () => {
    expect(validatePersona(persona({ routineSlot3: '' }))).toEqual([]);
    expect(validatePersona(persona({ routineSlot2: '' }))[0]).toMatch(/슬롯2 비움/);
  });

  it('카탈로그에 없는 id → 위반(루틴·주말·방학 각각)', () => {
    expect(validatePersona(persona({ routineSlot3: 'online-lecture' }))[0]).toMatch(/카탈로그.*없는 id/);
    expect(validatePersona(persona({ weekend: ['rest', 'no-such-activity'] }))[0]).toMatch(/주말 'no-such-activity'/);
    expect(validatePersona(persona({ vacation: ['no-such-activity'] }))[0]).toMatch(/방학 'no-such-activity'/);
  });

  it('루틴 슬롯에 rest 계열 → 위반, 주말의 같은 활동 중복은 유효(제품도 허용)', () => {
    expect(validatePersona(persona({ routineSlot3: restActivity.id }))[0]).toMatch(/rest 계열/);
    expect(validatePersona(persona({ weekend: [paidWeekend.id, paidWeekend.id] }))).toEqual([]);
  });

  it('여러 위반은 전부 나열된다', () => {
    const id = routineCandidates[0].id;
    const r = validatePersona(persona({ parents: ['strict', 'strict'], routineSlot2: id, routineSlot3: id }));
    expect(r).toHaveLength(2);
  });
});

describe('PERSONAS — invalid 표시와 판정이 양방향으로 일치한다', () => {
  it('표시 없는 페르소나는 전부 유효하고, 표시된 페르소나는 전부 위반이다', () => {
    expect(personaMarkMismatches(PERSONAS)).toEqual([]);
    for (const p of PERSONAS) {
      expect(validatePersona(p).length > 0, `${p.name}: ${validatePersona(p).join(' / ')}`).toBe(p.invalid === true);
    }
  });

  it('두 표가 모두 비어 있지 않다(가르는 것이 공허하지 않다)', () => {
    expect(PERSONAS.filter(p => p.invalid).length).toBeGreaterThan(0);
    expect(PERSONAS.filter(p => !p.invalid).length).toBeGreaterThan(0);
  });

  it('assertPersonaMarks — 어긋난 배열은 기동을 거부한다(양성 대조군)', () => {
    expect(() => assertPersonaMarks(PERSONAS)).not.toThrow();
    expect(() => assertPersonaMarks([persona({ parents: ['freedom', 'freedom'] })])).toThrow(/invalid 표시가 없다/);
    expect(() => assertPersonaMarks([persona({ invalid: true })])).toThrow(/표시가 낡았다/);
  });
});

// ===== 제품 확정 잠금 규칙 3종 — 단위 =====
function stateWith(over: Partial<GameState>): GameState {
  return { ...createInitialState('male', PARENTS, { rngSeed: 1 }), ...over };
}
const Y1 = 1;
const routineCostY1 = getActivityCost(paidRoutine, Y1) + getActivityCost(paidRoutine2, Y1);
const weekendCostY1 = getActivityCost(paidWeekend, Y1);

describe('UI 규칙 재현 — 단위', () => {
  it('전제: 픽스처 활동은 전부 유료다', () => {
    expect(getActivityCost(paidRoutine, Y1)).toBeGreaterThan(0);
    expect(getActivityCost(paidRoutine2, Y1)).toBeGreaterThan(0);
    expect(weekendCostY1).toBeGreaterThan(0);
  });

  it('① routineTooExpensive — 루틴 2칸 합계 기준, 방학이면 0', () => {
    const base = { routineSlot2: paidRoutine.id, routineSlot3: paidRoutine2.id, year: Y1, isVacation: false };
    expect(routineTooExpensive(stateWith({ ...base, money: routineCostY1 - 0.1 }))).toBe(true);
    expect(routineTooExpensive(stateWith({ ...base, money: routineCostY1 }))).toBe(false);
    expect(routineTooExpensive(stateWith({ ...base, money: 0, isVacation: true }))).toBe(false);
    expect(routineTooExpensive(stateWith({ ...base, money: 0, routineSlot2: '' }))).toBe(false);
  });

  it('③ pickerCumulativeBlocked — 앞 슬롯이 잔액을 먹어 뒤 슬롯이 막힌다, 막힌 슬롯은 차감하지 않는다', () => {
    const s = stateWith({ routineSlot2: '', routineSlot3: '', year: Y1, isVacation: false, money: weekendCostY1 });
    expect(pickerCumulativeBlocked(s, [paidWeekend.id])).toEqual([]);
    expect(pickerCumulativeBlocked(s, [paidWeekend.id, paidWeekend.id])).toEqual([paidWeekend.id]);
    // 무료 활동은 잔액과 무관하게 통과
    expect(pickerCumulativeBlocked(stateWith({ ...s, money: 0 }), ['rest', 'rest'])).toEqual([]);
    // 루틴비가 먼저 빠진다(MainWeekScreen.tsx:407)
    const withRoutine = stateWith({ ...s, routineSlot2: paidRoutine.id, routineSlot3: paidRoutine2.id, money: routineCostY1 + weekendCostY1 - 0.1 });
    expect(pickerCumulativeBlocked(withRoutine, [paidWeekend.id])).toEqual([paidWeekend.id]);
    // **막힌 슬롯은 차감하지 않는다** — 같은 활동 2칸으로는 관측이 안 된다(3자 검수 M19b: 막힌 칸도
    // 차감하는 변이가 살아남았다). 비싼 A·싼 B로 3칸을 깐다: 잔액 A+B에 [A, A, B] → A 통과(잔액 B),
    // A 막힘(차감 없음), B 통과. 막힌 A를 차감하면 B까지 막혀 [A, B]가 된다.
    const costA = getActivityCost(paidRoutine, Y1);
    const cheap = ACTIVITIES.find(a => a.id === 'internet-lecture')!;
    const costB = getActivityCost(cheap, Y1);
    expect(costA > costB && costB > 0, '전제: A가 B보다 비싸고 둘 다 유료').toBe(true);
    // 전제: A는 1칸 활동. slots ≥ 2면 collapseActivityChoices가 인접 [A, A]를 한 칸으로 접어 결과가 []가
    // 되고, 아래 단언은 "막힌 칸 차감"과 무관한 이유로 빨강이 된다(#488 3자 검수 LOW — 암묵 의존을 드러낸다).
    expect(paidRoutine.slots, '전제: A(academy)가 1칸이 아니면 3칸 픽스처가 접힌다').toBe(1);
    const three = stateWith({ ...s, money: costA + costB });
    expect(pickerCumulativeBlocked(three, [paidRoutine.id, paidRoutine.id, cheap.id])).toEqual([paidRoutine.id]);
  });

  it('② previewMoneySkips — 엔진이 미리 돌린 주의 money 스킵 id', () => {
    const s = stateWith({ routineSlot2: '', routineSlot3: '', year: Y1, isVacation: false, money: 0 });
    // 잔액 0에 유료 주말 3칸 — 용돈 지급 순서와 무관하게 적어도 한 칸은 돈 때문에 스킵된다
    expect(previewMoneySkips(s, [paidWeekend.id, paidWeekend.id, paidWeekend.id])).toContain(paidWeekend.id);
    expect(previewMoneySkips(stateWith({ ...s, money: 1000 }), [paidWeekend.id, paidWeekend.id])).toEqual([]);
  });

  it('productViewOfWeek — 주차에서 방학 여부를 다시 계산한다(하네스 수동 학년 전환의 stale 값 보정)', () => {
    expect(productViewOfWeek(stateWith({ week: 1, isVacation: true })).isVacation).toBe(false);
    expect(productViewOfWeek(stateWith({ week: 20, isVacation: false })).isVacation).toBe(true);
  });

  it('confirmLocked = ① ∨ ② (제품 moneyBlocked)', () => {
    const locked = evaluateUiWeekGates(stateWith({ routineSlot2: paidRoutine.id, routineSlot3: paidRoutine2.id, money: 0, isVacation: false }), []);
    expect(locked.routineLocked).toBe(true);
    expect(locked.confirmLocked).toBe(true);
    const free = evaluateUiWeekGates(stateWith({ routineSlot2: '', routineSlot3: '', money: 1000, isVacation: false }), ['rest']);
    expect(free).toEqual({ routineLocked: false, previewSkipped: [], pickerBlocked: [], confirmLocked: false });
  });
});

// ===== 계측 순서 — runPersona 배선 =====
// 주입 엔진: 매주 잔액을 0으로 만들고 돈 이벤트를 세운다. 이벤트 해결이 잔액을 `eventMoney`로 되돌린다.
// 계측이 이벤트 **뒤**를 읽으면 brokeWeeks 0·minMoney는 시작 잔액이고, **앞**을 읽으면 매주 빠듯·minMoney 0이다.
const EVENT_WEEKS = 10;
const MONEY_EVENT: GameEvent = {
  id: 'qa-sim-honesty-money-event', title: '', description: '',
  choices: [{ text: '', effects: {}, message: '' }],
};
const emptyLog = (): WeekLog => ({ statChanges: {}, fatigueChange: 0, moneyChange: 0, messages: [], skipped: [], milestoneMessages: [] });

function stubDeps(eventMoney: number): PlaythroughDeps {
  return {
    processWeek: (s) => (s.week > EVENT_WEEKS
      ? { ...s, phase: 'ending' }
      : { ...s, week: s.week + 1, money: 0, phase: 'event', currentEvent: MONEY_EVENT, weekLog: emptyLog() }),
    resolveEvent: (s) => ({ ...s, money: eventMoney, currentEvent: null, phase: 'weekday' }),
    talkToNpc: (s) => s,
  };
}

const paidPersona = persona({
  parents: PARENTS, routineSlot2: paidRoutine.id, routineSlot3: paidRoutine2.id,
  weekend: [paidWeekend.id, 'rest'], vacation: ['rest', 'rest', 'rest'],
});

describe('runPersona — 돈 계측은 이벤트 해결 뒤의 잔액을 읽는다', () => {
  it('전제: 픽스처 페르소나는 유효하고, 시작 잔액은 0보다 크다', () => {
    expect(validatePersona(paidPersona)).toEqual([]);
    expect(createInitialState('male', PARENTS, { rngSeed: 1 }).money).toBeGreaterThan(0);
    expect(DEFAULT_DEPS.processWeek).toBeTypeOf('function');
  });

  it('이벤트가 루틴비+주말비를 되돌리는 주: brokeWeeks 0, minMoney는 시작 잔액(0이 아니다)', () => {
    const initialMoney = createInitialState('male', PARENTS, { rngSeed: 1 }).money;
    const r = runPersona(paidPersona, 1, stubDeps(routineCostY1 + weekendCostY1));
    expect(r.totalWeeksPlayed).toBe(0);            // 주입 엔진이라 엔진 카운터는 안 움직인다 — 배선 확인용
    expect(r.brokeWeeks).toBe(0);
    expect(r.minMoney).toBe(Math.round(Math.min(initialMoney, routineCostY1 + weekendCostY1)));
    // UI 규칙 배선 — 이벤트 뒤 잔액이 충분하므로 잠길 수 있는 건 1주차(시작 잔액 = 첫 주 용돈)뿐이다.
    // ①③은 순수 규칙이라 시작 잔액에서 정확히 파생하고, ②는 엔진 내부(용돈 지급 순서)에 걸려 상한만 둔다.
    expect(r.uiRoutineLockWeeks).toBe(initialMoney < routineCostY1 ? 1 : 0);
    expect(r.uiPickerBlockWeeks).toBe(initialMoney - routineCostY1 < weekendCostY1 ? 1 : 0);
    expect(r.uiPreviewSkipWeeks).toBeLessThanOrEqual(1);
    expect(r.uiConfirmLockWeeks).toBeLessThanOrEqual(1);
  });

  it('양성 대조군 — 이벤트가 돈을 안 주면 매주 빠듯하고 minMoney 0, UI 규칙 3종이 매주 잠긴다', () => {
    const r = runPersona(paidPersona, 1, stubDeps(0));
    // 이벤트 주 10 + 엔딩 주 1(주입 엔진이 잔액 0을 그대로 두고 phase만 ending으로) — 계측은 마지막 주도 읽는다
    expect(r.brokeWeeks).toBe(EVENT_WEEKS + 1);
    expect(r.minMoney).toBe(0);
    // 2주차부터 매주(EVENT_WEEKS주) + 엔딩 주까지 잔액 0 — 셋 다 최소 EVENT_WEEKS주
    expect(r.uiRoutineLockWeeks).toBeGreaterThanOrEqual(EVENT_WEEKS);
    expect(r.uiPickerBlockWeeks).toBeGreaterThanOrEqual(EVENT_WEEKS);
    expect(r.uiPreviewSkipWeeks).toBeGreaterThanOrEqual(EVENT_WEEKS);
    expect(r.uiConfirmLockWeeks).toBeGreaterThanOrEqual(EVENT_WEEKS);
  });
});
