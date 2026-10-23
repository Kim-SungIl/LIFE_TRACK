// 쓸 수 있는 돈 — "새로 돈을 쓸 수 있는가"를 묻는 모든 판정의 단일 근거.
//
// 월 단위 계획(docs/monthly-plan-design-2026-10.md §4)에서는 그 달 주말 활동비를 **봉투처럼 예약**한다
// (monthPlan.reservedMoney). 그래서 잔액(`state.money`)과 "지금 새로 쓸 수 있는 돈"이 갈린다 — 4주차 노래방 몫으로
// 떼어 둔 돈으로 2주차 생일 선물을 사면 안 된다. 한 곳이라도 잔액을 직접 읽으면 그 화면만 예약금을 써 버리므로
// (#441 — 두 근거가 갈리면 라벨이 거짓말한다) 판정은 여기 하나로 모은다.
//
// **두 가지 물음이 있다.**
//   · getSpendableMoney / canSpend — 아직 처리 안 된 주(지금 주 포함)의 예약을 뺀 돈. 사건 선택지·상점·
//     이벤트 조건처럼 **계획 밖의 새 지출**이 묻는다. 사건은 processWeek 뒤 다음 주 좌표에서 열리므로
//     "지금 주"가 곧 아직 안 쓴 주다.
//   · getSpendableForPlanning / canSpendWhilePlanning — 지금 고치고 있는 **그 주 자신의** 예약은 빼지 않는다.
//     계획 화면에서 이번 주 칸을 편집할 때 그 칸의 비용을 예약으로 한 번, 선택으로 또 한 번 세면 안 되기 때문이다.
//
// **실행 시점의 차감은 이 파일을 읽지 않는다.** 엔진이 이번 주 활동비를 실제로 뺄 때는 예약된 그 돈을 쓰는
// 순간이므로 실제 잔액을 본다. 그 자리는 spendableMoneySsot.test.ts의 허용 목록에 이유와 함께 적혀 있다.
import { reservedMoney } from './monthPlan';
import type { GameState } from './types';

type MoneyView = Pick<GameState, 'money' | 'monthPlan' | 'year' | 'week'>;

/** 지금 새로 쓸 수 있는 돈(만원) = 잔액 − 아직 처리 안 된 주들의 예약. 음수면 0. */
export function getSpendableMoney(state: MoneyView): number {
  return Math.max(0, Math.round((state.money - reservedMoney(state)) * 10) / 10);
}

/** 새로 `cost`만원을 쓸 수 있는가. 비용 0 이하는 항상 참. */
export function canSpend(state: MoneyView, cost: number): boolean {
  return cost <= 0 || getSpendableMoney(state) >= cost;
}

/** 계획 화면에서 **이번 주** 칸을 고칠 때 쓸 수 있는 돈 = 잔액 − 다음 주부터의 예약(이번 주 몫은 지금 고르는 중). */
export function getSpendableForPlanning(state: MoneyView): number {
  return Math.max(0, Math.round((state.money - reservedMoney(state, state.week + 1)) * 10) / 10);
}

/** 이번 주를 확정하며 `cost`만원을 낼 수 있는가(루틴비 등) — 다음 주부터의 예약은 건드리지 않는다. */
export function canSpendWhilePlanning(state: MoneyView, cost: number): boolean {
  return cost <= 0 || getSpendableForPlanning(state) >= cost;
}
