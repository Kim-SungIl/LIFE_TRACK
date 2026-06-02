import { ParentStrength } from '../../../engine/types';
import { PARENT_ICONS, breakSentences } from '../shared';
import { Portrait } from '../../Portrait';

type Props = {
  parents: readonly ParentStrength[];
  smalltalk: string | null;
  hasEvent: boolean;          // 이번 주 가정 미니 이벤트가 실제로 남아있는지 (배지/라벨 구분용)
  onTalk: () => void;
  onClose: () => void;
};

// 아이콘은 shared PARENT_ICONS 재사용, 라벨 텍스트만 별도 보유 (SSOT).
const LABELS: Record<ParentStrength, string> = {
  emotional:  '정서적 지지',
  wealth:     '여유 있는 집',
  info:       '정보가 있는 집',
  strict:     '엄격한 집',
  resilience: '타고난 체질',
  freedom:    '자유로운 집',
};

// Phase 2.1 — 가정 모달 (단일 엔티티 — 두 부모 강점은 가정 분위기)
export function HomeModal({ parents, smalltalk, hasEvent, onTalk, onClose }: Props) {
  // 잡담을 건네거나 이벤트가 있을 땐 부모가 환하게(happy), 평소엔 차분히(neutral)
  const parentExpr = smalltalk || hasEvent ? 'happy' : 'neutral';
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
        {/* 엄마·아빠 일러스트 헤더 — 이모지(🏠) 대신, NPC 모달과 톤 일관 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 8 }}>
          <Portrait characterId="mother" size={62} expression={parentExpr} />
          <Portrait characterId="father" size={62} expression={parentExpr} />
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 700 }}>가정</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
          엄마와 아빠가 만든 우리 집 분위기
        </div>

        {/* 두 강점은 '읽는 정보' — 버튼으로 오인되지 않게 muted 태그(pill)로 표시 */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {parents.map(p => (
            <span key={p} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,255,255,0.05)', borderRadius: 999, padding: '5px 12px',
              fontSize: '0.78rem', color: 'var(--text-muted)',
            }}>
              <span style={{ fontSize: '0.9rem', opacity: 0.85 }}>{PARENT_ICONS[p]}</span>
              {LABELS[p]}
            </span>
          ))}
        </div>

        {/* 잡담 영역 — 항상 렌더 + 고정 최소높이로 클릭마다(또는 줄 길이차로) 모달이 점프하지 않게 (레이아웃 시프트 방지) */}
        <div style={{
          marginTop: 14, padding: '12px 14px',
          background: 'rgba(255,255,255,0.06)', borderRadius: 10,
          // 실제 대사는 크림 off-white(--text-primary)로 또렷하게, placeholder는 muted로 절제
          fontSize: smalltalk ? '0.9rem' : '0.8rem', fontStyle: 'italic',
          lineHeight: 1.65, wordBreak: 'keep-all', overflowWrap: 'break-word',
          minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', whiteSpace: 'pre-line',
          color: smalltalk ? 'var(--text-primary)' : 'var(--text-muted)',
        }}>
          {/* 문장(.!?) 단위로 줄바꿈 — 애매하게 두 번째 줄에 한 단어만 걸치는 어색한 wrap 방지 */}
          {smalltalk ? breakSentences(smalltalk) : '말을 걸면 부모님이 한마디 건네요.'}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          {/* 1차 액션을 더 넓게(flex 1.6) — '✨ 부모와 대화하기'가 좁은 폭에서 줄바꿈되지 않게 nowrap */}
          <button className="btn btn-primary" style={{ flex: 1.6, whiteSpace: 'nowrap' }} onClick={onTalk}>
            {hasEvent ? '✨ 부모와 대화하기' : '부모와 안부 묻기'}
          </button>
          <button className="btn btn-secondary" style={{ flex: 1, whiteSpace: 'nowrap' }} onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
