import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GameState } from '../../../engine/types';
import { getWeekLabel, getMonthLabel } from '../../../engine/gameEngine';
import { getAvailableActivities, ACTIVITIES, getActivityCost, collapseActivityChoices } from '../../../engine/activities';
import { getParentMods } from '../../../engine/parentModifiers';
import { getCharacterDialogue, getActivityReaction, getNpcDialogue } from '../../../engine/dialogues';
import { MiniTalkEvent, getAvailableHomeEvents } from '../../../engine/talkSystem';
import { ShopItem } from '../../../engine/shopSystem';
import { TalkActionResult } from '../../../engine/store';
import { Portrait } from '../../Portrait';
import { ActivityPicker } from '../../ActivityPicker';
import { Shop } from '../../Shop';
import { Tutorial } from '../../Tutorial';
import { BgWrapper, ScreenBgProps } from '../BgWrapper';
import { breakSentences, getFatigueDisplay, getUpcomingEvents } from '../shared';
import { HudPanel } from './HudPanel';
import { StatsPanel } from './StatsPanel';
import { NpcSelectModal } from './NpcSelectModal';
import { NpcDetailModal } from './NpcDetailModal';
import { HomeModal } from './HomeModal';
import { MiniTalkModal } from './MiniTalkModal';

type Props = {
  state: GameState;
  bgProps: ScreenBgProps;
  onSetRoutine: (slot2: string | null, slot3: string | null) => void;
  onTalkNpc: (npcId: string) => TalkActionResult;
  onTalkHome: () => TalkActionResult;
  onBuyItem: (item: ShopItem, npcId?: string) => void;
  // 주 확정 — 선택/루틴 choice 와 NPC 동행을 store 에 반영하고 주간 결산으로 전환 (GameScreen 오케스트레이션)
  onConfirmWeek: (activities: string[], npcChoices: Record<string, string>) => void;
};

const SOCIAL_ACTIVITIES = ['hang-out', 'club', 'study-group'];

