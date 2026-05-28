import { ParentStrength } from '../../../engine/types';

type Props = {
  parents: readonly ParentStrength[];
  smalltalk: string | null;
  onTalk: () => void;
  onClose: () => void;
};

const LABELS: Record<ParentStrength, { icon: string; label: string }> = {
  emotional:  { icon: '🫂', label: '정서적 지지' },
  wealth:     { icon: '🏠', label: '여유 있는 집' },
  info:       { icon: '📱', label: '정보가 있는 집' },
  strict:     { icon: '📐', label: '엄격한 집' },
  resilience: { icon: '⭐', label: '타고난 체질' },
  freedom:    { icon: '🌿', label: '자유로운 집' },
};

// Phase 2.1 — 가정 모달 (단일 엔티티 — 두 부모 강점은 가정 분위기)
export function HomeModal({ parents, smalltalk, onTalk, onClose }: Props) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'linear-gradient(135deg, rgba(42,34,48,0.98), rgba(23,21,28,0.98))',
        borderRadius: 16, padding: 24, width: '85%', maxWidth: 360, textAlign: 'center',
        border: '1px solid rgba(224,138,91,0.25)',
      }}>
        <div style={{ fontSize: '2.2rem', marginBottom: 6 }}>🏠</div>
        <div style={{ fontSize: '1rem', fontWeight: 700 }}>가정</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
          엄마와 아빠가 만든 우리 집 분위기
        </div>

        {/* 두 강점을 분위기 카드로 표시 */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'center' }}>
          {parents.map(p => {
            const m = LABELS[p];
            return (
              <div key={p} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 8px',
                border: '1px solid rgba(224,138,91,0.15)',
              }}>
                <span style={{ fontSize: '1.4rem' }}>{m.icon}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{m.label}</span>
              </div>
            );
          })}
        </div>

        {smalltalk && (
          <div style={{
            marginTop: 14, padding: '10px 14px',
            background: 'rgba(255,255,255,0.04)', borderRadius: 10,
            fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic',
            lineHeight: 1.6, wordBreak: 'keep-all', overflowWrap: 'break-word',
          }}>{smalltalk}</div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onTalk}>부모와 대화하기</button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
