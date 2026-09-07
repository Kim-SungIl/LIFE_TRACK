// 돈 궤적 (T25) — 학년말·엔딩에서 "그 해/7년 동안 돈이 어떻게 굴렀는지"를 한 줄로 회수한다.
//
// 왜 최종 잔액이 아니라 궤적인가:
//   잔액 스냅샷 하나로는 정반대의 두 플레이가 같은 값을 낸다. 유료 루틴 빌드는 매주 잉여가 0이라
//   늘 0 근처이고, 알뜰하게 딱 맞춰 쓴 판도 0 근처다. T21에서 행복 등급을 마지막 스냅샷에서
//   궤적으로 바꾼 것과 같은 함정이라 처음부터 학년별로 적립한다.
//
// 두 축을 쓴다:
//   spent        — 그 해에 실제로 빠져나간 돈(만원). 0 하한 클램프 **이후**의 실차감분이다.
//   blockedWeeks — 그 해에 **돈 때문에 주 계획을 확정하지 못한** 주 수(주당 최대 1).
//
// ⚠️ blockedWeeks를 무엇으로 세는지가 이 파일의 핵심이고, 두 번 틀렸다.
//
//   ① 처음엔 엔진의 `WeekLog.skipped(reason:'money')`를 셌다. 그런데 MainWeekScreen의
//      `confirmDisabled`가 바로 그 기록을 읽어 **주 확정을 막으므로**, 막힌 주는 애초에
//      `processWeek`에 도달하지 않는다. 제품에서 상시 0이 되는 죽은 축이었다.
//   ② 다음엔 `getAvailableActivities` 차집합(잔액 무한 대조군)으로 갈았다. 이건 더 나빴다 —
//      `passesActivityGates`는 **비용을 아예 보지 않고** `requires`만 본다. 그래서 세어진 것은
//      `requires`에 돈 조건이 있어 **목록에서 사라진**(플레이어가 보지도 못한) 활동이고,
//      가격만 있고 `requires`가 없어 목록에 회색으로 남는 것(hang-out 1만·family-trip 8만 등
//      4종)은 못 셌다. 의도와 정확히 반대 집합이었다. 게다가 Y5+에서는 돈 `requires`를 가진
//      활동이 과외(28만) 하나로 수렴해, 이 축이 "잔액이 28만 미만인가"의 다른 이름이 됐다.
//
//   ③ 지금 세는 것 = **플레이어가 실제로 겪은 강제 계획 변경.** 계획 화면에서 확정 버튼이
//      돈 때문에 잠긴 주다(루틴 고정비를 못 내거나, 고른 활동이 순차 차감에서 떨어짐).
//      제품에서 그 순간에만 발생하므로 UI가 알려 준다(store.markMoneyBlockedWeek).
//      실측(4페르소나 × 4시드 × 7년, 연평균): 무료 0 · 혼합 0 · 유료 0 · 지출형 34.8 ·
//      지출형+부유 4.6. 잔액 단일 문턱으로 환원되지 않는다 — 계획 대비 누적 비용에 달린다.
//
// 두 축이 함께 있어야 "쪼들렸다"와 "안 썼다"가 갈린다 — 막힌 적이 없는데 지출도 0이면
// 돈이 없어서가 아니라 지갑을 열 생각을 안 한 것이고, 그게 무료 루틴 빌드가 7년 말
// 1500만원대를 방치하던 축이다. 판정에 잔액이 안 들어가므로 기록장(readonly) 회상에서도
// 시점 오염이 없다.

import type { GameState } from './types';

export const MONEY_YEAR_SLOTS = 7;

// ending.ts의 emptyYearCounts와 모양은 같지만 일부러 복제한다 —
// shopSystem이 이 모듈을 import하므로 ending(→memorySystem→…)을 끌어오면 순환 위험이 생긴다.
export function emptyMoneyYears(): number[] {
  return [0, 0, 0, 0, 0, 0, 0];
}

const isYearArray = (v: unknown): v is number[] =>
  Array.isArray(v) && v.length === MONEY_YEAR_SLOTS;

/**
 * 이 판이 돈 궤적을 기록하는 판인가.
 *
 * **기록기는 배열을 새로 만들지 않는다.** 만들게 두면 구세이브가 첫 지출/첫 막힘에서
 * 0으로 채운 7년 배열을 얻고, 마이그레이션 이전 학년이 "아는 0"으로 읽혀 화면이
 * "지갑을 안 연 7년"이라고 거짓말한다(백필을 피하려던 이유와 같은 거짓말이다).
 * 구세이브는 배열이 없으므로 여기서 false가 되어 영구히, **결정론적으로** 침묵한다.
 * 손상 세이브(길이 불일치·비배열)도 같은 경로로 조용히 빠진다.
 */
