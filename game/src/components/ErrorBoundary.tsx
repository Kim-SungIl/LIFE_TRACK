import { Component, type ErrorInfo, type ReactNode } from 'react';
import { getLastSavedAt } from '../engine/store';

type Props = { children: ReactNode };
type State = { hasError: boolean };

// 렌더 크래시 시 화이트스크린 대신 복구 UI.
// 진행은 store localStorage 자동저장으로 대개 보존되어 있으므로, 새로고침으로 이어하기를 유도한다.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const savedAt = getLastSavedAt();
    const savedTime = savedAt
      ? new Date(savedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : null;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          textAlign: 'center',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
        }}
      >
        <div style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 12 }}>
          예상치 못한 문제가 발생했어요
        </div>
        <div style={{
          fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.65,
          maxWidth: 320, marginBottom: savedTime ? 8 : 24,
        }}>
          진행 상황은 저장되어 있어요. 새로고침하면 이어서 할 수 있어요.
        </div>
        {savedTime && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 24 }}>
            마지막 저장 · {savedTime}
          </div>
        )}
        <button
          type="button"
          className="btn btn-primary"
          style={{ maxWidth: 280 }}
          onClick={() => window.location.reload()}
        >
          새로고침
        </button>
      </div>
    );
  }
}
