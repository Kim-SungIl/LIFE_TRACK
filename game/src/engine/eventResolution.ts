// 사건 선택 해결·NPC 말걸기의 엔진 본체 — store 액션과 sim 하네스가 **같은 함수**를 탄다.
//
// 예전엔 store.ts 안에 있었고 scripts/lib/y1-sim-resolve.ts가 그걸 손으로 베껴 두었다("store.resolveEvent와
// 동일"). 베낀 쪽은 조용히 어긋났다(2026-10-27 대조): W48 사건을 닫아도 학년 전환을 안 해서 그 해의
// milestone·성취 3축·Y7 진로 갈림길이 빠졌고, 사건 효과를 주간 로그에 접지 않았고, 기록에서 vacationText를
// 안 지웠고, 말걸기는 지난달 적립 대화(talkBank)·보류분(pendingWeekDelta)을 몰랐다. 하네스가 없는 게임을 쟀다.
// 이제 store는 기록실 적립(archive — 브라우저 저장소 쓰기)만 훅으로 얹고, 나머지는 여기서 한 번만 정한다.

import { applyRelationshipChoice, relationshipContinuation, ROMANCE_ROUTES, romanceRetryNpc, restoreRomanceRetry } from './romance';
import type { GameState, GameEvent, EventChoice, StatKey } from './types';
import { scaleIntimacyChange, scaleStatChange, applyYearTransition } from './gameEngine';
import { talkBankCount } from './monthPlayback';
import { cloneGameState } from './stateClone';
import { getChainFollowup, pickChainForWeek, recordSummerVacationEnd, applyReachReservation, FOLLOWUP_EVENT_IDS, DIRECT_SEQUEL_IDS } from './events';
import { assignCurrentEvent } from './eventPresentation';
import { applyMemorySlotFromChoice, applyMemorySlotFromMiniTalk } from './memorySystem';
import { type MiniTalkEvent, getAvailableNpcEvents, getNpcSmalltalk } from './talkSystem';
import { applyParentIntimacyDelta } from './parentIntimacy';
import { absWeek, isNpcInteractable } from './relationshipSignals';
import { CAREER_CHOICE_EVENT_ID } from './careerChoice';
import { recordMoneySpent } from './moneyTrajectory';

/** 가시 효과의 "적용 전" 스냅샷 — 실제로 얼마가 먹혔는지는 클램프 뒤에만 알 수 있다. */
export function visibleSnapshot(s: GameState): { stats: GameState['stats']; fatigue: number; money: number } {
  return { stats: { ...s.stats }, fatigue: s.fatigue, money: s.money };
}

/**
 * 스냅샷 대비 실제 변화를 **그 주의 보류분**에 더한다(types.ts `pendingWeekDelta` 참조).
 *
 * 원본 효과값이 아니라 차분을 쓴다 — 0~100 클램프에 걸리면 표와 실제가 갈리고, 결산이
 * 또 다른 거짓말을 한다. 반올림은 여기서 하지 않는다(접을 때 한 번만).
 */
export function accruePendingDelta(state: GameState, before: ReturnType<typeof visibleSnapshot>): void {
  const p = state.pendingWeekDelta ?? { stats: {}, fatigue: 0, money: 0 };
  for (const key of Object.keys(state.stats) as StatKey[]) {
    const d = state.stats[key] - before.stats[key];
    if (d !== 0) p.stats[key] = (p.stats[key] ?? 0) + d;
  }
  p.fatigue += state.fatigue - before.fatigue;
  p.money += state.money - before.money;
  state.pendingWeekDelta = p;
}

