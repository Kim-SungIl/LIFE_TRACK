import { NpcState } from '../../../engine/types';
import { Portrait } from '../../Portrait';

type Props = {
  npcs: NpcState[];
  year: number;
  onSelect: (npcId: string) => void;
};

// 만난 친구만 카드로 표시 — 클릭 시 상세 모달 오픈 (부모가 npcDetailFor 처리)
export function NpcRelationPanel({ npcs, year, onSelect }: Props) {
  const metNpcs = npcs.filter(n => n.met);
  if (metNpcs.length === 0) return null;

  return (
    <div data-tutorial="npc" style={{ background: 'rgba(42,34,48,0.85)', backdropFilter: 'blur(6px)', borderRadius: 12, padding: '10px 14px', marginBottom: 10 }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 10 }}>👥 친구</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {metNpcs.map(n => {
          const intimacyColor = n.intimacy >= 70 ? 'var(--accent-soft)' : n.intimacy >= 40 ? 'var(--yellow)' : 'var(--text-muted)';
          const intimacyLabel = n.intimacy >= 70 ? '절친' : n.intimacy >= 40 ? '친구' : '아는 사이';
          return (
            <div key={n.id}
              onClick={() => onSelect(n.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px',
                transition: 'background 0.15s',
              }}
            >
              <Portrait characterId={n.id} size={36} expression="neutral" year={year} />
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
