import { MiniTalkEvent } from '../../../engine/talkSystem';

type Props = {
  result: MiniTalkEvent;
  // 오버레이 클릭 — 미니 결과만 닫고 하단 모달(NPC/가정)은 유지
  onDismiss: () => void;
  // 닫기 버튼 — 미니 결과 + 하단 모달까지 모두 닫기
  onCloseAll: () => void;
};

export function MiniTalkModal({ result, onDismiss, onCloseAll }: Props) {
  return (
    <div onClick={onDismiss} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'linear-gradient(135deg, rgba(42,34,48,0.98), rgba(23,21,28,0.98))',
        borderRadius: 16, padding: 24, width: '85%', maxWidth: 360, textAlign: 'center',
        border: '1px solid rgba(224,138,91,0.4)',
      }}>
        <div style={{
          fontSize: '0.9rem', lineHeight: 1.7, whiteSpace: 'pre-line',
          wordBreak: 'keep-all', overflowWrap: 'break-word',
          background: 'rgba(224,138,91,0.06)', borderRadius: 12, padding: '14px 16px',
        }}>{result.description}</div>
        <div style={{
          marginTop: 14, fontSize: '0.78rem', color: 'var(--accent-soft)', fontWeight: 600,
        }}>{result.message}</div>
        <button className="btn btn-primary" style={{ marginTop: 18, width: '100%' }} onClick={onCloseAll}>닫기</button>
      </div>
    </div>
  );
}
