import { GameState } from '../../../engine/types';
import { Portrait } from '../../Portrait';
import { relationshipSignal } from '../../../engine/relationshipSignals';

type Props = {
  state: GameState;
  onSelect: (npcId: string) => void;
};

const SIGNAL_COLOR = { warn: '#d9a05b', good: '#8fb573', info: '#8a8078' } as const;

// 만난 친구만 카드로 표시 — 클릭 시 상세 모달 오픈 (부모가 npcDetailFor 처리)
export function NpcRelationPanel({ state, onSelect }: Props) {
  const metNpcs = state.npcs.filter(n => n.met);
  if (metNpcs.length === 0) return null;

  return (
    <div data-tutorial="npc" style={{ background: 'rgba(42,34,48,0.85)', backdropFilter: 'blur(6px)', borderRadius: 12, padding: '10px 14px', marginBottom: 10 }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 10 }}>👥 친구</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {metNpcs.map(n => {
          // 친구 게이지 색 = 능력치 등급 색 언어(STAT_GRADES)와 통일 — 아는 사이(E 회색) → 친구(B 우수=초록) → 절친(A 최상=골드)
          const intimacyColor = n.intimacy >= 70 ? '#e5c07b' : n.intimacy >= 40 ? '#8fb573' : '#8a8078';
          const intimacyLabel = n.intimacy >= 70 ? '절친' : n.intimacy >= 40 ? '친구' : '아는 사이';
          const signal = relationshipSignal(n, state);
          return (
            <div key={n.id}
              onClick={() => onSelect(n.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px',
                transition: 'background 0.15s',
              }}
            >
              <Portrait characterId={n.id} size={36} expression="neutral" year={state.year} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{n.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${n.intimacy}%`, background: intimacyColor, borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                  {/* 라벨 고정 폭 — '아는 사이'(긴 라벨)일 때 바가 좁아지는 너비 편차 방지 */}
                  <span style={{ fontSize: '0.65rem', color: intimacyColor, whiteSpace: 'nowrap', width: 46, flexShrink: 0, textAlign: 'right' }}>
                    {intimacyLabel}
                  </span>
                </div>
                {/* 관계 신호 — 방치/최근/임박. 숫자 대신 감각적 한 줄(없으면 미표시) */}
                {signal && (
                  <div style={{ fontSize: '0.65rem', color: SIGNAL_COLOR[signal.tone], marginTop: 3 }}>
                    {signal.text}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
