import { GameState, Activity } from '../../../engine/types';
import { ACTIVITIES, NPC_COMPANION_ACTIVITIES, collapseActivityChoices } from '../../../engine/activities';
import { getActivityReaction } from '../../../engine/dialogues';
import { ActivityPicker } from '../../ActivityPicker';

type Props = {
  editingSlot: string;
  setEditingSlot: (slot: string | null) => void;
  state: GameState;
  activities: Activity[];
  selectedActivities: string[];
  setSelectedActivities: (ids: string[]) => void;
  npcChoices: Record<string, string>;
  maxSlots: number;
  currentSlots: number;
  availableMoney: number;
  onSetRoutine: (slot2: string | null, slot3: string | null) => void;
  setNpcSelectFor: (v: string | null) => void;
  setLastReaction: (v: string | null) => void;
};

// 방과후/저녁 루틴 + 주말/방학 슬롯의 활동 선택 모달 (ActivityPicker 래퍼).
export function SlotEditPopup({
  editingSlot, setEditingSlot, state, activities,
  selectedActivities, setSelectedActivities, npcChoices,
  maxSlots, currentSlots, availableMoney,
  onSetRoutine, setNpcSelectFor, setLastReaction,
}: Props) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 250,
    }} onClick={() => setEditingSlot(null)}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'linear-gradient(180deg, rgba(42,34,48,0.99), rgba(23,21,28,0.99))',
        borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 600,
        maxHeight: '92vh', minHeight: '70vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -4px 30px rgba(0,0,0,0.5)',
      }}>
        {/* 헤더 — 크고 명확하게 */}
        <div style={{
          padding: '20px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              {editingSlot === 'routine1' ? '📚 방과후 활동' :
               editingSlot === 'routine2' ? '🌙 저녁 활동' :
               '☀️ 주말 활동'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {editingSlot.startsWith('routine') ? '매주 반복되는 루틴을 골라주세요' : '이번 주말에 할 활동을 골라주세요'}
            </div>
          </div>
          <span onClick={() => setEditingSlot(null)} style={{
            fontSize: '0.85rem', color: 'var(--text-muted)', cursor: 'pointer',
            padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.06)',
          }}>✕ 닫기</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
          {/* 루틴 슬롯 2(저녁)에 자유시간 옵션 — 디폴트 상태(routineSlot3=null)도 강조하지 않음. */}
          {editingSlot === 'routine2' && (
            <div onClick={() => {
              if (state.routineSlot2) { onSetRoutine(state.routineSlot2, null); }
              setEditingSlot(null);
            }} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 6,
              borderRadius: 10, cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <span style={{ fontSize: '1.1rem' }}>🕊️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>자유시간</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>쉬면서 멘탈 회복 + 피로 감소</div>
              </div>
            </div>
          )}
          <ActivityPicker
            key={editingSlot}
            companionEligible={editingSlot !== 'routine1' && editingSlot !== 'routine2'}
            activities={
              editingSlot === 'routine1' || editingSlot === 'routine2'
                ? activities.filter(a => a.slots === 1 && a.category !== 'rest' &&
                    (editingSlot === 'routine2' ? a.id !== (state.routineSlot2) : true))
                : activities
            }
            selected={
              editingSlot === 'routine1' ? (state.routineSlot2 ? [state.routineSlot2] : []) :
              editingSlot === 'routine2' ? (state.routineSlot3 ? [state.routineSlot3] : []) :
              (() => {
                // 주말/방학: 현재 편집 중인 슬롯의 활동만 하이라이트
                const idx = editingSlot === 'weekend1' ? 0 :
                            editingSlot === 'weekend2' ? 1 :
                            parseInt(editingSlot.replace('weekend', '')) - 1;
                return selectedActivities[idx] ? [selectedActivities[idx]] : [];
              })()
            }
            onToggle={(id) => {
              if (editingSlot === 'routine1') {
                onSetRoutine(id, state.routineSlot3 === id ? null : state.routineSlot3);
                // routine1 설정 후 → routine2가 비어있으면 자동으로 열기
                if (!state.routineSlot3) {
                  setEditingSlot('routine2');
                } else {
                  setEditingSlot(null);
                }
              } else if (editingSlot === 'routine2') {
                onSetRoutine(state.routineSlot2, id);
                setEditingSlot(null);
              } else {
                // 주말/방학 슬롯 — 인덱스 기반 할당 (같은 활동 중복 가능)
                const slotIdx = editingSlot === 'weekend1' ? 0 :
                                editingSlot === 'weekend2' ? 1 :
                                parseInt(editingSlot.replace('weekend', '')) - 1;
                if (NPC_COMPANION_ACTIVITIES.includes(id)) {
                  // NPC 선택 필요 — slotKey 저장 후 NPC 모달 열기
                  setNpcSelectFor(`slot:${slotIdx}:${id}`);
                } else {
                  const act = ACTIVITIES.find(a => a.id === id);
                  const newArr = [...selectedActivities];
                  if (act && act.slots >= 2) {
                    // slots=N 활동: slotIdx부터 N개만 채움. 끝 근처 클릭이면 시작점을 앞으로 클립.
                    const startIdx = Math.min(slotIdx, maxSlots - act.slots);
                    for (let i = 0; i < act.slots; i++) newArr[startIdx + i] = id;
                    setSelectedActivities(newArr.slice(0, maxSlots));
                  } else {
                    newArr[slotIdx] = id;
                    setSelectedActivities(newArr);
                  }
                  setLastReaction(getActivityReaction(id));
                }
                setEditingSlot(null);
              }
            }}
            maxSlots={editingSlot.startsWith('routine') ? 1 : maxSlots}
            currentSlots={editingSlot.startsWith('routine') ? 0 : (() => {
              // 편집 중인 슬롯의 활동을 제외한 슬롯 수 계산
              const idx = editingSlot === 'weekend1' ? 0 :
                          editingSlot === 'weekend2' ? 1 :
                          parseInt(editingSlot.replace('weekend', '')) - 1;
              const editingAct = selectedActivities[idx];
              const editingSlots = editingAct ? (activities.find(x => x.id === editingAct)?.slots || 0) : 0;
              return currentSlots - editingSlots;
            })()}
            state={state}
            npcChoices={npcChoices}
            compact={false}
            availableMoney={availableMoney}
            pendingVacUse={editingSlot.startsWith('routine') ? undefined : (() => {
              // 이번 주 계획에 이미 배치된 활동별 인스턴스 수 — 편집 중 슬롯의 활동은
              // 1인스턴스 제외 (위 currentSlots 계산과 동일 규칙)
              const idx = editingSlot === 'weekend1' ? 0 :
                          editingSlot === 'weekend2' ? 1 :
                          parseInt(editingSlot.replace('weekend', '')) - 1;
              const counts: Record<string, number> = {};
              for (const inst of collapseActivityChoices(selectedActivities)) {
                counts[inst] = (counts[inst] ?? 0) + 1;
              }
              const editingAct = selectedActivities[idx];
              if (editingAct && counts[editingAct]) counts[editingAct] -= 1;
              return counts;
            })()}
          />
        </div>
      </div>
    </div>
  );
}
