// 주말/방학 계획의 스냅샷과 "지난주처럼" 1탭 복사 판정.
//
// **왜 필요한가**: 주중 2슬롯은 `state.routineSlot2/routineSlot3`로 지속되고 안 바꿀수록
// 커지는 루틴 보너스까지 붙는다 — 주중의 기본값은 "반복"이다. 그런데 주말 2슬롯(방학은
// 자유 슬롯)은 확정할 때마다 비워져(MainWeekScreen의 `setSelectedActivities([])`) 336주
// 내내 같은 두 탭을 다시 한다. 이 파일은 그 반복만 1탭으로 접는다 — 밀도·밸런스 불변.
//
// **자동 채움이 아니다.** 스냅샷을 슬롯에 **채우기만** 하고 확정은 기존 CTA가 한다. 유료
// 주말 활동이 플레이어 모르게 확정되면 돈을 조용히 쓰는 경로가 되기 때문이다.
import { GameState, WeekendPlanSnapshot } from './types';
import { ACTIVITIES, NPC_COMPANION_ACTIVITIES } from './activities';
import { getParentMods } from './parentModifiers';
import { isNpcEnrolled } from './relationshipSignals';
import { predictWeekOutcome } from './gameEngine';

/** 학기 중 주말 슬롯 수(토·일). */
export const SEMESTER_WEEKEND_SLOTS = 2;
/** 방학 자유 슬롯의 기본 개수 — freedom 부모의 `vacationSlotBonus`가 여기에 더해진다. */
export const VACATION_BASE_SLOTS = 5;

/**
 * 이번 주에 플레이어가 채울 수 있는 선택 슬롯 수.
 *
 * 계획 화면(`MainWeekScreen`)과 이 파일이 같은 값을 써야 한다 — 두 층에 같은 표를 박으면
 * 한쪽만 늙는다(#441). 엔진은 이 상한을 보지 않는다(슬롯 배열을 그대로 처리한다).
 */
export function getWeekSlotCount(state: GameState): number {
  return state.isVacation
    ? VACATION_BASE_SLOTS + getParentMods(state.parents).vacationSlotBonus
    : SEMESTER_WEEKEND_SLOTS;
}

/**
 * 슬롯 배열의 `idx` 칸에 `id`를 넣은 **구멍 없는** 복사본. 계획 화면의 칸 편집은 전부 이걸 거친다.
 *
 * `newArr[idx] = id`는 앞 칸이 비어 있으면 배열 구멍(hole)을 남긴다 — 일요일만 고르면
 * `[<empty>, 'reading']`. 구멍은 `JSON.stringify`에서 `null`이 되고 `.map`·`.every`는 건너뛰며
 * 스프레드는 `undefined`로 편다 — 같은 계획이 지나는 층마다 다른 모양이 된다. 빈 칸은 `''`다:
 * `captureWeekendPlan`이 스냅샷에 쓰는 값이자 "지난주처럼"이 슬롯에 도로 채우는 값이고,
 * 엔진은 falsy를 "없음"으로 읽는다(`collapseActivityChoices`).
 */
export function assignSlot(slots: readonly string[], idx: number, id: string): string[] {
  // **map이 아니라 Array.from이다** — map은 구멍을 건너뛰어 구멍을 그대로 남긴다(captureWeekendPlan과 같은 이유).
  const next = Array.from({ length: Math.max(slots.length, idx + 1) }, (_, i) => slots[i] || '');
  next[idx] = id;
  return next;
}

/**
 * 확정 시점의 계획을 스냅샷으로 접는다. **빈 주말이면 `null`** — 복사할 것이 없다.
 *
 * 슬롯 배열을 인덱스째로 보존하는 이유: 동행 키가 `${activityId}:${slotIdx}`라
 * 배열을 압축하면 키가 가리키는 칸이 어긋난다. 빈 칸은 `''`로 정규화한다 —
 * 배열 구멍(`newArr[1] = id`가 만드는 hole)은 JSON 저장에서 `null`이 되기 때문이다.
 */
export function captureWeekendPlan(
  activities: readonly (string | null | undefined)[],
  npcChoices: Record<string, string>,
  isVacation: boolean,
): WeekendPlanSnapshot | null {
  // **map이 아니라 Array.from이다** — `map`은 배열 구멍을 건너뛰어 구멍을 그대로 남긴다.
  const slots = Array.from(activities, id => (typeof id === 'string' ? id : ''));
  // 꼬리의 빈 칸은 의미가 없다 — 있으나 없으나 같은 계획이다.
  while (slots.length > 0 && slots[slots.length - 1] === '') slots.pop();
  if (slots.every(id => id === '')) return null;
  return { activities: slots, npcChoices: { ...npcChoices }, isVacation };
}

