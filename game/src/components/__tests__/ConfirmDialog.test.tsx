// @vitest-environment jsdom
// ConfirmDialog — window.confirm 대체의 계약:
// 확인/취소 콜백, Escape=취소, 오조작 방지(취소가 왼쪽·첫 포커스).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '../ConfirmDialog';

function renderConfirm(overrides?: Partial<Parameters<typeof ConfirmDialog>[0]>) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      message="정말 삭제할까요?"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onConfirm, onCancel };
}

describe('ConfirmDialog', () => {
  it('메시지와 기본 라벨(확인/취소)을 렌더한다', () => {
    renderConfirm();
    expect(screen.getByText('정말 삭제할까요?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '확인' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument();
  });

  it('title과 커스텀 라벨을 지원한다', () => {
    renderConfirm({ title: '저장 삭제', confirmLabel: '삭제한다', cancelLabel: '남겨둔다' });
    expect(screen.getByRole('dialog', { name: '저장 삭제' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '삭제한다' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '남겨둔다' })).toBeInTheDocument();
  });

  it('확인/취소 버튼이 각 콜백을 호출한다', () => {
    const { onConfirm, onCancel } = renderConfirm();
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape는 취소로 처리한다', () => {
    const { onConfirm, onCancel } = renderConfirm();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('첫 포커스는 취소 버튼 — 파괴적 확인의 오조작 방지', () => {
    renderConfirm({ danger: true });
    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus();
  });
});
