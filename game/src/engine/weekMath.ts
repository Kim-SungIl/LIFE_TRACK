// 절대주차 SSOT — 한 학년 48주 가정(W48 전환). "몇 주 전" 비교용이라 ±1주 오차는 무해.
// 관계 신호(relationshipSignals)·이벤트 페이싱(events/selection) 공용. 의존 없는 순수 leaf 모듈.
export function absWeek(year: number, week: number): number {
  return (year - 1) * 48 + week;
}

// ===== 학기 구조 SSOT =====
// 1학기: W1~W19, 여름방학: W20~W24, 2학기: W25~W42, 겨울방학: W43~W48.
// gameEngine에 있던 것을 leaf로 내렸다 — 계절을 읽어야 하는 층(말걸기·관계 신호)이
// gameEngine을 끌어오면 순환이 된다(gameEngine → relationshipSignals → …).
// gameEngine은 기존 import 경로 유지를 위해 재노출한다(absWeek과 같은 방식).
export function getWeekInfo(week: number) {
  if (week <= 19) return { semester: 1 as const, isVacation: false, label: `1학기 ${week}주차` };
  if (week <= 24) return { semester: 1 as const, isVacation: true, label: `여름방학 ${week - 19}주차` };
  if (week <= 42) return { semester: 2 as const, isVacation: false, label: `2학기 ${week - 24}주차` };
  return { semester: 2 as const, isVacation: true, label: `겨울방학 ${week - 42}주차` };
}

/** 계절 — 잡담·미니이벤트 게이트가 공유하는 단일 근거. state.isVacation(저장 필드)을 읽지 않는다. */
export function getSeason(week: number): 'semester' | 'vacation' {
  return getWeekInfo(week).isVacation ? 'vacation' : 'semester';
}
