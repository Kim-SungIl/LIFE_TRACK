// 기능 플래그 — 아직 다 붙지 않은 큰 기능을 켜고 끈다.
//
// **월 단위 계획(MONTHLY_PLANNING).** 4단계(월 계획 화면)까지 들어왔지만 4주 자동 진행(5단계)·튜토리얼 개편(6단계)이
// 아직이다. 지금 켜면 첫 판 튜토리얼이 가리키는 주간 화면 요소가 첫 화면에 없고, 배포 E2E(verify:dist-e2e)의
// "이어하기 → 루틴 → 확정" 경로가 월 계획 화면에 막힌다. 그래서 기본은 꺼 두고, 디렉터가 직접 해 볼 수 있게
// 브라우저 저장소 키로 켠다: 개발자 도구 콘솔에서 `localStorage.setItem('lifetrack_monthly_planning', '1')` 뒤 새로고침.
// 5·6단계가 끝나면 기본값을 켠다(docs/monthly-plan-design-2026-10.md §12).
export const MONTHLY_PLANNING_DEFAULT = false;
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
