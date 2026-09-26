// @vitest-environment jsdom
// 오버레이(Dialog·Tutorial) 키 리스너의 **위상(capture)**과 **Escape 전파 차단** 계약. (T52)
//
// Dialog.tsx와 Tutorial.tsx는 keydown을 document **캡처** 단계에서 받고, Escape면 stopPropagation을
// 건다. 이 두 줄은 지우거나 bubble로 바꿔도 관련 스위트 8파일 82개가 전부 초록이었다(뮤테이션 4종
// 실측 — Dialog·Tutorial 각각 stopPropagation 삭제, capture true→false). 기존 픽스처가 전부
// `fireEvent.keyDown(document)`라서다: target이 document면 AT_TARGET이라 캡처/버블 구분이 없고,
// stopPropagation은 같은 노드의 다른 리스너를 못 막는다. 그리고 오버레이끼리는 `isTopLayer` 가드가
// 이미 격리하므로(tutorialKeyboard.test `tutorial_guard_alone`) 위상·전파는 그 사이에서도 안 보인다.
//
// 위상과 전파가 보이는 자리는 **오버레이 아래 화면**이다. 지금 제품에는 keydown을 듣는 화면이 없다
// (전수: Dialog·Tutorial·useAudioUnlock뿐 — 마지막 것은 앱 마운트 시 document 캡처로 먼저 등록되는
// 오디오 해제 제스처라 무관 — 그리고 JSX onKeyDown은 0건). 그래서 이 계약은 지금 깨진 걸 고친 게
// 아니라 **모달의 의미**를 잠근다: 사용자가 누른 Escape 한 번에 최상위 오버레이 하나만 반응하고,
// 그 아래 화면(GameScreen 단축키·EventScene 진행 키처럼 언젠가 생길 핸들러)은 그 키를 **보지도
// 못해야** 한다. 아래 화면의 모양은 둘이다 — 문서 레벨 단축키 리스너(bubble)와, 자기 서브트리의
// 키를 소비하는 조상 onKeyDown. 픽스처는 둘을 동시에 둔다(Dialog·Tutorial은 포털이 아니라 인라인
// 렌더라 GameScreen의 루트 div가 실제로 그 조상이다).
//
// 어느 줄이 어느 단언에 걸리는가:
//   · stopPropagation 삭제 → Escape가 아래 화면의 두 탐침에 내려간다 (*_no_leak의 탐침 단언).
//   · capture → bubble    → 조상 onKeyDown이 document 버블보다 **먼저** 돌아 역시 탐침에 잡히고,
//                            그 조상이 전파를 끊는 화면이면 오버레이는 Escape를 영영 못 본다
//                            (*_beats_consuming_screen의 "안 닫혔다" 단언 — 캡처에만 걸린다).
// 음성 단언만 두지 않는다 — 오버레이가 내려간 뒤, 또는 Escape가 아닌 키에는 같은 탐침이 반응하는
// 양성 짝이 각 블록에 있다. 탐침이 죽어 있으면 "안 불렸다"는 아무것도 증명하지 않기 때문이다.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useEffect, useState, type ReactNode } from 'react';
import { Dialog } from '../Dialog';
import { Tutorial } from '../Tutorial';
import { STEPS } from '../tutorialSteps';

// jsdom 미구현 — Tutorial이 타겟으로 스크롤하는 effect에서 던진다(키 계약과 무관).
beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });

type Probe = { doc: string[]; ancestor: string[]; inner: string[] };
const newProbe = (): Probe => ({ doc: [], ancestor: [], inner: [] });

/**
 * 오버레이 아래 화면의 모양 — 문서 레벨 단축키 리스너(bubble) + 서브트리 onKeyDown 조상.
 * `consume`이면 조상이 자기 서브트리의 키를 소비한다(전파 차단) — "아무 키나 누르면 진행"하는
 * 씬이 그 모양이다.
 */
