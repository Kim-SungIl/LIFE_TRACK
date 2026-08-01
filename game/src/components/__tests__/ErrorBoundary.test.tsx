// @vitest-environment jsdom
// ErrorBoundary — 렌더 크래시 폴백의 계약:
// children 통과, 폴백 UI(role=alert), 마지막 저장 시각, 저장 삭제 확인 다이얼로그.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';
import { getLastSavedAt, deleteSave } from '../../engine/store';

vi.mock('../../engine/store', () => ({
  getLastSavedAt: vi.fn(),
  deleteSave: vi.fn(),
}));

const mockedGetLastSavedAt = vi.mocked(getLastSavedAt);
const mockedDeleteSave = vi.mocked(deleteSave);

function Thrower(): never {
  throw new Error('test render crash');
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockedGetLastSavedAt.mockReturnValue(null);
    mockedDeleteSave.mockClear();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: vi.fn() },
      writable: true,
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('에러 없을 때 children을 그대로 렌더한다', () => {
    render(
      <ErrorBoundary>
        <div>정상 자식</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('정상 자식')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('자식이 렌더 중 throw하면 폴백을 표시한다', () => {
    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('예상치 못한 문제가 발생했어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '새로고침' })).toBeInTheDocument();
  });

  it('getLastSavedAt이 타임스탬프면 "마지막 저장"을 표시하고, null이면 숨긴다', () => {
    mockedGetLastSavedAt.mockReturnValue('2026-08-01T15:30:00.000Z');
    const { unmount } = render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/마지막 저장/)).toBeInTheDocument();
    unmount();

    mockedGetLastSavedAt.mockReturnValue(null);
    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>,
    );
    expect(screen.queryByText(/마지막 저장/)).not.toBeInTheDocument();
  });

  it('"저장 삭제하고 처음부터 시작" → 확인 시 deleteSave, 취소 시 미호출', () => {
    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: '저장 삭제하고 처음부터 시작' }));
    expect(screen.getByRole('dialog', { name: '처음부터 시작할까요?' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('dialog', { name: '처음부터 시작할까요?' })).not.toBeInTheDocument();
    expect(mockedDeleteSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '저장 삭제하고 처음부터 시작' }));
    fireEvent.click(screen.getByRole('button', { name: '삭제하고 시작' }));
    expect(mockedDeleteSave).toHaveBeenCalledTimes(1);
  });
});
