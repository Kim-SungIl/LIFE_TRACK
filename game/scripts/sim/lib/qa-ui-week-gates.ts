/**
 * 주 확정 화면의 **돈 게이트 3종을 하네스에서 재현**한다 — "제품이라면 이 주에 확정이 잠겼을까".
 *
 * 왜 필요한가(T47): 엔진(processWeek)은 잔액이 모자라면 슬롯을 **조용히 스킵**하지만, 제품은
 * 그 주를 넘기지 못하게 한다. 세 규칙이 각각 다른 자리에서 막는다:
 *   ① routineTooExpensive — MainWeekScreen.tsx:123-130. 루틴 2칸 **합계** > 잔액이면 확정 잠금.
 *   ② unaffordable       — MainWeekScreen.tsx:168-177. `predictWeekOutcome(...).skipped`의 reason==='money'
 *                           (엔진이 같은 processWeek를 미리 돌려 남긴 기록). 있으면 확정 잠금.
 *   ③ 누적 잔액 게이트   — ActivityPicker.tsx:135 `canAfford = cost <= 0 || money >= cost`에서 money는
 *                           MainWeekScreen.tsx:407이 넘기는 `state.money - routineCost - Σ(이미 고른 활동 비용)`.
 *                           고르는 **순서대로** 잔액이 줄어, 뒤 슬롯의 유료 활동이 선택 자체가 안 된다.
 * 하네스는 이 셋을 안 거치므로 "스킵된 슬롯"은 셌어도 "플레이어가 그 주를 넘길 수 없었다"는 사실은
 * 못 셌다. 여기서는 값을 바꾸지 않고 **세기만** 한다.
 *
 * ①②는 순수함수(getActivityCost·predictWeekOutcome)로 같은 규칙을 그대로 호출한다. ③은 컴포넌트
 * 안(JSX·prop 식)에만 있어 함수로 못 부른다 — 위 두 줄을 최소 복제했다. 규칙 줄 번호가 바뀌면 여기 주석도.
 *
 * 주의: 루틴 슬롯의 ③은 다시 세지 않는다. 루틴은 설정 때 한 번 고르고 매주 지속되며, 매주의 재판정은
 * ①이 맡는다(제품도 그렇다). 여기 ③은 그 주의 주말/방학 **선택 슬롯**만 본다.
 */
import { ACTIVITIES, collapseActivityChoices, getActivityCost } from '../../../src/engine/activities';
import { getWeekInfo, predictWeekOutcome } from '../../../src/engine/gameEngine';
import type { GameState } from '../../../src/engine/types';

/**
 * 확정 직전 **화면이 보는** 상태. 하네스의 수동 학년 전환(week=1, year++)은 store.advanceFromYearEnd와
 * 달리 isVacation·semester를 안 고쳐서, 새 학년 1주차에 겨울방학 값이 남는다(엔진은 prepareWeekContext가
 * 다시 계산하므로 무해하지만, ①의 `state.isVacation ? 0 : 루틴비`가 그 주를 방학으로 읽어 0을 낸다).
 */
export function productViewOfWeek(s: GameState): GameState {
  const info = getWeekInfo(s.week);
  return { ...s, isVacation: info.isVacation, semester: info.semester };
}

/** MainWeekScreen.tsx:123-129 — 방학이면 0, 아니면 루틴 2칸 비용 합(학년 차등 적용). */
export function routineCostOf(s: GameState): number {
  if (s.isVacation) return 0;
  const r2 = s.routineSlot2 ? ACTIVITIES.find(a => a.id === s.routineSlot2) : null;
  const r3 = s.routineSlot3 ? ACTIVITIES.find(a => a.id === s.routineSlot3) : null;
  return (r2 ? getActivityCost(r2, s.year) : 0) + (r3 ? getActivityCost(r3, s.year) : 0);
}

/**
 * 다음 주 좌표 — 엔진 advanceWeekCounter(gameEngine.ts)의 `week++` / `week > 48 → 다음 학년 W1`을 그대로 옮긴 순수함수.
 * 학년 경계(W48 → 다음 학년 W1)를 넘는 유일한 자리라 여기서만 판정한다.
 */
