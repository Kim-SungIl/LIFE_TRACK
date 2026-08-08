import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GameState, STAT_LABELS } from '../../../engine/types';
import { getWeekLabel, getMonthLabel, predictWeekOutcome } from '../../../engine/gameEngine';
import { getAvailableActivities, ACTIVITIES, getActivityCost, collapseActivityChoices } from '../../../engine/activities';
import { getParentMods } from '../../../engine/parentModifiers';
import { getExamSchedule } from '../../../engine/examSystem';
import { getCharacterDialogue, getActivityReaction, getNpcDialogue } from '../../../engine/dialogues';
import { MiniTalkEvent, getAvailableHomeEvents, getEligibleParentClimax } from '../../../engine/talkSystem';
import { ShopItem } from '../../../engine/shopSystem';
import { TalkActionResult, getLastSavedAt } from '../../../engine/store';
import { isNpcEnrolled, isNpcInteractable, relationshipSignal } from '../../../engine/relationshipSignals';
import { Shop } from '../../Shop';
import { Dialog } from '../../Dialog';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Tutorial } from '../../Tutorial';
import { BgWrapper, ScreenBgProps } from '../BgWrapper';
import { breakSentences, getFatigueDisplay, getUpcomingEvents } from '../shared';
import { HudPanel } from './HudPanel';
import { StatsPanel } from './StatsPanel';
import { StageBriefingCard } from './StageBriefingCard';
import { ExamTimeline } from './ExamTimeline';
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
  // localStorage 저장 실패 여부 — true면 진행 손실 경고 배너 (store.isStorageSaveFailed)
  saveFailed?: boolean;
};

