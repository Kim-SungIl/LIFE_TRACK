import { GameState } from '../../../engine/types';
import { ACTIVITIES, getActivityCost } from '../../../engine/activities';

type Props = {
  state: GameState;
  selectedActivities: string[];
  setSelectedActivities: (ids: string[]) => void;
  npcChoices: Record<string, string>;
  onEditSlot: (slot: string) => void;
  routineTooExpensive: boolean;
  routineCost: number;
  maxComboWeeks: number;
  slot2ComboWeeks: number;
  slot3ComboWeeks: number;
  maxSlots: number;
};

// 이번 주 일과 — 학기 중(주중/주말 2단) · 방학(자유 슬롯) 플래너.
// 슬롯 탭 → onEditSlot(slotKey) 로 부모의 SlotEditPopup 오픈.
export function WeekPlanner({
  state, selectedActivities, setSelectedActivities, npcChoices, onEditSlot,
  routineTooExpensive, routineCost, maxComboWeeks,
  slot2ComboWeeks, slot3ComboWeeks, maxSlots,
}: Props) {
  const labelFor = (w: number) => w >= 8 ? '🔥 ' : w >= 6 ? '⭐ ' : w >= 3 ? '✨ ' : '';
  const routineComboLabel = labelFor(maxComboWeeks);

  // 슬롯 렌더 헬퍼 — routine 슬롯의 경우 그 슬롯의 카운터를 명시적으로 전달
  const renderSlot = (
    emoji: string, timeLabel: string, activityName: string | null,
    onClick: (() => void) | null, isFixed = false, isRoutine = false,
    moneyCost?: number, withNpc?: string, slotComboWeeks: number = 0,
  ) => {
    const isEmpty = !activityName;
    const isClickable = !isFixed && onClick;
    const shouldHighlight = isEmpty && !isFixed; // 빈 선택 슬롯은 항상 강조
    return (
      <button
        type="button"
        disabled={!isClickable}
        onClick={() => isClickable && onClick!()}
        className={`btn-reset ${shouldHighlight ? 'slot-pulse' : ''}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
          padding: '10px 12px', marginBottom: 4, borderRadius: 10,
          cursor: isClickable ? 'pointer' : 'default',
          background: isFixed ? 'rgba(255,255,255,0.03)' :
                      isEmpty ? 'rgba(224,138,91,0.08)' :
                      isRoutine ? 'rgba(125,163,217,0.12)' : 'rgba(224,138,91,0.12)',
          border: isEmpty && !isFixed ? '1px dashed rgba(224,138,91,0.4)' :
                  isRoutine && slotComboWeeks >= 3 ? '1px solid rgba(224,179,84,0.4)' :
                  isRoutine ? '1px solid rgba(125,163,217,0.2)' :
                  !isEmpty && !isFixed ? '1px solid rgba(224,138,91,0.2)' :
                  '1px solid rgba(255,255,255,0.04)',
          boxShadow: isRoutine && slotComboWeeks >= 6 ? '0 0 8px rgba(224,179,84,0.2)' :
                     isEmpty && !isFixed ? '0 0 6px rgba(224,138,91,0.15)' : 'none',
          transition: 'all 0.15s',
          opacity: isFixed ? 0.6 : 1,
          animation: shouldHighlight ? 'slotPulse 2s ease-in-out infinite' : 'none',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
          <span style={{ fontSize: '1rem' }}>{emoji}</span>
          <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: 1 }}>{timeLabel}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {activityName ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{activityName}</span>
                {isRoutine && <span style={{ fontSize: '0.55rem', color: 'var(--blue)', background: 'rgba(125,163,217,0.15)', padding: '1px 4px', borderRadius: 3 }}>매주</span>}
                {isRoutine && slotComboWeeks >= 3 && <span style={{ fontSize: '0.55rem', color: 'var(--yellow)', background: 'rgba(224,179,84,0.15)', padding: '1px 4px', borderRadius: 3 }}>{labelFor(slotComboWeeks)}{slotComboWeeks}주 연속</span>}
              </div>
              {(moneyCost !== undefined && moneyCost > 0 || withNpc) && (
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 1 }}>
                  {moneyCost !== undefined && moneyCost > 0 && <span style={{ color: 'var(--yellow)' }}>{moneyCost}만원 </span>}
                  {withNpc && <span style={{ color: 'var(--accent-soft)' }}>{withNpc} 동행</span>}
                </div>
              )}
            </div>
          ) : isFixed ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>수업</span>
          ) : (
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-soft)', fontWeight: 500 }}>탭하여 활동 선택</span>
          )}
        </div>
        {/* 선택 가능한 슬롯에 변경 아이콘 표시 */}
        {isClickable && (
          <div style={{ flexShrink: 0, fontSize: '0.7rem', color: isEmpty ? 'var(--accent-soft)' : 'rgba(255,255,255,0.3)', padding: '2px 4px' }}>
            {isEmpty ? '▶' : '✎'}
          </div>
        )}
      </button>
    );
  };

  return (
    <div data-tutorial="routine" style={{
      background: 'rgba(42,34,48,0.85)', backdropFilter: 'blur(6px)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
      border: routineTooExpensive ? '1px solid var(--red)' : '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 10 }}>
        📅 이번 주 일과
        {!state.isVacation && maxComboWeeks >= 3 && (
          <span style={{ color: 'var(--yellow)', marginLeft: 8, fontSize: '0.68rem' }}>
            {routineComboLabel}루틴 보너스 활성
          </span>
        )}
      </div>

      {/* 돈 부족 경고 */}
      {routineTooExpensive && (
        <div style={{
          background: 'rgba(217,100,88,0.15)', border: '1px solid rgba(217,100,88,0.3)',
          borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: '0.78rem',
          textAlign: 'center', color: 'var(--red)',
        }}>
          💰 돈이 부족해요! 방과후 활동을 변경해 주세요 (현재 {Number.isInteger(state.money) ? state.money : state.money.toFixed(1)}만원, 필요 {routineCost}만원)
        </div>
      )}

      {/* 학기 중: 주중 | 주말 가로 2단 (좁은 폰에서는 week.css에서 세로 스택) */}
      {!state.isVacation && (
        <div className="week-grid" style={{ display: 'flex', gap: 8 }}>
          {/* 왼쪽: 주중 */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>주중 (월~금)</div>
            {renderSlot('🏫', '오전', '학교', null, true)}
            {renderSlot('🏫', '오후', '학교', null, true)}
            {renderSlot(
              state.routineSlot2 ? '📚' : '❓',
              '방과후',
              state.routineSlot2 ? ACTIVITIES.find(a => a.id === state.routineSlot2)?.name || null : null,
              () => onEditSlot('routine1'),
              false, true,
              (() => { const r = state.routineSlot2 ? ACTIVITIES.find(a => a.id === state.routineSlot2) : null; return r ? getActivityCost(r, state.year) : undefined; })(),
              undefined,
              slot2ComboWeeks,
            )}
            {renderSlot(
              state.routineSlot3 ? '🌙' : '🕊️',
              '저녁',
              state.routineSlot3 ? ACTIVITIES.find(a => a.id === state.routineSlot3)?.name || null : (state.routineSlot2 ? '자유시간' : null),
              () => onEditSlot('routine2'),
              false, !!state.routineSlot2,
              (() => { const r = state.routineSlot3 ? ACTIVITIES.find(a => a.id === state.routineSlot3) : null; return r ? getActivityCost(r, state.year) : undefined; })(),
              undefined,
              slot3ComboWeeks,
            )}
          </div>

          {/* 오른쪽: 주말 */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>주말 (토~일)</div>
            {renderSlot(
              selectedActivities[0] ? '🌟' : '☀️',
              '토요일',
              selectedActivities[0] ? ACTIVITIES.find(a => a.id === selectedActivities[0])?.name || null : null,
              () => {
                // slots=2 활동이 선택되어 있으면 전체 초기화 후 선택 패널 열기
                const act = ACTIVITIES.find(a => a.id === selectedActivities[0]);
                if (act && act.slots >= 2) {
                  setSelectedActivities([]);
                }
                onEditSlot('weekend1');
              },
              false, false,
              (() => { const a0 = selectedActivities[0] ? ACTIVITIES.find(a => a.id === selectedActivities[0]) : null; return a0 ? getActivityCost(a0, state.year) : undefined; })(),
              (npcChoices[`${selectedActivities[0]}:0`] || npcChoices[selectedActivities[0]])
                ? state.npcs.find(n => n.id === (npcChoices[`${selectedActivities[0]}:0`] || npcChoices[selectedActivities[0]]))?.name : undefined,
            )}
            {(() => {
              const slot0Act = ACTIVITIES.find(a => a.id === selectedActivities[0]);
              const isSlot0TwoSlot = slot0Act && slot0Act.slots >= 2;
              return renderSlot(
                isSlot0TwoSlot ? '💤' : selectedActivities[1] ? '🌟' : '☀️',
                '일요일',
                isSlot0TwoSlot ? '(연속 활동)' : selectedActivities[1] ? ACTIVITIES.find(a => a.id === selectedActivities[1])?.name || null : null,
                isSlot0TwoSlot ? null : () => onEditSlot('weekend2'),
                isSlot0TwoSlot, false,
                isSlot0TwoSlot ? undefined : (() => { const a1 = selectedActivities[1] ? ACTIVITIES.find(a => a.id === selectedActivities[1]) : null; return a1 ? getActivityCost(a1, state.year) : undefined; })(),
                isSlot0TwoSlot ? undefined :
                  (npcChoices[`${selectedActivities[1]}:1`] || npcChoices[selectedActivities[1]])
                    ? state.npcs.find(n => n.id === (npcChoices[`${selectedActivities[1]}:1`] || npcChoices[selectedActivities[1]]))?.name : undefined,
              );
            })()}

            {/* 주말 미선택 경고 */}
            {selectedActivities.length === 0 && state.routineSlot2 && (
              <div style={{
                marginTop: 8, padding: '8px 10px', borderRadius: 8,
                background: 'rgba(224,179,84,0.15)', border: '1px solid rgba(224,179,84,0.3)',
                fontSize: '0.72rem', color: 'var(--yellow)', lineHeight: 1.4,
                textAlign: 'center', animation: 'pulse-soft 2s ease-in-out infinite',
              }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>주말 활동이 비어있어요!</div>
                <div style={{ fontSize: '0.65rem', opacity: 0.85 }}>토/일 슬롯을 탭해서 활동을 선택하세요</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 방학: 자유 슬롯 */}
      {state.isVacation && (
        <>
          {/* Phase 1: 방학 시작/마무리 안내문 (학교급별 톤) */}
          {(() => {
            const isStart = state.week === 20 || state.week === 43;
            const isEnd = state.week === 24 || state.week === 48;
            if (!isStart && !isEnd) return null;
            const schoolLevel: 'elementary' | 'middle' | 'high' =
              state.year === 1 ? 'elementary' : state.year <= 4 ? 'middle' : 'high';
            const startMessages: Record<typeof schoolLevel, string> = {
              elementary: '방학식이 끝났다. 가방이 평소보다 가볍게 느껴졌다.',
              middle: '방학이 시작됐지만, 숙제와 학원 일정표가 먼저 눈에 들어왔다. 손을 놓으면 배운 게 조금씩 새어나가는 게 느껴지는 나이다.',
              high: '방학이라는 말이 예전처럼 가볍게 들리지는 않았다. 일주일만 책을 안 펴도 감이 훅 떨어진다 — 다들 그래서 방학이 더 무섭다고 한다.',
            };
            const endMessages: Record<typeof schoolLevel, string> = {
              elementary: '방학의 마지막 날. 일기장에 적을 게 평소보다 많았다.',
              middle: '개학이 코앞이다. 정신을 차려보니 방학이 다 갔다.',
              high: '이번 방학도 끝이다. 다음 학기는 또 한 단계 무거워질 것 같다.',
            };
            const msg = isStart ? startMessages[schoolLevel] : endMessages[schoolLevel];
            const label = isStart ? '🏖️ 방학 시작' : '🍂 방학 마무리';
            return (
              <div style={{
                background: 'rgba(224,138,91,0.12)',
                border: '1px solid rgba(224,138,91,0.25)',
                borderRadius: 10,
                padding: '10px 12px',
                marginBottom: 10,
              }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{msg}</div>
              </div>
            );
          })()}
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
            🏖️ 방학 — 자유 시간
          </div>
          {Array.from({ length: maxSlots }, (_, i) => (
            <div key={i}>
              {renderSlot(
                selectedActivities[i] ? '🌟' : '☀️',
                `활동 ${i + 1}`,
                selectedActivities[i] ? ACTIVITIES.find(a => a.id === selectedActivities[i])?.name || null : null,
                () => {
                  // 2칸 활동이 점유 중이면 해당 활동만 배열에서 제거 (사용자가 다시 고를 수 있도록)
                  const cur = selectedActivities[i];
                  const act = cur ? ACTIVITIES.find(a => a.id === cur) : null;
                  if (act && act.slots >= 2) {
                    setSelectedActivities(selectedActivities.filter(a => a !== cur));
                  }
                  onEditSlot(`weekend${i + 1}`);
                },
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
