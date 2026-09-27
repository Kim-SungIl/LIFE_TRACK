// @vitest-environment jsdom
// 튜토리얼이 **죽은 뒤에 DOM을 읽지 않는다**. (T56)
//
// 결함의 모양: CI build가 빨강인데 테스트는 2,509개 전부 초록이었다. 종료 코드를 1로
// 만든 건 미처리 예외 한 건이다.
//
//   ReferenceError: document is not defined
//     ❯ Timeout._onTimeout src/components/Tutorial.tsx:21:16
//     (originated in src/components/__tests__/tutorialKeyboard.test.tsx)
//
// 21행은 updateRect의 `document.querySelector`다. 언마운트가 거두는 타이머는 32행의
// 100ms 하나뿐이고, 스크롤 effect의 400ms(74행)와 MutationObserver 후속 50·150·300ms
// (44~46행)는 **정리 대상에 없었다**. 컴포넌트가 사라진 뒤 발화하면 제품에서는 죽은
// 자리의 setRect(무해)지만, 테스트에서는 jsdom 환경이 먼저 해체돼 `document` 자체가
// 없다 — 부하가 걸린 러너에서만 순서가 뒤집히는 시간 의존 플레이크였다(로컬 27초 / CI 93초).
//
// 그래서 여기서 잠그는 건 "타이머 개수"가 아니라 **DOM을 읽었는가**다. 개수는 React가
// 제 스케줄러용으로 0ms 타이머를 남겨 두기 때문에 0이 되지 않는다(언마운트 직후 6개 중
// 2개가 그것이다). 읽기는 오직 updateRect만 한다.
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { Tutorial } from '../Tutorial';
import { STEPS } from '../tutorialSteps';

// jsdom 미구현 — Tutorial이 타겟으로 스크롤하는 effect에서 던진다(타이머 계약과 무관).
beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

/** updateRect가 부른 `document.querySelector('[data-tutorial=…]')`만 센다. */
function rectReads() {
  const spy = vi.spyOn(document, 'querySelector');
  return {
    all: () => spy.mock.calls.map(c => String(c[0])).filter(s => s.startsWith('[data-tutorial=')),
    since: (n: number) => spy.mock.calls.map(c => String(c[0])).filter(s => s.startsWith('[data-tutorial=')).slice(n),
  };
}

function renderTutorial() {
  const targets = [...new Set(STEPS.map(s => s.target))];
  return render(
    <>
      {targets.map(t => <div key={t} data-tutorial={t} />)}
      <Tutorial onComplete={vi.fn()} />
    </>,
  );
}

/** 첫 스텝의 타겟 엘리먼트를 변형해 MutationObserver 후속 타이머를 띄운다. */
function mutateTarget(container: HTMLElement) {
  const el = container.querySelector(`[data-tutorial="${STEPS[0].target}"]`);
  if (!el) throw new Error('타겟 앵커가 없다 — 픽스처가 STEPS와 어긋났다');
  el.appendChild(document.createElement('span'));
  // jsdom MutationObserver는 마이크로태스크로 배달된다. 가짜 타이머는 마이크로태스크를
  // 건드리지 않으므로 큐를 한 번 비우면 콜백이 돈다.
  return new Promise<void>(resolve => queueMicrotask(resolve));
}

describe('튜토리얼 타이머 — 언마운트가 전부 거둔다', () => {
  it('tutorial_scroll_timer_cleared: 스크롤 뒤 재측정(400ms)은 언마운트를 넘지 않는다', () => {
    // 가짜 타이머는 **대상이 타이머를 만들기 전에** 켠다.
    vi.useFakeTimers();
    const reads = rectReads();

    // 양성 대조를 **먼저, 따로 건다**. 같은 렌더에서 400ms를 감아 버리면 타이머가 그
    // 자리에서 소진되고, 뒤따르는 언마운트 단언은 "원래 남을 게 없었다"는 이유로
    // 통과한다 — 정리 코드를 통째로 지워도 초록인 공허한 테스트가 된다(실제로 그랬다).
    const alive = renderTutorial();
    const beforeTick = reads.all().length;
    vi.advanceTimersByTime(400);
    expect(reads.all().length, '살아 있는 동안 400ms 재측정이 돌아야 한다').toBeGreaterThan(beforeTick);
    alive.unmount();

    // 본 단언 — 400ms가 뜨기 **전에** 언마운트한다.
    const { unmount } = renderTutorial();
    unmount();
    const afterUnmount = reads.all().length;
    vi.advanceTimersByTime(5_000);
    expect(reads.since(afterUnmount), '언마운트 뒤 재측정한 선택자').toEqual([]);
  });

  it('tutorial_observer_followups_cleared: 변화 감지 후속 3개(50·150·300ms)도 따라 죽는다', async () => {
    vi.useFakeTimers();
    const reads = rectReads();
    const { container, unmount } = renderTutorial();

    // 양성 대조 — 변형 한 번이 후속 타이머 셋을 띄운다.
    await mutateTarget(container);
    const scheduled = reads.all().length;
    vi.advanceTimersByTime(300);
    expect(reads.all().length - scheduled, '50·150·300ms 후속이 각각 한 번씩 재측정한다')
      .toBeGreaterThanOrEqual(3);

    // 이번엔 변형 직후 — 후속 셋이 아직 대기 중인 상태로 언마운트한다.
    await mutateTarget(container);
    unmount();
    const afterUnmount = reads.all().length;
    vi.advanceTimersByTime(5_000);
    expect(reads.since(afterUnmount), '언마운트 뒤 후속 타이머가 재측정한 선택자').toEqual([]);
  });

  it('tutorial_step_change_clears_previous: 스텝을 넘기면 이전 스텝의 타이머가 이전 타겟을 읽지 않는다', () => {
    vi.useFakeTimers();
    const reads = rectReads();
    renderTutorial();

    const first = `[data-tutorial="${STEPS[0].target}"]`;
    const second = `[data-tutorial="${STEPS[1].target}"]`;
    expect(first, '첫 두 스텝의 타겟이 같으면 이 테스트는 아무것도 못 가른다').not.toBe(second);

    // 400ms가 뜨기 전에 다음 스텝으로 — 이전 스텝의 타이머가 대기 중이다.
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    const afterStep = reads.all().length;
    vi.advanceTimersByTime(5_000);

    expect(reads.since(afterStep).filter(s => s === first), '스텝이 바뀐 뒤 이전 타겟을 읽은 횟수')
      .toEqual([]);
  });
});
