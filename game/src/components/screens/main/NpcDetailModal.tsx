import { NpcState } from '../../../engine/types';
import { Portrait } from '../../Portrait';
import { breakSentences } from '../shared';
import { relationshipSignal, absWeek } from '../../../engine/relationshipSignals';

const SIGNAL_COLOR = { warn: '#d9a05b', good: '#8fb573', info: '#8a8078' } as const;

type Props = {
  npc: NpcState;
  year: number;
  week: number;
  // 친밀도/상황 기반 기본 인사말 — 부모(MainWeekScreen)가 getNpcDialogue 로 사전 계산해 전달
  dialogue: string;
  // 말 걸기 후 잡담 라인 — null 이면 dialogue 표시, 있으면 잡담 라인으로 교체
  smalltalk: string | null;
  onTalk: () => void;
  onClose: () => void;
};

export function NpcDetailModal({ npc, year, week, dialogue, smalltalk, onTalk, onClose }: Props) {
  const intimacyColor = npc.intimacy >= 70 ? 'var(--accent-soft)' : npc.intimacy >= 40 ? 'var(--yellow)' : 'var(--text-muted)';
  const intimacyLabel = npc.intimacy >= 70 ? '절친' : npc.intimacy >= 40 ? '친구' : '아는 사이';
  const signal = relationshipSignal(npc, absWeek(year, week));
  return (
    <div onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'linear-gradient(135deg, rgba(42,34,48,0.98), rgba(23,21,28,0.98))',
        borderRadius: 16, padding: 24, width: '85%', maxWidth: 340, textAlign: 'center',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <Portrait characterId={npc.id} size={72} expression="neutral" year={year} />
        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 12 }}>{npc.name}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
          {npc.intimacy >= 30 ? npc.description : '같은 학교 친구'}
        </div>

        {/* 인사말 — 친밀도/상황에 따라 다양한 대사. 말 걸기 클릭 시 잡담 라인으로 교체됨. */}
        <div style={{
          background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '10px 14px',
          marginTop: 14, fontStyle: 'italic', fontSize: '0.85rem', lineHeight: 1.6,
          whiteSpace: 'pre-line', wordBreak: 'keep-all', overflowWrap: 'break-word',
        }}>
          {smalltalk
            ? smalltalk
            : `"${breakSentences(dialogue)}"`}
        </div>

        {/* 친밀도 */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: intimacyColor }}>{intimacyLabel}</span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>친밀도 {Math.round(npc.intimacy)}</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${npc.intimacy}%`, background: intimacyColor, borderRadius: 3 }} />
          </div>
          {/* 관계 신호 — 방치/최근/임박 */}
          {signal && (
            <div style={{ fontSize: '0.7rem', color: SIGNAL_COLOR[signal.tone], marginTop: 8 }}>
              {signal.text}
            </div>
          )}
        </div>

        {/* 말 걸기는 항상 활성 — 사전 결정 모델. 클릭 시 상단 인사말 영역이 잡담 라인으로 교체. */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onTalk}>말 걸기</button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
