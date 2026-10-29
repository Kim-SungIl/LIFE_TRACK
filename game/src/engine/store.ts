import { create } from 'zustand';
import { buildRomanceRetry, canStartRomanceRetry, romanceRetryNpc, type RomanceNpc, type RomancePlan, readRomancePlan, resumedRomancePlan } from './romance';
import { GameState, ParentStrength, type MonthPlan, type MonthRun, type PlaybackStop } from './types';
import { createInitialState, processWeek, getWeekInfo, settleMonthStartIfDue } from './gameEngine';
import { payRoutineIfDue } from './monthlyMoney';
import { getCurrentMonthPlan, getPlannedWeek, validateMonthPlan } from './monthPlan';
import {
  addMissedTalks, boundaryStopAfter, checkPlannedWeek, createMonthRun, getMonthRun, migrateTalkLedgers, recordWeek, talkBankCount, talkChances,
  totalTalks, isWellFormedMonthRun,
} from './monthPlayback';
import { getMonthBlock } from './weekMath';
import { applyDeclinedInvites, validateInviteAnswers } from './monthInvites';
import { migrateLoadedState, runSaveMigrations, CURRENT_SAVE_VERSION } from './stateMigration';
import { cloneGameState } from './stateClone';
import {
  resolveCurrentEvent, talkToNpcOutcome, visibleSnapshot, accruePendingDelta, applyVisibleTalkEffects, spendTalkBank,
  type AppliedEventOutcome, type TalkActionResult,
} from './eventResolution';
import { describeUnplayable } from './saveIntegrity';
import { ShopItem, applyItemEffects, canBuyItem, limitKey } from './shopSystem';
import { GAME_EVENTS } from './events';
import { assignCurrentEvent } from './eventPresentation';
import { applyMemorySlotFromMiniTalk, recordMilestoneForYear } from './memorySystem';
import { getAvailableHomeEvents, getEligibleParentClimax, getHomeSmalltalk } from './talkSystem';
import { PARENT_MINI_EVENTS } from './talkData';
import { applyParentIntimacyDelta } from './parentIntimacy';
import { absWeek } from './relationshipSignals';
import {
  commitRun, beginRun, accrueFromState, accrueResolvedEvent, accrueTalk, accrueParentEvent,
  newRunId, needsRecommit, alreadyCommitted, isRunId,
  type RunDelta,
} from './archive';
import { calculateEnding } from './ending';
import { recordMoneyBlockedWeek, recordMoneyBlockedWeeks } from './moneyTrajectory';
import { captureWeekendPlan } from './weekendPlan';
import { saveLastSetup } from './lastSetup';
import { pickSemesterGoal, type GoalOffer } from './semesterGoal';

// 화면·테스트가 store에서 가져다 쓰던 타입 — 본체는 eventResolution.ts로 옮겼다.
export type { AppliedEventOutcome, TalkActionResult };

// 부모 미니이벤트 발동 기록(쿨다운/로테이션용) — id당 마지막 발동 주차만 유지.
function recordParentEventFired(state: GameState, id: string): void {
  const prev = (state.parentEventsFired ?? []).filter(f => f.id !== id);
  state.parentEventsFired = [...prev, { id, week: state.totalWeeksPlayed ?? 0 }];
}

const SAVE_KEY = 'lifetrack_save';

interface SaveData {
  version: number;
  state: GameState;
  savedAt: string;
}

function saveToStorage(state: GameState) {
  try {
    const savedAt = new Date().toISOString();
    const data: SaveData = { version: CURRENT_SAVE_VERSION, state, savedAt };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    storageSaveFailed = false;
    lastSavedAt = savedAt;
  } catch {
    // storage full/unavailable — 진행은 계속하되 UI가 배너로 알릴 수 있게 플래그만 세운다.
    storageSaveFailed = true;
  }
}

// 마지막 저장 시도 실패 여부 — 저장은 state 변경마다 subscribe에서 동기 실행되므로,
// 렌더 시점에 이 getter를 읽으면 항상 최신이다 (진행 손실을 사용자가 모른 채 지나가지 않게).
let storageSaveFailed = false;
export function isStorageSaveFailed(): boolean { return storageSaveFailed; }
// 마지막 저장 성공 시각(ISO) — HUD 저장 인디케이터용. 위와 동일하게 렌더 시점 최신.
let lastSavedAt: string | null = null;
export function getLastSavedAt(): string | null { return lastSavedAt; }

/**
 * 세이브가 **있는데 못 읽는** 이유. (T36)
 *
 * 예전엔 이 셋이 전부 `null`이었다 — "세이브가 없다"와 같은 값이다. 그래서 타이틀은
 * 이어하기를 안 그리는 것으로 끝났고, 플레이어는 자기 저장이 왜 사라졌는지 한 마디도 못 들었다.
 * Chromium 주입 실측: 절단 JSON·`version=99` 둘 다 **안내 0건·콘솔 0건**(구조 손상 14종은
 * 전부 "이 저장을 열 수 없어요"가 떴다 — 그 비대칭을 메운다).
 *
 * 거부는 유지한다(#441 "판정 불가 손상값은 접지 말고 거부") — 다만 **말하고** 거부한다.
 */
export type SaveUnreadableReason =
  /** JSON이 안 풀린다. 쓰는 도중 탭이 죽으면 뒷부분이 잘린 채 남는다 — 복구 불가. */
  | 'truncated'
  /** 파싱은 됐는데 진행 내용(`state`)이 없다. */
  | 'no-state'
  /** 더 새로운 빌드가 쓴 세이브. 구버전 step으로 미지의 구조를 다룰 수 없다 — **지우지 않는다.** */
  | 'future-version';

/**
 * 세이브 읽기 결과. **`null` 하나로 접지 않는다** — `none`(처음 온 사람)과
 * `unreadable`(저장이 있는데 못 연다)은 화면에서 서로 다른 일이기 때문이다.
 */
export type SaveReadResult =
  | { kind: 'none' }
  | { kind: 'ok'; data: SaveData }
  | { kind: 'unreadable'; reason: SaveUnreadableReason };

