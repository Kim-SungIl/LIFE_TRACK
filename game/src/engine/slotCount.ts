// 한 주에 플레이어가 채울 수 있는 선택 칸 수 — 단일 근거(leaf).
//
// weekendPlan.ts(계획 화면)와 monthPlan.ts(월 계획 검증)가 같이 쓴다. weekendPlan은 gameEngine을 끌어오므로
// 월 계획 쪽(→ spendableMoney → gameEngine 경로)이 그걸 import하면 순환이 된다. 그래서 숫자와 판정만 여기 둔다.
import { getParentMods } from './parentModifiers';
import type { ParentStrength } from './types';

/** 학기 중 주말 슬롯 수(토·일). */
export const SEMESTER_WEEKEND_SLOTS = 2;
/** 방학 자유 슬롯의 기본 개수 — freedom 부모의 `vacationSlotBonus`가 여기에 더해진다. */
export const VACATION_BASE_SLOTS = 5;

/** 그 주가 방학인지와 부모로 정해지는 선택 칸 수. */
export function slotCountFor(parents: readonly ParentStrength[], isVacation: boolean): number {
  return isVacation ? VACATION_BASE_SLOTS + getParentMods(parents).vacationSlotBonus : SEMESTER_WEEKEND_SLOTS;
}
