// ScreenChunkFallback의 **서명**을 두 곳(고립 렌더 테스트 · 호출부 배선 테스트)이 공유한다.
// 각자 정의하면 한쪽만 느슨해져도 안 보인다 — 실제로 호출부 단언이 `role="status"`만 보던
// 동안, fallback을 인라인 `<div role="status">⏳ 불러오는 중…</div>`로 갈아끼워도 전부 통과했다.
import { expect } from 'vitest';

/** 시각적으로 숨겨졌는가 — 1px + clip 조합(sr-only 관용구). */
export function isVisuallyHidden(el: HTMLElement): boolean {
  const s = el.style;
  return s.position === 'absolute'
    && parseInt(s.width, 10) <= 1
    && parseInt(s.height, 10) <= 1
    && /rect\(/.test(s.clip)
    && s.overflow === 'hidden';
}

/**
 * 이 요소가 ScreenChunkFallback인지 — role만 맞는 가짜를 거른다.
 * 잡아야 할 변조: `fallback={null}` · 인라인 스피너 div로 교체 · 덮개 해제.
 */
export function expectChunkFallback(el: HTMLElement | null, ctx: string): void {
  expect(el, `${ctx}: 청크를 기다리는 프레임에 fallback이 없다`).toBeTruthy();
  const root = el as HTMLElement;

  expect(root.getAttribute('aria-live'), `${ctx}: 라이브 리전 표시가 없다`).toBe('polite');
  // 덮지 않으면 이전 화면이 남은 채 새 화면이 겹쳐 그려진다.
  expect(root.style.position, `${ctx}: 화면을 덮지 않는다`).toBe('fixed');
  expect(root.style.inset, `${ctx}: 전체를 덮지 않는다`).toBe('0px');
  expect(root.style.background, `${ctx}: 배경색이 없다`).toBe('var(--bg-primary)');

  // 스피너를 두지 않기로 한 판단(번쩍임 방지)을 지킨다 — 보이는 자식이 생기면 걸린다.
  const visible = [...root.querySelectorAll<HTMLElement>('*')].filter(e => !isVisuallyHidden(e));
  expect(
    visible.map(e => e.tagName),
    `${ctx}: fallback에 보이는 자식이 생겼다 — 청크는 보통 한 프레임 안에 온다`,
  ).toEqual([]);
  // 반대로 스크린리더용 문구는 있어야 한다(전부 지우면 위 단언은 통과한다).
  expect(root.textContent, `${ctx}: 스크린리더용 문구가 없다`).toContain('불러오는 중');
}
