// 한 달 계획 — 그 달 각 주의 주말(방학이면 자유) 칸과 동행, 그리고 남은 주 활동비의 봉투 예약.
// 설계: docs/monthly-plan-design-2026-10.md §3·§4.
//
// **엔진은 여전히 주 단위로 돈다.** 이 계획은 "그 주에 무엇을 넣을지"를 미리 적어 둔 것일 뿐이고,
// 그 주가 오면 계획 화면(또는 5단계 자동 진행)이 그 주 칸을 꺼내 평소처럼 확정한다(store.confirmWeek).
//
// **봉투 예약.** 남은 주의 유료 활동비를 쓸 수 있는 돈에서 미리 뺀다 — 4주차 노래방 몫으로 떼어 둔 돈으로
// 2주차 생일 선물을 사면 안 된다. 예약은 그 주가 처리되는 순간 사라진다(그 주 돈은 엔진이 실제 잔액에서 뺀다).
// 그래서 "아직 처리 안 된 주"(state.week 이후)만 센다. 수입 활동(알바)은 예약하지 않는다 — 일한 주에 받는다.
//
// 이 파일은 gameEngine·weekendPlan을 import하지 않는다(spendableMoney → 이 파일 경로가 엔진 쪽에서 불리므로 순환 방지).
import { ACTIVITIES, NPC_COMPANION_ACTIVITIES, collapseActivityChoicesWithSlots, getActivityCost } from './activities';
import { slotCountFor } from './slotCount';
import { getMonthBlock, getWeekInfo } from './weekMath';
import type { GameState, MonthPlan, MonthPlanWeek } from './types';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** 지금 달의 계획. 없거나 지난달(학년·달 블록이 다름) 것이면 null. 학년 전환 대기(W49)도 null. */
export function getCurrentMonthPlan(state: Pick<GameState, 'monthPlan' | 'year' | 'week'>): MonthPlan | null {
  const plan = state.monthPlan;
  if (!plan || state.week < 1 || state.week > 48) return null;
  return plan.year === state.year && plan.month === getMonthBlock(state.week).index ? plan : null;
}

/** 이번 달 계획에 적힌 그 주의 칸. 없으면 null. */
export function getPlannedWeek(state: Pick<GameState, 'monthPlan' | 'year' | 'week'>, week = state.week): MonthPlanWeek | null {
  return getCurrentMonthPlan(state)?.weeks.find(w => w.week === week) ?? null;
}

/**
 * 계획의 이번 주 칸을 주간 화면에서 고친 칸으로 바꾼 남은 주 계획 — [▶ 남은 주 자동 진행]이 화면에서 손본 이번 주를 버리지 않게(3자 검수).
 * 지난 주는 뺀다(validateMonthPlan은 지금 주부터 달 끝까지를 받는다). 동행 키는 그 칸의 동행 활동을 가리키는 것만 남긴다 —
 * 화면은 칸을 바꿔도 예전 동행 키를 들고 있을 수 있다.
 */
export function withPlannedWeek(plan: MonthPlan, week: number, activities: readonly string[], npcChoices: Readonly<Record<string, string>>): MonthPlan {
  const companions = Object.fromEntries(Object.entries(npcChoices).filter(([key]) => {
    const m = /^(.+):(\d+)$/.exec(key);
    return !!m && activities[Number(m[2])] === m[1] && NPC_COMPANION_ACTIVITIES.includes(m[1]);
  }));
  return {
    ...plan,
    weeks: plan.weeks.filter(w => w.week >= week)
      .map(w => w.week === week ? { ...w, activities: [...activities], npcChoices: companions } : w),
  };
}

/** 한 주 계획의 유료 활동비 합 — 여러 칸 활동은 한 번만, 수입 활동은 0. */
export function plannedWeekCost(activities: readonly string[], year: number): number {
  return round1(collapseActivityChoicesWithSlots([...activities]).reduce((sum, inst) => {
    const a = ACTIVITIES.find(x => x.id === inst.id);
    const cost = a ? getActivityCost(a, year) : 0;
    return sum + (cost > 0 ? cost : 0);
  }, 0));
}

/**
 * 봉투에 떼어 둔 돈 — 이번 달 계획 중 `fromWeek` 이후(포함) 주들의 유료 활동비 합.
 * 기본 `fromWeek` = 지금 주: 아직 처리되지 않은 주들이다(사건·상점은 처리 뒤 다음 주 좌표에서 열린다).
 */
export function reservedMoney(state: Pick<GameState, 'monthPlan' | 'year' | 'week'>, fromWeek = state.week): number {
  const plan = getCurrentMonthPlan(state);
  if (!plan) return 0;
  return round1(plan.weeks
    .filter(w => w.week >= fromWeek)
    .reduce((sum, w) => sum + plannedWeekCost(w.activities, state.year), 0));
}

/** 그 주가 방학인지(학기 구조 SSOT) 보고 채울 수 있는 칸 수. */
export function slotCountForWeek(state: Pick<GameState, 'parents'>, week: number): number {
  return slotCountFor(state.parents, getWeekInfo(week).isVacation);
}

/**
 * 계획이 지금 판에 맞는지 — 맞으면 null, 아니면 이유. store.setMonthPlan이 저장 전에 본다.
 *   · 지금 (학년, 달 블록)의 계획이어야 한다.
 *   · 주는 지금 주부터 그 달 끝까지 빠짐없이, 순서대로(달 중간에 다시 짜면 남은 주만).
 *   · 칸 수는 그 주의 상한 이하(학기 2 / 방학 5 + 자유방임 1), 활동 id는 카탈로그에 있어야 한다.
 *   · 동행 키는 `${활동}:${칸}` 모양이고 그 칸에 그 동행 활동이 있어야 한다.
 */
export function validateMonthPlan(state: Pick<GameState, 'year' | 'week' | 'parents'>, plan: MonthPlan): string | null {
  if (state.week < 1 || state.week > 48) return '학년 전환 중에는 계획할 수 없다';
  const block = getMonthBlock(state.week);
  if (plan.year !== state.year || plan.month !== block.index) return `지금 달(${state.year}학년 ${block.label})의 계획이 아니다`;
  const expected = Array.from({ length: block.endWeek - state.week + 1 }, (_, i) => state.week + i);
  const got = plan.weeks.map(w => w.week);
  if (got.length !== expected.length || got.some((w, i) => w !== expected[i])) {
    return `주가 맞지 않는다 — 기대 [${expected.join(',')}], 받은 [${got.join(',')}]`;
  }
  for (const w of plan.weeks) {
    const cap = slotCountForWeek(state, w.week);
    if (w.activities.length > cap) return `W${w.week}: 칸 ${w.activities.length}개가 상한 ${cap}을 넘는다`;
    for (const id of w.activities) {
      if (id && !ACTIVITIES.some(a => a.id === id)) return `W${w.week}: 없는 활동 id '${id}'`;
    }
    for (const key of Object.keys(w.npcChoices)) {
      const m = /^(.+):(\d+)$/.exec(key);
      if (!m) return `W${w.week}: 동행 키 '${key}' 모양이 아니다`;
      const [, id, idx] = m;
      if (w.activities[Number(idx)] !== id || !NPC_COMPANION_ACTIVITIES.includes(id)) {
        return `W${w.week}: 동행 '${key}'이 그 칸의 동행 활동을 가리키지 않는다`;
      }
    }
  }
  return null;
}
