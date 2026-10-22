// 쓸 수 있는 돈 — "새로 돈을 쓸 수 있는가"를 묻는 모든 판정의 단일 근거.
//
// 월 단위 계획(docs/monthly-plan-design-2026-10.md §4)에서는 월초에 그 달 주말 활동비를 **봉투처럼 예약**한다.
// 그러면 잔액(`state.money`)과 "지금 새로 쓸 수 있는 돈"이 갈린다 — 4주차 노래방 몫으로 떼어 둔 돈으로
// 2주차 생일 선물을 사면 안 된다. 그 판정이 이벤트 선택지·상점·활동 자격·확정 잠금 등 약 20곳에 흩어져
// `state.money`를 직접 읽고 있었다. 한 곳이라도 잔액을 읽으면 그 화면만 예약금을 써 버리므로(#441 —
// 두 근거가 갈리면 라벨이 거짓말한다) 여기 하나로 모은다.
//
// **지금은 잔액과 같다.** 예약(월 계획 상태)이 아직 없기 때문이다. 이 파일을 거치게 바꾼 변경은 동작이
// 바뀌지 않아야 하고, 주 진행 골든(weekly-driver-golden.json)이 바이트 동일로 그걸 증명한다.
// 예약이 생기면 여기서 `잔액 − 남은 예약`을 돌려준다.
//
// **실행 시점의 차감은 이 함수를 읽지 않는다.** 엔진이 이번 주 활동비를 실제로 뺄 때(gameEngine의 루틴·
// 주말 적용)는 예약된 그 돈을 쓰는 순간이므로 실제 잔액을 본다. 그 자리는 spendableMoneySsot.test.ts의
// 허용 목록에 이유와 함께 적혀 있다.
import type { GameState } from './types';

/** 지금 새로 쓸 수 있는 돈(만원). 예약이 없으면 잔액 그대로. */
export function getSpendableMoney(state: Pick<GameState, 'money'>): number {
  return state.money;
}

/** 새로 `cost`만원을 쓸 수 있는가. 비용 0 이하는 항상 참. */
export function canSpend(state: Pick<GameState, 'money'>, cost: number): boolean {
  return cost <= 0 || getSpendableMoney(state) >= cost;
}
