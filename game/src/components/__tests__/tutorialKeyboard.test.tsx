// @vitest-environment jsdom
// 튜토리얼 오버레이의 **키보드 출구**. (T31)
//
// 결함의 모양: `건너뛰기`가 <span onClick>(role·tabIndex 없음, 38.7×14px)이라 Playwright에서
// Tab을 20번 눌러도 0회 도달했다. Escape도 안 먹었고, 포커스 트랩이 없어 Tab 궤적이
// 오버레이 뒤(가정·메뉴·기록장·활동 슬롯)를 자유롭게 돌았다 — **마우스로는 오버레이가 막는
// 것들이 키보드로는 그대로 뚫렸다.** 즉 "출구가 없다"와 "막아야 할 게 안 막힌다"가 동시에 있었다.
//
// 여기서 잠그는 계약:
//   1. 건너뛰기는 버튼이다(role 있음 → Tab 도달 + Enter/Space 활성화).
//   2. Escape가 튜토리얼의 출구다.
//   3. 비인터랙티브 스텝은 Tab을 말풍선 안에 가둔다(마우스가 막히는 것과 같게).
//   4. 인터랙티브 스텝은 가두지 않는다 — 하이라이트 대상을 직접 눌러야 넘어가는 스텝이라,
//      여기서 Tab까지 가두면 키보드 사용자는 **튜토리얼을 진행할 수 없게 된다**(막다른 길).
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Tutorial } from '../Tutorial';
import { Dialog } from '../Dialog';
import { STEPS } from '../tutorialSteps';

// jsdom 미구현 — Tutorial이 타겟으로 스크롤하는 effect에서 던진다(키보드 계약과 무관).
beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });

// 앵커가 없으면 Tutorial은 중앙 폴백 카드로 강등되고 건너뛰기 자체가 렌더되지 않는다.
// (jsdom의 getBoundingClientRect는 0을 돌려주지만 null은 아니라 말풍선 경로를 탄다.)
function renderTutorial(opts?: { routineSet?: boolean }) {
  const onComplete = vi.fn();
  const utils = render(
    <>
      <button>오버레이 바깥 버튼</button>
      {[...new Set(STEPS.map(s => s.target))].map(t => <div key={t} data-tutorial={t} />)}
      <Tutorial onComplete={onComplete} routineSet={opts?.routineSet} />
    </>,
  );
  return { ...utils, onComplete };
}

/** document 캡처 리스너로 Tab을 발화하고 기본동작이 막혔는지(=트랩이 잡았는지) 돌려준다. */
function pressTab(shiftKey = false): boolean {
  const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
  document.dispatchEvent(e);
  return e.defaultPrevented;
}

/** 첫 스텝(비인터랙티브)에서 i번째 '다음'을 눌러 스텝을 넘긴다. */
function goToStep(n: number): void {
  for (let i = 0; i < n; i++) fireEvent.click(screen.getByRole('button', { name: '다음' }));
}

