// 절대주차 SSOT — 한 학년 48주 가정(W48 전환). "몇 주 전" 비교용이라 ±1주 오차는 무해.
// 관계 신호(relationshipSignals)·이벤트 페이싱(events/selection) 공용. 의존 없는 순수 leaf 모듈.
export function absWeek(year: number, week: number): number {
  return (year - 1) * 48 + week;
}
