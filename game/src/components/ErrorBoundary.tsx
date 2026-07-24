import { Component, type ErrorInfo, type ReactNode } from 'react';
import { getLastSavedAt, deleteSave } from '../engine/store';

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

  // 저장된 상태 자체가 크래시 원인이면 새로고침만으로는 같은 화면으로 되돌아온다(루프).
  // 마지막 탈출구로 저장 삭제 후 처음부터 — 되돌릴 수 없으므로 확인을 받는다.
  private handleReset = () => {
    if (window.confirm('저장된 진행을 삭제하고 처음부터 시작할까요?\n이 동작은 되돌릴 수 없어요.')) {
      deleteSave();
      window.location.reload();
    }
  };

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
        <div style={{ marginTop: 20, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          새로고침해도 계속 같은 문제가 생기나요?<br />
          <button
            type="button"
            className="btn-reset"
            onClick={this.handleReset}
            style={{ color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }}
          >
            저장 삭제하고 처음부터 시작
          </button>
        </div>
      </div>
    );
  }
}
