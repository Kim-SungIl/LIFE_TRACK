import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameStore } from '../engine/store';
import { getWeekLabel, getMonthLabel } from '../engine/gameEngine';
import { getExamSchedule } from '../engine/examSystem';
import { getAvailableActivities, ACTIVITIES, getActivityCost, collapseActivityChoices } from '../engine/activities';
import { getParentMods } from '../engine/parentModifiers';
import { StatKey, STAT_LABELS, getGrade, STAT_FLAVOR_LABELS, EXAM_TYPE_LABELS, ParentStrength } from '../engine/types';
import { MiniTalkEvent } from '../engine/talkSystem';
import { Portrait } from './Portrait';
import { STAT_DESCRIPTIONS } from '../engine/statDescriptions';
import { ActivityPicker } from './ActivityPicker';
import { getBackground, getSchoolLevel } from '../engine/backgrounds';
import { getCharacterDialogue, getActivityReaction, getNpcDialogue, getResultDialogue } from '../engine/dialogues';
import { Tutorial } from './Tutorial';
import { Shop } from './Shop';
import { ShopItem } from '../engine/shopSystem';
import { EventScene } from './EventScene';
import { prefetchAssets } from '../engine/assetPrefetch';
import { BgWrapper } from './screens/BgWrapper';
import { STAT_ICONS, breakSentences, type EventResultData } from './screens/shared';
import { YearEndScreen } from './screens/YearEndScreen';
import { EndingScreen } from './screens/EndingScreen';
import { EventResultScreen } from './screens/EventResultScreen';
import { WeeklyResultScreen } from './screens/WeeklyResultScreen';

