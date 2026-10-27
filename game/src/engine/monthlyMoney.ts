// 월 단위 돈 — 용돈은 달 초에 한 번, 학원(유료 루틴)은 한 달 등록(설계안 docs/monthly-plan-design-2026-10.md §4).
//
// 엔진은 여전히 주 단위로 돈다. 바뀌는 건 **돈이 움직이는 시점**뿐이다.
//   · 용돈: 달 첫 주의 계획 시점에 그 달 4주치(주 용돈 × 4)를 받는다. 총액은 예전 매주 지급과 같다.
//   · 유료 루틴: 같은 시점에 그 달 **학기 주 수**만큼 선불한다(섞인 달 7월은 3주, 1월은 2주, 방학 달은 0).
//     낸 돈은 어떤 이유로도 돌아오지 않는다 — 이벤트로 빠져도(timeCost), 번아웃으로 끊겨도.
//   · 달 중간에 루틴을 바꾸면 **이번 달 남은 학기 주 수 × 새 루틴 주 단가**를 바로 낸다(디렉터 결정 (가)).
//     이미 낸 돈은 안 돌아온다. 같은 학원으로 되돌아와도 기록이 덮였으니 다시 낸다.
//   · 수입 루틴(알바, 비용이 음수)은 선불 대상이 아니다 — 일한 주에 받는다(예전과 같다).
//
// **결제 시점은 셋이다.** ① 달 첫 주로 넘어갈 때(processWeek 끝·학년 전환) ② 루틴을 바꿀 때(setRoutine)
// ③ 주를 확정할 때(confirmWeek) — ③은 달 초에 돈이 모자라 못 냈다가 그 뒤 낼 수 있게 된 경우를 받는다.
// 셋 다 `payRoutineIfDue` 하나를 부른다. 확정 잠금(getConfirmGate)은 `getRoutineDueCost`로 "지금 내야 할 돈"을 본다.
//
// **구세이브는 다음 달 초까지 예전 방식이다.** `monthlyMoney`가 켜지기 전의 판(달 중간 세이브)에서 갑자기
// 남은 주 학원비를 청구하거나 그 달 용돈을 빠뜨리면 안 된다. 그래서 그 판은 첫 달 초를 만날 때까지
// 매주 용돈·매주 학원비로 돌고, 달 초에 켜진다.
import { ACTIVITIES, getActivityCost } from './activities';
import { recordMoneySpent } from './moneyTrajectory';
import { getParentMods, getWeeklyIncome } from './parentModifiers';
import { canSpendWhilePlanning } from './spendableMoney';
import { WEEKS_PER_MONTH, getMonthBlock, getWeekInfo } from './weekMath';
import type { GameState } from './types';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** 달 첫 주인가(W1·W5·…·W45). W49(학년 전환 대기)는 어느 달에도 속하지 않는다. */
export function isMonthStartWeek(week: number): boolean {
  return Number.isInteger(week) && week >= 1 && week <= 48 && (week - 1) % WEEKS_PER_MONTH === 0;
}

/** 이 판이 월 단위 돈으로 도는가. 새 판은 처음부터, 구세이브는 첫 달 초부터 켜진다. */
export function isMonthlyMoneyActive(state: Pick<GameState, 'monthlyMoney'>): boolean {
  return state.monthlyMoney === true;
}

/** 주 용돈 순액(용돈 − 생활비). 예전 매주 지급과 같은 식이다. */
export function getWeeklyNetIncome(state: Pick<GameState, 'parents' | 'year'>): number {
  return round1(getWeeklyIncome(state.parents, state.year) - getParentMods(state.parents).livingCost);
}

/** 한 달 용돈 = 주 순액 × 4. 섞인 달·방학 달도 4주치다(예전에도 방학 주에 용돈이 나왔다). */
export function getMonthlyAllowance(state: Pick<GameState, 'parents' | 'year'>): number {
  return round1(getWeeklyNetIncome(state) * WEEKS_PER_MONTH);
}