/**
 * 세이브에서 읽은 스냅샷의 **모양**만 검사한다. 이상하면 정규화하지 않고 `null`(거부).
 *
 * 펴서 살리면 플레이어가 고른 적 없는 주말이 슬롯에 들어간다 — `saveIntegrity`가
 * 손상 세이브를 정규화하지 않고 거부하는 것과 같은 이유다.
 */
function readSnapshot(raw: unknown): WeekendPlanSnapshot | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.isVacation !== 'boolean') return null;
  if (!Array.isArray(p.activities)) return null;
  if (!p.activities.every(v => typeof v === 'string' || v === null)) return null;
  const rawChoices = p.npcChoices;
  if (typeof rawChoices !== 'object' || rawChoices === null || Array.isArray(rawChoices)) return null;
  const npcChoices: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawChoices)) {
    if (typeof v !== 'string') return null;
    npcChoices[k] = v;
  }
  return {
    activities: (p.activities as (string | null)[]).map(v => v ?? ''),
    npcChoices,
    isVacation: p.isVacation,
  };
}

/**
 * 지난주 계획을 **지금 그대로 다시 할 수 있는가**. 가능하면 채울 계획, 아니면 `null`.
 *
 * **전부 아니면 아무것도 아니다(hide-or-nothing).** 하나라도 불가능하면 버튼을 숨긴다.
 * "지난주처럼"은 약속이라 절반만 채우면 무엇이 빠졌는지 플레이어가 모르는 채로 다른
 * 주말이 된다. 부분 채움을 고르면 무엇이 빠졌는지 설명하는 줄이 하나 더 필요해져
 * 크롬도 는다 — 안 뜨는 버튼은 크롬이 0이다.
 *
 * 무효 사유는 넷:
 *   · 슬롯 구조가 다른 주(학기 2칸 ↔ 방학 자유 슬롯)
 *   · 카탈로그에 없는 활동 id (변조·삭제된 활동)
 *   · 동행 친구가 지금은 같이 못 감 (전출·졸업) 또는 동행 지정이 사라짐
 *   · 돈/학년·학기·방학횟수 게이트 — **엔진에게 묻는다**
 */
export function getRepeatablePlan(state: GameState): WeekendPlanSnapshot | null {
  const plan = readSnapshot(state.lastWeekendPlan);
  if (!plan) return null;
  // 학기 주말(2칸)과 방학 자유 슬롯은 다른 계획이다 — 서로 복사하지 않는다.
  if (plan.isVacation !== state.isVacation) return null;
  if (plan.activities.length > getWeekSlotCount(state)) return null;
  if (plan.activities.every(id => id === '')) return null;
  for (const id of plan.activities) {
    if (id !== '' && !ACTIVITIES.some(a => a.id === id)) return null;
  }

  // 동행 — 지난주 같이 간 친구가 지금도 같은 학교에 있는가(전출 도윤·졸업 공백기 하은).
  // 판정은 계획 화면의 동행 후보와 같은 규칙(met + isNpcEnrolled)을 쓴다.
  for (const npcId of Object.values(plan.npcChoices)) {
    const npc = state.npcs.find(n => n.id === npcId);
    if (!npc || !npc.met || !isNpcEnrolled(npc, state)) return null;
  }
  // 동행이 필수인 활동인데 지정이 없으면 "지난주처럼"이 성립하지 않는다.
  for (let i = 0; i < plan.activities.length; i++) {
    const id = plan.activities[i];
    if (!NPC_COMPANION_ACTIVITIES.includes(id)) continue;
    // 2칸 이상 활동의 이어지는 칸에는 동행 키가 없다(시작 칸에만 붙는다). 지금 동행 활동은
    // 전부 1칸이지만 카탈로그가 바뀌어도 안 깨지게 둔다.
    const slots = ACTIVITIES.find(a => a.id === id)?.slots ?? 1;
    if (i > 0 && plan.activities[i - 1] === id && slots >= 2) continue;
    if (!plan.npcChoices[`${id}:${i}`] && !plan.npcChoices[id]) return null;
  }

  // 돈·게이트는 **엔진이 남긴 기록**으로 판정한다. 이 계획으로 한 주를 그대로 돌려 보고
  // `WeekLog.skipped`를 읽는 것이다 — 화면이 판정을 재구현하면 순차 차감·수입 활동·
  // `vacationLimit`·꼬리 슬롯이 빠진다(MainWeekScreen의 `unaffordable`이 같은 출처를 쓴다).
  // origin='routine'은 루틴의 문제라 여기서 보지 않는다 — 루틴이 잔액을 먼저 먹으면
  // 어차피 선택 슬롯이 money로 스킵돼 여기 걸린다.
  const { skipped } = predictWeekOutcome(state, plan.activities, plan.npcChoices);
  if (skipped.some(s => s.origin === 'choice')) return null;

  return plan;
}