export function loadFromStorage(): SaveReadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    // 저장소 접근 자체가 막힌 경우(사생활 보호 모드 등). 이건 이 세이브의 문제가 아니라
    // 브라우저 상태이고, 지울 것도 없으므로 손상 안내를 띄우지 않는다.
    return { kind: 'none' };
  }
  if (!raw) return { kind: 'none' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'unreadable', reason: 'truncated' };
  }
  if (typeof parsed !== 'object' || parsed === null || !(parsed as SaveData).state) {
    return { kind: 'unreadable', reason: 'no-state' };
  }
  const data = parsed as SaveData;
  // 스탬프 정규화(버전 도입 이전/손상 세이브 = v1). 과거 버전은 버리지 않는다 —
  // loadSavedGame에서 단계형 마이그레이션(runSaveMigrations)으로 살린다.
  const version = Number.isInteger(data.version) && data.version >= 1 ? data.version : 1;
  // 미래 버전(구버전 앱에서 신버전 세이브를 여는 다운그레이드)은 거부하되 **지우지 않는다** —
  // 다른 기기나 최신 빌드에서는 멀쩡히 열리는 세이브다. 삭제는 사용자가 누를 때만.
  if (version > CURRENT_SAVE_VERSION) return { kind: 'unreadable', reason: 'future-version' };
  return { kind: 'ok', data: { ...data, version } };
}

export function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}

interface GameStore {
  state: GameState | null;
  // 이번 판이 기록에 무엇을 처음 더했는지 — 엔딩 화면 전용. 세이브에 넣지 않는 이유는
  // 스키마 마이그레이션 없이 끝내려는 것 + 새로고침 후엔 "이번 판" 개념이 이미 지난 일이기 때문.
  runDelta: RunDelta | null;
  npcActivityMap: Record<string, string>; // activityId -> npcId
  startGame: (gender: 'male' | 'female', parents: [ParentStrength, ParentStrength], options?: { useReducedRecovery?: boolean }) => void;
  loadSavedGame: () => boolean;
  resetGame: () => void;
  /**
   * 세이브를 **남긴 채** 타이틀로 나간다. resetGame과의 차이가 요점이다 —
   * 엔딩을 본 판은 지우지 않으므로 타이틀에서 "엔딩 다시 보기"로 되돌아올 수 있다.
   * (App이 state===null이면 TitleScreen을 그린다.)
   */
  exitToTitle: () => void;
  setRoutine: (slot2: string | null, slot3: string | null) => void;
  setWeekendChoices: (choices: string[]) => void;
  setVacationChoices: (choices: string[]) => void;
  /**
   * 확정한 주의 주말/방학 계획을 스냅샷으로 남긴다 — "지난주처럼" 1탭 복사의 원본.
   *
   * **확정 경로에서만, `advanceWeek` 직전에** 부른다(그래야 processWeek이 클론에 싣고 간다).
   * 계획이 비어 있으면 스냅샷을 **지운다** — 라벨이 '지난주처럼'이라 두 주 전 계획을
   * 되살리면 거짓말이 된다.
   */
  recordWeekendPlan: (activities: string[], npcChoices: Record<string, string>) => void;
  setNpcActivityMap: (map: Record<string, string>) => void;
  /**
   * 한 주를 확정한다 — 계획 화면의 "이번 주 확정"이 부르는 **유일한** 경로.
   *
   * 순서가 계약이다: 슬롯(학기 주말 / 방학 자유) → 동행 → "지난주처럼" 스냅샷 → `advanceWeek`.
   * 스냅샷은 반드시 `advanceWeek` 앞이어야 processWeek이 클론에 싣고 간다. 예전엔 GameScreen이
   * 이 넷을 손으로 엮었다. 월 단위 자동 진행기(docs/monthly-plan-design-2026-10.md)가 같은 순서를
   * 따로 짜면 동행이나 스냅샷이 조용히 빠지므로, 확정은 여기 하나로 모은다.
   * 화면 순서와 바이트 동일한지는 weeklyDriverGolden.test.ts가 잠근다.
   */
  confirmWeek: (activities: string[], npcChoices: Record<string, string>) => void;
  /**
   * 이번 달 계획을 저장한다(monthPlan.ts). 지금 (학년, 달)·남은 주·칸 수·활동·동행이 맞아야 하고,
   * 안 맞으면 저장하지 않고 이유를 돌려준다(null = 저장됨). 남은 주의 유료 활동비가 봉투로 예약된다.
   */
  setMonthPlan: (plan: MonthPlan) => string | null;
  advanceWeek: () => void;
  // 반환: 실제 적용된 효과(구간 감쇠·클램프 반영) — 결과 화면 표시는 이 실측값을 쓴다.
  resolveEvent: (choiceIndex: number) => AppliedEventOutcome | undefined;
  advanceFromYearEnd: () => void;
  setPhase: (phase: GameState['phase']) => void;
  buyItem: (item: ShopItem, targetNpcId?: string) => string[];
  // Phase 2.1 말걸기 — 결과(event/smalltalk) 반환, 효과는 즉시 적용
  // 무한 클릭 가능 — 사전 결정에 따라 이벤트가 떨어지거나 잡담 한 줄
  talkToNpc: (npcId: string) => TalkActionResult;
  startRomanceRetry: (npcId: string, plan?: RomancePlan) => boolean;
  consumeRomancePlan: () => void;
  talkToHome: () => TalkActionResult;
  // Phase 2A — 부모 ±선택지 이벤트의 선택 적용 (talkToHome이 띄운 choice 이벤트에 대해 호출)
  resolveParentTalkChoice: (eventId: string, choiceIdx: number) => void;
  // ===== 개발 환경 한정 디버그 메서드 (DebugPanel에서 호출) =====
  debugAdvanceToYearEnd: () => void;
  debugSkipToEnding: () => void;
  debugSetStat: (key: 'academic' | 'social' | 'talent' | 'mental' | 'health', value: number) => void;
  debugForceParentEvent: () => void;
  // T25 — 계획 화면의 확정 버튼이 **돈 때문에** 잠긴 주를 알린다.
  // 판정 주체가 UI인 이유: 그 주는 확정되지 않으므로 processWeek에 도달하지 않는다.
  markMoneyBlockedWeek: () => void;
  /**
   * 월 계획 화면의 [이번 달 시작]이 돈 때문에 잠겼다 — 그 달 남은 주를 "막힌 주"로 한 번 센다(moneyTrajectory.ts 헤더).
   * 같은 달은 한 번만. 화면이 매 렌더 알려와도 안전하다.
   */
  markMoneyBlockedMonth: () => void;
  /**
   * T68 — 이번 학기 목표를 고른다. 판정(고를 수 있는 때·후보)은 `semesterGoal.ts` 하나다.
   * 제시된 후보가 아니거나 고를 수 없는 때면 아무것도 안 하고 false. 스탯·rng 무관(기록만).
   */
  chooseSemesterGoal: (offer: GoalOffer) => boolean;
  /**
   * 이번 달 자동 진행(monthPlayback.ts, 설계안 §5). 계획을 저장한 뒤 부른다 — 이번 달 재생 상태를 만들고(이미 있으면 이어서)
   * 이번 주를 계획대로 확정한다. 확정은 confirmWeek 하나를 탄다(사람이 누른 판과 같은 상태).
   */
  startMonthPlayback: () => void;
  /**
   * 재생 카드(phase 'result')에서 다음으로 — 주 경계다. 멈출 이유가 적혀 있으면 멈추고(계획 단계에 선다),
   * 아니면 다음 주를 재생한다. 달의 마지막 주 뒤에는 부르지 않는다(월말 결산 → finishMonth).
   */
  continuePlayback: () => void;
  /** ⏸ / 💬 / 🛒 — 계획 단계면 바로 멈추고, 처리 중(사건·카드)이면 다음 주 경계에서 멈추도록 적어 둔다. */
  pausePlayback: (reason: Extract<PlaybackStop, 'player' | 'talk' | 'shop'>) => void;
  /** 멈춘 재생을 이어간다(계획 단계에서). */
  resumePlayback: () => void;
  /** 월말 결산을 닫는다 — 재생이 지나친 대화 기회를 다음 달 적립으로 넘기고 다음 달 계획 화면으로. */
  finishMonth: () => void;
}

