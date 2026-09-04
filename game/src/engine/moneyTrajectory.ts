// 돈 궤적 (T25) — 학년말·엔딩에서 "그 해/7년 동안 돈이 어떻게 굴렀는지"를 한 줄로 회수한다.
//
// 왜 최종 잔액이 아니라 궤적인가:
//   잔액 스냅샷 하나로는 정반대의 두 플레이가 같은 값을 낸다. 유료 루틴 빌드는 매주 잉여가 0이라
//   늘 0 근처이고, 알뜰하게 딱 맞춰 쓴 판도 0 근처다. T21에서 행복 등급을 마지막 스냅샷에서
//   궤적으로 바꾼 것과 같은 함정이라 처음부터 학년별로 적립한다.
//
// 두 축을 쓴다:
//   spent      — 그 해에 실제로 빠져나간 돈(만원). 0 하한 클램프 **이후**의 실차감분이다.
//   tightWeeks — 그 해에 "돈만 없어서" 못 고르는 활동이 하나라도 있던 주 수(0~48).
//
// ⚠ tightWeeks가 **엔진 스킵(WeekLog.skipped)이 아닌 이유**는 실측에서 나왔다.
//   MainWeekScreen의 confirmDisabled가 바로 그 skipped(money)를 읽어 주 확정을 막으므로,
//   제품에서 돈 스킵이 실제로 일어나는 경우는 거의 없다. 스킵을 세면 지출형 플레이어조차
//   연 0회로 잡혀 '쪼들림' 문장이 영구 미노출 컷이 된다(#409와 같은 실패형).
//   그래서 플레이어가 **실제로 겪는 것** — 목록에 있는데 값 때문에 못 고르는 상태 — 를 센다.
//   판정은 제품과 같은 SSOT(getAvailableActivities)에 잔액만 무한으로 준 대조군의 차집합이다.
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

function yearSlot(year: number): number | null {
  if (!Number.isFinite(year) || year < 1 || year > MONEY_YEAR_SLOTS) return null;
  return year - 1;
}

/** 실제로 빠져나간 금액을 그 해 슬롯에 적립. 0/음수는 무시한다 — 수입은 지출이 아니다. */
export function recordMoneySpent(state: GameState, amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) return;
  const i = yearSlot(state.year);
  if (i == null) return;
  const arr = state.moneySpentByYear ?? emptyMoneyYears();
  arr[i] = Math.round(((arr[i] ?? 0) + amount) * 10) / 10;
  state.moneySpentByYear = arr;
}

/** 이번 주가 "돈에 막힌 주"였으면 그 해 슬롯에 1주 적립. 주당 최대 1이다(활동 수가 아니다). */
export function recordTightWeek(state: GameState, lockedByMoney: number): void {
  if (!Number.isFinite(lockedByMoney) || lockedByMoney <= 0) return;
  const i = yearSlot(state.year);
  if (i == null) return;
  const arr = state.moneyTightWeeksByYear ?? emptyMoneyYears();
  arr[i] = (arr[i] ?? 0) + 1;
  state.moneyTightWeeksByYear = arr;
}

export type MoneyTrajectory = {
  spent: number;        // 기간 총 지출(만원)
  tightWeeks: number;   // 기간 중 돈에 막힌 주 수
  years: number;        // 그 기간이 몇 학년치인지 (연 환산용)
};

export type MoneyPattern = 'strapped' | 'tight' | 'hoarded' | 'balanced';

// 문턱 — 한 해는 48주, 주간 용돈은 학교급·wealth에 따라 4~7만이라 연 수입은 192~336만이다.
//
// 실측(5페르소나 × 3시드 × 7년)에서 나온 분포로 잡았다:
//   무료·유료·혼합 루틴은 막힌 주 0 — 잔액이 카탈로그 최고가를 금방 넘긴다.
//   지출형(유료루틴+유료주말)만 Y5~Y7이 48/48/48주로 통째로 막힌다(고등 -1만/주는 의도된 설계).
//   지출형+부유한부모는 Y5만 31주.
//   STRAPPED 12주 = 한 해의 4분의 1. 지출형의 고등 3년과 wealth의 Y5가 여기 걸리고,
//   TIGHT 3주로 그 아래를 받는다. 두 값 다 위 분포에서 어느 쪽으로 움직여도 페르소나가 갈린다.
const STRAPPED_TIGHT_WEEKS_PER_YEAR = 12;
const TIGHT_WEEKS_PER_YEAR = 3;
// HOARD 40만/년 = 주당 1만 미만, 연 수입의 20% 미만. 실측 무료 루틴이 연 15만이다.
const HOARD_SPENT_PER_YEAR = 40;

