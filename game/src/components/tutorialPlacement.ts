// 튜토리얼 말풍선 배치 — Tutorial.tsx에서 분리(컴포넌트 파일은 컴포넌트만 export).
//
// 결함(2026-10 실측, Playwright): 주말 단계의 타깃(이번 주 일과)은 키가 ~510px이다.
// 가운데로 스크롤한 뒤 말풍선을 타깃 바로 아래에 붙이기만 해서
//   · 390×844 — 말풍선 698~936px, 「다음」 버튼 879~917px(화면 밖)
//   · 375×667 — 말풍선 610~848px, 본문까지 통째로 접힌 선 아래
// 였다. 고치는 축은 둘이다.
//   1) 스크롤: 타깃과 말풍선이 함께 안 들어가면 가운데 대신 **말풍선 쪽 가장자리**에 타깃을 붙인다
//      (주말 단계는 아래쪽 = 토·일 칸이 화면에 남고 위쪽 학교 칸이 밀려난다).
//   2) 배치: 그래도 안 들어가면(페이지 끝이라 더 못 내리는 등) 반대쪽으로 뒤집고, 그것도 안 되면
//      화면 안으로 민다 — 「다음」이 화면 밖에 있는 상태는 어떤 경우에도 만들지 않는다.

export const HIGHLIGHT_PAD = 8;
export const TOOLTIP_GAP = 16;
export const VIEWPORT_EDGE = 12;
// 첫 렌더(말풍선을 아직 못 잼)·jsdom용 추정치. 실측 182~238px보다 약간 크게 잡는다.
export const CARD_FALLBACK_HEIGHT = 260;

type Side = 'top' | 'bottom';

/** 하이라이트 바깥에서 말풍선까지 + 말풍선 + 화면 여백 — 말풍선 쪽에 필요한 세로 공간. */
function spaceNeeded(cardH: number): number {
  return HIGHLIGHT_PAD + TOOLTIP_GAP + cardH + VIEWPORT_EDGE;
}

/** 말풍선의 top(px, 뷰포트 기준). */
export function placeTooltip(
  rect: { top: number; bottom: number },
  cardH: number,
  viewportH: number,
  position: Side,
): number {
  const below = rect.bottom + HIGHLIGHT_PAD + TOOLTIP_GAP;
  const above = rect.top - HIGHLIGHT_PAD - TOOLTIP_GAP - cardH;
  const fitsBelow = below + cardH <= viewportH - VIEWPORT_EDGE;
  const fitsAbove = above >= VIEWPORT_EDGE;
  const top = position === 'bottom'
    ? (fitsBelow || !fitsAbove ? below : above)
    : (fitsAbove || !fitsBelow ? above : below);
  const maxTop = viewportH - VIEWPORT_EDGE - cardH;
  return Math.max(VIEWPORT_EDGE, Math.min(top, maxTop));
}

/** 타깃으로 스크롤하는 방법. margin은 scroll-margin(말풍선 쪽)으로 쓴다. */
export function scrollPlan(
  targetH: number,
  cardH: number,
  viewportH: number,
  position: Side,
): { block: 'center' | 'start' | 'end'; margin: number } {
  // 가운데 정렬하면 타깃 양옆 여백은 (화면 − 타깃)/2. 말풍선 쪽에 그만큼 있으면 지금처럼 가운데.
  const need = spaceNeeded(cardH);
  if ((viewportH - targetH) / 2 >= need) return { block: 'center', margin: 0 };
  return { block: position === 'bottom' ? 'end' : 'start', margin: need };
}