function ScreenBelow({ probe, consume = false, children }: { probe: Probe; consume?: boolean; children: ReactNode }) {
  useEffect(() => {
    const hotkey = (e: KeyboardEvent) => { probe.doc.push(e.key); };
    document.addEventListener('keydown', hotkey);
    return () => document.removeEventListener('keydown', hotkey);
  }, [probe]);
  return (
    <div onKeyDown={e => { probe.ancestor.push(e.key); if (consume) e.stopPropagation(); }}>
      {children}
    </div>
  );
}

describe('Dialog — Escape는 아래 화면으로 새지 않는다', () => {
  function Fixture({ probe, consume }: { probe: Probe; consume?: boolean }) {
    const [open, setOpen] = useState(true);
    return (
      <ScreenBelow probe={probe} consume={consume}>
        <button>화면의 버튼</button>
        {open && (
          <Dialog onClose={() => setOpen(false)} ariaLabel="상점">
            <button onKeyDown={e => probe.inner.push(e.key)}>편의점</button>
          </Dialog>
        )}
      </ScreenBelow>
    );
  }

  it('dialog_escape_no_leak: Escape 한 번에 Dialog만 닫히고 아래 화면은 그 키를 보지 못한다', () => {
    const probe = newProbe();
    render(<Fixture probe={probe} />);
    const inner = screen.getByRole('button', { name: '편의점' });
    expect(inner, '전제: 열리면 포커스가 다이얼로그 안에 있다 — 사용자가 Escape를 누르는 자리').toHaveFocus();

    fireEvent.keyDown(inner, { key: 'Escape' });
    expect(screen.queryByRole('dialog'), 'Escape로 안 닫혔다').toBeNull();
    expect(probe.ancestor,
      '조상 onKeyDown이 Escape를 받았다 — stopPropagation이 빠졌거나 리스너가 bubble이라 조상이 먼저 돌았다').toEqual([]);
    expect(probe.doc,
      '문서 단축키 리스너가 Escape를 받았다 — 같은 키 한 번이 화면에서 두 번째 일을 한다').toEqual([]);

    // 양성 짝 — 탐침이 살아 있다: Dialog가 내려간 뒤에는 같은 Escape가 화면에 닿는다.
    fireEvent.keyDown(screen.getByRole('button', { name: '화면의 버튼' }), { key: 'Escape' });
    expect(probe.ancestor, '탐침(조상)이 죽어 있다 — 위의 "안 불렸다"가 무의미하다').toEqual(['Escape']);
    expect(probe.doc, '탐침(문서)이 죽어 있다 — 위의 "안 불렸다"가 무의미하다').toEqual(['Escape']);
  });

  it('dialog_escape_beats_consuming_screen: 아래 화면이 서브트리의 키를 소비해도 Escape는 Dialog에 먼저 닿는다', () => {
    const probe = newProbe();
    render(<Fixture probe={probe} consume />);
    fireEvent.keyDown(screen.getByRole('button', { name: '편의점' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog'),
      '캡처가 아니면 조상이 전파를 끊은 뒤라 Dialog는 Escape를 못 본다 — 키보드로 닫을 길이 없다').toBeNull();
    expect(probe.ancestor, '캡처면 조상은 Escape를 아예 못 본다').toEqual([]);
  });

  it('dialog_passes_other_keys: Escape가 아닌 키는 다이얼로그 안 요소에 그대로 닿는다 (양성 짝)', () => {
    const probe = newProbe();
    render(<Fixture probe={probe} />);
    fireEvent.keyDown(screen.getByRole('button', { name: '편의점' }), { key: 'Enter' });
    expect(probe.inner, '차단이 Escape 밖으로 번지면 다이얼로그 안 위젯이 키를 잃는다').toEqual(['Enter']);
    expect(screen.getByRole('dialog'), 'Enter로 닫히면 안 된다').toBeInTheDocument();
  });
});

describe('Tutorial — 인터랙티브 스텝에서 Escape는 아래 화면으로 새지 않는다', () => {
  // 인터랙티브 스텝이 가장 현실적인 자리다: 오버레이가 pointerEvents:'none'이고 Tab도 안 가두므로
  // (tutorialKeyboard.test `tutorial_interactive_step_releases_tab`) 포커스가 **하이라이트 대상 —
  // 아래 화면의 버튼**에 있는 채로 Escape를 누른다. 그 키가 화면에도 닿으면 "건너뛰기"가 화면의
  // 두 번째 동작까지 일으킨다.
  const INTERACTIVE = STEPS.findIndex(s => s.interactive);
  const TARGET_NAME = `${STEPS[INTERACTIVE]?.target} 대상`;

  function renderTutorialOver(probe: Probe, consume?: boolean) {
    const onComplete = vi.fn();
    render(
      <ScreenBelow probe={probe} consume={consume}>
        {[...new Set(STEPS.map(s => s.target))].map(t => (
          <div key={t} data-tutorial={t}><button>{t} 대상</button></div>
        ))}
        <Tutorial onComplete={onComplete} />
      </ScreenBelow>,
    );
    for (let i = 0; i < INTERACTIVE; i++) fireEvent.click(screen.getByRole('button', { name: '다음' }));
    const target = screen.getByRole('button', { name: TARGET_NAME });
    target.focus();
    return { onComplete, target };
  }

  it('tutorial_escape_no_leak: 하이라이트 대상에 포커스를 둔 채 Escape → 튜토리얼만 끝나고 화면은 그 키를 못 본다', () => {
    expect(INTERACTIVE, 'interactive 스텝 전제 붕괴').toBeGreaterThan(0);
    const probe = newProbe();
    const { onComplete, target } = renderTutorialOver(probe);
    expect(target, '전제: 인터랙티브 스텝은 포커스를 뺏지 않는다 — 아래 화면의 대상에 있다').toHaveFocus();

    fireEvent.keyDown(target, { key: 'Escape' });
    expect(onComplete, 'Escape가 튜토리얼의 출구다').toHaveBeenCalledTimes(1);
    expect(probe.ancestor,
      '조상 onKeyDown이 Escape를 받았다 — stopPropagation이 빠졌거나 리스너가 bubble이라 조상이 먼저 돌았다').toEqual([]);
    expect(probe.doc,
      '문서 단축키 리스너가 Escape를 받았다 — 건너뛰기 한 번이 화면에서 두 번째 일을 한다').toEqual([]);
  });

  it('tutorial_escape_beats_consuming_screen: 화면이 서브트리의 키를 소비해도 Escape는 튜토리얼에 먼저 닿는다', () => {
    const probe = newProbe();
    const { onComplete, target } = renderTutorialOver(probe, true);
    fireEvent.keyDown(target, { key: 'Escape' });
    expect(onComplete,
      '캡처가 아니면 화면이 전파를 끊은 뒤라 튜토리얼은 Escape를 못 본다 — 키보드 출구가 닫힌다').toHaveBeenCalledTimes(1);
    expect(probe.ancestor, '캡처면 조상은 Escape를 아예 못 본다').toEqual([]);
  });

  it('tutorial_passes_target_keys: 인터랙티브 스텝의 과제는 대상을 직접 누르는 것 — Enter는 화면에 그대로 닿는다 (양성 짝)', () => {
    const probe = newProbe();
    const { onComplete, target } = renderTutorialOver(probe);
    fireEvent.keyDown(target, { key: 'Enter' });
    expect(probe.ancestor, '차단이 Escape 밖으로 번지면 키보드 사용자는 이 스텝을 못 넘긴다').toEqual(['Enter']);
    expect(probe.doc, '탐침(문서)이 죽어 있다 — 위 블록의 "안 불렸다"가 무의미하다').toEqual(['Enter']);
    expect(onComplete, 'Enter는 출구가 아니다').not.toHaveBeenCalled();
  });
});