// 가시 효과(스탯/피로/돈) 적용 헬퍼 — 미니이벤트/선택지 공통.
// 적용한 만큼을 보류분에 적어 둔다: 이 경로는 processWeek **이전**이라 이번 주 로그가 아직
// 없고, 남기지 않으면 현재값에만 반영돼 결산의 변화량과 어긋난다(#442와 같은 부호 역전).
export function applyVisibleTalkEffects(
  state: GameState,
  effects: { stats?: Partial<GameState['stats']>; fatigue?: number; money?: number } | undefined,
): void {
  if (!effects) return;
  const before = visibleSnapshot(state);
  if (effects.stats) {
    for (const [k, v] of Object.entries(effects.stats)) {
      const key = k as keyof GameState['stats'];
      state.stats[key] = Math.max(0, Math.min(100, state.stats[key] + (v as number)));
    }
  }
  if (effects.fatigue) {
    state.fatigue = Math.max(0, Math.min(100, state.fatigue + effects.fatigue));
  }
  if (effects.money) {
    const beforeMoney = state.money;
    state.money = Math.round((state.money + effects.money) * 10) / 10;
    if (state.money < 0) state.money = 0;
    recordMoneySpent(state, Math.round((beforeMoney - state.money) * 10) / 10);
  }
  accruePendingDelta(state, before);
}

// 말걸기 결과 — 사전 결정 모델
// - 'event': 이번 주 사전 결정에서 발동 + 풀에 가용 이벤트 있음 → 미니 이벤트 발동
// - 'smalltalk': 그 외 모든 경우 → 잠깐의 잡담 한 줄 (클릭마다 다른 라인)
export type TalkActionResult =
  | { kind: 'event'; event: MiniTalkEvent }
  | { kind: 'smalltalk'; line: string };

/** 지난달 적립 대화를 하나 쓴다(store.talkToNpc / talkToHome). */
export function spendTalkBank(state: GameState): void {
  if (state.talkBank) state.talkBank = { ...state.talkBank, count: Math.max(0, state.talkBank.count - 1) };
}

// ===== resolveEvent 단계 헬퍼 (state 직접 mutate) =====

