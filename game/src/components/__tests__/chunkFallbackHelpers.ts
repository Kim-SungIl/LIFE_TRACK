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

  // 덮개를 **안 보이게** 만들면 값 단언 셋을 전부 만족하면서 결과는 `return null`과 같다.
  // 숨기는 방법은 무한하다(실측 MISS: `opacity:0` · `zIndex:-1` · className으로 숨기기.
  // vitest에 `css: true`가 없어 클래스 스타일은 getComputedStyle로도 안 보인다).
  // 그래서 속성을 하나씩 막지 않고 **인라인 style 속성 집합 자체를 닫는다** — 목록 밖
  // 속성이 붙으면 그게 무엇이든 걸린다. 이 컴포넌트는 인라인 style만 쓰기로 되어 있으므로
  // className도 금지한다(클래스가 붙는 순간 이 검사 전체가 무의미해진다).
  expect(
    Array.from(root.style),
    `${ctx}: 덮개의 인라인 style이 예상과 다르다 — 속성이 추가됐다면 그걸로 덮개를 ` +
    '안 보이게 만들 수 있다(opacity·zIndex·filter·clipPath…). 정당한 추가라면 이 목록을 늘려라',
  ).toEqual(['position', 'inset', 'background']);
  expect(
    root.className,
    `${ctx}: 덮개에 클래스가 붙었다 — 클래스 스타일은 이 테스트가 볼 수 없어 ` +
    '(vitest css 미처리) 숨김 여부를 판정할 수 없게 된다',
  ).toBe('');

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

/**
 * 위 화이트리스트는 **루트만** 본다. 호출부에서 덮개를 감싸면 컴포넌트 본문은 그대로여서
 * 전부 통과한다(5차 검수 실측: 세 호출부 전부 MISS).
 *
 *     <Suspense fallback={<div style={{ opacity: 0 }}><ScreenChunkFallback /></div>}>
 *
 * 숨김 속성을 더 열거하는 건 같은 함정의 반복이라 다른 축을 쓴다 — **래퍼는 fallback
 * 트리의 일부라 청크가 오면 함께 사라진다.** 그래서 프레임에서 부모를 붙잡아 뒀다가
 * 도착 뒤에 아직 문서에 붙어 있는지만 본다. 무슨 스타일로 숨기든 걸린다.
 *
 * 반환된 검사는 **청크 도착을 확인한 뒤에** 불러야 한다(부르지 않으면 이 축은 통째로 빠진다).
 */
export function watchFallbackWrapper(el: HTMLElement | null, ctx: string): () => void {
  expect(el, `${ctx}: fallback이 없어 래퍼를 볼 수 없다`).toBeTruthy();
  const parent = (el as HTMLElement).parentElement;
  expect(parent, `${ctx}: fallback이 문서에 붙어 있지 않다`).toBeTruthy();
  return () => {
    expect(
      parent!.isConnected,
      `${ctx}: fallback을 감싼 노드가 청크 도착과 함께 사라졌다 — 호출부가 ` +
      '`fallback={<div ...><ScreenChunkFallback /></div>}`처럼 래퍼를 끼웠다. ' +
      '덮개의 style 화이트리스트는 루트만 보므로 래퍼에 건 숨김은 그대로 통과한다',
    ).toBe(true);
  };
}

/**
 * 시각적으로 감춰진 조상 — 자기 자신부터 위로 훑는다.
 *
 * **`aria-hidden`은 일부러 안 본다.** 오버레이 배경에 붙이는 표준 모달 a11y 개선인데,
 * 그걸 숨김으로 치면 멀쩡한 개선을 "Suspense 경계가 바깥으로 올라갔다"고 오진한다(4차 실측).
 * 같은 이유로 `byRole`의 기본 접근성 필터도 쓸 수 없다 — 그게 aria-hidden을 함께 거른다.
 *
 * 문자열 매칭(`[style*="display: none"]`) 대신 계산 스타일을 보는 건 공백·표기 형식에
 * 기대지 않기 위해서다(5차 검수 지적). 다만 vitest에 `css: true`가 없어 **클래스 기반
 * 숨김은 여전히 안 보인다** — 이 축의 남은 갭이다.
 */
export function hiddenAncestor(el: HTMLElement): HTMLElement | null {
  for (let a: HTMLElement | null = el; a; a = a.parentElement) {
    if (a.hidden) return a;
    const cs = getComputedStyle(a);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') {
      return a;
    }
  }
  return null;
}