export function MainWeekScreen({ state, bgProps, onSetRoutine, onTalkNpc, onTalkHome, onBuyItem, onConfirmWeek }: Props) {
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [npcSelectFor, setNpcSelectFor] = useState<string | null>(null);
  const [npcDetailFor, setNpcDetailFor] = useState<string | null>(null);
  const [npcChoices, setNpcChoices] = useState<Record<string, string>>({});
  // Phase 2.1 말걸기 — 사전 결정 모델, 가정은 단일 엔티티
  const [showHomeModal, setShowHomeModal] = useState(false);
  const [miniTalkResult, setMiniTalkResult] = useState<MiniTalkEvent | null>(null);
  // 잡담 한 줄 — 비-pending 주에 클릭 시 캐릭터 톤의 잡담 라인 표시 (클릭마다 새로 픽)
  const [npcSmalltalk, setNpcSmalltalk] = useState<string | null>(null);
  const [homeSmalltalk, setHomeSmalltalk] = useState<string | null>(null);
  // 모달 전환 시 잡담 상태 리셋 — NPC 갈아탈 때 이전 잡담이 남아있는 상태 누수 방지
  useEffect(() => { setNpcSmalltalk(null); }, [npcDetailFor]);
  useEffect(() => { if (!showHomeModal) setHomeSmalltalk(null); }, [showHomeModal]);
  const [lastReaction, setLastReaction] = useState<string | null>(null);
  const [showShop, setShowShop] = useState(false);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(() => {
    try { return !localStorage.getItem('lifetrack_tutorial_done'); } catch { return false; }
  });
  // A-3: 확정 버튼 더블탭 락 — 렌더 갱신 사이 빠른 두 번째 클릭으로 processWeek가 두 번 도는 것 차단
  const confirmLockRef = useRef(false);

  // 의존: week/year/totalWeeksPlayed (primitives) — 한 주가 진행될 때만 새 라인 뽑고,
  // 말걸기 같은 로컬 state 변경에는 영향 안 받게 한다.
  const dialogue = useMemo(
    () => getCharacterDialogue(state),
    [state.week, state.year, state.totalWeeksPlayed],
  );

  // ===== 메인 변수들 =====
  const weekInfo = getWeekLabel(state);
  const month = getMonthLabel(state.week);
  const maxSlots = state.isVacation ? 5 + getParentMods(state.parents).vacationSlotBonus : 2;
  const activities = getAvailableActivities(state);
  // 2칸 활동은 onToggle에서 같은 id로 인접 슬롯에 중복 저장됨. 슬롯/비용 계산 시 한 인스턴스로 collapse.
  // 엔진의 vacationChoices 처리(gameEngine.ts)와 동일한 헬퍼 사용 — SSOT.
  const selectedInstances = collapseActivityChoices(selectedActivities)
    .map(id => activities.find(a => a.id === id))
    .filter((a): a is typeof activities[number] => !!a);
  const currentSlots = selectedInstances.reduce((s, act) => s + act.slots, 0);
  const { color: fatigueColor, label: fatigueLabel } = getFatigueDisplay(state.fatigue);

  // 루틴 비용 체크 — 돈이 부족하면 루틴 변경 강제. 학년별 차등 비용 적용.
  // 방학 중에는 엔진이 루틴을 가동하지 않으므로 비용 0.
  const routineCost = (() => {
    if (state.isVacation) return 0;
    const r2 = state.routineSlot2 ? ACTIVITIES.find(a => a.id === state.routineSlot2) : null;
    const r3 = state.routineSlot3 ? ACTIVITIES.find(a => a.id === state.routineSlot3) : null;
    return (r2 ? getActivityCost(r2, state.year) : 0) + (r3 ? getActivityCost(r3, state.year) : 0);
  })();
  const routineTooExpensive = !state.isVacation && state.routineSlot2 && routineCost > 0 && state.money < routineCost;

  // 이번 주 누적 활동 비용 — 루틴 + 사용자가 고른 활동들 (HUD 잔액 옆 실시간 표시용)
  const selectedActivityCost = selectedInstances.reduce(
    (sum, act) => sum + Math.max(0, getActivityCost(act, state.year)),
    0,
  );
  const weeklyActivityCost = routineCost + selectedActivityCost;
  const weeklyOverBudget = weeklyActivityCost > state.money;

  // 루틴 콤보 표시 — 슬롯별 카운터 (한 슬롯만 변경 시 다른 슬롯 보너스 보전)
  const labelFor = (w: number) => w >= 8 ? '🔥 ' : w >= 6 ? '⭐ ' : w >= 3 ? '✨ ' : '';
  const slot2ComboWeeks = !state.isVacation && state.routineSlot2Weeks >= 3 ? state.routineSlot2Weeks : 0;
  const slot3ComboWeeks = !state.isVacation && state.routineSlot3Weeks >= 3 ? state.routineSlot3Weeks : 0;
  const maxComboWeeks = Math.max(slot2ComboWeeks, slot3ComboWeeks);
  const routineComboLabel = labelFor(maxComboWeeks);

  const upcomingEvents = getUpcomingEvents(state);
  // 가정 모달 배지 — pending 이어도 풀이 비면 잡담으로 빠지므로, 실제 남은 이벤트가 있을 때만 true
  const homeHasEvent = state.parentEventPendingThisWeek && getAvailableHomeEvents(state).length > 0;
  // met NPC 목록 — NpcSelectModal memo 안정성 위해 npcs ref 변경 시에만 재계산
  const metNpcs = useMemo(() => state.npcs.filter(n => n.met), [state.npcs]);

  // memo된 자식들에게 넘기는 콜백 — 안정 ref 보장
  const handleOpenHome = useCallback(() => setShowHomeModal(true), []);

  // 친밀도/상황 기반 NPC 인사말 — getNpcDialogue 내부 Math.random()으로 인해
  // 부모 리렌더(예: lastReaction)마다 호출하면 modal 표시 중 텍스트가 flickering.
  // state 스냅샷 + NPC 식별자가 안정한 동안 dialogue 고정 (state ref 가 바뀌면 재추첨).
  const npcDetail = npcDetailFor ? state.npcs.find(n => n.id === npcDetailFor) : null;
  const npcDialogue = useMemo(
    () => npcDetail ? getNpcDialogue(npcDetail.id, npcDetail.intimacy, state) : '',
    [npcDetail?.id, npcDetail?.intimacy, state],
  );

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
      <div
        onClick={() => isClickable && onClick!()}
        className={shouldHighlight ? 'slot-pulse' : ''}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
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
      </div>
    );
  };

  const handleConfirm = () => {
    if (confirmLockRef.current) return;
    // 주말 활동 미선택 시 확인 팝업
    if (!state.isVacation && selectedActivities.length === 0) {
      if (!window.confirm('주말 활동을 선택하지 않았어요!\n정말 이번 주말은 쉴까요?')) {
        return;
      }
    }
    confirmLockRef.current = true;
    setTimeout(() => { confirmLockRef.current = false; }, 500);
    onConfirmWeek(selectedActivities, npcChoices);
    setSelectedActivities([]); setNpcChoices({}); setLastReaction(null);
  };

  // NPC 선택 모달에서 친구 선택 — 슬롯/레거시 분기 후 활동·동행 기록
  const handleSelectNpc = (npcId: string) => {
    if (!npcSelectFor) return;
    const isSlotBased = npcSelectFor.startsWith('slot:');
    const slotIdx = isSlotBased ? parseInt(npcSelectFor.split(':')[1]) : -1;
    const activityId = isSlotBased ? npcSelectFor.split(':')[2] : npcSelectFor;
    if (isSlotBased) {
      const newArr = [...selectedActivities];
      newArr[slotIdx] = activityId;
      setSelectedActivities(newArr);
      setNpcChoices({ ...npcChoices, [`${activityId}:${slotIdx}`]: npcId });
    } else {
      setNpcChoices({ ...npcChoices, [npcSelectFor]: npcId });
      setSelectedActivities([...selectedActivities, npcSelectFor]);
    }
    setLastReaction(getActivityReaction(activityId));
    setNpcSelectFor(null);
  };

  const handleTalkNpc = (npcId: string) => {
    const r = onTalkNpc(npcId);
    if (r.kind === 'event') { setMiniTalkResult(r.event); setNpcSmalltalk(null); }
    else { setNpcSmalltalk(r.line); }
  };

  const handleTalkHome = () => {
    const r = onTalkHome();
    if (r.kind === 'event') { setMiniTalkResult(r.event); setHomeSmalltalk(null); }
    else { setHomeSmalltalk(r.line); }
  };

  return (
    <>
    <BgWrapper {...bgProps}>
      {/* HUD 상단 */}
      <HudPanel
        parents={state.parents}
        gender={state.gender}
        mentalStat={state.stats.mental}
        mentalState={state.mentalState}
        year={state.year}
        fatigue={state.fatigue}
        money={state.money}
        isVacation={state.isVacation}
        parentBonusesApplied={state.weekLog?.parentBonusesApplied}
        mood={bgProps.bg.mood}
        weekInfo={weekInfo}
        month={month}
        fatigueColor={fatigueColor}
        fatigueLabel={fatigueLabel}
        weeklyActivityCost={weeklyActivityCost}
        weeklyOverBudget={weeklyOverBudget}
        onOpenHome={handleOpenHome}
      />

      {/* 독백 말풍선 */}
      <div style={{
        background: 'rgba(42,34,48,0.88)', backdropFilter: 'blur(6px)',
        borderRadius: '4px 12px 12px 12px', padding: '8px 14px', marginBottom: 10,
        fontSize: '0.82rem', fontStyle: 'italic', color: 'var(--text-secondary)',
        whiteSpace: 'pre-line', wordBreak: 'keep-all', overflowWrap: 'break-word',
      }}>
        {lastReaction ? `"${breakSentences(lastReaction)}"` : `"${breakSentences(dialogue)}"`}
      </div>

      {/* 다가오는 이벤트 배너 */}
      {upcomingEvents.length > 0 && (
        <div style={{
          background: 'rgba(224,138,91,0.15)', border: '1px solid rgba(224,138,91,0.3)',
          borderRadius: 10, padding: '8px 14px', marginBottom: 10,
          fontSize: '0.8rem', fontWeight: 600, textAlign: 'center',
          color: 'var(--accent-soft)',
        }}>
          {upcomingEvents.map((e, i) => (
            <div key={i}>📌 {e}</div>
          ))}
        </div>
      )}

      {/* 스탯 (접기/펼치기) */}
      <StatsPanel stats={state.stats} />

      {/* ===== 주간 플래너 ===== */}
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

        {/* 학기 중: 주중 | 주말 가로 2단 */}
        {!state.isVacation && (
          <div style={{ display: 'flex', gap: 8 }}>
            {/* 왼쪽: 주중 */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>주중 (월~금)</div>
              {renderSlot('🏫', '오전', '학교', null, true)}
              {renderSlot('🏫', '오후', '학교', null, true)}
              {renderSlot(
                state.routineSlot2 ? '📚' : '❓',
                '방과후',
                state.routineSlot2 ? ACTIVITIES.find(a => a.id === state.routineSlot2)?.name || null : null,
                () => setEditingSlot('routine1'),
                false, true,
                (() => { const r = state.routineSlot2 ? ACTIVITIES.find(a => a.id === state.routineSlot2) : null; return r ? getActivityCost(r, state.year) : undefined; })(),
                undefined,
                slot2ComboWeeks,
              )}
              {renderSlot(
                state.routineSlot3 ? '🌙' : '🕊️',
                '저녁',
                state.routineSlot3 ? ACTIVITIES.find(a => a.id === state.routineSlot3)?.name || null : (state.routineSlot2 ? '자유시간' : null),
                () => setEditingSlot('routine2'),
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
                  setEditingSlot('weekend1');
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
                  isSlot0TwoSlot ? null : () => setEditingSlot('weekend2'),
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
                middle: '방학이 시작됐지만, 숙제와 학원 일정표가 먼저 눈에 들어왔다.',
                high: '방학이라는 말이 예전처럼 가볍게 들리지는 않았다.',
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
                    setEditingSlot(`weekend${i + 1}`);
                  },
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* 슬롯 편집 팝업 */}
      {editingSlot && (
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
                  {editingSlot?.startsWith('routine') ? '매주 반복되는 루틴을 골라주세요' : '이번 주말에 할 활동을 골라주세요'}
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
                                parseInt((editingSlot || '').replace('weekend', '')) - 1;
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
                    if (SOCIAL_ACTIVITIES.includes(id)) {
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
                maxSlots={editingSlot?.startsWith('routine') ? 1 : maxSlots}
                currentSlots={editingSlot?.startsWith('routine') ? 0 : (() => {
                  // 편집 중인 슬롯의 활동을 제외한 슬롯 수 계산
                  const idx = editingSlot === 'weekend1' ? 0 :
                              editingSlot === 'weekend2' ? 1 :
                              parseInt((editingSlot || '').replace('weekend', '')) - 1;
                  const editingAct = selectedActivities[idx];
                  const editingSlots = editingAct ? (activities.find(x => x.id === editingAct)?.slots || 0) : 0;
                  return currentSlots - editingSlots;
                })()}
                state={state}
                npcChoices={npcChoices}
                compact={false}
                availableMoney={state.money - routineCost -
                  selectedInstances.reduce((sum, act) => sum + getActivityCost(act, state.year), 0)
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* NPC 관계 — 만난 친구만 표시 */}
      {state.npcs.some(n => n.met) && (
        <div data-tutorial="npc" style={{ background: 'rgba(42,34,48,0.85)', backdropFilter: 'blur(6px)', borderRadius: 12, padding: '10px 14px', marginBottom: 10 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 10 }}>👥 친구</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {state.npcs.filter(n => n.met).map(n => {
              const intimacyColor = n.intimacy >= 70 ? 'var(--accent-soft)' : n.intimacy >= 40 ? 'var(--yellow)' : 'var(--text-muted)';
              const intimacyLabel = n.intimacy >= 70 ? '절친' : n.intimacy >= 40 ? '친구' : '아는 사이';
              return (
                <div key={n.id}
                  onClick={() => setNpcDetailFor(n.id)}
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
                      <span style={{ fontSize: '0.65rem', color: intimacyColor, whiteSpace: 'nowrap' }}>
                        {intimacyLabel}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* NPC 선택 모달 */}
      {npcSelectFor && (
        <NpcSelectModal
          metNpcs={metNpcs}
          year={state.year}
          npcSelectFor={npcSelectFor}
          onSelect={handleSelectNpc}
          onCancel={() => setNpcSelectFor(null)}
        />
      )}

      {/* NPC 상세 모달 */}
      {npcDetail && (
        <NpcDetailModal
          npc={npcDetail}
          year={state.year}
          dialogue={npcDialogue}
          smalltalk={npcSmalltalk}
          onTalk={() => handleTalkNpc(npcDetail.id)}
          onClose={() => { setNpcDetailFor(null); setNpcSmalltalk(null); }}
        />
      )}

      {/* 가정 모달 */}
      {showHomeModal && (
        <HomeModal
          parents={state.parents}
          smalltalk={homeSmalltalk}
          hasEvent={homeHasEvent}
          onTalk={handleTalkHome}
          onClose={() => { setShowHomeModal(false); setHomeSmalltalk(null); }}
        />
      )}

      {/* 미니 이벤트 결과 모달 */}
      {miniTalkResult && (
        <MiniTalkModal
          result={miniTalkResult}
          year={state.year}
          onDismiss={() => setMiniTalkResult(null)}
          onCloseAll={() => { setMiniTalkResult(null); setNpcDetailFor(null); setShowHomeModal(false); }}
        />
      )}

      {/* 상점 버튼 */}
      <div
        onClick={() => { setShowShop(true); setNpcDetailFor(null); setNpcSelectFor(null); }}
        style={{
          background: 'rgba(42,34,48,0.85)', backdropFilter: 'blur(6px)',
          borderRadius: 12, padding: '10px 14px', marginBottom: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', border: '1px solid rgba(224,179,84,0.15)',
          transition: 'all 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.1rem' }}>🛒</span>
          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>상점</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--yellow)' }}>💰 {Number.isInteger(state.money) ? state.money : state.money.toFixed(1)}만원</div>
          {(state.activeBuffs || []).length > 0 && (
            <div style={{ fontSize: '0.6rem', color: 'var(--blue)' }}>
              버프 {state.activeBuffs.length}개 활성
            </div>
          )}
        </div>
      </div>

      {/* 선택 안내 메시지 */}
      {currentSlots === 0 && !routineTooExpensive && (state.isVacation || state.routineSlot2) && (
        <div style={{
          textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)',
          padding: '6px 12px', marginBottom: 4,
          background: 'rgba(255,255,255,0.08)', borderRadius: 8,
        }}>
          {state.isVacation
            ? '위의 빈 슬롯을 탭해서 방학 활동을 선택하세요!'
            : '주말 활동을 선택하지 않으면 자동으로 휴식합니다.'}
        </div>
      )}

      {/* 확정 버튼 */}
      <div data-tutorial="confirm" style={{ paddingBottom: 20 }}>
        <button className="btn btn-primary"
          disabled={(!state.isVacation && !state.routineSlot2) || !!routineTooExpensive}
          onClick={handleConfirm}
        >
          {routineTooExpensive
            ? '⬆ 돈이 부족해요 — 루틴을 변경하세요'
            : !state.isVacation && !state.routineSlot2
              ? '⬆ 먼저 방과후 루틴을 설정하세요'
              : currentSlots === 0
                ? (state.isVacation ? '이번 주는 쉰다' : '주말은 쉰다')
                : '이번 주 확정 →'}
        </button>
      </div>

    </BgWrapper>

    {/* 상점 */}
    {showShop && (
      <Shop
        state={state}
        onBuy={(item: ShopItem, npcId?: string) => onBuyItem(item, npcId)}
        onClose={() => setShowShop(false)}
      />
    )}
    {/* 튜토리얼 — 슬롯 편집 중엔 CSS로만 숨김 (언마운트하면 step 리셋됨) */}
    {showTutorial && (
      <div style={{ display: editingSlot ? 'none' : 'contents' }}>
      <Tutorial
        routineSet={!!state.routineSlot2}
        onComplete={() => {
          setShowTutorial(false);
          try { localStorage.setItem('lifetrack_tutorial_done', '1'); } catch { /* storage unavailable */ }
        }}
      />
      </div>
    )}
    </>
  );
}
