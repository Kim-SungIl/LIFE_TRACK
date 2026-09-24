// @vitest-environment jsdom
// 첫 선택 안내 오버레이(first-week)의 **모달 계약**. (T31)
//
// 결함의 모양: 공용 Dialog를 안 쓰고 손으로 role="dialog" aria-modal="true"를 붙인 오버레이라
// 껍데기만 모달이었다. Playwright 실측 — 열려도 activeElement=BODY, 바깥 [inert] 0개,
// Escape 무반응, **Tab으로 안내가 가린 선택지 3개에 먼저 닿고 활성화까지 됐다.**
// 마우스로는 못 누르는 선택지를 키보드로는 누를 수 있었다는 뜻이다.
//
// 여기서 잠그는 것:
//   - 배선: 안내가 공용 Dialog 컴포넌트로 그려진다(스택·트랩·복귀 계약은 Dialog.test가 잠근다).
//     div로 되돌리면 spy가 안 불린다 — 계약 테스트가 "다시 손으로 짠 모달"을 놓치지 않게.
//   - 그 배선이 실제로 만드는 상태: 포커스가 CTA에, 씬은 inert, Escape로 닫힘, 닫히면 선택지 복귀.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// 실제 Dialog를 그대로 쓰되 호출만 엿본다 — 동작 테스트와 배선 테스트를 한 파일에서 같이 본다.
const { dialogSpy } = vi.hoisted(() => ({ dialogSpy: vi.fn() }));
vi.mock('../Dialog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../Dialog')>();
  return {
    Dialog: (props: React.ComponentProps<typeof actual.Dialog>) => {
      dialogSpy(props);
      return <actual.Dialog {...props} />;
    },
  };
});

import { EventScene } from '../EventScene';
import { makeState, makeEvent, makeChoice } from '../../test/fixtures';

const CHOICES = ['같이 간다', '먼저 간다', '못 본 척한다'];

function renderFirstWeek() {
  const onChoice = vi.fn();
  const utils = render(
    <EventScene
      // 안내 발동 조건은 id === 'first-week' — 다른 id면 이 오버레이 자체가 없다.
      event={makeEvent({
        id: 'first-week',
        title: '첫 주',
        description: '지훈이 손을 흔든다.',
        choices: CHOICES.map(text => makeChoice({ text })),
      })}
      gender="male"
      year={1}
      state={makeState()}
      onChoice={onChoice}
    />,
  );
  return { ...utils, onChoice };
}

function cta(): HTMLElement {
  return screen.getByRole('button', { name: '골라볼게요!' });
}
function choiceButtons(): HTMLElement[] {
  return CHOICES.map(t => screen.getByText(t).closest('button') as HTMLElement);
}
function pressTab(): boolean {
  const e = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(e);
  return e.defaultPrevented;
}

beforeEach(() => {
  dialogSpy.mockClear();
  // ever_seen이 있으면 안내가 아예 안 뜬다(반복 플레이어 스킵) — 첫 판 상태를 만든다.
  localStorage.clear();
});

describe('첫 선택 안내 — 공용 Dialog 배선', () => {
  it('choiceHint_uses_shared_dialog: 손으로 짠 오버레이가 아니라 Dialog로 그려진다', () => {
    renderFirstWeek();
    expect(dialogSpy, 'div role="dialog"로 되돌리면 여기서 죽는다').toHaveBeenCalled();
    expect(dialogSpy.mock.calls[0][0]).toMatchObject({ ariaLabel: '선택 안내' });
  });

  it('choiceHint_absent_for_returning_player: ever_seen이면 Dialog를 안 연다', () => {
    localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
    renderFirstWeek();
    expect(dialogSpy).not.toHaveBeenCalled();
    expect(screen.queryByText('이제 선택할 차례예요')).toBeNull();
  });
});

describe('첫 선택 안내 — 열려 있는 동안', () => {
  it('choiceHint_focus_on_cta: 포커스가 안내 버튼으로 들어온다 (전엔 BODY였다)', () => {
    renderFirstWeek();
    expect(document.body, 'activeElement=BODY면 Tab이 문서 처음부터 돈다').not.toHaveFocus();
    expect(cta()).toHaveFocus();
  });

  it('choiceHint_scene_inert: 선택지를 품은 블록이 inert가 된다 (전엔 0개였다)', () => {
    renderFirstWeek();
    const inertEls = Array.from(document.querySelectorAll('[inert]'));
    expect(inertEls.length, '바깥이 inert가 아니면 보조기술은 가려진 선택지를 계속 읽는다').toBeGreaterThan(0);
    // 개수만 세면 엉뚱한 요소에 붙어도 통과한다 — 실제로 선택지를 덮는지 확인한다.
    const [first] = choiceButtons();
    expect(inertEls.some(el => el.contains(first)), 'inert가 선택지를 안 덮으면 의미가 없다').toBe(true);
  });

  it('choiceHint_tab_cannot_reach_choices: Tab이 가려진 선택지로 못 넘어간다', () => {
    renderFirstWeek();
    expect(pressTab(), '트랩이 없으면 기본동작이 살아 뒤 선택지로 넘어간다').toBe(true);
    expect(cta(), 'Tab 한 번에 선택지로 가면 안내를 안 읽고도 고를 수 있다').toHaveFocus();
    for (const b of choiceButtons()) expect(b).not.toHaveFocus();
  });

  it('choiceHint_escape_closes: Escape로 닫힌다 (전엔 무반응)', () => {
    renderFirstWeek();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('이제 선택할 차례예요')).toBeNull();
    expect(document.querySelectorAll('[inert]').length, 'inert가 남으면 선택지가 영영 잠긴다').toBe(0);
  });
});

describe('첫 선택 안내 — 닫은 뒤', () => {
  it('choiceHint_returns_focus_to_choices: 포커스가 첫 선택지로 돌아온다', () => {
    renderFirstWeek();
    fireEvent.click(cta());
    expect(screen.queryByText('이제 선택할 차례예요')).toBeNull();
    expect(choiceButtons()[0], 'body로 돌아가면 키보드 사용자는 문서 처음부터 Tab을 다시 눌러야 한다')
      .toHaveFocus();
  });

  it('choiceHint_choices_operable_after_close: 선택지가 다시 조작 가능해진다', () => {
    const { onChoice } = renderFirstWeek();
    fireEvent.click(cta());
    expect(document.querySelectorAll('[inert]').length).toBe(0);
    const [, second] = choiceButtons();
    fireEvent.click(second);
    expect(onChoice).toHaveBeenCalledWith(1);
  });
});
