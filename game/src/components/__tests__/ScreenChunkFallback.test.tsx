// @vitest-environment jsdom
// lazy 화면 청크를 기다리는 동안의 자리. 두 화면(TitleScreen·GameScreen)이 공유하는데
// **아무 테스트도 이 컴포넌트를 렌더하지 않았다** — 본문을 통째로 `return null`로 바꿔도
// 871개가 전부 통과했다(검수에서 뮤테이션으로 확인). 그러면 청크를 기다리는 동안 화면이
// 통째로 비어 배경색조차 사라지는데 CI는 그린이다.
//
// 여기서 잠그는 것은 "빈 화면이되 **의도한 방식으로** 비어 있다"다:
// 배경을 덮고(가림), 스피너는 없고(번쩍임 방지), 스크린리더용 문구만 시각적으로 숨긴다.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScreenChunkFallback } from '../ScreenChunkFallback';
// 서명 판정은 호출부 배선 테스트(lazyScreenWiring)와 **공유한다** — 각자 정의하면
// 한쪽만 느슨해져도 안 보인다.
import { isVisuallyHidden } from './chunkFallbackHelpers';

describe('ScreenChunkFallback', () => {
  it('빈 화면이 아니라 화면을 덮는 요소를 그린다', () => {
    const { container } = render(<ScreenChunkFallback />);
    // `return null` 뮤테이션이 여기서 걸린다.
    expect(container.firstElementChild, '아무것도 그리지 않았다').toBeTruthy();

    const root = container.firstElementChild as HTMLElement;
    // 덮지 않으면 이전 화면이 남은 채 새 화면이 겹쳐 그려진다.
    expect(root.style.position, '화면을 덮지 않는다').toBe('fixed');
    expect(root.style.inset, '전체를 덮지 않는다').toBe('0px');
    // 배경이 없으면 뒤 화면이 비쳐 "덮었다"가 무의미해진다.
    expect(root.style.background, '배경색이 없다').toBe('var(--bg-primary)');
  });

  it('스크린리더용 문구를 담되 눈에는 보이지 않는다', () => {
    render(<ScreenChunkFallback />);
    const label = screen.getByText('불러오는 중…');
    expect(label, '스크린리더용 문구가 없다').toBeTruthy();
    // 이 단언이 없으면 sr-only 스타일을 지워 "불러오는 중…"이 화면에 뜨게 만들어도 통과한다.
    // 그건 스피너를 안 넣기로 한 판단(번쩍임 방지)을 정면으로 뒤집는 변경이다.
    expect(
      isVisuallyHidden(label as HTMLElement),
      '문구가 화면에 그대로 보인다 — 스피너를 안 두기로 한 판단과 어긋난다',
    ).toBe(true);
  });

  it('라이브 리전으로 표시된다', () => {
    render(<ScreenChunkFallback />);
    // 주석에 적어둔 대로 **실제로 읽히는지는 미검증**이다(jsdom으로는 확인 불가).
    // 여기서 잠그는 것은 "표시가 붙어 있다"까지다 — 그 이상을 주장하지 않는다.
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
  });

  it('스피너를 두지 않는다 — 보이는 것은 아무것도 없다', () => {
    const { container } = render(<ScreenChunkFallback />);
    // 시각적으로 숨겨진 것 말고 눈에 보이는 자식이 생기면(스피너·텍스트·이미지) 여기서 걸린다.
    const visible = [...container.querySelectorAll<HTMLElement>('*')]
      .filter(el => !isVisuallyHidden(el));
    expect(
      visible.map(el => el.tagName),
      '보이는 자식이 생겼다 — 청크는 보통 한 프레임 안에 와서 번쩍임만 남는다',
    ).toEqual(['DIV']);   // 덮개 자신뿐
    expect(container.querySelector('img'), '이미지를 싣지 않는다').toBeNull();
  });
});