describe('튜토리얼 건너뛰기 — 키보드가 닿는 출구', () => {
  it('tutorial_skip_is_button: 건너뛰기는 span이 아니라 button이다', () => {
    renderTutorial();
    // role 조회가 곧 계약 — span으로 되돌리면 이 줄에서 죽는다.
    const skip = screen.getByRole('button', { name: '건너뛰기' });
    expect(skip.tagName, 'span onClick은 Tab 순서에 없다').toBe('BUTTON');
    expect(skip.getAttribute('tabindex'), 'tabindex=-1이면 Tab 도달이 다시 0회가 된다').toBeNull();
    expect(skip).toBeEnabled();
  });

  it('tutorial_skip_hit_area: 히트 영역을 패딩으로 최소 24×24까지 키운다(글자는 14px였다)', () => {
    renderTutorial();
    const skip = screen.getByRole('button', { name: '건너뛰기' });
    // jsdom은 레이아웃을 계산하지 않으므로 **선언**을 본다(narrowViewport.test와 같은 방식).
    expect(skip.style.padding, '패딩 0(btn-reset)으로 돌아가면 히트 영역이 다시 글자 크기다').not.toBe('');
    expect(parseInt(skip.style.minWidth, 10)).toBeGreaterThanOrEqual(24);
    expect(parseInt(skip.style.minHeight, 10)).toBeGreaterThanOrEqual(24);
    // 시각 톤은 유지 — 배경 없는 muted 작은 글씨(btn-reset이 background:none을 준다)
    expect(skip.className).toContain('btn-reset');
    expect(skip.style.color).toBe('var(--text-muted)');
  });

  it('tutorial_skip_keyboard_activates: 포커스 후 Enter로 onComplete가 불린다', async () => {
    const user = userEvent.setup();
    const { onComplete } = renderTutorial();
    screen.getByRole('button', { name: '건너뛰기' }).focus();
    await user.keyboard('{Enter}');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe('튜토리얼 Escape', () => {
  it('tutorial_escape_completes: Escape가 건너뛰기와 같은 출구다', () => {
    const { onComplete } = renderTutorial();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('tutorial_escape_on_last_step: 건너뛰기가 없는 마지막 스텝에서도 Escape로 나간다', () => {
    // routineSet=true — 루틴 스텝(waitFor)이 완료 상태로 열려 '다음'이 보인다(그 전엔 숨김).
    const { onComplete } = renderTutorial({ routineSet: true });
    goToStep(STEPS.length - 1);
    expect(screen.queryByRole('button', { name: '건너뛰기' }), '마지막 스텝엔 건너뛰기가 없다').toBeNull();
    expect(screen.getByRole('button', { name: '시작!' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe('튜토리얼 포커스 트랩', () => {
  it('tutorial_focus_enters_overlay: 열리면 포커스가 오버레이 안으로 들어온다', () => {
    renderTutorial();
    // 첫 렌더는 rect=null이라 폴백 카드였다가 말풍선으로 갈아끼는데, 그때 포커스를 쥔 버튼이
    // 사라져 body로 떨어졌다. 갈아끼운 뒤에도 포커스가 안에 있어야 Escape/Tab 궤적이 성립한다.
    expect(document.body, '포커스가 body면 Tab이 문서 처음부터 다시 돈다').not.toHaveFocus();
    expect(screen.getByRole('button', { name: '다음' })).toHaveFocus();
  });

  it('tutorial_tab_stays_inside: 마지막 요소에서 Tab을 눌러도 바깥 버튼으로 안 나간다', () => {
    renderTutorial();
    const outside = screen.getByRole('button', { name: '오버레이 바깥 버튼' });
    const skip = screen.getByRole('button', { name: '건너뛰기' });
    const next = screen.getByRole('button', { name: '다음' });

    skip.focus();
    expect(pressTab(), '트랩이 없으면 기본동작이 그대로 나가 뒤 페이지로 샌다').toBe(true);
    expect(next, '첫 요소로 순환해야 한다').toHaveFocus();
    expect(outside).not.toHaveFocus();

    // 역방향도 같다
    next.focus();
    expect(pressTab(true)).toBe(true);
    expect(skip).toHaveFocus();
  });

  it('tutorial_tab_pulled_back: 포커스가 바깥으로 새 있으면 Tab에서 다시 안으로 끌어온다', () => {
    renderTutorial();
    const outside = screen.getByRole('button', { name: '오버레이 바깥 버튼' });
    outside.focus();
    expect(pressTab()).toBe(true);
    expect(screen.getByRole('button', { name: '다음' })).toHaveFocus();
  });

  it('tutorial_interactive_step_releases_tab: 하이라이트를 직접 눌러야 하는 스텝은 Tab을 안 가둔다', () => {
    renderTutorial();
    const interactiveIndex = STEPS.findIndex(s => s.interactive);
    expect(interactiveIndex, 'interactive 스텝 전제 붕괴').toBeGreaterThan(0);
    goToStep(interactiveIndex);
    // 이 스텝에서 오버레이는 pointerEvents:'none'이라 마우스가 뒤 화면에 그대로 닿는다.
    // 그런데 Tab만 가두면 키보드 사용자는 대상 요소를 누를 방법이 없어 튜토리얼이 막힌다.
    screen.getByRole('button', { name: '건너뛰기' }).focus();
    expect(pressTab(), '인터랙티브 스텝에서 Tab을 가두면 진행 불가 상태가 된다').toBe(false);
  });
});

describe('튜토리얼 위에 Dialog가 열렸을 때 — 스택을 공유하는 이유', () => {
  // focusTrap 스택을 두 컴포넌트가 공유하는 유일한 이유다: 루틴 스텝에서 슬롯 편집 Dialog가
  // 튜토리얼 위에 열리는데, 레이어마다 스택이 갈리면 Escape 한 번에 팝업이 닫히면서 튜토리얼까지
  // 건너뛰어진다. 그런데 Tutorial의 `isTopLayer` 가드를 지워도 전 스위트 1,671개가 초록이었다
  // (3자 검수 F7, 직접 재현) — 두 층을 같이 띄운 픽스처가 없었다.
  function StackFixture({ onComplete }: { onComplete: () => void }) {
    const [open, setOpen] = useState(true);
    return (
      <>
        {[...new Set(STEPS.map(s => s.target))].map(t => <div key={t} data-tutorial={t} />)}
        <Tutorial onComplete={onComplete} />
        {open && (
          <Dialog onClose={() => setOpen(false)} ariaLabel="슬롯 편집">
            <button>팝업 안 버튼</button>
          </Dialog>
        )}
      </>
    );
  }

  it('tutorial_escape_closes_dialog_only: Escape는 위의 Dialog만 닫고 튜토리얼은 남는다', () => {
    const onComplete = vi.fn();
    render(<StackFixture onComplete={onComplete} />);
    expect(screen.getByRole('dialog'), '전제: Dialog가 튜토리얼 위에 떠 있다').toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog'), '최상위 Dialog가 먼저 닫혀야 한다').toBeNull();
    expect(onComplete, 'Escape 한 번에 튜토리얼까지 건너뛰었다 — 가드가 빠졌다').not.toHaveBeenCalled();

    // Dialog가 내려간 뒤에는 튜토리얼이 최상위다 — 이제 Escape가 튜토리얼의 출구다.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
