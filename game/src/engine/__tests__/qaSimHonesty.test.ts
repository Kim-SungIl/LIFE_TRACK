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
 *   4. (T54) 말걸기 순서 — 제품은 이벤트를 전부 닫고 결산을 넘긴 **다음 주 계획 화면**에서만 말을 건다
 *      (GameScreen.tsx phase 라우터: event(:336) → result(:412) → MainWeekScreen(:446)만 onTalkNpc를 받는다).
 *      하네스가 processWeek 직후·이벤트 앞에서 걸면 RNG 소비 순서와 미니톡 학년 게이트가 어긋난다. 주입 deps로
 *      호출 **순서**와 말걸기 시점의 상태(currentEvent·phase·학년 경계)를 잠근다.
 *   5. (T54) brokeWeeks의 "다음 주 루틴비"는 **다음 주 좌표**로 판정한다 — 학기 마지막 주(다음 주 방학)는 0,
 *      방학 마지막 주(다음 주 학기)는 루틴비, 학년 경계(W48→W1)는 다음 학년 단가. 경계 주는 getWeekInfo에서 파생한다.
 *
 * 임계·비용은 리터럴이 아니라 카탈로그(ACTIVITIES·getActivityCost)에서 파생한다.
 */
import { describe, expect, it } from 'vitest';
import { ACTIVITIES, getActivityCost } from '../activities';
import { createInitialState, getWeekInfo } from '../gameEngine';
import type { GameEvent, GameState, ParentStrength, WeekLog } from '../types';
import { validatePersona, personaMarkMismatches, type Persona } from '../../../scripts/sim/lib/qa-persona';
import {
  evaluateUiWeekGates, nextWeekCoord, nextWeekRoutineCost, pickerCumulativeBlocked, previewMoneySkips, productViewOfWeek,
  routineCostOf, routineTooExpensive,
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

// ===== (T54) 말걸기 순서 — runPersona 배선 =====
// 세 스텁이 호출 토큰을 한 배열에 남긴다. 제품 순서는 주마다 [talk → processWeek → resolve…]이고, 말걸기 시점엔
// 이벤트가 열려 있으면 안 된다(GameScreen 라우터가 EventScene을 먼저 고른다). 첫 주는 부팅 상태에서 건다 —
// createInitialState의 jihun이 met이라 talkFocus='jihun'이면 매 주 정확히 한 번 호출된다.
const TALK_NPC = 'jihun';
interface TalkObservation { year: number; week: number; phase: GameState['phase']; eventOpen: boolean }

function orderDeps(log: string[], talks: TalkObservation[]): PlaythroughDeps {
  return {
    processWeek: (s) => {
      log.push('processWeek');
      return s.week > EVENT_WEEKS
        ? { ...s, phase: 'ending' }
        : { ...s, week: s.week + 1, phase: 'event', currentEvent: MONEY_EVENT, weekLog: emptyLog() };
    },
    resolveEvent: (s) => { log.push('resolve'); return { ...s, currentEvent: null, phase: 'weekday' }; },
    talkToNpc: (s, npcId) => {
      log.push('talk');
      expect(npcId).toBe(TALK_NPC);
      talks.push({ year: s.year, week: s.week, phase: s.phase, eventOpen: s.currentEvent != null });
      return s;
    },
  };
}

// 학년 경계용 — 이벤트 없이 W48까지 걷고 학년말(phase 'year-end', week 49)을 세운다. 하네스가 학년을 넘긴 뒤
// 새 학년 W1에서 말을 걸어야 한다(제품: year-end 화면 → advanceFromYearEnd → W1 계획 화면 → 말걸기).
function yearBoundaryDeps(talks: TalkObservation[]): PlaythroughDeps {
  return {
    processWeek: (s) => {
      if (s.year >= 2 && s.week >= 2) return { ...s, phase: 'ending' };
      if (s.week >= 48) return { ...s, week: 49, phase: 'year-end', currentEvent: null, weekLog: emptyLog() };
      return { ...s, week: s.week + 1, phase: 'weekday', weekLog: emptyLog() };
    },
    resolveEvent: (s) => s,
    talkToNpc: (s) => { talks.push({ year: s.year, week: s.week, phase: s.phase, eventOpen: s.currentEvent != null }); return s; },
  };
}

const talkPersona = persona({ talk: true, talkFocus: TALK_NPC });

describe('runPersona — 말걸기는 이벤트를 닫은 뒤, 다음 주 확정 앞에 한다(제품 순서)', () => {
  it('전제: 픽스처 페르소나는 유효하고, 부팅 상태의 대상 NPC는 말을 걸 수 있다(met)', () => {
    expect(validatePersona(talkPersona)).toEqual([]);
    const s0 = createInitialState('male', PARENTS, { rngSeed: 1 });
    expect(s0.npcs.find(n => n.id === TALK_NPC)?.met).toBe(true);
    expect(s0.currentEvent).toBeNull();
  });

  it('호출 순서가 주마다 [talk → processWeek → resolve]이고 말걸기 시점에 이벤트가 열려 있지 않다', () => {
    const log: string[] = [];
    const talks: TalkObservation[] = [];
    runPersona(talkPersona, 1, orderDeps(log, talks));
    // 양성 대조군 — 말걸기가 실제로 배선돼 있다(주마다 한 번: 이벤트 주 EVENT_WEEKS + 엔딩 주 1).
    expect(talks).toHaveLength(EVENT_WEEKS + 1);
    // 순서 — 이벤트 주는 [talk, processWeek, resolve], 엔딩 주는 [talk, processWeek]. 말걸기가 processWeek 직후로
    // 돌아가면(T47 배선) [processWeek, talk, resolve]가 되어 여기서 빨강.
    const expected = [...Array.from({ length: EVENT_WEEKS }, () => ['talk', 'processWeek', 'resolve']).flat(), 'talk', 'processWeek'];
    expect(log).toEqual(expected);
    // 상태 — 말걸기 시점엔 지난주 이벤트가 닫혀 있고(currentEvent null) phase가 'event'가 아니다.
    for (const t of talks) {
      expect(t.eventOpen, `week ${t.week}: 이벤트가 열린 채 말을 걸었다`).toBe(false);
      expect(t.phase, `week ${t.week}: phase ${t.phase}에서 말을 걸었다`).not.toBe('event');
    }
  });

  it('학년 경계 — W48 뒤의 말걸기는 year-end(W49)가 아니라 다음 학년 W1 계획 화면에서 한다', () => {
    const talks: TalkObservation[] = [];
    runPersona(talkPersona, 1, yearBoundaryDeps(talks));
    // 양성 대조군 — Y1 W1~W48 + Y2 W1~W2 = 50번(주마다 한 번).
    expect(talks).toHaveLength(50);
    expect(talks.some(t => t.year === 2 && t.week === 1 && t.phase === 'weekday'), '새 학년 W1 계획 화면의 말걸기가 없다').toBe(true);
    for (const t of talks) {
      expect(t.week <= 48, `week ${t.week}(year ${t.year}): 학년말 상태에서 말을 걸었다`).toBe(true);
      expect(t.phase, `week ${t.week}(year ${t.year}): phase ${t.phase}`).not.toBe('year-end');
    }
  });
});

// ===== (T54) brokeWeeks — 다음 주 루틴비 =====
// 경계 주는 달력(getWeekInfo)에서 파생한다: 학기 마지막 주(다음 주 방학)·방학 마지막 주(다음 주 학기). 학년 경계
// W48은 후자에 든다(W48 겨울방학 → 다음 학년 W1 학기).
const WEEKS = Array.from({ length: 48 }, (_, i) => i + 1);
const lastSemesterWeeks = WEEKS.filter(w => !getWeekInfo(w).isVacation && getWeekInfo(nextWeekCoord(1, w).week).isVacation);
const lastVacationWeeks = WEEKS.filter(w => getWeekInfo(w).isVacation && !getWeekInfo(nextWeekCoord(1, w).week).isVacation);

/** 매주 잔액을 `moneyAt(학년, 이번 주)`로 두고 이벤트 없이 걷는 엔진. Y1 W48 → year-end, 그 뒤 첫 주 → ending. */
function brokeDeps(moneyAt: (year: number, week: number) => number): PlaythroughDeps {
  return {
    processWeek: (s) => {
      const money = moneyAt(s.year, s.week);
      if (s.year >= 2) return { ...s, money, phase: 'ending' };
      if (s.week >= 48) return { ...s, money, week: 49, phase: 'year-end', currentEvent: null, weekLog: emptyLog() };
      return { ...s, money, week: s.week + 1, phase: 'weekday', weekLog: emptyLog() };
    },
    resolveEvent: (s) => s,
    talkToNpc: (s) => s,
  };
}
const PLENTY = 10_000;

describe('nextWeekCoord / nextWeekRoutineCost — 다음 주 좌표와 루틴비', () => {
  it('전제: 달력에 경계 주가 있고 학년 경계는 방학→학기다', () => {
    expect(lastSemesterWeeks.length).toBeGreaterThan(0);
    expect(lastVacationWeeks.length).toBeGreaterThan(1);
    expect(lastVacationWeeks).toContain(48);
    expect(nextWeekCoord(1, 48)).toEqual({ year: 2, week: 1 });
    expect(nextWeekCoord(3, 19)).toEqual({ year: 3, week: 20 });
  });

  it('학기 마지막 주는 0, 방학 마지막 주는 다음 주 학년의 루틴비', () => {
    const s = stateWith({ routineSlot2: paidRoutine.id, routineSlot3: paidRoutine2.id });
    for (const w of lastSemesterWeeks) expect(nextWeekRoutineCost(s, 1, w), `W${w}`).toBe(0);
    for (const w of lastVacationWeeks) {
      const next = nextWeekCoord(1, w);
      expect(nextWeekRoutineCost(s, 1, w), `W${w}`).toBe(routineCostOf({ ...s, year: next.year, isVacation: false }));
      expect(nextWeekRoutineCost(s, 1, w), `W${w}`).toBeGreaterThan(0);
    }
  });
});

describe('runPersona — brokeWeeks는 다음 주 루틴비로 판정한다', () => {
  const routineOf = (year: number) => routineCostOf(stateWith({ routineSlot2: paidRoutine.id, routineSlot3: paidRoutine2.id, year, isVacation: false }));

  it('전제: 픽스처 루틴은 유료이고 잔액 PLENTY는 어느 학년 루틴비보다 크다', () => {
    expect(routineOf(1)).toBeGreaterThan(0);
    expect(PLENTY).toBeGreaterThan(routineOf(2));
  });

  it('방학 마지막 주(W24·W48)에 잔액 0 → 그 주들만 빠듯하다(다음 주가 학기)', () => {
    const broke = new Set(lastVacationWeeks);
    const r = runPersona(paidPersona, 1, brokeDeps((year, week) => (year === 1 && broke.has(week) ? 0 : PLENTY)));
    expect(r.brokeWeeks).toBe(lastVacationWeeks.length);
  });

  it('학기 마지막 주(W19·W42)에 잔액 0 → 빠듯한 주 0(다음 주가 방학이라 루틴비가 없다)', () => {
    const broke = new Set(lastSemesterWeeks);
    const r = runPersona(paidPersona, 1, brokeDeps((year, week) => (year === 1 && broke.has(week) ? 0 : PLENTY)));
    expect(r.brokeWeeks).toBe(0);
  });

  it('학년 경계 W48 — 잔액이 이번 학년 루틴비와 같으면 다음 학년 단가로는 모자란다', () => {
    // 전제: 학원비가 학교급으로 오른다(Y1 초등 → Y2 중등). 같으면 이 축은 관측이 안 되므로 먼저 단언한다.
    expect(routineOf(2), '전제: Y2 루틴비 > Y1 루틴비').toBeGreaterThan(routineOf(1));
    const r = runPersona(paidPersona, 1, brokeDeps((year, week) => (year === 1 && week === 48 ? routineOf(1) : PLENTY)));
    expect(r.brokeWeeks).toBe(1);
    // 대조 — 다음 학년 단가만큼 있으면 빠듯하지 않다.
    const ok = runPersona(paidPersona, 1, brokeDeps((year, week) => (year === 1 && week === 48 ? routineOf(2) : PLENTY)));
    expect(ok.brokeWeeks).toBe(0);
  });
});