export function MainWeekScreen({ state, bgProps, onSetRoutine, onTalkNpc, onTalkHome, onResolveParentChoice, onBuyItem, onConfirmWeek, onOpenAlbum, saveFailed }: Props) {
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
    // ever_seen은 새 게임에도 유지되는 영속 플래그 — 한 번이라도 튜토리얼을 본/건너뛴 반복 플레이어는 자동 스킵.
    // (startGame이 매번 지우는 tutorial_done과 달리 wipe하지 않음)
    try {
      return !localStorage.getItem('lifetrack_tutorial_done')
        && !localStorage.getItem('lifetrack_tutorial_ever_seen');
    } catch { return false; }
  });
  // A-3: 확정 버튼 더블탭 락 — 렌더 갱신 사이 빠른 두 번째 클릭으로 processWeek가 두 번 도는 것 차단
  const confirmLockRef = useRef(false);
  // 주말 활동 미선택 확인 — window.confirm 대체(Phase 3)
  const [showRestConfirm, setShowRestConfirm] = useState(false);
  // 한 번이라도 "쉬어갈게요"를 고르면 이후로는 안 묻는다. 주말을 비우는 건 오조작이 아니라
  // 유효한 수(구간에 따라 최적해)인데, 확정할 때마다 되묻으면 최적 플레이에만 336주 내내
  // 추가 탭이 붙는다. tutorial_ever_seen과 같은 "한 번 배웠으면 그만 가르친다" 플래그.
  const [restAcked, setRestAcked] = useState(() => {
    try { return !!localStorage.getItem('lifetrack_rest_ack'); } catch { return false; }
  });
  // 친구 관계 시트 — 진입카드에서 열림(Phase 5 IA)
  const [showRelations, setShowRelations] = useState(false);

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
  // 확정 가능 여부 — 프리뷰 노출/버튼 disabled 공용 판정 (SSOT).
  const confirmDisabled = (!state.isVacation && !state.routineSlot2) || !!routineTooExpensive;

  // Phase 2 — 확정 시 예상 결과 프리뷰. 순수 processWeek 재실행 diff(gameEngine).
  // 계획(루틴/주말선택/동행)·현재 상태가 바뀔 때만 재계산.
  const weekPreview = useMemo(
    () => predictWeekOutcome(state, selectedActivities, npcChoices),
    [state, selectedActivities, npcChoices],
  );

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
  // Y7 수능 D-day — 스케줄 SSOT에서 수능 주차 조회. 지나면 숨김(null).
  const suneungWeek = state.year === 7
    ? Object.entries(getExamSchedule(state.year)).find(([, t]) => t === 'suneung')
    : undefined;
  const suneungWeeksLeft = suneungWeek && state.week <= Number(suneungWeek[0])
    ? Number(suneungWeek[0]) - state.week : null;
  // 가정 모달 배지 — pending 이어도 풀이 비면 잡담으로 빠지므로, 실제 남은 이벤트가 있을 때만 true.
  // Phase 4B: 발동 가능한 강점 절정이 있으면 pending과 무관하게 배지를 켠다(놓침 방지).
  const homeHasEvent = getEligibleParentClimax(state) != null
    || (state.parentEventPendingThisWeek && getAvailableHomeEvents(state).length > 0);
  // 동행 후보 = met + 재적(같은 학교) — 전출 도윤/졸업 공백기 하은은 주말 동행에서 제외.
  // NpcSelectModal memo 안정성 위해 npcs ref(+ 재적 판정 입력인 year/events) 변경 시에만 재계산.
  const companionNpcs = useMemo(
    () => state.npcs.filter(n => n.met && isNpcEnrolled(n, state)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.npcs, state.year, state.events],
  );

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

  // 확정 본처리 — 더블탭 락 후 주 진행. 확인 다이얼로그 통과분과 공용.
  // 락 체크를 여기서도 — 다이얼로그 확인 버튼은 handleConfirm 게이트를 안 거치므로(초고속 더블탭 방어).
  const proceedConfirm = () => {
    if (confirmLockRef.current) return;
    confirmLockRef.current = true;
    setTimeout(() => { confirmLockRef.current = false; }, 500);
    onConfirmWeek(selectedActivities, npcChoices);
    setSelectedActivities([]); setNpcChoices({}); setLastReaction(null);
  };

  const handleConfirm = () => {
    if (confirmLockRef.current) return;
    // 주말 활동 미선택 시 확인 — 인게임 다이얼로그(Phase 3). 이미 한 번 확인한 플레이어에겐 안 묻는다.
    if (!state.isVacation && selectedActivities.length === 0 && !restAcked) {
      setShowRestConfirm(true);
      return;
    }
    proceedConfirm();
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
        suneungWeeksLeft={suneungWeeksLeft}
        onOpenHome={handleOpenHome}
        onOpenAlbum={onOpenAlbum}
      />

      {/* 저장 실패 경고 — 진행 손실을 사용자가 모른 채 지나가지 않게 (storage full/사파리 프라이빗 등) */}
      {saveFailed && (
        <div role="alert" aria-live="assertive" style={{
          background: 'rgba(217,100,88,0.15)', border: '1px solid rgba(217,100,88,0.4)',
          borderRadius: 10, padding: '8px 14px', marginBottom: 10,
          fontSize: '0.75rem', fontWeight: 600, textAlign: 'center', color: 'var(--red)',
        }}>
          ⚠️ 진행 상황이 저장되지 않았어요 — 브라우저 저장 공간을 확인해 주세요
        </div>
      )}
      {/* 자동 저장 인디케이터 — "저장됐는지" 신뢰 회복. 라이브 텍스트는 '자동 저장됨' 고정(스팸 방지),
          시각은 aria-hidden으로 시각 전용. */}
      {!saveFailed && getLastSavedAt() && (
        <div aria-live="polite" style={{
          textAlign: 'center', fontSize: '0.66rem', color: 'var(--text-muted)',
          marginTop: -4, marginBottom: 10,
        }}>
          💾 자동 저장됨
          <span aria-hidden="true"> · {new Date(getLastSavedAt()!).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}

      {/* 독백 말풍선 */}
      <div style={{
        background: 'rgba(42,34,48,0.88)', backdropFilter: 'blur(6px)',
        borderRadius: '4px 12px 12px 12px', padding: '8px 14px', marginBottom: 10,
        fontSize: '0.82rem', fontStyle: 'italic', color: 'var(--text-secondary)',
        whiteSpace: 'pre-line', wordBreak: 'keep-all', overflowWrap: 'break-word',
      }}>
        {lastReaction ? `"${breakSentences(lastReaction)}"` : `"${breakSentences(dialogue)}"`}
      </div>

      {/* 진학 브리핑 — 스테이지 전환 학년(Y2/Y5/Y7) 첫 2주 한정 */}
      <StageBriefingCard state={state} />

      {/* 다가오는 이벤트 배너 */}
      {upcomingEvents.length > 0 && (
        <div style={{
          background: 'rgba(224,138,91,0.15)', border: '1px solid rgba(224,138,91,0.3)',
          borderRadius: 10, padding: '8px 14px', marginBottom: 10,
          fontSize: '0.8rem', fontWeight: 600, textAlign: 'center',
          color: 'var(--accent-soft)',
        }}>
          {upcomingEvents.map((e, i) => (
            <div key={i} style={e.tone === 'warn' ? { color: 'var(--yellow)' } : undefined}>
              {e.tone === 'warn' ? '⚠️' : '📌'} {e.text}
            </div>
          ))}
        </div>
      )}

      {/* 연간 시험 스트립 — 시험 밀도(초2 vs 고6+수능)의 상시 노출 */}
      <ExamTimeline year={state.year} week={state.week} />

      {/* 스탯 (접기/펼치기) */}
      <StatsPanel stats={state.stats} year={state.year} />

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

      {/* NPC 관계 — 진입카드 요약(1줄) → 탭 시 하단 시트로 전체 리스트 (Phase 5 IA).
          의사결정 단서(방치 친구 경고 / 절친)는 요약에 남겨 한눈 비교 보존. */}
      {(() => {
        const metNpcs = state.npcs.filter(n => n.met);
        if (metNpcs.length === 0) return null;
        // 부재(전출·졸업) 친구는 챙길 수 없다 — 말 걸기가 막혀 lastInteractionWeek 갱신 수단이 없으므로
        // warn cue에 올리면 해소 불가능한 잔소리가 된다(전출만 걸러선 졸업한 하은이 통과했다).
        const present = metNpcs.filter(n => isNpcInteractable(n, state));
        // 상태 라벨(절친/친구)은 '지훈 친구'처럼 어색해서 제거(사용자 피드백).
        // 챙길 친구(방치 warn)가 있을 때만 행동 단서를 남긴다.
        const warnFriend = present.find(n => relationshipSignal(n, state)?.tone === 'warn');
        const cue = warnFriend
          ? { text: `⚠️ ${warnFriend.name} 챙기기`, color: 'var(--yellow)' }
          : null;
        return (
          <button
            type="button" className="btn-reset" data-tutorial="npc"
            onClick={() => setShowRelations(true)}
            aria-haspopup="dialog"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', background: 'rgba(42,34,48,0.85)', backdropFilter: 'blur(6px)',
              borderRadius: 12, padding: '10px 14px', marginBottom: 10, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.05)', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>👥 친구 {metNpcs.length}명</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem' }}>
              {cue && <span style={{ color: cue.color, fontWeight: 600 }}>{cue.text}</span>}
              <span style={{ color: 'var(--text-muted)' }}>›</span>
            </span>
          </button>
        );
      })()}

      {/* NPC 선택 모달 */}
      {npcSelectFor && (
        <NpcSelectModal
          metNpcs={companionNpcs}
          year={state.year}
          npcSelectFor={npcSelectFor}
          onSelect={handleSelectNpc}
          onCancel={() => setNpcSelectFor(null)}
        />
      )}

      {/* 친구 관계 시트 — 진입카드에서 열림. 기존 NpcRelationPanel 재사용, 탭하면 상세로 */}
      {showRelations && (
        <Dialog
          onClose={() => setShowRelations(false)}
          align="bottom" maxWidth={600} ariaLabel="친구 관계"
          contentStyle={{
            background: 'var(--bg-secondary)', borderRadius: '16px 16px 0 0',
            padding: '10px 14px 20px', maxHeight: '80dvh', overflowY: 'auto',
          }}
        >
          <NpcRelationPanel state={state} onSelect={(id) => { setShowRelations(false); setNpcDetailFor(id); }} />
        </Dialog>
      )}

      {/* NPC 상세 모달 */}
      {npcDetail && (
        <NpcDetailModal
          npc={npcDetail}
          state={state}
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
      <button
        type="button" className="btn-reset"
        onClick={() => { setShowShop(true); setNpcDetailFor(null); setNpcSelectFor(null); }}
        style={{
          background: 'rgba(42,34,48,0.85)', backdropFilter: 'blur(6px)',
          borderRadius: 12, padding: '10px 14px', marginBottom: 10, width: '100%',
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
      </button>

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

      {/* Phase 2 — 확정 전 예상 결과 프리뷰 (계획 확정 가능할 때만) */}
      {!confirmDisabled && (() => {
        const p = weekPreview;
        // Phase 6: 정확 수치(45→62 (+17)) 대신 방향 + 결과 상태 라벨 — 계산기화 완화,
        // '선택의 무게' 신호(더 지침/회복·번아웃 위험)는 유지. 상세 델타는 주간 결산에서.
        const afterDisplay = getFatigueDisplay(p.fatigueAfter);
        const fatigueDir = p.fatigueDelta > 0 ? 'up' : p.fatigueDelta < 0 ? 'down' : 'flat';
        return (
          <div aria-live="polite" style={{
            marginBottom: 8, padding: '9px 14px', borderRadius: 10,
            background: p.burnoutRisk ? 'rgba(214,110,110,0.10)' : 'rgba(255,255,255,0.05)',
            border: p.burnoutRisk ? '1px solid rgba(214,110,110,0.35)' : '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>😴 예상 피로</span>
              <span role="img" aria-label={fatigueDir === 'up' ? '늘어남' : fatigueDir === 'down' ? '줄어듦' : '유지'} style={{ color: fatigueDir === 'up' ? 'var(--red)' : fatigueDir === 'down' ? 'var(--green)' : 'var(--text-muted)', fontWeight: 700 }}>
                {fatigueDir === 'up' ? '↑' : fatigueDir === 'down' ? '↓' : '→'}
              </span>
              <span style={{ color: afterDisplay.color, fontWeight: 700 }}>{afterDisplay.label}</span>
              {p.burnoutRisk && (
                <span style={{ color: 'var(--red)', fontSize: '0.72rem', fontWeight: 700 }}>⚠️ 번아웃 위험</span>
              )}
            </div>
            {/* 스탯 힌트 — 더 조용하게: 초록 강조 제거, 전부 muted 위스퍼 톤(hide-numbers). 방향만 은은히. */}
            {p.statHints.length > 0 && (
              <div style={{ marginTop: 3, fontSize: '0.68rem', color: 'var(--text-muted)', opacity: 0.85, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {p.statHints.map(h => (
                  <span key={h.key} aria-label={`${STAT_LABELS[h.key]} ${h.dir === 'up' ? '오름' : '내림'}`}>
                    {STAT_LABELS[h.key]} <span aria-hidden="true">{h.dir === 'up' ? '↑' : '↓'}</span>
                  </span>
                ))}
              </div>
            )}
            <div style={{ marginTop: 3, fontSize: '0.66rem', color: 'var(--text-muted)', opacity: 0.8 }}>
              이벤트 결과에 따라 달라질 수 있어요
            </div>
          </div>
        );
      })()}

      {/* 고정 CTA 높이만큼 스크롤 여백 확보 — 마지막 콘텐츠(프리뷰)가 하단 바에 가리지 않도록 */}
      <div aria-hidden="true" style={{ height: 'calc(80px + env(safe-area-inset-bottom))' }} />

      {/* 확정 버튼 — 하단 고정(sticky CTA). .bottom-action = position:fixed + safe-area */}
      <div data-tutorial="confirm" className="bottom-action">
        <button className="btn btn-primary"
          disabled={confirmDisabled}
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
    {/* 주말 활동 미선택 확인 (window.confirm 대체).
        문구 주의: 피로 자연 회복(applyFatigueRecovery)은 슬롯과 무관하게 매주 돈다 —
        비운다고 "더 회복"되는 게 아니라 활동이 얹는 피로가 안 붙는 것이다. 문구도 그 사실대로. */}
    {showRestConfirm && (
      <ConfirmDialog
        title="이번 주말은 쉬어요"
        message={'채우지 않은 주말은 그만큼 피로가 덜 쌓여요.\n쉬는 것도 한 주의 선택이에요.'}
        confirmLabel="쉬어갈게요"
        cancelLabel="활동 고를래요"
        onConfirm={() => {
          setShowRestConfirm(false);
          setRestAcked(true);
          try { localStorage.setItem('lifetrack_rest_ack', '1'); } catch { /* 저장 실패해도 진행엔 영향 없음 */ }
          proceedConfirm();
        }}
        onCancel={() => setShowRestConfirm(false)}
      />
    )}
    {/* 튜토리얼 — 슬롯 편집 중엔 CSS로만 숨김 (언마운트하면 step 리셋됨) */}
    {showTutorial && (
      <div style={{ display: editingSlot ? 'none' : 'contents' }}>
      <Tutorial
        routineSet={!!state.routineSlot2}
        onComplete={() => {
          setShowTutorial(false);
          // done(이번 게임) + ever_seen(영속) 동시 세팅 — 완료/건너뛰기 후 반복 플레이는 자동 스킵.
          try {
            localStorage.setItem('lifetrack_tutorial_done', '1');
            localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
          } catch { /* storage unavailable */ }
        }}
      />
      </div>
    )}
    </>
  );
}
