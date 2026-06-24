import { useState, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../engine/store';
import { getWeekLabel } from '../engine/gameEngine';
import { calculateEnding } from '../engine/ending';
import { StatKey, STAT_LABELS } from '../engine/types';
import { getBackground, getSchoolLevel } from '../engine/backgrounds';
import { characterStagePrefixByLevel } from '../engine/characterAssets';
import { getResultDialogue } from '../engine/dialogues';
import { prefetchAssets } from '../engine/assetPrefetch';
import { EventScene } from './EventScene';
import { STAT_ICONS, getFatigueDisplay, getUpcomingEvents, type EventResultData } from './screens/shared';
import { YearEndScreen } from './screens/YearEndScreen';
import { EndingScreen } from './screens/EndingScreen';
import { EventResultScreen } from './screens/EventResultScreen';
import { WeeklyResultScreen } from './screens/WeeklyResultScreen';
import { MainWeekScreen } from './screens/main/MainWeekScreen';

// GameScreen 은 phase 라우터 — 각 화면(year-end / ending / event / event-result / weekly / main)으로 위임.
// 이벤트 결과(eventResultData)·CG 로딩은 화면 전환을 가르므로 여기서 소유한다. 주간 결산은 phase==='result'.
export function GameScreen() {
  // P3-7: selector 없는 전체-스토어 구독 → state + 사용하는 액션만 선택.
  // 액션은 Zustand에서 안정 참조라, npcActivityMap만 바뀔 땐 shallow-equal → 리렌더 스킵.
  const {
    state, setWeekendChoices, setVacationChoices, setRoutine, advanceWeek,
    advanceFromYearEnd, resolveEvent, setNpcActivityMap, buyItem, talkToNpc, talkToHome,
    resolveParentTalkChoice, setPhase,
  } = useGameStore(useShallow(s => ({
    state: s.state,
    setWeekendChoices: s.setWeekendChoices,
    setVacationChoices: s.setVacationChoices,
    setRoutine: s.setRoutine,
    advanceWeek: s.advanceWeek,
    advanceFromYearEnd: s.advanceFromYearEnd,
    resolveEvent: s.resolveEvent,
    setNpcActivityMap: s.setNpcActivityMap,
    buyItem: s.buyItem,
    talkToNpc: s.talkToNpc,
    talkToHome: s.talkToHome,
    resolveParentTalkChoice: s.resolveParentTalkChoice,
    setPhase: s.setPhase,
  })));

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

  // 자주 쓰는 자산 prefetch — 학교급(level) 전환 또는 player sprite era(Y1 ↔ Y2+) 변경 시에만 fire.
  // P3-8: 이전엔 state.year 매번 fire (Y1~Y7 = 7회). 이젠 level + isElementarySprite primitive dep으로
  //       학교급 transition 시(보통 3회)에만 fire. prefetched Set 내부 중복 차단과 별개로
  //       useEffect 자체의 호출 횟수를 줄여 hot path overhead 절감.
  const schoolLevel = state ? getSchoolLevel(state.year) : null;
  const isElementarySprite = state?.year === 1;
  const playerGender = state?.gender;
  useEffect(() => {
    if (!playerGender || !schoolLevel) return;
    const g = playerGender === 'male' ? 'm' : 'f';
    const playerPrefix = characterStagePrefixByLevel(`player_${g}`, schoolLevel);
    prefetchAssets([
      `images/characters/${playerPrefix}_fullbody.png`,
      `images/backgrounds/classroom_${schoolLevel}.png`,
      `images/backgrounds/classroom_${schoolLevel}_spring.png`,
      `images/backgrounds/classroom_${schoolLevel}_afternoon.png`,
      `images/backgrounds/classroom_${schoolLevel}_sunset.png`,
      `images/backgrounds/hallway_${schoolLevel}.png`,
      `images/backgrounds/library_${schoolLevel}.png`,
      `images/backgrounds/gymnasium.png`,
      `images/backgrounds/school_road_morning.png`,
      `images/backgrounds/home_evening.png`,
      `images/backgrounds/bedroom_night.png`,
    ]);
  }, [playerGender, schoolLevel, isElementarySprite]);

  // 주간 결산 화면은 state.phase==='result'로 표현 (새로고침 후에도 유지). 로컬 boolean 제거.
  const [eventResultData, setEventResultData] = useState<EventResultData | null>(null);
  // 기록장 — 지난 학년 회상(읽기 전용). null이면 닫힘. phase를 안 건드리는 로컬 오버레이.
  const [albumYear, setAlbumYear] = useState<number | null>(null);
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
  const [bgImgError, setBgImgError] = useState(false);

  // useMemo는 모든 early return 위에 둬야 hooks order가 안 깨진다.
  const resultDialogue = useMemo(
    () => state?.weekLog ? getResultDialogue(state, state.weekLog) : '',
    // weekLog만 deps — state 전체를 넣으면 매 렌더 재계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state?.weekLog],
  );
  // 엔딩 진입 후엔 state 가 거의 정지지만, calculateEnding 이 비-trivial 함수라
  // 방어적으로 memo. ending phase 가 아니면 null — 분기 진입 후만 계산됨.
  const endingData = useMemo(
    () => state?.phase === 'ending' ? calculateEnding(state) : null,
    [state],
  );

  if (!state) return null;

  const bg = getBackground(state.week, state.isVacation, state.mentalState, state.year);
  const handleBgImgError = () => setBgImgError(true);
  const bgProps = { bg, bgImgError, onImgError: handleBgImgError };

  // 기록장 오버레이 — 어느 화면에서 열든 최상단에서 가로챈다(읽기 전용, phase 무변경).
  if (albumYear !== null) {
    return (
      <YearEndScreen
        year={albumYear}
        gender={state.gender}
        memorySlots={state.memorySlots ?? []}
        milestoneScenes={state.milestoneScenes ?? []}
        stats={state.stats}
        bgProps={bgProps}
        onAdvance={() => {}}
        readonly
        examResults={state.examResults ?? []}
        reachedYears={Array.from({ length: Math.max(0, state.year - 1) }, (_, i) => i + 1)}
        onSelectYear={setAlbumYear}
        onClose={() => setAlbumYear(null)}
      />
    );
  }

  // ===== 이벤트 결과 — 비주얼 노벨 배경 유지 =====
  // 방금 내린 선택의 결과 연출이라 어떤 phase보다 우선한다. 특히 학년말 주(W48) 이벤트에서
  // year-end/ending보다 먼저 체크해야 결과 화면이 학년말 일기장에 묻히지 않는다.
  // onContinue로 닫으면 다음 render에서 phase(result/year-end/ending/event)로 자연 분기.
  if (eventResultData) {
    return (
      <EventResultScreen
        gender={state.gender}
        year={state.year}
        eventResultData={eventResultData}
        cgLoaded={cgLoaded}
        cgError={cgError}
        onCgLoaded={() => setCgLoaded(true)}
        onCgError={() => setCgError(true)}
        onContinue={() => { setEventResultData(null); setCgLoaded(false); setCgError(false); }}
      />
    );
  }

  // ===== v1.2 학년말 일기장 (Y1~Y6) =====
  if (state.phase === 'year-end') {
    return (
      <YearEndScreen
        year={state.year}
        gender={state.gender}
        memorySlots={state.memorySlots}
        milestoneScenes={state.milestoneScenes}
        stats={state.stats}
        bgProps={bgProps}
        onAdvance={advanceFromYearEnd}
      />
    );
  }

  // ===== 엔딩 =====
  if (state.phase === 'ending' && endingData) {
    return (
      <EndingScreen
        ending={endingData}
        track={state.track}
        stats={state.stats}
        parents={state.parents}
        burnoutCount={state.burnoutCount}
        bgProps={bgProps}
      />
    );
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
          // B-2 안전망: 모든 선택지가 비용 부족으로 잠겨 EventScene이 sentinel(-1)을 보낸 경우.
          // choices[-1]은 undefined라 아래 effects 계산이 크래시 → store.resolveEvent와 동일하게
          // 효과 없는 "지나친다"로 위임한다. (choiceIndex=-1은 선택지별 CG(_c-1_)는 매칭 안 되지만,
          // resolveEventCgRelPaths 폴백에 선택지-무관 base/gender CG가 있어 그 이벤트에 존재하면
          // 결과 화면에 표시될 수 있음 — 전선택지 잠김 + base CG 동시 충족은 드문 cosmetic.)
          if (!choice) {
            setEventResultData({ message: '잠시 머뭇거리다 자리를 떴다.', effects: [], event: evt, choiceIndex: index });
            resolveEvent(index);
            return;
          }
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

  // ===== 주간 결산 =====
  if (state.phase === 'result' && state.weekLog) {
    const { color: fatigueColor } = getFatigueDisplay(state.fatigue);
    return (
      <WeeklyResultScreen
        weekLog={state.weekLog}
        stats={state.stats}
        fatigue={state.fatigue}
        money={state.money}
        gender={state.gender}
        year={state.year}
        mentalState={state.mentalState}
        track={state.track}
        bgProps={bgProps}
        weekInfo={getWeekLabel(state)}
        resultDialogue={resultDialogue}
        fatigueColor={fatigueColor}
        upcomingEvents={getUpcomingEvents(state)}
        onContinue={() => setPhase('weekday')}
      />
    );
  }

  // ===== 메인 게임 화면 =====
  return (
    <MainWeekScreen
      state={state}
      bgProps={bgProps}
      onOpenAlbum={state.year >= 2 ? () => setAlbumYear(state.year - 1) : undefined}
      onSetRoutine={setRoutine}
      onTalkNpc={talkToNpc}
      onTalkHome={talkToHome}
      onResolveParentChoice={resolveParentTalkChoice}
      onBuyItem={buyItem}
      onConfirmWeek={(activities, npcChoices) => {
        if (state.isVacation) setVacationChoices(activities);
        else setWeekendChoices(activities);
        // npcChoices를 그대로 전달 (슬롯 키 포함 — store에서 npcId만 추출)
        setNpcActivityMap(npcChoices);
        // advanceWeek가 phase를 result/event/year-end/ending으로 전환 → 라우터가 알아서 분기.
        advanceWeek();
      }}
    />
  );
}
