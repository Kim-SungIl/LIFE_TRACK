// @vitest-environment jsdom
// Dialog — 전 모달 공통 셸의 접근성 계약:
// Escape/backdrop 닫기, 포커스 트랩(Tab 순환), 열기 전 포커스 복귀, 중첩 시 최상위만 반응.
// keydown은 document 캡처 단계 리스너라 fireEvent.keyDown(document, ...)로 발화한다.
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dialog } from '../Dialog';

describe('Dialog 열기/닫기', () => {
  it('role=dialog + aria-modal로 렌더된다', () => {
    render(
      <Dialog onClose={() => {}} ariaLabel="테스트 다이얼로그">
        <button>내용 버튼</button>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: '테스트 다이얼로그' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('Escape를 누르면 onClose가 호출된다', () => {
    const onClose = vi.fn();
    render(
      <Dialog onClose={onClose}>
        <button>확인</button>
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('backdrop 클릭은 닫고, 콘텐츠 클릭은 닫지 않는다', () => {
    const onClose = vi.fn();
    render(
      <Dialog onClose={onClose}>
        <button>확인</button>
      </Dialog>,
    );
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closeOnBackdrop=false면 backdrop 클릭으로 닫히지 않는다', () => {
    const onClose = vi.fn();
    render(
      <Dialog onClose={onClose} closeOnBackdrop={false}>
        <button>확인</button>
      </Dialog>,
    );
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Dialog 포커스 관리', () => {
  it('열리면 첫 포커스 가능 요소로 포커스가 이동한다', () => {
    render(
      <Dialog onClose={() => {}}>
        <button>첫 버튼</button>
        <button>둘째 버튼</button>
      </Dialog>,
    );
    expect(screen.getByText('첫 버튼')).toHaveFocus();
  });

  it('닫히면 열기 직전 포커스로 복귀한다', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>열기</button>
          {open && (
            <Dialog onClose={() => setOpen(false)}>
              <button onClick={() => setOpen(false)}>닫기</button>
            </Dialog>
          )}
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByText('열기');
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByText('닫기')).toHaveFocus();
    fireEvent.click(screen.getByText('닫기'));
    expect(opener).toHaveFocus();
  });

  it('Tab이 마지막 요소에서 첫 요소로 순환한다 (역방향 포함)', () => {
    render(
      <Dialog onClose={() => {}}>
        <button>첫 버튼</button>
        <button>마지막 버튼</button>
      </Dialog>,
    );
    const first = screen.getByText('첫 버튼');
    const last = screen.getByText('마지막 버튼');

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });

  it('포커스가 다이얼로그 밖으로 새면 Tab에서 다시 안으로 끌어온다', () => {
    render(
      <Dialog onClose={() => {}}>
        <button>안쪽 버튼</button>
      </Dialog>,
    );
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByText('안쪽 버튼')).toHaveFocus();
  });
});

describe('Dialog 중첩', () => {
  it('Escape는 최상위 다이얼로그만 닫는다', () => {
    const closeBottom = vi.fn();
    const closeTop = vi.fn();
    render(
      <>
        <Dialog onClose={closeBottom} ariaLabel="아래층">
          <button>아래 버튼</button>
        </Dialog>
        <Dialog onClose={closeTop} ariaLabel="위층">
          <button>위 버튼</button>
        </Dialog>
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closeTop).toHaveBeenCalledTimes(1);
    expect(closeBottom).not.toHaveBeenCalled();
  });

  it('위층이 열리면 아래층 콘텐츠는 inert 처리된다', () => {
    render(
      <>
        <Dialog onClose={() => {}} ariaLabel="아래층">
          <button>아래 버튼</button>
        </Dialog>
        <Dialog onClose={() => {}} ariaLabel="위층">
          <button>위 버튼</button>
        </Dialog>
      </>,
    );
    const bottom = screen.getByRole('dialog', { name: '아래층' });
    expect(bottom.inert).toBe(true);
  });
});