// 구세이브(=배열 없음)는 null을 돌려준다. 0으로 백필하면 "한 푼도 안 썼다"는 거짓 회고가 되므로
// 화면은 이 null을 받아 줄을 아예 그리지 않는다(#424 양방향 폴백 규칙).
function readYears(state: Pick<GameState, 'moneySpentByYear' | 'moneyTightWeeksByYear'>):
  { spent: number[]; tight: number[] } | null {
  const spent = state.moneySpentByYear;
  const tight = state.moneyTightWeeksByYear;
  if (!Array.isArray(spent) || !Array.isArray(tight)) return null;
  return { spent, tight };
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0);

export function moneyTrajectoryForYear(
  state: Pick<GameState, 'moneySpentByYear' | 'moneyTightWeeksByYear'>,
  year: number,
): MoneyTrajectory | null {
  const src = readYears(state);
  const i = yearSlot(year);
  if (!src || i == null) return null;
  return { spent: num(src.spent[i]), tightWeeks: num(src.tight[i]), years: 1 };
}

/** 7년 합. 아직 안 산 해도 분모에 들어간다 — 완주 시점에만 쓰는 함수라 문제 없다. */
export function moneyTrajectoryLifetime(
  state: Pick<GameState, 'moneySpentByYear' | 'moneyTightWeeksByYear'>,
): MoneyTrajectory | null {
  const src = readYears(state);
  if (!src) return null;
  let spent = 0;
  let tightWeeks = 0;
  for (let i = 0; i < MONEY_YEAR_SLOTS; i++) {
    spent += num(src.spent[i]);
    tightWeeks += num(src.tight[i]);
  }
  return { spent: Math.round(spent * 10) / 10, tightWeeks, years: MONEY_YEAR_SLOTS };
}

export function moneyPattern(t: MoneyTrajectory): MoneyPattern {
  const years = Math.max(1, t.years);
  const tightPerYear = t.tightWeeks / years;
  if (tightPerYear >= STRAPPED_TIGHT_WEEKS_PER_YEAR) return 'strapped';
  if (tightPerYear >= TIGHT_WEEKS_PER_YEAR) return 'tight';
  // 여기부터는 돈에 막힌 적이 사실상 없는 판이다. 안 쓴 것과 잘 쓴 것을 지출로 가른다.
  return t.spent / years < HOARD_SPENT_PER_YEAR ? 'hoarded' : 'balanced';
}

const fmtMoney = (v: number): string => Math.round(v).toLocaleString('ko-KR');

// 잔액을 덧붙일 문턱 — 한 해 수입(192~336만)에 육박하게 남은 판만 "남았다"고 말한다.
const LEFTOVER_MENTION = 300;

/** 학년말 한 줄. 잔액을 안 쓰므로 기록장(readonly) 회상에도 그대로 안전하다. */
export function moneyYearLine(t: MoneyTrajectory): { title: string; desc: string } {
  switch (moneyPattern(t)) {
    case 'strapped':
      return {
        title: '💸 돈이 자주 걸린 한 해',
        desc: `하고 싶은 걸 앞에 두고 값부터 본 주가 ${t.tightWeeks}주였다.`,
      };
    case 'tight':
      return {
        title: '🪙 빠듯했던 한 해',
        desc: `쓸 만큼은 썼다. 그래도 ${t.tightWeeks}주는 값을 먼저 봐야 했다.`,
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
  switch (moneyPattern(t)) {
    case 'strapped':
      return {
        title: '💸 돈이 앞을 막던 7년',
        desc: `${t.tightWeeks}주 동안, 하고 싶은 것 앞에서 값부터 봤다. 그때마다 이유는 같았다.`,
      };
    case 'tight':
      return {
        title: '🪙 빠듯하게 굴린 7년',
        desc: `넉넉하진 않았다. ${t.tightWeeks}주는 값을 먼저 봤지만, 해낸 쪽이 많았다.`,
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
