import { NpcState } from '../../../engine/types';
import { Portrait } from '../../Portrait';

type Props = {
  // 부모가 met 필터링한 NPC 목록 (메모 안정성 위해 ref 안정 보장)
  metNpcs: readonly NpcState[];
  year: number;
  // `slot:idx:activityId` (슬롯 기반) 또는 activityId (레거시)
  npcSelectFor: string;
  onSelect: (npcId: string) => void;
  onCancel: () => void;
};

export function NpcSelectModal({ metNpcs, year, npcSelectFor, onSelect, onCancel }: Props) {
  const isSlotBased = npcSelectFor.startsWith('slot:');
  const activityId = isSlotBased ? npcSelectFor.split(':')[2] : npcSelectFor;
  const modalLabel = activityId === 'hang-out' ? '놀까' : activityId === 'study-group' ? '공부할까' : '활동할까';
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400 }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>누구와 {modalLabel}?</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 16 }}>함께하는 친구에 따라 친밀도가 올라갑니다</div>
        {metNpcs.map(npc => (
          <div key={npc.id} onClick={() => onSelect(npc.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 10, marginBottom: 6, cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; }}
          >
            <Portrait characterId={npc.id} size={40} expression="neutral" year={year} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{npc.name}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{npc.description}</div>
            </div>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>친밀 {Math.round(npc.intimacy)}</span>
          </div>
        ))}
        <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={onCancel}>취소</button>
      </div>
    </div>
  );
}