export function nextWeekCoord(year: number, week: number): { year: number; week: number } {
  return week >= 48 ? { year: year + 1, week: 1 } : { year, week: week + 1 };
}

/**
 * **다음 주**에 루틴이 과금될 금액(brokeWeeks 판정 분모, T54). 방학이면 0, 학기면 **다음 주 학년**의 루틴 2칸 합.
 * 이번 주 방학 여부(`wasVacation`)로 재면 학기 마지막 주(W19·W42)는 있지도 않은 다음 주 루틴비로 빠듯하다고 세고,
 * 방학 마지막 주(W24·W48)는 다음 주 루틴비를 0으로 봐서 놓친다. W48은 학년도 바뀌어 학원비 단가(getActivityCost)도 다르다.
 */
export function nextWeekRoutineCost(s: GameState, year: number, week: number): number {
  const next = nextWeekCoord(year, week);
  return routineCostOf({ ...s, year: next.year, isVacation: getWeekInfo(next.week).isVacation });
}

/** ① MainWeekScreen.tsx:130 */
export function routineTooExpensive(s: GameState): boolean {
  const routineCost = routineCostOf(s);
  return !s.isVacation && !!s.routineSlot2 && routineCost > 0 && s.money < routineCost;
}

/**
 * ② MainWeekScreen.tsx:168-177 — 엔진이 미리 돌린 한 주에서 돈 때문에 안 돌아갈 활동 id(루틴+선택, 중복 제거).
 * 제품은 ①이 켜져 있으면 이 목록을 비우지만(문구 우선순위), 여기서는 규칙별로 세기 위해 **원 판정**을 낸다 —
 * 확정 잠금 여부는 evaluateUiWeekGates.confirmLocked(①∨②)로 같다.
 */
export function previewMoneySkips(s: GameState, planned: string[], npcMap?: Record<string, string>): string[] {
  return [...new Set(predictWeekOutcome(s, planned, npcMap).skipped.filter(k => k.reason === 'money').map(k => k.activityId))];
}

/**
 * ③ ActivityPicker.tsx:135 + MainWeekScreen.tsx:407 — 선택 순서대로 잔액을 차감한 누적 게이트.
 * 골라진 활동만 잔액에서 빠진다(막힌 활동은 제품에서 선택되지 않았으므로 차감하지 않는다).
 * 수입 활동(cost < 0)은 항상 고를 수 있고 뒤 슬롯의 잔액을 늘린다 — 제품 식이 부호를 그대로 더한다.
 */
export function pickerCumulativeBlocked(s: GameState, planned: string[]): string[] {
  let available = s.money - routineCostOf(s);
  const blocked: string[] = [];
  for (const id of collapseActivityChoices(planned)) {
    const act = ACTIVITIES.find(a => a.id === id);
    if (!act) continue;
    const cost = getActivityCost(act, s.year);
    if (!(cost <= 0 || available >= cost)) { blocked.push(id); continue; }
    available -= cost;
  }
  return blocked;
}

export interface UiWeekGates {
  routineLocked: boolean;     // ①
  previewSkipped: string[];   // ②
  pickerBlocked: string[];    // ③
  /** 제품의 moneyBlocked(MainWeekScreen.tsx:184) = ① ∨ ② — 확정 버튼이 돈 때문에 잠긴 주. */
  confirmLocked: boolean;
}

/** 세 규칙을 한 주에 대해 한 번에. `s`는 productViewOfWeek를 거친 상태를 넘길 것. */
export function evaluateUiWeekGates(s: GameState, planned: string[], npcMap?: Record<string, string>): UiWeekGates {
  const routineLocked = routineTooExpensive(s);
  const previewSkipped = previewMoneySkips(s, planned, npcMap);
  const pickerBlocked = pickerCumulativeBlocked(s, planned);
  return { routineLocked, previewSkipped, pickerBlocked, confirmLocked: routineLocked || previewSkipped.length > 0 };
}