export function hasMoneyTracking(
  state: Pick<GameState, 'moneySpentByYear' | 'moneyBlockedWeeksByYear'>,
): boolean {
  return isYearArray(state.moneySpentByYear) && isYearArray(state.moneyBlockedWeeksByYear);
}

function yearSlot(year: number): number | null {
  if (!Number.isFinite(year) || year < 1 || year > MONEY_YEAR_SLOTS) return null;
  return year - 1;
}

/** 실제로 빠져나간 금액을 그 해 슬롯에 적립. 0/음수는 무시한다 — 수입은 지출이 아니다. */
export function recordMoneySpent(state: GameState, amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (!hasMoneyTracking(state)) return;
  const i = yearSlot(state.year);
  if (i == null) return;
  const arr = state.moneySpentByYear!;
  arr[i] = Math.round(((arr[i] ?? 0) + amount) * 10) / 10;
}

/**
 * "돈 때문에 이번 주 계획을 확정하지 못했다"를 그 해 슬롯에 1주 적립.
 * 주당 최대 1회 — 중복 호출은 store가 절대주차 스탬프로 막는다(markMoneyBlockedWeek).
 */
export function recordMoneyBlockedWeek(state: GameState): void {
  if (!hasMoneyTracking(state)) return;
  const i = yearSlot(state.year);
  if (i == null) return;
  const arr = state.moneyBlockedWeeksByYear!;
  arr[i] = (arr[i] ?? 0) + 1;
}

export type MoneyTrajectory = {
  spent: number;          // 기간 총 지출(만원)
  blockedWeeks: number;   // 기간 총 "돈에 막힌 주" 수
  strappedYears: number;  // 그중 한 해 안에서 STRAPPED 문턱을 넘긴 해의 수
  years: number;          // 그 기간이 몇 학년치인지 (연 환산용)
};

export type MoneyPattern = 'strapped' | 'tight' | 'hoarded' | 'balanced';

// 문턱 — 한 해는 48주.
//   STRAPPED 12주 = 한 해의 4분의 1. 실측 지출형(연 34.8주)이 여기 걸리고,
//   TIGHT 3주로 그 아래를 받는다(실측 지출형+부유 연 4.6주).
//   무료·혼합·유료 루틴은 연 0주라 지출 축으로 갈린다.
const STRAPPED_BLOCKED_WEEKS_PER_YEAR = 12;
const TIGHT_BLOCKED_WEEKS_PER_YEAR = 3;
// 7년 판정에서 '돈이 앞을 막던 7년'이라고 부르려면 그런 해가 몇 해여야 하는가.
// 1해로는 과하고(지출형+부유는 Y1만 나빴다), 평균만 보면 후반 궤적이 지워진다 —
// 12주짜리 해가 3년 연속이어도 36/7=5.1로 'tight'에 머물던 것이 T21과 같은 함정이었다.
const STRAPPED_YEARS_FOR_LIFETIME = 3;
// HOARD 40만/년 = 주당 1만 미만, 연 수입(192~336만)의 20% 미만. 실측 무료 루틴이 연 15만이다.
const HOARD_SPENT_PER_YEAR = 40;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0);

export function moneyTrajectoryForYear(
  state: Pick<GameState, 'moneySpentByYear' | 'moneyBlockedWeeksByYear'>,
  year: number,
): MoneyTrajectory | null {
  if (!hasMoneyTracking(state)) return null;
  const i = yearSlot(year);
  if (i == null) return null;
  const blocked = num(state.moneyBlockedWeeksByYear![i]);
  return {
    spent: num(state.moneySpentByYear![i]),
    blockedWeeks: blocked,
    strappedYears: blocked >= STRAPPED_BLOCKED_WEEKS_PER_YEAR ? 1 : 0,
    years: 1,
  };
}

/** 7년 합. 아직 안 산 해도 분모에 들어간다 — 완주 시점에만 쓰는 함수라 문제 없다. */
export function moneyTrajectoryLifetime(
  state: Pick<GameState, 'moneySpentByYear' | 'moneyBlockedWeeksByYear'>,
): MoneyTrajectory | null {
  if (!hasMoneyTracking(state)) return null;
  let spent = 0;
  let blockedWeeks = 0;
  let strappedYears = 0;
  for (let i = 0; i < MONEY_YEAR_SLOTS; i++) {
    spent += num(state.moneySpentByYear![i]);
    const b = num(state.moneyBlockedWeeksByYear![i]);
    blockedWeeks += b;
    if (b >= STRAPPED_BLOCKED_WEEKS_PER_YEAR) strappedYears++;
  }
  return { spent: Math.round(spent * 10) / 10, blockedWeeks, strappedYears, years: MONEY_YEAR_SLOTS };
}

