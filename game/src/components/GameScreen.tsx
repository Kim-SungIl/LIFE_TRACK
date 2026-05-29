import { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '../engine/store';
import { getWeekLabel } from '../engine/gameEngine';
import { calculateEnding } from '../engine/ending';
import { StatKey, STAT_LABELS } from '../engine/types';
import { getBackground, getSchoolLevel } from '../engine/backgrounds';
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
// 이벤트 결과(eventResultData)·주간 결산(showResult)·CG 로딩은 화면 전환을 가르므로 여기서 소유한다.
export function GameScreen() {
  const {
    state, setWeekendChoices, setVacationChoices, setRoutine, advanceWeek,
    advanceFromYearEnd, resolveEvent, setNpcActivityMap, buyItem, talkToNpc, talkToHome,
  } = useGameStore();

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
  const [bgImgError, setBgImgError] = useState(false);

  // useMemo는 모든 early return 위에 둬야 hooks order가 안 깨진다.
  const resultDialogue = useMemo(
    () => state?.weekLog ? getResultDialogue(state, state.weekLog) : '',
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

  // ===== v1.2 학년말 일기장 (Y1~Y6) =====
  if (state.phase === 'year-end') {
    return (
      <YearEndScreen
        year={state.year}
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
        gender={state.gender}
        year={state.year}
        eventResultData={eventResultData}
        cgLoaded={cgLoaded}
        cgError={cgError}
        onCgLoaded={() => setCgLoaded(true)}
        onCgError={() => setCgError(true)}
        onContinue={() => { setEventResultData(null); setCgLoaded(false); setCgError(false); setShowResult(true); }}
      />
    );
  }

  // ===== 주간 결산 =====
  if (showResult && state.weekLog) {
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
        onContinue={() => setShowResult(false)}
      />
    );
  }

  // ===== 메인 게임 화면 =====
  return (
    <MainWeekScreen
      state={state}
      bgProps={bgProps}
      onSetRoutine={setRoutine}
      onTalkNpc={talkToNpc}
      onTalkHome={talkToHome}
      onBuyItem={buyItem}
      onConfirmWeek={(activities, npcChoices) => {
        if (state.isVacation) setVacationChoices(activities);
        else setWeekendChoices(activities);
        // npcChoices를 그대로 전달 (슬롯 키 포함 — store에서 npcId만 추출)
        setNpcActivityMap(npcChoices);
        advanceWeek();
        setShowResult(true);
      }}
    />
  );
}
