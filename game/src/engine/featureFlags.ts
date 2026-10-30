// 기능 플래그 — 큰 기능을 켜고 끈다.
//
// **월 단위 계획(MONTHLY_PLANNING) — 기본값 켜짐.** 주간 화면이 메인이고, 그 화면 띠에서 한 달 계획을 짜면 남은 주의 칸이
// 미리 채워진다. 자동 진행(재생 카드 → 월말 결산)은 띠의 [▶ 남은 주 자동 진행]을 누를 때만 돈다(2026-10-29 사용자 판정 —
// 예전엔 계획 화면이 먼저 뜨고 저장하면 곧장 재생됐다. docs/monthly-plan-design-2026-10.md). 막고 있던 둘을 풀고 켰다:
//   · 첫 판 튜토리얼 — 주간 화면에 MONTHLY_MAIN_STEPS(계획 띠 스텝 포함), 계획 화면을 처음 열면 MONTH_PLAN_STEPS(tutorialSteps.ts)
//   · 배포 E2E — verify:dist-e2e가 이어하기 → 주간 화면 → 월 계획 → 저장 → 자동 진행 → 재생 카드 → 멈춤 → 새로고침 경로를 걷는다
// 주 단위로 되돌려 보려면 개발자 도구 콘솔에서 `localStorage.setItem('lifetrack_monthly_planning', '0')` 뒤 새로고침.
export const MONTHLY_PLANNING_DEFAULT = true;
export const MONTHLY_PLANNING_KEY = 'lifetrack_monthly_planning';

/** 월 계획 화면을 쓰는가. 저장소가 막힌 환경에서는 기본값. */
export function isMonthlyPlanningEnabled(): boolean {
  try {
    const v = localStorage.getItem(MONTHLY_PLANNING_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch { /* 저장소 차단 — 기본값 */ }
  return MONTHLY_PLANNING_DEFAULT;
}