/** 지출로 갈리는 마지막 두 칸 — 막힌 적이 사실상 없는 판을 "안 썼다"와 "잘 썼다"로 나눈다. */
function bySpend(t: MoneyTrajectory): MoneyPattern {
  return t.spent / Math.max(1, t.years) < HOARD_SPENT_PER_YEAR ? 'hoarded' : 'balanced';
}

/** 그 해 한 칸의 판정. */
export function moneyPatternForYear(t: MoneyTrajectory): MoneyPattern {
  if (t.blockedWeeks >= STRAPPED_BLOCKED_WEEKS_PER_YEAR) return 'strapped';
  if (t.blockedWeeks >= TIGHT_BLOCKED_WEEKS_PER_YEAR) return 'tight';
  return bySpend(t);
}

/**
 * 7년의 판정. **평균만 쓰지 않는다** — 나쁜 해가 몇 해였는지를 먼저 본다.
 * 평균으로만 자르면 후반 3년이 통째로 막힌 판도 'tight'로 내려앉는다(T21과 같은 wash-out).
 */
export function moneyPatternLifetime(t: MoneyTrajectory): MoneyPattern {
  if (t.strappedYears >= STRAPPED_YEARS_FOR_LIFETIME) return 'strapped';
  if (t.strappedYears >= 1 || t.blockedWeeks / Math.max(1, t.years) >= TIGHT_BLOCKED_WEEKS_PER_YEAR) return 'tight';
  return bySpend(t);
}

const fmtMoney = (v: number): string => Math.round(v).toLocaleString('ko-KR');

// 잔액을 덧붙일 문턱 — 한 해 수입(192~336만)에 육박하게 남은 판만 "남았다"고 말한다.
const LEFTOVER_MENTION = 300;

/** 학년말 한 줄. 잔액을 안 쓰므로 기록장(readonly) 회상에도 그대로 안전하다. */
export function moneyYearLine(t: MoneyTrajectory): { title: string; desc: string } {
  switch (moneyPatternForYear(t)) {
    case 'strapped':
      return {
        title: '💸 돈이 자주 걸린 한 해',
        desc: `계획을 세워놓고 값 때문에 다시 고친 주가 ${t.blockedWeeks}주였다.`,
      };
    case 'tight':
      return {
        title: '🪙 빠듯했던 한 해',
        desc: `쓸 만큼은 썼다. 그래도 ${t.blockedWeeks}주는 계획을 접고 다시 짜야 했다.`,
      };
    case 'hoarded':
      return {
        title: '🏦 지갑을 안 연 한 해',
        desc: '용돈은 매주 들어왔는데, 쓴 데가 거의 없었다.',
      };
    default:
      return {
        title: '💰 쓸 줄 알았던 한 해',
        desc: '필요한 데 쓰고, 아쉬운 데서 멈췄다.',
      };
  }
}

/** 엔딩 한 줄. 여기서만 최종 잔액을 쓴다 — 7년을 닫는 한 순간이라 스톡이 곧 결과다. */
export function moneyLifeLine(t: MoneyTrajectory, finalMoney: number): { title: string; desc: string } {
  const left = Math.max(0, finalMoney);
  switch (moneyPatternLifetime(t)) {
    case 'strapped':
      return {
        title: '💸 돈이 앞을 막던 7년',
        desc: `${t.blockedWeeks}주 동안, 하려던 것을 값 때문에 고쳐 잡았다. 그때마다 이유는 같았다.`,
      };
    case 'tight':
      return {
        title: '🪙 빠듯하게 굴린 7년',
        desc: `넉넉하진 않았다. ${t.blockedWeeks}주는 계획을 다시 짰지만, 해낸 쪽이 많았다.`,
      };
    case 'hoarded':
      return {
        title: '🏦 쓰지 않은 7년',
        desc: `용돈은 7년 내내 들어왔다. ${fmtMoney(left)}만원이 남았고, 그 돈으로 할 수 있었던 것들도 같이 남았다.`,
      };
    default:
      return {
        title: '💰 쓸 줄 알았던 7년',
        desc: left >= LEFTOVER_MENTION
          ? `쓸 때 썼다. 그러고도 ${fmtMoney(left)}만원이 남았다.`
          : '모자라지도, 남기지도 않았다. 쓸 때 썼다.',
      };
  }
}