// 이벤트 선택의 "실제 적용" 결과 DTO — choice의 원본 수치와 적용값은 다르다
// (스탯/친밀도는 구간 감쇠 + 0~100 클램프). 화면이 원본을 그대로 보여주면
// 고스탯 구간에서 "+4 표시 → +1.6 적용" 괴리가 생기므로 resolveEvent가 이걸 반환한다.
export type AppliedEventOutcome = {
  stats: Partial<Record<StatKey, number>>;  // 적용 후 실측 델타 (소수 1자리)
  fatigue?: number;
  money?: number;
  npcs: { npcId: string; delta: number; firstMeet: boolean }[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;

// 선택 결과 적용: 스탯(구간감쇠)/피로/용돈 + 이벤트 등장 NPC met + timeCost/문이과/부모 친밀도.
// 반환값 = 실제 적용된 델타 모음 (표시용 — 게임 로직은 여전히 state mutate가 본체).
export function applyChoiceOutcome(state: GameState, event: GameEvent, choice: EventChoice, occurrenceWeek: number): AppliedEventOutcome {
  applyRelationshipChoice(state, event, choice, occurrenceWeek);
  const outcome: AppliedEventOutcome = { stats: {}, npcs: [] };
  // 적용 전 스냅샷 — 아래 끝에서 이번 주 로그가 아직 없을 때(부팅 도입 장면) 보류분으로 적는 데 쓴다.
  const atEntry = visibleSnapshot(state);
  // 스탯 효과 — 구간별 감쇠(scaleStatChange)로 활동과 동일하게 고구간 캡 적용 (QA C3 근본원인).
  for (const [key, val] of Object.entries(choice.effects)) {
    const k = key as keyof typeof state.stats;
    const before = state.stats[k];
    const scaled = scaleStatChange(val as number, before);
    state.stats[k] = Math.max(0, Math.min(100, before + scaled));
    const applied = round1(state.stats[k] - before);
    if (applied !== 0) outcome.stats[k] = applied;
  }
  // 피로 효과
  if (choice.fatigueEffect) {
    const before = state.fatigue;
    state.fatigue = Math.max(0, Math.min(100, state.fatigue + choice.fatigueEffect));
    const applied = round1(state.fatigue - before);
    if (applied !== 0) outcome.fatigue = applied;
  }
  // 용돈 효과 — 음수 방지
  if (choice.moneyEffect) {
    const before = state.money;
    state.money = Math.round((state.money + choice.moneyEffect) * 10) / 10;
    if (state.money < 0) state.money = 0;
    const applied = round1(state.money - before);
    if (applied !== 0) outcome.money = applied;
    // T25 돈 궤적 — 선택지로 나간 돈도 지출이다(applied<0일 때만).
    if (applied < 0) recordMoneySpent(state, -applied);
  }
  // NPC 친밀도 효과 + 만남 처리 (구간별 감쇠)
  if (choice.npcEffects) {
    for (const ne of choice.npcEffects) {
      const npc = state.npcs.find(n => n.id === ne.npcId);
      if (npc) {
        const firstMeet = !npc.met;
        const before = npc.intimacy;
        const scaled = scaleIntimacyChange(ne.intimacyChange, npc.intimacy);
        npc.intimacy = Math.max(0, Math.min(100, npc.intimacy + scaled));
        npc.met = true;
        // 관계 신호: 친밀도가 오른 상호작용만 "최근 함께함"으로 기록(악화 선택지는 제외)
        // 발생주(occurrenceWeek) 사용 — state.week은 processWeek의 week++ 이후라 +1 어긋남(record와 동일 규칙).
        if (scaled > 0) npc.lastInteractionWeek = absWeek(state.year, occurrenceWeek);
        outcome.npcs.push({ npcId: ne.npcId, delta: round1(npc.intimacy - before), firstMeet });
      }
    }
  }
  // 이벤트에 등장한 모든 NPC도 met (선택지 무관, 남/여 분기 모두)
  const allBranchChoices = [...event.choices, ...(event.femaleChoices || [])];
  for (const c of allBranchChoices) {
    if (c.npcEffects) {
      for (const ne of c.npcEffects) {
        const npc = state.npcs.find(n => n.id === ne.npcId);
        if (npc) npc.met = true;
      }
    }
  }
  // speakers 등장 NPC도 met (대사 전용 등장도 만남으로 인정)
  if (event.speakers) {
    for (const npcId of event.speakers) {
      const npc = state.npcs.find(n => n.id === npcId);
      if (npc) npc.met = true;
    }
  }
  // 시간 소모: 다음 주 루틴/주말 슬롯 감소
  if (choice.timeCost) {
    state.eventTimeCost = choice.timeCost;
  }
  // 문/이과 선택 (Y6 W1 이벤트 전용)
  if (choice.trackSelect) {
    state.track = choice.trackSelect;
  }
  // T66: 진로 갈림길 선택 (career-crossroads 전용). 엔딩은 이 값을 열린 갈래 안에서만 쓴다.
  if (choice.careerSelect) {
    state.careerChoice = choice.careerSelect;
  }
  // Phase 4C: 이벤트 선택의 부모 친밀도 반응 — 단일 진입점. 그 주는 평균회귀 면제.
  if (choice.parentEffect) {
    applyParentIntimacyDelta(state, choice.parentEffect.baseDelta, choice.parentEffect.tag);
    state.actedWithParentThisWeek = true;
  }
  if (romanceRetryNpc(event.id)) {
    // This optional conversation belongs to the current planning week, not the previous log.
  } else if (state.weekLog) {
    foldOutcomeIntoWeekLog(state, outcome);
  } else {
    // **이번 주 로그가 아직 없는 이벤트** = 부팅 도입 장면(first-week)과 그 뒤에 붙는 체인.
    // 첫 processWeek 이전이라 접을 로그가 없는데, 그렇다고 버리면 1주차 결산이 도입 장면의
    // 효과를 못 본다. 실측(시드 11): 도입 선택지 인기 +2 → 시작 25 → 1주차 끝 26.4인데
    // 결산은 "인기 −0.6"에 잃은 것 칩까지 띄웠다(이벤트 결과 화면에서 "+2"를 본 직후에).
    // 장부(state.events)는 이 사건을 week 1로 적으므로 결산도 그 주 것으로 세야 한다 —
    // 말걸기·상점(#453)과 같은 통로(pendingWeekDelta)로 남기면 첫 processWeek이
    // 캡 계산 뒤(foldPendingIntoLog)에서 접는다. 위치가 캡 뒤라 활동 몫은 안 깎인다(밸런스 불변).
    accruePendingDelta(state, atEntry);
  }
  return outcome;
}

/**
 * 이벤트로 실제 적용된 값을 **그 주의 로그에 접는다.**
 *
 * 없으면 결산 화면이 한 행에서 두 계층을 섞어 말한다 — 현재값은 state.stats(이벤트 포함)에서
 * 오고 변화량은 weekLog(이벤트 제외)에서 왔다. 실측: 이벤트로 체력 +2를 받은 주에 화면이
 * "체력 42, 이번 주 **-0.4**"라고 적었다. 42는 이벤트 포함값인데 -0.4는 일과만이라, 주 시작값이
 * 42.8이었다고 주장하는 셈이었다(실제 40.8). 인기도 +0.2가 **-1.8**로 부호가 뒤집혔고,
 * "잃은 것" 칩(WeeklyResultScreen:68)이 방금 **얻은** 축을 손실로 라벨링했다.
 *
 * **outcome을 쓰는 이유**: choice.effects 원본이 아니라 구간 감쇠·클램프를 거친 뒤의
 * 실제 적용값이다. 원본을 더하면 고스탯 구간에서 로그가 또 다른 거짓말을 한다.
 *
 * 독백(dialogues.ts RESULT_POOLS)도 같은 statChanges를 읽는다 — "weekLog의 실제 사건/스탯
 * 변화에 맞춰 골라 준다"는 그 층의 선언과 이제야 맞는다.
 *
 * weekLog가 null일 수 있다(첫 주 진입 전 부팅 이벤트). 그 경우 접을 곳이 없으니 건너뛴다.
 */
export function foldOutcomeIntoWeekLog(state: GameState, outcome: AppliedEventOutcome): void {
  const log = state.weekLog;
  if (!log) return;
  for (const [key, val] of Object.entries(outcome.stats)) {
    const k = key as StatKey;
    log.statChanges[k] = round1((log.statChanges[k] ?? 0) + (val as number));
  }
  if (outcome.fatigue) log.fatigueChange = round1((log.fatigueChange ?? 0) + outcome.fatigue);
  if (outcome.money) log.moneyChange = round1((log.moneyChange ?? 0) + outcome.money);
}

// 이벤트 기록 — condition(함수)은 JSON 직렬화 손실 방지 위해 제거, 발생주차는 occurrenceWeek로 통일.
export function recordResolvedEvent(state: GameState, event: GameEvent, choiceIndex: number, occurrenceWeek: number, isFemale: boolean): void {
  const recordedEvent: Partial<GameEvent> = { ...event };
  delete recordedEvent.condition;
  // 변이 테이블은 카탈로그가 갖고 있다 — 기록에 복제하면 발동 횟수만큼 세이브가 불어난다
  // (7년 완주 실측: 332개 항목 중 62개에 중복 적재되어 105.6KB, 세이브의 29%).
  // condition을 지우는 것과 같은 위생이다: 기록은 "무엇을 골랐나"만 남긴다.
  delete recordedEvent.schoolVariants;
  delete recordedEvent.vacationText;
  // presentedFemaleChoices는 바로 아래 resolvedFemale로 접어 넣으므로 원본은 남기지 않는다.
  delete recordedEvent.presentedFemaleChoices;
  state.events.push({
    ...(recordedEvent as GameEvent),
    resolvedChoice: choiceIndex,
    week: occurrenceWeek,
    year: state.year,
    // 변이 이벤트는 presentEvent가 femaleChoices를 지우므로 `!!event.femaleChoices`가 항상
    // false다. 여성 문장을 집었는지는 굽는 시점에만 알 수 있어 presentedFemaleChoices로 받고,
    // **고른 선택지가 실제로 여성 문장이었는지**까지 본다(엔딩은 (이벤트, 선택지)로 갈린다).
    resolvedFemale: isFemale && (
      !!event.femaleChoices || (event.presentedFemaleChoices?.includes(choiceIndex) ?? false)
    ),
  });
}

// 이벤트 종료 후 연쇄: followup → conditional/milestone chain(주당 cap) → 학년전환/주간결산 분기.
// occurrenceWeek = 발생주차(currentEvent.week, clone 이전 원본). location도 clone 이전 원본을 받는다.
export function resolveEventChain(state: GameState, location: string | undefined, occurrenceWeek: number): void {
  // 가드: 같은 주(week+year)에 followup이 이미 발동했으면 추가 발동 안 함 (DIRECT_SEQUEL은 제외).
  const followupFiredThisWeek = state.events.some(
    prev => prev.week === occurrenceWeek && prev.year === state.year
      && FOLLOWUP_EVENT_IDS.has(prev.id) && !DIRECT_SEQUEL_IDS.has(prev.id),
  );
  // 연쇄 판정은 발생주 좌표로(atOccurrence) — week++ 뒤 좌표로 보면 W24 연쇄가 학기로 새고 W19·W42가 막힌다.
  const followup = followupFiredThisWeek ? null : getChainFollowup(state, occurrenceWeek, location);
  if (followup) {
    assignCurrentEvent(state, followup, occurrenceWeek);
  } else {
    // chain cap: 일반 누적 2개, milestone(도달형) 잔여 있으면 3개까지 (졸업 직전 누락 방지).
    // 앵커 컷 예약·학년 마지막 주 예약 비우기도 pickChainForWeek 안에 있다.
    const eventsThisWeek = state.events.filter(
      prev => prev.week === occurrenceWeek && prev.year === state.year && prev.id !== ROMANCE_ROUTES.subin.opening && !romanceRetryNpc(prev.id),
    ).length;
    const pick = pickChainForWeek(state, occurrenceWeek, eventsThisWeek);
    applyReachReservation(state, pick.reserve, occurrenceWeek);
    const chainPick = pick.event;
    if (chainPick) {
      assignCurrentEvent(state, chainPick, occurrenceWeek);
      return;
    }
    // 이 주의 사건이 다 닫혔다 — 여름방학 마지막 주면 이월 판정용 친밀도를 찍는다.
    recordSummerVacationEnd(state, occurrenceWeek);
    if (state.week > 48) {
      // W48 학년말/졸업 주 이벤트 종료 → processWeek가 미뤄둔 학년 전환을 지금 수행.
      applyYearTransition(state);
    } else {
      // 일반 주: 주간 결산 화면으로. 결산할 로그가 없으면(부팅 first-week 장면) 계획 화면으로 복귀 —
      // 이전엔 phase='result'로 두고 GameScreen의 weekLog 가드에 우연히 의존했다.
      state.phase = state.weekLog ? 'result' : 'weekday';
    }
  }
}

/** resolveCurrentEvent·talkToNpcOutcome이 store에서만 얹는 부수 효과 — sim 하네스는 안 넘긴다. */
export interface ResolutionHooks {
  /** 사건 기록 직후(체인·학년 전환 전). store는 기록실 적립(accrueResolvedEvent)을 건다. */
  onEventRecorded?: (state: GameState) => void;
  /** 미니 이벤트가 발동한 직후. store는 기록실 적립(accrueTalk)을 건다. */
  onMiniTalkFired?: (state: GameState, eventId: string) => void;
}

/**
 * 현재 사건의 선택지를 해결한다 — store.resolveEvent의 본체. 입력 상태는 건드리지 않고 사본을 돌려준다.
 * 해결하지 않는 경우(사건 없음 · 잘못된 연애 재도전 장면)는 null.
 */
export function resolveCurrentEvent(
  s: GameState, choiceIndex: number, hooks: ResolutionHooks = {},
): { state: GameState; applied: AppliedEventOutcome } | null {
  if (!s.currentEvent) return null;
  // A malformed/replayed manual scene must not create or consume a relationship.
  if (romanceRetryNpc(s.currentEvent.id) && (!restoreRomanceRetry(s)
      || !Number.isInteger(choiceIndex) || !s.currentEvent.choices[choiceIndex])) return null;
  // 성별 분기 적용
  const isFemale = s.gender === 'female';
  const choices = (isFemale && s.currentEvent.femaleChoices) ? s.currentEvent.femaleChoices : s.currentEvent.choices;
  // B-2 안전망: 모든 선택지가 비용 부족으로 잠겼을 때 EventScene이 sentinel(-1)을 보내면
  // 효과 0인 "지나친다"로 처리해 이벤트만 닫고 다음 주로 진행 가능하게 한다.
  const choice = choices[choiceIndex] ?? {
    text: '지나친다',
    effects: {},
    message: '잠시 머뭇거리다 자리를 떴다.',
  };

  const newState = cloneGameState(s);
  const event = newState.currentEvent!;
  // 발생 주차 = currentEvent.week (clone 이전 원본). newState.week는 processWeek의 week++ 이후라
  // 그대로 쓰면 발생주+1로 어긋난다(off-by-one) → record/chain이 이 값을 공유한다.
  const occurrenceWeek = s.currentEvent.week ?? newState.week;

  // 선택 결과 적용 (스탯/피로/용돈 + NPC met + timeCost/문이과/부모 친밀도)
  const applied = applyChoiceOutcome(newState, event, choice, occurrenceWeek);

  // v1.2 기억 슬롯 생성 (importance ≥3 + ANNUAL 제외 필터는 내부에서)
  applyMemorySlotFromChoice(newState, event, choiceIndex, choice);

  // M4: 버프 추가 (동일 id 있으면 기간 덮어쓰기)
  if (choice.addBuff) {
    if (!newState.activeBuffs) newState.activeBuffs = [];
    newState.activeBuffs = newState.activeBuffs.filter(b => b.id !== choice.addBuff!.id);
    newState.activeBuffs.push({ ...choice.addBuff });
  }

  // 이벤트 기록 (선택 인덱스 + 발생주차 + 연차 + 성별 분기)
  recordResolvedEvent(newState, event, choiceIndex, occurrenceWeek, isFemale);
  // 런간 기록 즉시 적립(store 훅). 바로 위 recordResolvedEvent가 방금 push한 항목을 읽는다.
  //
  // CG의 발생 학년을 지키는 것은 이 호출 순서가 **아니다** — recordResolvedEvent가 항목에
  // year를 박아 두므로(위 함수) 적립은 그 값을 읽고, resolveEventChain의 W48 학년 전환
  // 뒤로 옮겨도 같은 파일이 적립된다(실측 확인). 순서가 실제로 정하는 건 touchPeak이
  // 친밀도를 읽는 시점뿐이다. 여기 두는 이유는 "기록은 방금 일어난 일 옆에서" 정도의
  // 가독성이고, 계약이 아니다.
  hooks.onEventRecorded?.(newState);

  // weekLog 메시지 + 이벤트 닫기
  if (newState.weekLog && !romanceRetryNpc(event.id)) {
    newState.weekLog.messages.push(`📖 ${choice.message}`);
  }
  newState.currentEvent = null;

  // followup/conditional/milestone chain + 학년 전환·결산 분기 (location은 clone 이전 원본)
  const continuation = relationshipContinuation(newState, event, choice);
  if (romanceRetryNpc(event.id) && event.romanceReturnPhase) {
    newState.phase = event.romanceReturnPhase;
  } else if (continuation) {
    assignCurrentEvent(newState, continuation, occurrenceWeek);
  } else if (event.id === CAREER_CHOICE_EVENT_ID) {
    // T66: 갈림길 뒤에는 아무것도 끼우지 않고 곧장 엔딩으로 — 체인 사건이 스탯을 움직이면
    // 방금 고른 갈래가 엔딩 시점에 닫힐 수 있다(careerChoice.ts 헤더).
    applyYearTransition(newState);
  } else {
    resolveEventChain(newState, s.currentEvent?.location, occurrenceWeek);
  }
  return { state: newState, applied };
}

/**
 * NPC에게 말을 건다 — store.talkToNpc의 본체. 입력 상태는 건드리지 않는다.
 * `state`가 null이면 상태가 그대로다(말을 걸 수 없는 상대). 잡담도 rng를 전진시키므로 새 상태를 돌려준다.
 */
export function talkToNpcOutcome(
  s: GameState, npcId: string, hooks: ResolutionHooks = {},
): { state: GameState | null; result: TalkActionResult } {
  const npc = s.npcs.find(n => n.id === npcId);
  if (!npc) return { state: null, result: { kind: 'smalltalk', line: '' } };
  // 부재(전출·졸업) 중인 친구에겐 말을 걸 수 없다 — UI는 버튼을 안 그리지만 엔진에서도 막는다.
  // 반드시 cloneGameState/getNpcSmalltalk 앞에서 반환할 것: 잡담 경로는 seededRandomTalk로
  // rngSeed를 전진시키므로, 여기서 새면 부재 카드를 누른 횟수만큼 밸런스 RNG가 흔들린다.
  if (!isNpcInteractable(npc, s)) return { state: null, result: { kind: 'smalltalk', line: '' } };

  // 친밀도 30+ 일 때만 미니 이벤트 후보 — 그 외엔 잡담 한 줄
  // 이번 주 기회가 없어도 지난달 재생이 지나친 기회(talkBank)가 남았으면 쓴다(설계안 §8 월 적립).
  const fromBank = !s.npcEventPendingThisWeek && talkBankCount(s) > 0;
  const eligible = npc.intimacy >= 30 && (s.npcEventPendingThisWeek || fromBank);
  if (eligible) {
    const available = getAvailableNpcEvents(s, npcId);
    if (available.length > 0) {
      // fire — 효과 적용 + pressure 리셋 + pending 소비 + fired 기록
      const newState = cloneGameState(s);
      const ev = available[0];
      // stats/fatigue/money는 공통 헬퍼로 적용 (talkToHome과 동일 경로 — raw 가산, 정규 이벤트와 달리 구간 감쇠 미적용).
      applyVisibleTalkEffects(newState, ev.effects);
      if (ev.effects.intimacy && ev.npcId) {
        const target = newState.npcs.find(n => n.id === ev.npcId);
        if (target) target.intimacy = Math.max(0, Math.min(100, target.intimacy + scaleIntimacyChange(ev.effects.intimacy, target.intimacy)));
      }
      // 관계 신호: 미니 이벤트를 본 NPC는 상호작용 기록(친밀도 변화 무관 — 말을 건 것 자체가 만남)
      { const t = newState.npcs.find(n => n.id === npcId); if (t) t.lastInteractionWeek = absWeek(newState.year, newState.week); }
      applyMemorySlotFromMiniTalk(newState, ev.id, ev.memorySlotDraft);
      newState.talkEventsFired = [...newState.talkEventsFired, ev.id];
      newState.talkEventPressure = 0;
      if (fromBank) spendTalkBank(newState);
      else newState.npcEventPendingThisWeek = false;
      hooks.onMiniTalkFired?.(newState, ev.id);
      return { state: newState, result: { kind: 'event', event: ev } };
    }
    // pending이지만 이 NPC 풀 비어있음 → 잡담 (pending은 다른 NPC를 위해 보존)
  }
  // 잡담 한 줄 — RNG 진행 위해 새 state로 push
  const newState = cloneGameState(s);
  const line = getNpcSmalltalk(newState, npcId);
  // 관계 신호: 잡담도 상호작용(친밀도 변화 0이라 lastInteractionWeek로만 "최근 함께함"이 잡힘)
  { const t = newState.npcs.find(n => n.id === npcId); if (t) t.lastInteractionWeek = absWeek(newState.year, newState.week); }
  return { state: newState, result: { kind: 'smalltalk', line } };
}
