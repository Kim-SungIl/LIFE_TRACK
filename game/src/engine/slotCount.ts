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

/**
 * 시간 소모(`timeCost`)로 칸이 빠진 뒤 남는 선택 — **칸 수 기준으로** 뒤에서부터 지운다(1=일요일, 2=토·일).
 *
 * 배열 길이로 자르면 같은 화면이 저장 모양에 따라 갈린다: 토요일만 채운 주는 `['hang-out']`(길이 1)로 남아
 * 빈 일요일 대신 **토요일이** 잘렸고, `['hang-out','']`이나 일요일을 채운 주는 일요일이 잘렸다(3자 검수, 약속 칸 경고).
 * 그래서 칸 수만큼 빈 칸으로 채운 뒤 자른다. 반환 길이 = `max(0, 칸 수 − timeCost)`(칸 수보다 긴 입력은 그 길이 기준).
 */
export function choicesAfterTimeCost(choices: readonly string[], slots: number, timeCost: number): string[] {
  const padded = Array.from({ length: Math.max(slots, choices.length) }, (_, i) => choices[i] || '');
  return timeCost > 0 ? padded.slice(0, Math.max(0, padded.length - timeCost)) : padded;
}
