import { useState, useEffect, useMemo, useRef, lazy, Suspense, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore, isStorageSaveFailed } from '../engine/store';
import { josa } from '../engine/korean';
import { getWeekLabel } from '../engine/gameEngine';
import { calculateEnding } from '../engine/ending';
import { StatKey, STAT_LABELS } from '../engine/types';
import { getBackground, getSchoolLevel } from '../engine/backgrounds';
import { characterStagePrefixByLevel } from '../engine/characterAssets';
import { getResultDialogue } from '../engine/dialogues';
import { prefetchAssets, runWhenIdle } from '../engine/assetPrefetch';
import { webpSrc } from '../engine/assetWebp';
import { STAT_ICONS, getFatigueDisplay, getUpcomingEvents, type EventResultData } from './screens/shared';
import { WeeklyResultScreen } from './screens/WeeklyResultScreen';
import { MainWeekScreen } from './screens/main/MainWeekScreen';
import { ScreenTransition, type TransitionPace } from './ScreenTransition';

// 비-부팅 화면만 lazy — MainWeekScreen / WeeklyResultScreen / TitleScreen 은 첫 페인트·고빈도라 eager 유지.
const EventScene = lazy(() =>
  import('./EventScene').then((m) => ({ default: m.EventScene })),
);
const YearEndScreen = lazy(() =>
  import('./screens/YearEndScreen').then((m) => ({ default: m.YearEndScreen })),
);
const EndingScreen = lazy(() =>
  import('./screens/EndingScreen').then((m) => ({ default: m.EndingScreen })),
);
const EventResultScreen = lazy(() =>
  import('./screens/EventResultScreen').then((m) => ({ default: m.EventResultScreen })),
);

/** Suspense fallback — 기존 톤 배경만 유지한 조용한 빈 화면 (깜빡임·스피너 없음).
 *  시각적으론 빈 배경이지만, 청크 로딩을 스크린리더에 1회 알린다(로드 후 재-suspend 없어 무음). */
function ScreenChunkFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ position: 'fixed', inset: 0, background: 'var(--bg-primary)' }}
    >
      <span style={{
        position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
        overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
      }}>불러오는 중…</span>
    </div>
  );
}