export function GameScreen() {
  const { state, setWeekendChoices, setVacationChoices, setRoutine, advanceWeek, advanceFromYearEnd, resolveEvent, setNpcActivityMap, buyItem, talkToNpc, talkToHome } = useGameStore();

  // 뒤로가기/새로고침 방지
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    // 브라우저 뒤로가기 방지: history에 더미 항목 추가
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // 엔딩 도달 시 클리어 플래그 저장 (다음 플레이부터 도전 모드 해금)
  useEffect(() => {
    if (state?.phase === 'ending') {
      try { localStorage.setItem('lifetrack_has_cleared', '1'); } catch { /* storage unavailable */ }
    }
  }, [state?.phase]);

  // 자주 쓰는 자산 prefetch — 학년/성별 결정되면 그 학교급의 자주 쓰는 배경과
  // 플레이어 fullbody를 미리 캐시에 적재. 화면 전환 시 즉시 표시.
  useEffect(() => {
    if (!state) return;
    const level = getSchoolLevel(state.year);
    const gender = state.gender === 'male' ? 'm' : 'f';
    const elementarySuffix = state.year === 1 ? '_elementary' : '';
    prefetchAssets([
      `images/characters/player_${gender}${elementarySuffix}_fullbody.png`,
      `images/backgrounds/classroom_${level}.png`,
      `images/backgrounds/classroom_${level}_spring.png`,
      `images/backgrounds/classroom_${level}_afternoon.png`,
      `images/backgrounds/classroom_${level}_sunset.png`,
      `images/backgrounds/hallway_${level}.png`,
      `images/backgrounds/library_${level}.png`,
      `images/backgrounds/gymnasium.png`,
      `images/backgrounds/school_road_morning.png`,
      `images/backgrounds/home_evening.png`,
      `images/backgrounds/bedroom_night.png`,
    ]);
  }, [state?.gender, state?.year]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [eventResultData, setEventResultData] = useState<EventResultData | null>(null);
  const [cgLoaded, setCgLoaded] = useState(false);
  // CG 후보 cascade가 모두 실패하면 true → 배경+주인공 fallback 다시 표시
  const [cgError, setCgError] = useState(false);
  // CG가 1500ms 안에 로드 안 되면 onError cascade와 무관하게 강제 fallback (빈 화면 회피)
  // 일부 환경에서 cascade onError가 마지막까지 트리거되지 않아 영원히 빈 화면이던 케이스 보호
  useEffect(() => {
    if (!eventResultData || cgLoaded || cgError) return;
    const timer = setTimeout(() => setCgError(true), 1500);
    return () => clearTimeout(timer);
  }, [eventResultData, cgLoaded, cgError]);
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
  const [expandedStat, setExpandedStat] = useState<StatKey | null>(null);
  // 부모 칩 hover/탭 시 보여줄 설명 — 모바일 대응 위해 클릭으로도 토글
  const [activeParentTip, setActiveParentTip] = useState<string | null>(null);
  const [lastReaction, setLastReaction] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(() => {
    try { return !localStorage.getItem('lifetrack_tutorial_done'); } catch { return false; }
  });
  const [bgImgError, setBgImgError] = useState(false);
  // A-3: 확정 버튼 더블탭 락 — 렌더 갱신 사이 빠른 두 번째 클릭으로 processWeek가 두 번 도는 것 차단
  // (early return 아래에서 useRef를 호출하면 hooks order가 깨져 "Rendered fewer hooks" 에러가 난다)
  const confirmLockRef = useRef(false);

  // useMemo는 모든 early return 위에 둬야 hooks order가 안 깨진다.
  // state가 null이면 빈 문자열을 캐시 — 정상 진입 시 다시 계산됨.
  // 의존: week/year/totalWeeksPlayed (primitives) — 한 주가 진행될 때만 새 라인 뽑고,
  // 말걸기 같은 로컬 state 변경(weekLog 객체 ref 변경)에는 영향 안 받게 한다.
  const dialogue = useMemo(
    () => state ? getCharacterDialogue(state) : '',
    [state?.week, state?.year, state?.totalWeeksPlayed],
  );
  const resultDialogue = useMemo(
    () => state?.weekLog ? getResultDialogue(state, state.weekLog) : '',
    [state?.weekLog],
  );

  if (!state) return null;

  const bg = getBackground(state.week, state.isVacation, state.mentalState, state.year);
  const handleBgImgError = () => setBgImgError(true);
  const bgProps = { bg, bgImgError, onImgError: handleBgImgError };

  // ===== v1.2 학년말 일기장 (Y1~Y6) =====
  if (state.phase === 'year-end') {
    return <YearEndScreen state={state} bgProps={bgProps} onAdvance={advanceFromYearEnd} />;
  }

  // ===== 엔딩 =====
  if (state.phase === 'ending') {
    return <EndingScreen state={state} bgProps={bgProps} />;
  }

  // ===== 이벤트 화면 (비주얼 노벨 스타일) =====
  // eventResultData가 세팅돼 있으면 결과 화면을 먼저 보여준 뒤, "계속 →" 클릭 후 followup 이벤트로 넘어감
  if (state.currentEvent && state.phase === 'event' && !eventResultData) {
    return (
      <EventScene
        event={state.currentEvent}
        gender={state.gender}
        year={state.year}
        state={state}
        npcs={state.npcs.map(n => ({ id: n.id, name: n.name, met: n.met }))}
        onChoice={(index: number) => {
          const evt = state.currentEvent!;
          const choice = ((state.gender === 'female' && evt.femaleChoices) ? evt.femaleChoices : evt.choices)[index];
          const effects: Record<string, string>[] = [];
          for (const [k, v] of Object.entries(choice.effects)) {
            const val = v as number;
            if (val !== 0) effects.push({ text: `${STAT_ICONS[k as StatKey]} ${STAT_LABELS[k as StatKey]} ${val > 0 ? '+' + val : val}`, color: val > 0 ? 'var(--green)' : 'var(--red)' });
          }
          if (choice.fatigueEffect) effects.push({ text: `피로 ${choice.fatigueEffect > 0 ? '+' : ''}${choice.fatigueEffect}`, color: choice.fatigueEffect > 0 ? 'var(--red)' : 'var(--green)' });
          if (choice.moneyEffect) effects.push({ text: `💰 ${choice.moneyEffect > 0 ? '+' : ''}${choice.moneyEffect}만`, color: choice.moneyEffect > 0 ? 'var(--green)' : 'var(--red)' });
          // NPC 첫 만남 체크
          const newMeets: string[] = [];
          if (choice.npcEffects) for (const ne of choice.npcEffects) {
            const npc = state.npcs.find(n => n.id === ne.npcId);
            if (npc) {
              effects.push({ text: `${npc.emoji} ${npc.name} ${ne.intimacyChange > 0 ? '♥' : '💔'}`, color: ne.intimacyChange > 0 ? 'var(--blue)' : 'var(--red)' });
              if (!npc.met) newMeets.push(npc.name);
            }
          }
          // 첫 만남 알림 추가
          for (const name of newMeets) {
            effects.unshift({ text: `🤝 ${name}와(과) 알게 되었다!`, color: 'var(--yellow)' });
          }
          setEventResultData({ message: choice.message, effects, event: evt, choiceIndex: index });
          resolveEvent(index);
        }}
      />
    );
  }

  // ===== 이벤트 결과 — 비주얼 노벨 배경 유지 =====
  if (eventResultData) {
    return (
      <EventResultScreen
        state={state}
        eventResultData={eventResultData}
        cgLoaded={cgLoaded}
        cgError={cgError}
        onCgLoaded={() => setCgLoaded(true)}
        onCgError={() => setCgError(true)}
        onContinue={() => { setEventResultData(null); setCgLoaded(false); setCgError(false); setShowResult(true); }}
      />
    );
  }

  // ===== 메인 변수들 =====
  const weekInfo = getWeekLabel(state);
  const month = getMonthLabel(state.week);
  const maxSlots = state.isVacation ? 5 + getParentMods(state.parents).vacationSlotBonus : 2;
  const activities = getAvailableActivities(state);
  const routineIds = !state.isVacation ? [state.routineSlot2, state.routineSlot3].filter(Boolean) as string[] : [];
  // 2칸 활동은 onToggle에서 같은 id로 인접 슬롯에 중복 저장됨. 슬롯/비용 계산 시 한 인스턴스로 collapse.
  // 엔진의 vacationChoices 처리(gameEngine.ts:711)와 동일한 헬퍼 사용 — SSOT.
  const selectedInstances = collapseActivityChoices(selectedActivities)
    .map(id => activities.find(a => a.id === id))
    .filter((a): a is typeof activities[number] => !!a);
  const currentSlots = selectedInstances.reduce((s, act) => s + act.slots, 0);
  const fatigueLabel = state.fatigue < 20 ? '좋음' : state.fatigue < 35 ? '경미' : state.fatigue < 50 ? '주의' : state.fatigue < 70 ? '위험' : '극한!';
  const fatigueColor = state.fatigue < 20 ? 'var(--green)' : state.fatigue < 35 ? 'var(--yellow)' : state.fatigue < 50 ? 'orange' : 'var(--red)';

  // 루틴 비용 체크 — 돈이 부족하면 루틴 변경 강제. 학년별 차등 비용 적용.
  // 방학 중에는 엔진이 루틴을 가동하지 않으므로 (gameEngine.ts:667) 비용 0.
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
  // HUD 헤더 — 둘 중 큰 쪽 기준으로 "보너스 활성" 안내
  const maxComboWeeks = Math.max(slot2ComboWeeks, slot3ComboWeeks);
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

  // 다가오는 이벤트 계산 — 시험 스케줄 SSOT(gameEngine.getExamSchedule) 사용
  const upcomingEvents: string[] = [];
  for (const [weekStr, examType] of Object.entries(getExamSchedule(state.year))) {
    const diff = Number(weekStr) - state.week;
    if (diff > 0 && diff <= 4) upcomingEvents.push(`${EXAM_TYPE_LABELS[examType]}까지 ${diff}주`);
  }
  if (state.week >= 18 && state.week < 20) upcomingEvents.push('여름방학이 다가온다');
  if (state.week >= 40 && state.week < 43) upcomingEvents.push('겨울방학이 다가온다');

  const SOCIAL_ACTIVITIES = ['hang-out', 'club', 'study-group'];

  const toggleActivity = (id: string) => {
    const activity = activities.find(a => a.id === id);
    if (!activity) return;
    if (selectedActivities.includes(id)) {
      setSelectedActivities(selectedActivities.filter(a => a !== id));
      const nc = { ...npcChoices }; delete nc[id]; setNpcChoices(nc);
      setLastReaction(null);
    } else {
      const cur = selectedActivities.reduce((s, aid) => s + (activities.find(x => x.id === aid)?.slots || 0), 0);
      if (cur + activity.slots <= maxSlots) {
        if (SOCIAL_ACTIVITIES.includes(id)) { setNpcSelectFor(id); }
        else { setSelectedActivities([...selectedActivities, id]); setLastReaction(getActivityReaction(id)); }
      }
    }
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
    if (state.isVacation) setVacationChoices(selectedActivities);
    else setWeekendChoices(selectedActivities);
    // npcChoices를 그대로 전달 (슬롯 키 포함 — store에서 npcId만 추출)
    setNpcActivityMap(npcChoices);
    advanceWeek();
    setSelectedActivities([]); setNpcChoices({}); setShowResult(true); setLastReaction(null);
  };

  // ===== 주간 결산 =====
  if (showResult && state.weekLog) {
    return (
      <WeeklyResultScreen
        state={state}
        bgProps={bgProps}
        weekInfo={weekInfo}
        resultDialogue={resultDialogue}
        fatigueColor={fatigueColor}
        upcomingEvents={upcomingEvents}
        onContinue={() => setShowResult(false)}
      />
    );
  }

  // ===== 메인 게임 화면 =====
  return (
    <>
    <BgWrapper {...bgProps}>
      {/* HUD 상단 */}
      <div data-tutorial="hud" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <Portrait characterId={state.gender === 'male' ? 'player_m' : 'player_f'} size={52} mental={state.stats.mental} mentalState={state.mentalState} year={state.year} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '1rem', fontWeight: 700 }}>{bg.mood} {weekInfo}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{month} {state.isVacation ? '· 방학' : ''}</div>
          {state.mentalState !== 'normal' && (
            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: state.mentalState === 'burnout' ? 'var(--red)' : 'var(--yellow)' }}>
              {state.mentalState === 'burnout' ? '🔥 번아웃' : '😩 피로 상태'}
            </div>
          )}
          {/* 부모 칩 — 22×22 발동 시 펄스. 호버/탭하면 absolute popover로 설명 노출 (layout shift 방지) */}
          {/* 클릭하면 부모 모달 — 인라인 "💬 가정" 라벨로 클릭 가능 affordance 명시 */}
          <div style={{ marginTop: 4, position: 'relative' }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {state.parents.map(p => {
                const icons: Record<string, string> = {
                  emotional: '🫂', wealth: '🏠', info: '📱',
                  strict: '📐', resilience: '⭐', freedom: '🌿',
                };
                const justFired = state.weekLog?.parentBonusesApplied?.some(b => b.parent === p);
                const isActive = activeParentTip === p;
                return (
                  <span
                    key={p}
                    onMouseEnter={() => setActiveParentTip(p)}
                    onMouseLeave={() => setActiveParentTip(prev => prev === p ? null : prev)}
                    onClick={() => { setActiveParentTip(null); setShowHomeModal(true); }}
                    style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: isActive ? 'rgba(224,138,91,0.28)' : 'rgba(224,138,91,0.12)',
                      border: '1px solid rgba(224,138,91,0.4)',
                      display: 'inline-grid', placeItems: 'center', fontSize: '0.7rem',
                      cursor: 'pointer', userSelect: 'none',
                      animation: justFired ? 'parentChipPulse 0.6s ease' : 'none',
                    }}
                  >{icons[p]}</span>
                );
              })}
              {/* 클릭 가능 affordance — "💬 가정" 라벨로 진입점 명시 */}
              <span
                onClick={() => { setActiveParentTip(null); setShowHomeModal(true); }}
                style={{
                  marginLeft: 4, fontSize: '0.65rem', color: 'var(--accent-soft)',
                  cursor: 'pointer', userSelect: 'none', fontWeight: 600, letterSpacing: '0.02em',
                }}
              >💬 가정</span>
            </div>
            {activeParentTip && state.parents.includes(activeParentTip as any) && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20,
                padding: '5px 8px', borderRadius: 6,
                background: 'rgba(20,16,28,0.92)', backdropFilter: 'blur(4px)',
                border: '1px solid rgba(224,138,91,0.35)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                fontSize: '0.66rem', lineHeight: 1.4, color: 'var(--text-secondary)',
                width: 'max-content', maxWidth: 240,
                wordBreak: 'keep-all', overflowWrap: 'break-word',
                pointerEvents: 'none',
              }}>
                <strong style={{ color: 'var(--accent-soft)' }}>
                  {({
                    emotional: '🫂 정서', wealth: '🏠 여유', info: '📱 정보',
                    strict: '📐 엄격', resilience: '⭐ 체질', freedom: '🌿 자유',
                  } as Record<string, string>)[activeParentTip]}
                </strong>
                {' — '}
                {({
                  emotional: '엄마/아빠가 자주 물어봐주고 안아준다. 지친 주에 피로 회복 보조.',
                  wealth: '용돈이 풍족해 학원·도구를 부담 없이 쓸 수 있다. 매주 용돈 +6만원.',
                  info: '엄마가 학원·인강 정보를 잘 안다. 학원·자습 효율 +10%.',
                  strict: '정해진 시간에 책상 — 루틴이 한 주 더 길게 유지된다.',
                  resilience: '타고난 체력 — 피로 증가 -15%.',
                  freedom: '"알아서 해" 분위기 — 노는 주의 idle 페널티 -50%.',
                } as Record<string, string>)[activeParentTip]}
              </div>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.72rem', lineHeight: 1.6 }}>
          <div style={{ color: fatigueColor }}>피로 {Math.round(state.fatigue)} · {fatigueLabel}</div>
          <div>
            💰 {Number.isInteger(state.money) ? state.money : state.money.toFixed(1)}만원
            {weeklyActivityCost > 0 && (
              <span style={{
                marginLeft: 6, fontSize: '0.66rem', fontWeight: 600,
                color: weeklyOverBudget ? 'var(--red)' : 'var(--text-secondary)',
              }}>
                (이번 주 -{weeklyActivityCost})
              </span>
            )}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>주말 마감 시 +{getParentMods(state.parents).weeklyIncome - getParentMods(state.parents).livingCost}만원 입금</div>
        </div>
      </div>

      {/* 이벤트 배너는 주간 플래너 안으로 이동 */}

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
      <div data-tutorial="stats" style={{ background: 'rgba(42,34,48,0.85)', backdropFilter: 'blur(6px)', borderRadius: 12, padding: showStats ? '8px 12px' : '8px 12px', marginBottom: 10 }}>
        <div
          onClick={() => setShowStats(!showStats)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '2px 0' }}
        >
          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>📊 능력치</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* 접혀있을 때 미니 요약 — 텍스트로 표시 */}
            {!showStats && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(Object.keys(state.stats) as StatKey[]).map(key => {
                  const grade = getGrade(state.stats[key]);
                  return (
                    <span key={key} style={{ fontSize: '0.62rem', fontWeight: 600, color: grade.color }}>
                      {STAT_LABELS[key]}{grade.grade}
                    </span>
                  );
                })}
              </div>
            )}
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{showStats ? '▲' : '▼'}</span>
          </div>
        </div>
        {showStats && (
          <div style={{ marginTop: 6 }}>
            {(Object.keys(state.stats) as StatKey[]).map(key => {
              const grade = getGrade(state.stats[key]);
              const isExp = expandedStat === key;
              const desc = STAT_DESCRIPTIONS[key];
              return (
                <div key={key}>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '3px 0', cursor: 'pointer' }} onClick={() => setExpandedStat(isExp ? null : key)}>
                    <span style={{ width: 20, fontSize: '0.75rem' }}>{STAT_ICONS[key]}</span>
                    <span style={{ width: 28, fontSize: '0.72rem', fontWeight: 600 }}>{STAT_LABELS[key]}</span>
                    <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, margin: '0 6px', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round(state.stats[key])}%`, background: grade.color, borderRadius: 5, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ width: 16, fontSize: '0.68rem', fontWeight: 700, color: grade.color }}>{grade.grade}</span>
                    <span style={{ minWidth: 56, fontSize: '0.6rem', color: grade.color, opacity: 0.85, marginLeft: 4 }}>{STAT_FLAVOR_LABELS[key][grade.grade]}</span>
                    <span style={{ width: 22, fontSize: '0.62rem', color: 'var(--text-secondary)', textAlign: 'right' }}>{Math.round(state.stats[key])}</span>
                  </div>
                  {isExp && (
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 10px', margin: '2px 0 4px 20px', fontSize: '0.68rem', lineHeight: 1.5 }}>
                      <div style={{ color: 'var(--text-primary)' }}>{desc.what}</div>
                      <div style={{ color: 'var(--green)', marginTop: 2 }}>▲ {desc.high}</div>
                      <div style={{ color: 'var(--red)' }}>▼ {desc.low}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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
                    setEditingSlot(`weekend${i + 1}` as any);
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
              {/* 루틴 슬롯 2(저녁)에 자유시간 옵션 — 디폴트 상태(routineSlot3=null)도 강조하지 않음.
                 사용자가 명시적으로 다른 활동을 고르기 전까지 "자동 선택된" 인상 회피. */}
              {editingSlot === 'routine2' && (
                <div onClick={() => {
                  if (state.routineSlot2) { setRoutine(state.routineSlot2, null); }
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
                    setRoutine(id, state.routineSlot3 === id ? null : state.routineSlot3);
                    // routine1 설정 후 → routine2가 비어있으면 자동으로 열기
                    if (!state.routineSlot3) {
                      setEditingSlot('routine2');
                    } else {
                      setEditingSlot(null);
                    }
                  } else if (editingSlot === 'routine2') {
                    setRoutine(state.routineSlot2, id);
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
      {npcSelectFor && (() => {
        // slot:idx:activityId 형태 파싱
        const isSlotBased = npcSelectFor.startsWith('slot:');
        const slotIdx = isSlotBased ? parseInt(npcSelectFor.split(':')[1]) : -1;
        const activityId = isSlotBased ? npcSelectFor.split(':')[2] : npcSelectFor;
        const modalLabel = activityId === 'hang-out' ? '놀까' : activityId === 'study-group' ? '공부할까' : '활동할까';
        return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400 }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>누구와 {modalLabel}?</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 16 }}>함께하는 친구에 따라 친밀도가 올라갑니다</div>
            {state.npcs.filter(n => n.met).map(npc => (
              <div key={npc.id} onClick={() => {
                if (isSlotBased) {
                  // 슬롯 기반: 해당 인덱스에 활동 할당 + NPC 기록
                  const newArr = [...selectedActivities];
                  newArr[slotIdx] = activityId;
                  setSelectedActivities(newArr);
                  setNpcChoices({ ...npcChoices, [`${activityId}:${slotIdx}`]: npc.id });
                } else {
                  // 레거시: 기존 방식
                  setNpcChoices({ ...npcChoices, [npcSelectFor]: npc.id });
                  setSelectedActivities([...selectedActivities, npcSelectFor]);
                }
                setLastReaction(getActivityReaction(activityId));
                setNpcSelectFor(null);
              }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 10, marginBottom: 6, cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; }}
              >
                <Portrait characterId={npc.id} size={40} expression="neutral" year={state.year} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{npc.name}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{npc.description}</div>
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>친밀 {Math.round(npc.intimacy)}</span>
              </div>
            ))}
            <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => setNpcSelectFor(null)}>취소</button>
          </div>
        </div>
        );
      })()}

      {/* NPC 상세 모달 */}
      {npcDetailFor && (() => {
        const npc = state.npcs.find(n => n.id === npcDetailFor);
        if (!npc) return null;
        const intimacyColor = npc.intimacy >= 70 ? 'var(--accent-soft)' : npc.intimacy >= 40 ? 'var(--yellow)' : 'var(--text-muted)';
        const intimacyLabel = npc.intimacy >= 70 ? '절친' : npc.intimacy >= 40 ? '친구' : '아는 사이';
        return (
          <div onClick={() => setNpcDetailFor(null)} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: 'linear-gradient(135deg, rgba(42,34,48,0.98), rgba(23,21,28,0.98))',
              borderRadius: 16, padding: 24, width: '85%', maxWidth: 340, textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <Portrait characterId={npc.id} size={72} expression="neutral" year={state.year} />
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
                {npcSmalltalk
                  ? npcSmalltalk
                  : `"${breakSentences(getNpcDialogue(npc.id, npc.intimacy, state))}"`}
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
              </div>

              {/* 말 걸기는 항상 활성 — 사전 결정 모델. 클릭 시 상단 인사말 영역이 잡담 라인으로 교체. */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    const r = talkToNpc(npc.id);
                    if (r.kind === 'event') { setMiniTalkResult(r.event); setNpcSmalltalk(null); }
                    else { setNpcSmalltalk(r.line); }
                  }}
                >말 걸기</button>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setNpcDetailFor(null); setNpcSmalltalk(null); }}>닫기</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Phase 2.1 — 가정 모달 (단일 엔티티 — 두 부모 강점은 가정 분위기) */}
      {showHomeModal && (() => {
        const labels: Record<ParentStrength, { icon: string; label: string }> = {
          emotional:  { icon: '🫂', label: '정서적 지지' },
          wealth:     { icon: '🏠', label: '여유 있는 집' },
          info:       { icon: '📱', label: '정보가 있는 집' },
          strict:     { icon: '📐', label: '엄격한 집' },
          resilience: { icon: '⭐', label: '타고난 체질' },
          freedom:    { icon: '🌿', label: '자유로운 집' },
        };
        return (
          <div onClick={() => { setShowHomeModal(false); setHomeSmalltalk(null); }} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: 'linear-gradient(135deg, rgba(42,34,48,0.98), rgba(23,21,28,0.98))',
              borderRadius: 16, padding: 24, width: '85%', maxWidth: 360, textAlign: 'center',
              border: '1px solid rgba(224,138,91,0.25)',
            }}>
              <div style={{ fontSize: '2.2rem', marginBottom: 6 }}>🏠</div>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>가정</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                엄마와 아빠가 만든 우리 집 분위기
              </div>

              {/* 두 강점을 분위기 카드로 표시 */}
              <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'center' }}>
                {state.parents.map(p => {
                  const m = labels[p];
                  return (
                    <div key={p} style={{
                      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 8px',
                      border: '1px solid rgba(224,138,91,0.15)',
                    }}>
                      <span style={{ fontSize: '1.4rem' }}>{m.icon}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{m.label}</span>
                    </div>
                  );
                })}
              </div>

              {homeSmalltalk && (
                <div style={{
                  marginTop: 14, padding: '10px 14px',
                  background: 'rgba(255,255,255,0.04)', borderRadius: 10,
                  fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic',
                  lineHeight: 1.6, wordBreak: 'keep-all', overflowWrap: 'break-word',
                }}>{homeSmalltalk}</div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    const r = talkToHome();
                    if (r.kind === 'event') { setMiniTalkResult(r.event); setHomeSmalltalk(null); }
                    else { setHomeSmalltalk(r.line); }
                  }}
                >부모와 대화하기</button>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowHomeModal(false); setHomeSmalltalk(null); }}>닫기</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Phase 2.1 — 미니 이벤트 결과 모달 */}
      {miniTalkResult && (
        <div onClick={() => setMiniTalkResult(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'linear-gradient(135deg, rgba(42,34,48,0.98), rgba(23,21,28,0.98))',
            borderRadius: 16, padding: 24, width: '85%', maxWidth: 360, textAlign: 'center',
            border: '1px solid rgba(224,138,91,0.4)',
          }}>
            <div style={{
              fontSize: '0.9rem', lineHeight: 1.7, whiteSpace: 'pre-line',
              wordBreak: 'keep-all', overflowWrap: 'break-word',
              background: 'rgba(224,138,91,0.06)', borderRadius: 12, padding: '14px 16px',
            }}>{miniTalkResult.description}</div>
            <div style={{
              marginTop: 14, fontSize: '0.78rem', color: 'var(--accent-soft)', fontWeight: 600,
            }}>{miniTalkResult.message}</div>
            <button className="btn btn-primary" style={{ marginTop: 18, width: '100%' }} onClick={() => {
              setMiniTalkResult(null);
              setNpcDetailFor(null);
              setShowHomeModal(false);
            }}>닫기</button>
          </div>
        </div>
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
    {showShop && state && (
      <Shop
        state={state}
        onBuy={(item: ShopItem, npcId?: string) => buyItem(item, npcId)}
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