/** 이 주부터 그 달 끝까지의 학기 주 수. 루틴은 학기에만 돈다. W49는 0. */
export function remainingSemesterWeeks(week: number): number {
  if (!Number.isInteger(week) || week < 1 || week > 48) return 0;
  const end = getMonthBlock(week).endWeek;
  let n = 0;
  for (let w = week; w <= end; w++) if (!getWeekInfo(w).isVacation) n++;
  return n;
}

/** 선불 대상 주 단가 — 유료면 그 학년 비용, 무료·수입 루틴은 0. */
function prepaidUnitCost(state: Pick<GameState, 'year'>, id: string | null): number {
  const a = id ? ACTIVITIES.find(x => x.id === id) : null;
  const cost = a ? getActivityCost(a, state.year) : 0;
  return cost > 0 ? cost : 0;
}

type Slot = 'routineSlot2' | 'routineSlot3';
const SLOTS: readonly Slot[] = ['routineSlot2', 'routineSlot3'];
const PAID_KEY = { routineSlot2: 'slot2', routineSlot3: 'slot3' } as const;

/** 지금 그 칸의 루틴이 이번 달 몫으로 이미 결제됐는가. */
export function isRoutineSlotPaid(state: GameState, slot: Slot): boolean {
  const rp = state.routinePrepaid;
  if (!rp || state.week > 48) return false;
  const id = state[slot];
  return !!id && rp.year === state.year && rp.month === getMonthBlock(state.week).index && rp[PAID_KEY[slot]] === id;
}

/**
 * 지금 내야 할 루틴비 — 확정 잠금과 계획 화면 예산이 읽는다.
 * 월 단위가 켜진 판: 아직 이번 달 몫을 안 낸 유료 칸들의 (남은 학기 주 × 주 단가) 합.
 * 구세이브(아직 매주 방식): 예전처럼 이번 주 한 주치 합. 방학이면 0(엔진이 루틴을 안 돌린다).
 */
export function getRoutineDueCost(state: GameState): number {
  if (state.isVacation) return 0;
  if (!isMonthlyMoneyActive(state)) {
    return SLOTS.reduce((sum, slot) => {
      const a = state[slot] ? ACTIVITIES.find(x => x.id === state[slot]) : null;
      return sum + (a ? getActivityCost(a, state.year) : 0);
    }, 0);
  }
  const weeks = remainingSemesterWeeks(state.week);
  return round1(SLOTS.reduce((sum, slot) => sum + (isRoutineSlotPaid(state, slot) ? 0 : prepaidUnitCost(state, state[slot]) * weeks), 0));
}

/**
 * 루틴을 이렇게 바꾸면 **지금** 내야 할 돈 — 루틴 고르기 화면이 "고를 수 있나"를 이걸로 본다.
 * 월 단위 돈이면 새 칸은 이번 달 남은 학기 주 × 주 단가다. 주 단가만 보면 잔액이 한 주치보다 많고 한 달치보다
 * 적을 때 고르게 해 놓고 확정에서 잠근다(3자 검수 — 3c가 결제만 바꾸고 피커는 그대로였다).
 */
export function getRoutineSwitchCost(state: GameState, slot2: string | null, slot3: string | null): number {
  return getRoutineDueCost({ ...state, routineSlot2: slot2, routineSlot3: slot3 });
}

/**
 * 내야 할 루틴비가 있고 낼 수 있으면 지금 낸다. 모자라면 아무것도 안 내고 그대로 둔다
 * (확정 잠금이 "루틴을 바꿔야 한다"로 막는다). 반환 = 실제로 낸 돈.
 * 결제가 끝나면 두 칸 모두 지금 루틴으로 기록한다 — 무료 칸은 0원이라 기록만 남는다.
 */
