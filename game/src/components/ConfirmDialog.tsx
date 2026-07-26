import { Dialog } from './Dialog';

// window.confirm 대체 — 게임 톤 유지 + 모바일 맥락 단절 방지(Phase 3).
// 동기 confirm과 달리 호출부는 상태로 열고 onConfirm/onCancel 콜백으로 흐름을 잇는다.
// 접근성/포커스 트랩/Escape는 Dialog가 담당. Escape·backdrop = 취소(onCancel).
interface ConfirmDialogProps {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 되돌릴 수 없는 파괴적 동작이면 확인 버튼을 경고색으로 */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  message,
  title,
  confirmLabel = '확인',
  cancelLabel = '취소',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      onClose={onCancel}
      maxWidth={340}
      labelledBy={title ? 'confirm-dialog-title' : undefined}
      ariaLabel={title ? undefined : message}
      contentStyle={{
        background: 'var(--bg-card)',
        borderRadius: 16,
        padding: 22,
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {title && (
        <div id="confirm-dialog-title" style={{ fontWeight: 700, fontSize: '1.02rem', marginBottom: 8 }}>
          {title}
        </div>
      )}
      <div style={{
        fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6,
        whiteSpace: 'pre-line', marginBottom: 22,
      }}>
        {message}
      </div>
      {/* 취소가 먼저(왼쪽) + 첫 포커스 대상 — 파괴적 확인의 오조작 방지 */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button" className="btn btn-secondary"
          onClick={onCancel}
          style={{ flex: 1, width: 'auto' }}
        >
          {cancelLabel}
        </button>
        <button
          type="button" className="btn btn-primary"
          onClick={onConfirm}
          style={{ flex: 1, width: 'auto', ...(danger ? { background: 'var(--red)' } : {}) }}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