// GameScreen 은 phase 라우터 — 각 화면(year-end / ending / event / event-result / weekly / main)으로 위임.
// 이벤트 결과(eventResultData)·CG 로딩은 화면 전환을 가르므로 여기서 소유한다. 주간 결산은 phase==='result'.
export function GameScreen() {
  // P3-7: selector 없는 전체-스토어 구독 → state + 사용하는 액션만 선택.
  // 액션은 Zustand에서 안정 참조라, npcActivityMap만 바뀔 땐 shallow-equal → 리렌더 스킵.
  const {
    state, setWeekendChoices, setVacationChoices, setRoutine, advanceWeek,
    advanceFromYearEnd, resolveEvent, setNpcActivityMap, buyItem, talkToNpc, talkToHome,
    resolveParentTalkChoice, setPhase, runDelta,
  } = useGameStore(useShallow(s => ({
    state: s.state,
    runDelta: s.runDelta,
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
    ].map(webpSrc));
  }, [playerGender, schoolLevel, isElementarySprite]);

  // 주간 결산 화면은 state.phase==='result'로 표현 (새로고침 후에도 유지). 로컬 boolean 제거.
  const [eventResultData, setEventResultData] = useState<EventResultData | null>(null);
  // 기록장 — 지난 학년 회상(읽기 전용). null이면 닫힘. phase를 안 건드리는 로컬 오버레이.
  const [albumYear, setAlbumYear] = useState<number | null>(null);

  // 이벤트 화면 청크 prefetch — 메인 화면 idle 때 한 번만. 첫 이벤트 진입 Suspense 플래시 완화.
  const eventChunksPrefetched = useRef(false);
  const onMainScreen = Boolean(
    state
    && !eventResultData
    && state.phase !== 'event'
    && state.phase !== 'year-end'
    && state.phase !== 'ending'
    && state.phase !== 'result',
  );
  useEffect(() => {
    if (!onMainScreen || eventChunksPrefetched.current) return;
    return runWhenIdle(() => {
      if (eventChunksPrefetched.current) return;
      eventChunksPrefetched.current = true;
      void import('./EventScene');
      void import('./screens/EventResultScreen');
    });
  }, [onMainScreen]);
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

  // 기록장 오버레이 — 메인 화면 반환부에서 fixed 오버레이로 겹쳐 그린다(읽기 전용, phase 무변경).
  // 이전엔 여기서 early-return으로 화면을 통째로 갈아끼워 MainWeekScreen이 언마운트됐고,
  // 그 로컬 state(주말 활동/NPC 동행 선택)가 기록장을 열 때마다 소실됐다.
  // YearEndScreen은 lazy라 내부 Suspense로만 받아 MainWeek가 통째로 fallback 되지 않게 한다.
  const albumOverlay = albumYear !== null ? (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto' }}>
      <Suspense fallback={<ScreenChunkFallback />}>
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
      </Suspense>
    </div>
  ) : null;

  // ===== phase 분기 (단일 Suspense로 lazy 청크 로딩) =====
  let phaseContent: ReactNode;
  // 전환 페이드용 화면 정체성. **분기마다 phaseContent와 같은 자리에서 함께 지정한다** —
  // 별도 함수로 분기 조건을 다시 쓰면 라우터와 어긋나서(예: 결과 화면인데 키는 'main')
  // 전환이 엉뚱한 타이밍에 돌게 된다. 새 분기를 추가하면 키도 같이 적어야 한다.
  let screenKey: string;
  let screenPace: TransitionPace = 'normal';

  // 이벤트 결과 — 비주얼 노벨 배경 유지.
  // 방금 내린 선택의 결과 연출이라 어떤 phase보다 우선한다. 특히 학년말 주(W48) 이벤트에서
  // year-end/ending보다 먼저 체크해야 결과 화면이 학년말 일기장에 묻히지 않는다.
  // onContinue로 닫으면 다음 render에서 phase(result/year-end/ending/event)로 자연 분기.
  if (eventResultData) {
    // 같은 선택의 결과 화면 안에서는 키가 고정 — cgLoaded 등으로 다시 페이드되지 않는다.
    screenKey = `event-result:${eventResultData.event?.id ?? '?'}#${eventResultData.choiceIndex ?? '?'}`;
    phaseContent = (
      <EventResultScreen
        gender={state.gender}
        year={eventResultData.year ?? state.year}
        eventResultData={eventResultData}
        cgLoaded={cgLoaded}
        cgError={cgError}
        onCgLoaded={() => setCgLoaded(true)}
        onCgError={() => setCgError(true)}
        onContinue={() => { setEventResultData(null); setCgLoaded(false); setCgError(false); }}
      />
    );
  } else if (state.phase === 'year-end') {
    // ===== v1.2 학년말 일기장 (Y1~Y6) =====
    screenKey = `year-end:${state.year}`;
    screenPace = 'slow';        // 한 판 6회 — 드문 장면이라 길게
    phaseContent = (
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
  } else if (state.phase === 'ending' && endingData) {
    // ===== 엔딩 =====
    screenKey = 'ending';
    screenPace = 'slow';        // 한 판 1회
    phaseContent = (
      <EndingScreen
        ending={endingData}
        track={state.track}
        stats={state.stats}
        parents={state.parents}
        burnoutCount={state.burnoutCount}
        bgProps={bgProps}
        runDelta={runDelta}
        gender={state.gender}
      />
    );
  } else if (state.currentEvent && state.phase === 'event') {
    // ===== 이벤트 화면 (비주얼 노벨 스타일) =====
    // eventResultData가 세팅돼 있으면 결과 화면을 먼저 보여준 뒤, "계속 →" 클릭 후 followup 이벤트로 넘어감
    // 연쇄 이벤트도 id가 바뀌므로 사이사이 전환이 들어간다. pace는 normal 고정 — 고빈도다.
    screenKey = `event:${state.currentEvent.id}`;
    phaseContent = (
      <EventScene
        event={state.currentEvent}
        gender={state.gender}
        year={state.year}
        state={state}
        npcs={state.npcs.map(n => ({ id: n.id, name: n.name, met: n.met }))}
        onChoice={(index: number) => {
          const evt = state.currentEvent!;
          const choice = ((state.gender === 'female' && evt.femaleChoices) ? evt.femaleChoices : evt.choices)[index];
          // 먼저 적용하고, 반환된 "실제 적용값"(구간 감쇠·클램프 반영)으로 표시를 만든다.
          // 이전엔 choice 원본 수치를 표시해 고스탯 구간에서 "+4 표시 → +1.6 적용" 괴리가 있었음.
          // resolveEvent → setEventResultData 두 set은 같은 핸들러라 React가 배칭 — 중간 렌더 없음.
          const applied = resolveEvent(index);
          // B-2 안전망: 모든 선택지가 비용 부족으로 잠겨 EventScene이 sentinel(-1)을 보낸 경우.
          // (choiceIndex=-1은 선택지별 CG(_c-1_)는 매칭 안 되지만, resolveEventCgRelPaths 폴백에
          // 선택지-무관 base/gender CG가 있어 그 이벤트에 존재하면 결과 화면에 표시될 수 있음 — 드문 cosmetic.)
          if (!choice || !applied) {
            setEventResultData({ message: '잠시 머뭇거리다 자리를 떴다.', effects: [], event: evt, choiceIndex: index, year: state.year });
            return;
          }
          const effects: Record<string, string>[] = [];
          const fmt = (v: number) => `${v > 0 ? '+' : ''}${Number.isInteger(v) ? v : v.toFixed(1)}`;
          for (const [k, v] of Object.entries(applied.stats)) {
            const val = v as number;
            effects.push({ text: `${STAT_ICONS[k as StatKey]} ${STAT_LABELS[k as StatKey]} ${fmt(val)}`, color: val > 0 ? 'var(--green)' : 'var(--red)' });
          }
          if (applied.fatigue) effects.push({ text: `피로 ${fmt(applied.fatigue)}`, color: applied.fatigue > 0 ? 'var(--red)' : 'var(--green)' });
          if (applied.money) effects.push({ text: `💰 ${fmt(applied.money)}만`, color: applied.money > 0 ? 'var(--green)' : 'var(--red)' });
          // NPC 친밀도 + 첫 만남 — state는 resolve 이전 스냅샷(렌더 클로저)이라 이름/이모지 조회용으로만 사용
          const newMeets: string[] = [];
          for (const an of applied.npcs) {
            const npc = state.npcs.find(n => n.id === an.npcId);
            if (npc) {
              // 클램프(0/100)로 실변화 0이면 하트 생략 — 스탯/피로/돈의 0 생략과 동일 규칙
              // (음수 효과가 친밀도 0에서 클램프되면 ♥로 반전되던 표기 방지)
              if (an.delta !== 0) {
                effects.push({ text: `${npc.emoji} ${npc.name} ${an.delta > 0 ? '♥' : '💔'}`, color: an.delta > 0 ? 'var(--blue)' : 'var(--red)' });
              }
              if (an.firstMeet) newMeets.push(npc.name);
            }
          }
          // 첫 만남 알림 추가
          for (const name of newMeets) {
            effects.unshift({ text: `🤝 ${josa(name, '와/과')} 알게 되었다!`, color: 'var(--yellow)' });
          }
          // state는 resolve 이전 스냅샷(렌더 클로저)이라 state.year가 곧 발생 학년이다 — W48
          // 학년 전환 후의 값이 아니다. 이 값이 결과 화면의 CG 해석 기준이 된다.
          setEventResultData({ message: choice.message, effects, event: evt, choiceIndex: index, year: state.year });
        }}
      />
    );
  } else if (state.phase === 'result' && state.weekLog) {
    // ===== 주간 결산 =====
    const { color: fatigueColor } = getFatigueDisplay(state.fatigue);
    screenKey = `weekly:${state.year}-${state.week}`;
    phaseContent = (
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
  } else {
    // ===== 메인 게임 화면 =====
    // 주 안에서는 키가 고정이라 루틴 조작으로 페이드가 돌지 않는다. 주 넘김은
    // main → weekly → main 으로 키가 두 번 바뀌면서 전환이 붙는다.
    screenKey = `main:${state.year}-${state.week}`;
    phaseContent = (
      <>
        <MainWeekScreen
          state={state}
          bgProps={bgProps}
          saveFailed={isStorageSaveFailed()}
          onOpenAlbum={() => setAlbumYear(state.year - 1)}
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
        {albumOverlay}
      </>
    );
  }

  return (
    <Suspense fallback={<ScreenChunkFallback />}>
      <ScreenTransition transitionKey={screenKey} pace={screenPace}>
        {phaseContent}
      </ScreenTransition>
    </Suspense>
  );
}