/**
 * 완주 정산 — phase가 'ending'으로 **처음** 넘어가는 순간에만 부른다.
 *
 * 이벤트·미니이벤트·CG는 이제 본 순간에 적립된다(accrue* 호출부 참조). 여기서 하는 일은
 * 완주 게이트 축(runs·endings)을 올리고 "이번 판에서 처음 본 것"을 RunDelta로 정산하는 것뿐이다.
 * runs는 이 스키마에서 유일한 비멱등 필드라, 중복 위험을 이 한 곳에 가둬 두는 게 핵심이다.
 *
 * 왜 전이 감지인가: 엔딩 진입 경로가 하나가 아니다. Y7 W48은 대기 이벤트 유무에 따라
 * processWeek(advanceWeekCounter) 또는 resolveEvent(resolveEventChain)에서 applyYearTransition을
 * 거쳐 곧장 'ending'이 된다 — **year-end를 경유하지 않는다**. 그래서 advanceFromYearEnd에
 * 적립을 매달아 뒀더니 실제 플레이에서 한 번도 안 걸렸다(디버그 패널로만 발동).
 *
 * 반대로 엔딩 화면의 useEffect에 걸면 안 된다 — 새로고침·리마운트마다 완주 횟수가 부푼다.
 * "이전 phase가 ending이 아니었다"가 한 판에 정확히 한 번을 보장하는 유일한 조건이다.
 */
function commitOnEnding(prev: GameState, next: GameState): RunDelta | null {
  if (next.phase !== 'ending' || prev.phase === 'ending') return null;
  try {
    // 같은 판을 두 번 세지 않는다 — 기록은 닿았는데 세이브가 엔딩 전에 머문 판(세이브 키만
    // 쓰기 실패)을 이어하기로 다시 끝내면 이 전이가 또 걸린다(archive.alreadyCommitted 참조).
    // 요약은 기록층의 lastRunDelta가 이미 들고 있다.
    if (alreadyCommitted(next)) return null;
    return commitRun(next, calculateEnding(next).title);
  } catch {
    return null;   // 기록 실패가 엔딩을 막지 않는다
  }
}

// ===== 한 달 자동 진행(monthPlayback.ts) — store 쪽 걸음 =====

type StoreGet = () => GameStore;
type StoreSet = (partial: Partial<GameStore>) => void;

/** 두 processWeek 사이의 계획 단계 — 주간 화면이 뜨는 phase. */
function isPlanningPhase(s: GameState): boolean {
  return s.phase === 'weekday' || s.phase === 'weekend' || s.phase === 'vacation';
}

function pausedRun(run: MonthRun, stop: PlaybackStop, stopDetail?: string): MonthRun {
  return { ...run, status: 'paused', stop, stopDetail, stopAtBoundary: undefined };
}

/**
 * 재생 중이면 이번 주를 계획대로 확정한다 — **확정은 confirmWeek 하나**(사람이 누른 것과 같은 길).
 * 계획이 성립하지 않으면(돈·동행 부재) 확정하지 않고 멈춘다. 확정 전에 이번 주 대화 기회를 지나치는지 센다(§8 월 적립).
 */
function playPlannedWeek(get: StoreGet, set: StoreSet): void {
  const s = get().state;
  const run = s && getMonthRun(s);
  if (!s || !run || run.status !== 'playing' || !isPlanningPhase(s)) return;
  const invalid = checkPlannedWeek(s);
  if (invalid) {
    set({ state: { ...s, monthRun: pausedRun(run, 'plan-invalid', invalid) } });
    return;
  }
  const chances = talkChances(s);
  if (chances.npc || chances.home) {
    set({ state: { ...s, monthRun: { ...run, missedTalks: addMissedTalks(run.missedTalks, chances) } } });
  }
  const planned = getPlannedWeek(s)!;
  get().confirmWeek([...planned.activities], { ...planned.npcChoices });
}