export function payRoutineIfDue(state: GameState): number {
  if (!isMonthlyMoneyActive(state) || state.week > 48) return 0;
  const due = getRoutineDueCost(state);
  // 확정 잠금(getConfirmGate)과 **같은 물음**이다 — 이번 주 자신의 예약은 지금 고르는 중이라 빼지 않는다.
  // 예전엔 여기만 canSpend(이번 주 예약까지 뺌)라 잠금은 열리는데 선불은 거부돼, 기록 없이 주 단위로 청구됐다(3자 검수).
  if (due > 0 && !canSpendWhilePlanning(state, due)) return 0;
  if (due > 0) {
    const before = state.money;
    state.money = round1(state.money - due);
    if (state.money < 0) state.money = 0;
    recordMoneySpent(state, round1(before - state.money));
  }
  state.routinePrepaid = {
    year: state.year,
    month: getMonthBlock(state.week).index,
    slot2: state.routineSlot2,
    slot3: state.routineSlot3,
  };
  return due;
}

export interface MonthStartPayment {
  /** 들어온 달의 이름("5월"). */
  label: string;
  allowance: number;
  /** 그 자리에서 낸 루틴 선불(모자라 못 냈으면 0). */
  routinePaid: number;
  /** 잔액 변화 = allowance − routinePaid. */
  delta: number;
}

/**
 * 달 첫 주로 넘어왔을 때 — 그 달 용돈을 받고 루틴을 선불한다. 구세이브는 여기서 월 단위가 켜진다.
 * 달 첫 주가 아니면 null. 결산에 어떻게 보일지는 호출자(gameEngine.settleMonthStartIfDue)가 정한다.
 */
export function payMonthStart(state: GameState): MonthStartPayment | null {
  if (!isMonthStartWeek(state.week)) return null;
  state.monthlyMoney = true;
  state.routinePrepaid = undefined; // 지난달 결제는 이번 달을 덮지 않는다
  const allowance = getMonthlyAllowance(state);
  state.money = round1(state.money + allowance);
  const routinePaid = payRoutineIfDue(state);
  return { label: getMonthBlock(state.week).label, allowance, routinePaid, delta: round1(allowance - routinePaid) };
}

/** 그 주의 이 루틴 칸을 실행할 때 돈을 빼지 않아도 되는가(이번 달 몫으로 이미 냈다). */
export function routineSlotPrepaidThisWeek(state: GameState, slot: Slot): boolean {
  return isMonthlyMoneyActive(state) && prepaidUnitCost(state, state[slot]) > 0 && isRoutineSlotPaid(state, slot);
}

/**
 * 이 선택지(timeCost)가 **이미 낸** 유료 루틴을 빼먹게 만드는가 — 선택지에 "(이미 낸 OO 빠짐)"을 단다.
 * timeCost는 다음 processWeek에서 루틴을 뒤에서부터 지운다(1 = 둘째 칸, 2 = 두 칸 다).
 * 사건은 processWeek 뒤에 뜨므로 그 "다음 주"가 지금 state.week이다. 방학 주면 루틴이 없다.
 */
export function prepaidRoutineSkippedBy(state: GameState, timeCost: number | undefined): string[] {
  if (!timeCost || timeCost <= 0 || !isMonthlyMoneyActive(state) || state.week > 48) return [];
  if (getWeekInfo(state.week).isVacation) return [];
  const hit: Slot[] = timeCost >= 2 ? ['routineSlot2', 'routineSlot3'] : ['routineSlot3'];
  return hit
    .filter(slot => routineSlotPrepaidThisWeek(state, slot))
    .map(slot => ACTIVITIES.find(a => a.id === state[slot])!.name);
}

/** HUD의 입금 안내 한 줄. 월 단위면 "다음 달 초 +N만원 입금", 아직 매주 방식인 구세이브는 예전 문구. */
export function incomeNote(state: GameState): string {
  if (!isMonthlyMoneyActive(state)) return `주말 마감 시 +${getWeeklyNetIncome(state)}만원 입금`;
  // 학년 마지막 달의 "다음 달"은 새 학년 첫 달이다 — 그 학년 단가로 들어온다(초6→중1에서 16 → 20, 3자 검수).
  const nextYear = state.week >= 1 && state.week <= 48 && getMonthBlock(state.week).endWeek === 48 && state.year < 7;
  return `다음 달 초 +${getMonthlyAllowance(nextYear ? { ...state, year: state.year + 1 } : state)}만원 입금`;
}
