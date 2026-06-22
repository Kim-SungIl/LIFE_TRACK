import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GameState } from '../../../engine/types';
import { getWeekLabel, getMonthLabel } from '../../../engine/gameEngine';
import { getAvailableActivities, ACTIVITIES, getActivityCost, collapseActivityChoices } from '../../../engine/activities';
import { getParentMods } from '../../../engine/parentModifiers';
import { getCharacterDialogue, getActivityReaction, getNpcDialogue } from '../../../engine/dialogues';
import { MiniTalkEvent, getAvailableHomeEvents, getEligibleParentClimax } from '../../../engine/talkSystem';
import { ShopItem } from '../../../engine/shopSystem';
import { TalkActionResult } from '../../../engine/store';
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
import { WeekPlanner } from './WeekPlanner';
import { SlotEditPopup } from './SlotEditPopup';
import { NpcRelationPanel } from './NpcRelationPanel';

type Props = {
  state: GameState;
  bgProps: ScreenBgProps;
  onSetRoutine: (slot2: string | null, slot3: string | null) => void;
  onTalkNpc: (npcId: string) => TalkActionResult;
  onTalkHome: () => TalkActionResult;
  onResolveParentChoice: (eventId: string, choiceIdx: number) => void;
  onBuyItem: (item: ShopItem, npcId?: string) => void;
  // 주 확정 — 선택/루틴 choice 와 NPC 동행을 store 에 반영하고 주간 결산으로 전환 (GameScreen 오케스트레이션)
  onConfirmWeek: (activities: string[], npcChoices: Record<string, string>) => void;
  // 기록장 열기 — 2학년 이상에서만 전달(완료 학년 존재). undefined면 HUD에서 버튼 숨김.
  onOpenAlbum?: () => void;
};

export function MainWeekScreen({ state, bgProps, onSetRoutine, onTalkNpc, onTalkHome, onResolveParentChoice, onBuyItem, onConfirmWeek, onOpenAlbum }: Props) {
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
    // state 전체가 아닌 primitive만 deps — 말걸기 등 로컬 state 변경 시 재추첨 방지(위 주석)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // 루틴 콤보 표시 — 슬롯별 카운터 (한 슬롯만 변경 시 다른 슬롯 보너스 보전).
  // routineComboLabel 은 WeekPlanner 가 maxComboWeeks 로 내부 계산하므로 여기선 카운터만.
  const slot2ComboWeeks = !state.isVacation && state.routineSlot2Weeks >= 3 ? state.routineSlot2Weeks : 0;
  const slot3ComboWeeks = !state.isVacation && state.routineSlot3Weeks >= 3 ? state.routineSlot3Weeks : 0;
  const maxComboWeeks = Math.max(slot2ComboWeeks, slot3ComboWeeks);

  const upcomingEvents = getUpcomingEvents(state);
  // 가정 모달 배지 — pending 이어도 풀이 비면 잡담으로 빠지므로, 실제 남은 이벤트가 있을 때만 true.
  // Phase 4B: 발동 가능한 강점 절정이 있으면 pending과 무관하게 배지를 켠다(놓침 방지).
  const homeHasEvent = getEligibleParentClimax(state) != null
    || (state.parentEventPendingThisWeek && getAvailableHomeEvents(state).length > 0);
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
    // npcDetail은 id/intimacy로 풀어서 추적 — 객체 ref 변경에 흔들리지 않게(위 주석)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [npcDetail?.id, npcDetail?.intimacy, state],
  );

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
        onOpenAlbum={onOpenAlbum}
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
      <WeekPlanner
        state={state}
        selectedActivities={selectedActivities}
        setSelectedActivities={setSelectedActivities}
        npcChoices={npcChoices}
        onEditSlot={setEditingSlot}
        routineTooExpensive={!!routineTooExpensive}
        routineCost={routineCost}
        maxComboWeeks={maxComboWeeks}
        slot2ComboWeeks={slot2ComboWeeks}
        slot3ComboWeeks={slot3ComboWeeks}
        maxSlots={maxSlots}
      />

      {/* 슬롯 편집 팝업 */}
      {editingSlot && (
        <SlotEditPopup
          editingSlot={editingSlot}
          setEditingSlot={setEditingSlot}
          state={state}
          activities={activities}
          selectedActivities={selectedActivities}
          setSelectedActivities={setSelectedActivities}
          npcChoices={npcChoices}
          maxSlots={maxSlots}
          currentSlots={currentSlots}
          availableMoney={state.money - routineCost -
            selectedInstances.reduce((sum, act) => sum + getActivityCost(act, state.year), 0)}
          onSetRoutine={onSetRoutine}
          setNpcSelectFor={setNpcSelectFor}
          setLastReaction={setLastReaction}
        />
      )}

      {/* NPC 관계 — 만난 친구만 표시 */}
      <NpcRelationPanel npcs={state.npcs} year={state.year} onSelect={setNpcDetailFor} />

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
          onSelectChoice={(idx) => onResolveParentChoice(miniTalkResult.id, idx)}
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