/** 이 주가 이미 "막힌 달"로 센 구간(그 달 fromWeek~달 끝)에 드는가. 손상된 표시는 없는 것으로 본다. */
function inBlockedMonth(s: GameState): boolean {
  const m = s.moneyBlockedMonth;
  if (!m || typeof m.year !== 'number' || typeof m.month !== 'number' || typeof m.fromWeek !== 'number') return false;
  if (s.week < 1 || s.week > 48) return false;
  return m.year === s.year && m.month === getMonthBlock(s.week).index && s.week >= m.fromWeek;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  runDelta: null,
  npcActivityMap: {},

  startGame: (gender, parents, options) => {
    const initial = createInitialState(gender, parents, options);
    // 판 신원 — **엔진이 아니라 여기서** 붙인다(types.ts runId 참조: 순수함수의 결정론을 안 깬다).
    // 아래 saveToStorage보다 먼저여야 세이브가 신원을 들고 간다.
    initial.runId = newRunId();
    // 튜토리얼 지연 — 시스템 설명보다 첫 장면(first-week, 지훈 재회)이 먼저 오도록 phase='event'로 부팅.
    // MainWeekScreen이 이벤트 동안 마운트되지 않아 튜토리얼 게이트는 장면 종료 후 첫 계획 화면에서 열리고,
    // week:1로 기록되므로 첫 주 결산의 fixed 선택에서 중복 발동하지 않는다.
    const firstScene = GAME_EVENTS.find(e => e.id === 'first-week');
    if (firstScene) {
      assignCurrentEvent(initial, firstScene, firstScene.week ?? 1);
    }
    // "이번 판에서 처음 본 이야기"의 기준선 리셋 — 세이브 덮어쓰기보다 먼저.
    // 새 판의 유일한 진입점이 여기이므로 리셋 지점도 여기 한 곳이다(loadSavedGame은 건드리지 않는다).
    beginRun();
    // 직전 판 설정 기록 — "같은 집에서 다시"의 입력. 새 판의 진입점이 여기 한 곳이므로
    // 입구(타이틀·기록실·엔딩)를 몇 개 만들어도 기록 지점은 늘지 않는다.
    saveLastSetup({ gender, parents, useReducedRecovery: !!options?.useReducedRecovery });
    set({ state: initial, runDelta: null });
    saveToStorage(initial);
    // tutorial_done만 지운다 — 새 판마다 튜토리얼을 다시 띄우기 위해서다.
    // 영속 플래그(lifetrack_tutorial_ever_seen / has_cleared / rest_ack)는 **의도적으로 남긴다**:
    // 셋 다 "플레이어가 한 번 배운 것"이라 새 판이라고 다시 가르칠 이유가 없다.
    // rest_ack = 주말을 비우는 게 실수가 아님을 한 번 확인한 표시(MainWeekScreen).
    // 여기에 removeItem을 추가하면 그 되묻기가 매 판 부활하니 주의.
    localStorage.removeItem('lifetrack_tutorial_done');
  },

  /**
   * **던지지 않는다 — 못 열면 false다.**
   *
   * loadFromStorage는 "JSON이 파싱되고 state 키가 있나"만 본다. 안쪽 구조는 안 보므로
   * 형태가 망가진 세이브가 그대로 통과해 하류에서 터졌다. 실측한 크래시 지점:
   *   · `parents`가 배열이 아니면 migrateLoadedState의 `.map`      (문자열·숫자·객체·true)
   *   · `npcs` / `vacationChoices`도 같은 형태로 `.map` / `.filter`
   *   · `parents`가 falsy면 map 가드는 통과하고, rngSeed 없는 구세이브에서 rng.ts의 `.join`
   *
   * **왜 정규화가 아니라 거부인가**: Array.isArray로 펴서 살리면 손상된 세이브를 조용히
   * "고쳐서" 플레이어가 고른 적 없는 상태로 7년을 진행시킨다. 못 여는 것보다 나쁘다.
   *
   * 이 예외는 **onClick 안에서 동기로** 나므로 React 에러 바운더리가 못 잡는다
   * (바운더리는 렌더 중 예외만 본다). 그래서 화면에는 아무 일도 안 일어난 것처럼 보였다 —
   * 버튼이 그냥 안 눌리는 것 같았고, 에러도 배너도 0이었다. 호출부가 false를 받아 안내한다.
   */
  loadSavedGame: () => {
    const save = loadFromStorage();
    // 못 읽는 세이브(절단·미래 버전)는 여기서 끝난다 — **사유는 타이틀이 말한다**(SaveReadResult).
    if (save.kind !== 'ok') return false;
    try {
      // 단계형(버전 격상) → 정규화(백필·재수화) 순서 — step은 격상 전 구조를 전제로 쓴다.
      const loaded = migrateLoadedState(runSaveMigrations(save.data.state, save.data.version));
      // **try/catch만으로는 부족하다.** 그 방어는 마이그레이션 중 실제로 터지는 손상만 거른다 —
      // `parents: null`이라도 rngSeed가 멀쩡하면 아무 데서도 안 터져 그대로 통과했고,
      // 그러면 손상 안내가 안 뜬 채 깨진 state가 set 되고 자동저장이 그걸 디스크에 다시 썼다.
      const why = describeUnplayable(loaded);
      if (why !== null) {
        console.error('[loadSavedGame] 구조가 깨진 세이브:', why);
        return false;
      }
      // 즉시 적립이 배포되기 전에 만들어진 세이브는 이 판의 이벤트가 archive를 한 번도 지나지
      // 않았다 — 여기서만 구제된다. 멱등이고, 이미 다 적립된 세이브면 쓰기 없이 끝난다.
      accrueFromState(loaded);
      // 신원 백필 — **아직 엔딩에 안 닿은 구세이브만.** 엔딩에 앉은 구세이브에 신원을 주면
      // 이미 세어진 판이 "안 닿은 판"으로 보여 완주가 부푼다(types.ts runId 참조).
      // 문자열이 아닌 신원(손상·수동 편집)은 **신원 없음**으로 접는다 — 남겨 두면 재커밋 판정은
      // 통과하는데 원장에는 안 남아 이어하기마다 완주가 부푼다(archive.isRunId 참조).
      if (!isRunId(loaded.runId)) loaded.runId = undefined;
      if (!loaded.runId && loaded.phase !== 'ending') loaded.runId = newRunId();
      // 완주 재커밋 — 기록 쓰기가 실패한 판이 세이브에 남아 있으면 여기서 되살린다.
      // accrueFromState가 events·talks·CG를 이미 자가치유했지만 runs·endings는 state에
      // 근거가 없어 이 호출이 유일한 복구 경로다. 판정·멱등의 근거는 archive.needsRecommit.
      if (needsRecommit(loaded)) commitRun(loaded, calculateEnding(loaded).title);
      // 재생 중에 껐다 켰으면 멈춘 채로 연다(설계안 §10). 사건·카드 중이었으면 그 화면을 마치고 경계에서 선다.
      migrateTalkLedgers(loaded);
      if (loaded.monthRun !== undefined && !isWellFormedMonthRun(loaded.monthRun)) delete loaded.monthRun;
      if (loaded.monthRun?.status === 'playing') loaded.monthRun = { ...loaded.monthRun, status: 'paused', stop: 'reload' };
      set({ state: loaded, runDelta: null });
      return true;
    } catch (e) {
      // 진단은 남긴다(ErrorBoundary와 같은 형식). 상태는 건드리지 않는다 —
      // 반쯤 적용된 state로 두면 화면이 더 이상한 곳에 착지한다.
      console.error('[loadSavedGame] 손상된 세이브', e);
      return false;
    }
  },

  resetGame: () => {
    deleteSave();
    // 기록(lifetrack_archive)은 지우지 않는다 — 새 게임은 한 판을 리셋하는 것이지
    // 지금까지의 학창시절들을 없애는 게 아니다.
    set({ state: null, runDelta: null, npcActivityMap: {} });
  },

  exitToTitle: () => {
    // **deleteSave를 부르지 않는다** — 이게 resetGame과의 유일한 차이이고 전부다.
    // 엔딩에서 나가는 길이 세이브를 지우면 그 판의 엔딩은 두 번 다시 못 본다.
    // 자동 저장 구독은 state가 truthy일 때만 쓰므로 null로 두는 것이 세이브를 건드리지 않는다.
    set({ state: null, runDelta: null, npcActivityMap: {} });
  },

  setRoutine: (slot2, slot3) => {
    const s = get().state;
    if (!s) return;
    // 슬롯별로 변경 여부 판단 — 안 바뀐 슬롯은 보너스 카운터 유지
    const slot2Weeks = s.routineSlot2 === slot2 ? s.routineSlot2Weeks : 0;
    const slot3Weeks = s.routineSlot3 === slot3 ? s.routineSlot3Weeks : 0;
    const next = cloneGameState(s);
    Object.assign(next, {
      routineSlot2: slot2, routineSlot3: slot3,
      routineSlot2Weeks: slot2Weeks, routineSlot3Weeks: slot3Weeks,
    });
    // 한 달 등록(monthlyMoney.ts) — 새로 든 유료 칸은 이번 달 남은 학기 주 수 × 주 단가를 **지금** 낸다.
    // 이미 낸 돈은 안 돌아온다(디렉터 결정 (가)). 모자라면 안 내고 두며, 확정 잠금이 막는다.
    // 계획 단계의 지출이라 상점처럼 보류분으로 남겨 이 주 결산에 보이게 한다.
    const before = visibleSnapshot(next);
    payRoutineIfDue(next);
    accruePendingDelta(next, before);
    set({ state: next });
  },

  setWeekendChoices: (choices) => {
    const s = get().state;
    if (!s) return;
    set({ state: { ...s, weekendChoices: choices } });
  },

  setVacationChoices: (choices) => {
    const s = get().state;
    if (!s) return;
    set({ state: { ...s, vacationChoices: choices } });
  },

  recordWeekendPlan: (activities, npcChoices) => {
    const s = get().state;
    if (!s) return;
    // captureWeekendPlan이 빈 계획에 null을 준다 → 스냅샷을 지운다(위 주석).
    set({ state: { ...s, lastWeekendPlan: captureWeekendPlan(activities, npcChoices, s.isVacation) ?? undefined } });
  },

  setNpcActivityMap: (map) => {
    set({ npcActivityMap: map });
  },

  setMonthPlan: (plan) => {
    const s = get().state;
    if (!s) return 'state 없음';
    // 칸·주·달 검증과 초대 답 검증 — 둘을 한 파일에 두면 monthPlan ↔ monthInvites 순환이 생겨 여기서 잇는다.
    // 지금 달 계획이 이미 있으면 달 중간에 다시 짜는 것이다(재생이 멈춘 뒤 "남은 주 다시 짜기") — 초대는 처음 그대로.
    const existing = getCurrentMonthPlan(s);
    const reason = validateMonthPlan(s, plan) ?? validateInviteAnswers(s, plan, existing);
    if (reason) return reason;
    const next = cloneGameState(s);
    next.monthPlan = structuredClone(plan);
    // 거절한 초대마다 친밀도 −1 — 처음 저장할 때 한 번(디렉터 결정 2026-10-25). 다시 짤 때 또 깎지 않는다.
    if (!existing) applyDeclinedInvites(next, plan.invites ?? []);
    set({ state: next });
    return null;
  },

  confirmWeek: (activities, npcChoices) => {
    const s = get().state;
    if (!s) return;
    // advanceWeek과 **같은 집합**에서 거부한다. 예전엔 결산·사건 중에 다시 불리면 advanceWeek만 조용히
    // return하고 슬롯·동행·"지난주처럼" 스냅샷은 덮였다(3자 검수 재현). 화면은 계획 단계에서만 부르지만,
    // 월 자동 진행기가 setPhase('weekday')를 빠뜨리면 스냅샷이 소리 없이 오염되는 자리라 여기서 막는다.
    if (s.phase === 'event' || s.phase === 'result' || s.phase === 'year-end' || s.phase === 'ending') return;
    // 달 초에 돈이 모자라 못 낸 이번 달 루틴비를 그 뒤 낼 수 있게 됐으면 확정 직전에 낸다(미리보기도 같은 순서).
    {
      const due = cloneGameState(s);
      const before = visibleSnapshot(due);
      if (payRoutineIfDue(due) > 0) {
        accruePendingDelta(due, before);
        set({ state: due });
      }
    }
    if (get().state!.isVacation) get().setVacationChoices(activities);
    else get().setWeekendChoices(activities);
    // npcChoices를 그대로 전달 (슬롯 키 포함 — processWeek에서 npcId만 추출)
    get().setNpcActivityMap(npcChoices);
    get().recordWeekendPlan(activities, npcChoices);
    // advanceWeek가 phase를 result/event/year-end/ending으로 전환 → 라우터가 알아서 분기.
    get().advanceWeek();
  },

  advanceWeek: () => {
    const s = get().state;
    if (!s) return;
    if (s.phase === 'event' || s.phase === 'result' || s.phase === 'year-end' || s.phase === 'ending') return;
    const newState = processWeek(s, get().npcActivityMap);
    // 이번 달 재생 기록 — 손으로 확정한 주도 적는다(월말 결산의 "계획 vs 실제"). 재생 중이면 다음 경계의 멈춤도 정한다.
    const run = getMonthRun(s);
    if (run) {
      const entry = recordWeek(s, newState, run.status === 'playing');
      const stop = run.status === 'playing' ? boundaryStopAfter(entry) : null;
      newState.monthRun = {
        ...structuredClone(run),
        log: [...run.log.map(w => structuredClone(w)), entry],
        // 이 시점엔 멈춤 요청이 없다(재생은 요청을 경계에서 소비한 뒤에만 주를 처리한다). 사건·카드 중의 ⏸·💬·🛒는
        // pausePlayback이 이미 적힌 이유를 덮지 않으므로 번아웃·계절 경계가 앞선다.
        ...(stop ? { stopAtBoundary: stop } : {}),
      };
    }
    // 이벤트/학년말/엔딩이 아니면 주간 결산 단계(phase='result')로 전환.
    // 결산을 React 로컬 state가 아닌 phase로 표현해 새로고침 후에도 결산 화면이 유지되게 한다.
    if (newState.phase !== 'event' && newState.phase !== 'year-end' && newState.phase !== 'ending') {
      newState.phase = 'result';
    }
    const runDelta = commitOnEnding(s, newState);
    set({ state: newState, npcActivityMap: {}, ...(runDelta ? { runDelta } : {}) });
  },

  consumeRomancePlan: () => {
    const s = get().state;
    if (!s || s.currentEvent || !resumedRomancePlan(s)) return;
    const next = cloneGameState(s);
    for (const event of next.events) {
      if (romanceRetryNpc(event.id) && event.year === s.year && event.week === s.week
          && event.romanceReturnPhase === s.phase && event.resolvedChoice !== undefined) {
        delete event.romancePlan;
      }
    }
    set({ state: next });
  },

  startRomanceRetry: (npcId, plan) => {
    const s = get().state;
    if (!s || !canStartRomanceRetry(s, npcId)) return false;
    const event = buildRomanceRetry(s, npcId as RomanceNpc, s.phase as 'weekday' | 'weekend' | 'vacation');
    if (!event) return false;
    const next = cloneGameState(s);
    const savedPlan = readRomancePlan(plan);
    assignCurrentEvent(next, savedPlan ? { ...event, romancePlan: savedPlan } : event, s.week);
    set({ state: next });
    return true;
  },

  resolveEvent: (choiceIndex) => {
    const s = get().state;
    if (!s) return;
    const resolved = resolveCurrentEvent(s, choiceIndex, { onEventRecorded: accrueResolvedEvent });
    if (!resolved) return;
    const runDelta = commitOnEnding(s, resolved.state);
    set({ state: resolved.state, ...(runDelta ? { runDelta } : {}) });
    return resolved.applied;
  },

  setPhase: (phase) => {
    const s = get().state;
    if (!s) return;
    set({ state: { ...s, phase } });
  },

  advanceFromYearEnd: () => {
    const s = get().state;
    if (!s || s.phase !== 'year-end') return;
    const newState = cloneGameState(s);
    newState.week = 1;
    newState.year++;
    newState.currentEvent = null;
    // 지난 학년의 재생·대화 적립은 새 학년으로 넘어가지 않는다(학년말 화면이 그 달 결산을 대신한다).
    delete newState.monthRun;
    delete newState.talkBank;
    // 방어적 분기 — 정상 플레이에서 Y7은 year-end를 거치지 않으므로 여기 도달하지 않는다
    // (applyYearTransition이 곧장 'ending'으로 보낸다). 디버그 패널 경로만 여기를 지난다.
    if (newState.year > 7) {
      newState.phase = 'ending';
    } else {
      newState.phase = 'weekday';
      const nextInfo = getWeekInfo(newState.week);
      newState.semester = nextInfo.semester;
      newState.isVacation = nextInfo.isVacation;
      // 새 학년 3월 — 그 달 용돈(새 학년 단가)과 루틴 선불. W48 처리 뒤엔 W49라 달이 아니어서 여기서 받는다.
      settleMonthStartIfDue(newState);
    }
    const runDelta = commitOnEnding(s, newState);
    set({ state: newState, ...(runDelta ? { runDelta } : {}) });
  },

  buyItem: (item, targetNpcId) => {
    const s = get().state;
    if (!s) return [];
    // 엔진 계층 방어 — UI 버튼은 canBuyItem으로 게이팅되지만, 우회 호출 시
    // 시즌·주간 한도·학년·스탯·중복 buff 게이트가 무시되지 않도록 여기서도 검증.
    const gate = canBuyItem(item, s, s.weekPurchases || {});
    if (!gate.ok) return gate.reason ? [gate.reason] : [];
    const before = visibleSnapshot(s);
    const { newState, messages } = applyItemEffects(item, s, targetNpcId);
    // 구매도 weekday 단계라 이번 주 로그가 아직 없다 — 남기지 않으면 결산이 지출을 못 보고
    // 주간 용돈만 세서 **부호를 뒤집는다**(15만원을 쓴 주에 "+7" 초록). 즉시 효과만 잡히고
    // 나중에 발동하는 buff는 그때의 로그가 가져간다(여기선 차분이 0).
    accruePendingDelta(newState, before);
    // 구매 횟수 추적 (limitGroup 공유 슬롯은 그룹 키로 합산)
    const key = limitKey(item);
    newState.weekPurchases = { ...newState.weekPurchases };
    newState.weekPurchases[key] = (newState.weekPurchases[key] || 0) + 1;
    set({ state: newState });
    return messages;
  },

  // ===== Phase 2.1 말걸기 (사전 결정 모델) =====
  // 사전 결정: processWeek에서 npcEventPendingThisWeek/parentEventPendingThisWeek 굴림.
  // 클릭은 결과 보는 행위 — 무한 가능. pending+풀 가용시 fire, 그 외엔 잡담.
  // pressure는 fire 시점에만 0 리셋 (놓친 주는 누적 유지 → 오래 안 만나면 자연스럽게 100% 보장).
  talkToNpc: (npcId) => {
    const s = get().state;
    if (!s) return { kind: 'smalltalk', line: '' };
    const { state, result } = talkToNpcOutcome(s, npcId, { onMiniTalkFired: accrueTalk });
    if (state) set({ state });
    return result;
  },

  talkToHome: () => {
    const s = get().state;
    if (!s) return { kind: 'smalltalk', line: '' };

    // Phase 4B: 강점별 "절정 순간" — 미니이벤트보다 우선. 선택지 없는 단일 컷, 평생 1회.
    // pressure RNG와 무관하게(결정론적 마일스톤) 발동 가능 시점에 가정 대화로 surface된다.
    const climax = getEligibleParentClimax(s);
    if (climax) {
      const newState = cloneGameState(s);
      applyVisibleTalkEffects(newState, climax.effects);  // strict만 멘탈 +2, 나머지 스탯 0(친밀도 가산 없음)
      applyMemorySlotFromMiniTalk(newState, climax.id, climax.memorySlotDraft);
      newState.parentClimaxFired = [...(newState.parentClimaxFired ?? []), climax.parentStrength];
      newState.actedWithParentThisWeek = true;
      newState.parentTalkPressure = 0;
      newState.parentEventPendingThisWeek = false;
      // 절정은 평생 1회 — 이 판을 완주하지 않으면 v1에서는 어디에도 남지 않았다.
      // 실제 이벤트 id를 넘긴다(합성 키는 CG 리졸버에서 절대 매칭되지 않는다).
      accrueParentEvent(newState, climax.id);
      set({ state: newState });
      return { kind: 'event', event: climax };
    }

    if (s.parentEventPendingThisWeek || talkBankCount(s, 'home') > 0) {
      const available = getAvailableHomeEvents(s);
      if (available.length > 0 && !s.parentEventPendingThisWeek) {
        // 이번 주 기회가 없으면 지난달 재생이 지나친 적립(talkBank, 설계안 §8) 하나를 이번 주 기회로 바꿔 쓴다 —
        // 그 뒤는 평소 경로 그대로다(선택지 이벤트는 닫았다 열어도 같은 이벤트, 정산은 resolveParentTalkChoice).
        const converted = cloneGameState(s);
        converted.parentEventPendingThisWeek = true;
        spendTalkBank(converted, 'home');
        set({ state: converted });
        return get().talkToHome();
      }
      if (available.length > 0) {
        const ev = available[0];
        // Phase 2A — ±선택지 이벤트: 효과는 선택 시점(resolveParentTalkChoice)에 적용.
        // 여기선 상태를 건드리지 않으므로 모달을 닫았다 다시 눌러도 같은 이벤트가 뜬다(선택 전 = 보류).
        if (ev.choices && ev.choices.length > 0) {
          return { kind: 'event', event: ev };
        }
        // 레거시(선택지 없는) 이벤트: 기존처럼 즉시 적용 + 발동 기록.
        const newState = cloneGameState(s);
        applyVisibleTalkEffects(newState, ev.effects);
        if (ev.effects.parentIntimacy) {
          // 단일 진입점 통합 — 강점 반응 배율·구간 감쇠 적용 (직접 가산 금지)
          applyParentIntimacyDelta(newState, ev.effects.parentIntimacy, ev.parentTag ?? 'familyTime');
        }
        applyMemorySlotFromMiniTalk(newState, ev.id, ev.memorySlotDraft);
        recordParentEventFired(newState, ev.id);
        newState.actedWithParentThisWeek = true; // 부모와 상호작용 → 이번 주 평균 회귀 면제
        newState.parentTalkPressure = 0;
        newState.parentEventPendingThisWeek = false;
        accrueParentEvent(newState, ev.id);
        set({ state: newState });
        return { kind: 'event', event: ev };
      }
    }
    const newState = cloneGameState(s);
    newState.actedWithParentThisWeek = true; // 부모와 대화 → 이번 주 평균 회귀 면제
    const line = getHomeSmalltalk(newState);
    set({ state: newState });
    return { kind: 'smalltalk', line };
  },

  // Phase 2A — 부모 ±선택지 이벤트의 선택 적용(선택-후-적용).
  // talkToHome이 효과 없이 이벤트만 띄우고, 사용자가 모달에서 고른 선택을 여기서 정산한다.
  // parentEventPendingThisWeek 가드로 중복 클릭/이미 소비된 주를 방어.
  resolveParentTalkChoice: (eventId, choiceIdx) => {
    const s = get().state;
    if (!s || !s.parentEventPendingThisWeek) return;
    const ev = PARENT_MINI_EVENTS.find(e => e.id === eventId);
    const choice = ev?.choices?.[choiceIdx];
    if (!ev || !choice) return;
    // 가용성 가드 — talkToHome과 대칭. 보유하지 않은 강점/쿨다운 중 이벤트가 stale·외부 호출로
    // 정산되는 것을 방어(현재 UI 경로는 안전하나 단일 진입점 불변식을 코드로 강제).
    if (!getAvailableHomeEvents(s).some(e => e.id === eventId)) return;

    const newState = cloneGameState(s);
    applyVisibleTalkEffects(newState, choice.effects);
    if (choice.parentEffect) {
      applyParentIntimacyDelta(newState, choice.parentEffect.baseDelta, choice.parentEffect.tag);
    }
    // 선택에 달린 회상 슬롯(있으면) → 학년말/엔딩 회상에 등장. sourceEventId당 1회(재발동해도 중복 방지).
    applyMemorySlotFromMiniTalk(newState, ev.id, choice.memorySlotDraft, choiceIdx);
    recordParentEventFired(newState, ev.id);
    newState.actedWithParentThisWeek = true;
    newState.parentTalkPressure = 0;
    newState.parentEventPendingThisWeek = false;
    accrueParentEvent(newState, ev.id);
    set({ state: newState });
  },

  startMonthPlayback: () => {
    const s = get().state;
    if (!s || !getCurrentMonthPlan(s) || !isPlanningPhase(s)) return;
    const run = getMonthRun(s);
    set({ state: { ...s, monthRun: run ? { ...run, status: 'playing', stop: undefined, stopDetail: undefined, stopAtBoundary: undefined } : createMonthRun(s) } });
    playPlannedWeek(get, set);
  },

  continuePlayback: () => {
    const s = get().state;
    if (!s || s.phase !== 'result') return;
    const run = getMonthRun(s);
    if (!run) { get().setPhase('weekday'); return; }
    const stop = run.status === 'playing' ? run.stopAtBoundary : (run.stop ?? 'player');
    set({ state: { ...s, phase: 'weekday', monthRun: stop ? pausedRun(run, stop) : run } });
    if (!stop) playPlannedWeek(get, set);
  },

  pausePlayback: (reason) => {
    const s = get().state;
    const run = s && getMonthRun(s);
    if (!s || !run || run.status !== 'playing') return;
    if (isPlanningPhase(s)) set({ state: { ...s, monthRun: pausedRun(run, reason) } });
    else if (!run.stopAtBoundary) set({ state: { ...s, monthRun: { ...run, stopAtBoundary: reason } } });
  },

  resumePlayback: () => {
    const s = get().state;
    const run = s && getMonthRun(s);
    if (!s || !run || !isPlanningPhase(s)) return;
    set({ state: { ...s, monthRun: { ...run, status: 'playing', stop: undefined, stopDetail: undefined, stopAtBoundary: undefined } } });
    playPlannedWeek(get, set);
  },

  finishMonth: () => {
    const s = get().state;
    if (!s || !s.monthRun) return;
    const next = cloneGameState(s);
    const missed = s.monthRun.missedTalks;
    delete next.monthRun;
    // 지난달 적립은 여기서 끝난다(다음 달로 안 넘어감). 이번 달 재생이 지나친 만큼만, 놓친 쪽으로 다음 달에 쓴다.
    if (totalTalks(missed) > 0 && next.week >= 1 && next.week <= 48) {
      next.talkBank = { year: next.year, month: getMonthBlock(next.week).index, npc: missed.npc, home: missed.home };
    } else {
      delete next.talkBank;
    }
    if (next.phase === 'result') next.phase = 'weekday';
    set({ state: next });
  },

  chooseSemesterGoal: (offer) => {
    const s = get().state;
    if (!s) return false;
    const next = cloneGameState(s);
    if (!pickSemesterGoal(next, offer)) return false;
    set({ state: next });
    return true;
  },

  // ===== 디버그 메서드 (DebugPanel에서 호출, import.meta.env.DEV 가드는 컴포넌트 쪽에서) =====
  // 같은 주에 매 렌더 호출되므로 절대주차 스탬프로 1회만 적립한다.
  // 계획을 고쳐 잠금이 풀렸다가 다시 잠겨도 그 주는 1회다(겪은 것은 "그 주에 막혔다" 하나다).
  markMoneyBlockedWeek: () => {
    const s = get().state;
    if (!s) return;
    const stamp = absWeek(s.year, s.week);
    if (s.moneyBlockedStamp === stamp) return;
    // 이 주는 이미 막힌 달로 셌다(월 계획이 막힌 달의 남은 주) — 재생이 멈춘 주간 화면이 또 알려와도 겹쳐 세지 않는다.
    if (inBlockedMonth(s)) return;
    // 배열을 새로 만들지 않는 recordMoneyBlockedWeek 규약 때문에 구세이브에선 조용히 no-op이다.
    const next = { ...s, moneyBlockedStamp: stamp };
    recordMoneyBlockedWeek(next);
    set({ state: next });
  },

  markMoneyBlockedMonth: () => {
    const s = get().state;
    if (!s || s.week < 1 || s.week > 48) return;
    const block = getMonthBlock(s.week);
    const m = s.moneyBlockedMonth;
    if (m && m.year === s.year && m.month === block.index) return;
    // 이번 주를 주간 화면이 이미 셌으면 그 주는 빼고 센다(같은 주를 두 번 세지 않는다).
    const weeks = block.endWeek - s.week + 1 - (s.moneyBlockedStamp === absWeek(s.year, s.week) ? 1 : 0);
    // 배열은 새로 만든다 — 기록기는 제자리에 더하므로, 얕은 복사본에 그대로 쓰면 이전 상태의 배열까지 바뀐다.
    const next: GameState = {
      ...s,
      moneyBlockedMonth: { year: s.year, month: block.index, fromWeek: s.week },
      moneyBlockedWeeksByYear: s.moneyBlockedWeeksByYear ? [...s.moneyBlockedWeeksByYear] : s.moneyBlockedWeeksByYear,
    };
    recordMoneyBlockedWeeks(next, weeks);
    set({ state: next });
  },

  debugAdvanceToYearEnd: () => {
    const s = get().state;
    if (!s || s.phase === 'ending') return;
    const newState = cloneGameState(s);
    // milestone 미생성 시 생성 (학년말 카드 fallback 막기 위함)
    if (!newState.milestoneScenes.find(m => m.year === newState.year)) {
      recordMilestoneForYear(newState, newState.year);
    }
    newState.phase = 'year-end';
    newState.currentEvent = null;
    set({ state: newState });
  },

  debugSkipToEnding: () => {
    const s = get().state;
    if (!s) return;
    const newState = cloneGameState(s);
    // Y1~현재까지 누락된 milestone 채우기 (엔딩 회상 fallback 방지)
    for (let y = 1; y <= 7; y++) {
      if (!newState.milestoneScenes.find(m => m.year === y)) {
        recordMilestoneForYear(newState, y);
      }
    }
    newState.year = 8;
    newState.week = 1;
    newState.phase = 'ending';
    newState.currentEvent = null;
    const runDelta = commitOnEnding(s, newState);
    set({ state: newState, ...(runDelta ? { runDelta } : {}) });
  },

  debugSetStat: (key, value) => {
    const s = get().state;
    if (!s) return;
    const clamped = Math.max(0, Math.min(100, value));
    set({ state: { ...s, stats: { ...s.stats, [key]: clamped } } });
  },

  // DEV 전용 — 다음 "가정에 말 걸기" 클릭에서 부모 미니이벤트를 즉시 발동시킨다.
  // 기존 발동기록의 쿨다운을 풀어(week=-999) 두 강점 이벤트가 번갈아(로테이션) 뜨게 한다.
  debugForceParentEvent: () => {
    const s = get().state;
    if (!s) return;
    const newState = cloneGameState(s);
    newState.parentEventPendingThisWeek = true;
    newState.parentTalkPressure = 1;
    newState.parentEventsFired = (newState.parentEventsFired ?? []).map(f => ({ ...f, week: -999 }));
    set({ state: newState });
  },
}));

// 상태 변경 시 자동 저장
useGameStore.subscribe((curr, prev) => {
  if (curr.state && curr.state !== prev.state) {
    saveToStorage(curr.state);
  }
});
