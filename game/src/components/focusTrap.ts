// 오버레이 공통 포커스 트랩 유틸 — Dialog(모달 셸)와 Tutorial(코치마크)이 공유한다.
//
// **왜 스택이 모듈 하나인가.** 레이어마다 자기 스택을 두면 Escape가 양쪽에서 동시에 먹힌다.
// 실제로 튜토리얼(루틴 스텝)이 떠 있는 동안 슬롯 편집 Dialog가 그 위에 열리는데,
// 스택이 갈리면 Escape 한 번에 팝업이 닫히면서 튜토리얼까지 건너뛰어진다.
// 스택을 공유하면 "최상위 레이어만 키보드에 반응"이 두 컴포넌트 사이에서도 성립한다.
//
// 포커스 트랩 자체는 Dialog가 이미 갖고 있던 구현을 그대로 옮긴 것이다(동작 변경 없음).
// Dialog.test.tsx가 이 동작을 잠그고 있으므로 여기 로직을 고치면 그쪽이 빨개진다.

/** 포커스 가능한 요소 셀렉터 */
export const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** 레이어 안 첫 포커스 가능 요소로 이동(없으면 레이어 자신 — tabIndex=-1 전제) */
export function focusFirst(el: HTMLElement): void {
  const first = el.querySelector<HTMLElement>(FOCUSABLE);
  (first ?? el).focus();
}

// 열린 레이어 스택(최상위 = 마지막).
const layerStack: HTMLElement[] = [];

export function pushLayer(el: HTMLElement): void {
  layerStack.push(el);
}

export function popLayer(el: HTMLElement): void {
  const i = layerStack.indexOf(el);
  if (i >= 0) layerStack.splice(i, 1);
}

export function topLayer(): HTMLElement | undefined {
  return layerStack[layerStack.length - 1];
}

export function isTopLayer(el: HTMLElement): boolean {
  return topLayer() === el;
}

/**
 * Tab 키를 el 안에 가둔다. 포커스가 밖(자식 unmount 등으로 body)으로 샜으면 다시 안으로.
 * 호출 전에 e.key === 'Tab' 과 최상위 레이어 여부를 확인할 것.
 */
export function trapTab(el: HTMLElement, e: KeyboardEvent): void {
  const nodes = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    n => n.offsetParent !== null,
  );
  const active = document.activeElement;
  // 포커스가 콘텐츠 밖(자식 unmount 등으로 body)으로 샜으면 다시 안으로
  if (!el.contains(active)) {
    e.preventDefault();
    (nodes[0] ?? el).focus();
    return;
  }
  if (nodes.length === 0) {
    e.preventDefault();
    el.focus();
    return;
  }
  const firstEl = nodes[0];
  const lastEl = nodes[nodes.length - 1];
  if (e.shiftKey && (active === firstEl || active === el)) {
    e.preventDefault();
    lastEl.focus();
  } else if (!e.shiftKey && active === lastEl) {
    e.preventDefault();
    firstEl.focus();
  }
}
