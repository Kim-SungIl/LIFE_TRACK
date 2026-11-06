// @vitest-environment jsdom
// 인터랙티브 스텝의 rAF 추적이 **좌표가 그대로면 리렌더하지 않는다.**
//
// 결함의 모양: updateRect가 매 프레임 새 DOMRect를 setRect에 넣어, 타깃이 멈춰 있어도 튜토리얼이
// 초당 60번 다시 그려졌다. 처방은 좌표 비교 — 단, 말풍선 배치는 window.innerHeight도 직접 읽으므로
// 뷰포트 높이만 바뀐 프레임(모바일 주소창·회전)은 건너뛰면 안 된다. 그 두 양성 대조를 같이 잠근다.
import { Profiler } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { Tutorial } from '../Tutorial';
import type { TutorialStep } from '../tutorialSteps';

beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const STEP: TutorialStep = { target: 'probe', title: '시험', desc: '시험 스텝', position: 'bottom', interactive: true };

function setup() {
  // 가짜 타이머는 대상이 타이머·rAF를 만들기 전에 켠다.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'] });
  const box = { top: 100, left: 20, width: 200, height: 40 };
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => {
    const { top, left, width, height } = box;
    return { top, left, width, height, bottom: top + height, right: left + width, x: left, y: top, toJSON: () => ({}) } as DOMRect;
  });
  let commits = 0;
  render(
    <>
      <div data-tutorial="probe" />
      <Profiler id="tutorial" onRender={() => { commits++; }}>
        <Tutorial onComplete={vi.fn()} steps={[STEP]} />
      </Profiler>
    </>,
  );
  const frames = (n: number) => act(() => { vi.advanceTimersByTime(16 * n); });
  frames(120); // 100ms·400ms 재측정과 카드 높이 측정까지 가라앉힌다
  return { box, frames, commits: () => commits };
}

describe('튜토리얼 rAF 추적', () => {
  it('tutorial_rect_stable: 타깃이 멈춰 있으면 프레임이 돌아도 다시 그리지 않는다', () => {
    const { frames, commits } = setup();
    const settled = commits();
    frames(60);
    expect(commits(), '정지한 타깃에 60프레임 동안 리렌더').toBe(settled);
  });

  // 축마다 따로 — 한 축만 움직이면 다른 축의 비교를 지워도 초록이다(3자 검수: top만 바꾸던 초안은
  // 폭·높이·left 비교를 지워도 통과했다). 제자리에서 펼쳐지는 타깃(높이·폭만 변함)이 rAF 추적의 이유다.
  it.each([
    ['top', 140], ['left', 60], ['width', 260], ['height', 300],
  ] as const)('tutorial_rect_moved(%s): 그 축만 바뀌어도 다시 그린다', (axis, value) => {
    const { box, frames, commits } = setup();
    const settled = commits();
    box[axis] = value;
    frames(2);
    expect(commits(), `${axis}만 바뀐 타깃을 놓쳤다`).toBeGreaterThan(settled);
  });

  it('tutorial_viewport_changed: 뷰포트 높이만 바뀌어도 다시 그린다(말풍선 배치가 innerHeight를 읽는다)', () => {
    const { frames, commits } = setup();
    const settled = commits();
    const h = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: h - 120 });
    try {
      frames(2);
      expect(commits(), '뷰포트 변화를 건너뛰었다').toBeGreaterThan(settled);
    } finally {
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
    }
  });
});
