// ===== T68 학기 목표 — 판정·문장 SSOT =====
//
// **왜 있나**: 활동 해금·학교급 변화는 있어도 "이번 학기에 하고 싶은 일"이 없어서, 중반엔 시험과
// 엔딩만 기다리며 주를 넘길 수 있었다. '지난주처럼'(weekendPlan.ts)은 조작을 줄이지만 계획을
// **바꿀 이유**는 주지 않는다. 이 파일은 그 이유 하나를 준다 — 학기 초에 작은 목표 하나를 고르면
// 주간 화면이 진행을 학교생활 말로 보여 주고, 학기 마지막 주 결산이 결과를 한 줄로 말한다.
//
// **무엇을 안 하나 (계약)**
//   · 보상이 없다. 스탯·피로·돈·친밀도·기억 슬롯·rngSeed를 하나도 건드리지 않는다. 목표는
//     이미 하던 주말 계획의 **기록**이지 경제가 아니다(같은 계획이면 목표 유무와 무관하게
//     같은 판이 나온다 — semesterGoal.test.ts가 바이트 동일로 잠근다). 이벤트 밀도도 그대로다.
//   · 숫자를 안 보인다(hide-numbers). 진행은 단계 말("첫발을 뗐다")로만 나간다.
//   · 돈으로 채우는 목표가 없다. 세 활동 계열은 전부 **무료 활동이 상시 열려 있는** 계열이고
//     (`GOAL_FREE_ACTIVITY`가 그 증인, 테스트가 카탈로그와 대조한다), 친구 목표는 무료 동행
//     활동(동아리·스터디 그룹)으로 채워진다.
//
// **판정 규칙**: 목표를 고른 학기의 학기 중 주(방학 제외) 가운데 조건을 채운 주를 센다.
//   · 활동 계열 = 그 주 **주말 선택 슬롯에서 실제로 실행된** 활동 중 그 계열이 있다
//     (돈·게이트로 스킵된 것, 이벤트 timeCost로 잘린 꼬리 슬롯은 안 센다 — 엔진이 실행한 것만).
//     루틴(방과후 슬롯)은 세지 않는다 — 세면 이미 그 계열 루틴을 돌리던 판은 고르는 순간 달성이라
//     "계획을 바꿀 이유"가 사라진다.
//   · 친구 = 그 친구와 주말 동행을 했고, 그 동행 활동이 실제로 실행됐다.
//   · `GOAL_TARGET_WEEKS`번 채우면 해냈다. 판정은 학기 마지막 주(W19·W42)의 processWeek 안에서
//     한다 — 학기 목표의 재료(주말 실행·동행)는 전부 processWeek 안에서 정해지므로 그 주에 이벤트가
//     떠도 결과가 안 바뀐다. 결산 화면은 이벤트 유무와 무관하게 그 주 로그로 착지한다.

import type {
  ActiveSemesterGoal, GameState, SemesterGoalKind, SemesterGoalOutcome, SemesterGoalRecord,
  Activity,
} from './types';
import { ACTIVITIES } from './activities';
import { getSchoolLevel } from './backgrounds';
import { isNpcEnrolled } from './relationshipSignals';
import { absWeek, getWeekInfo } from './weekMath';
import { josa } from './korean';
import { INITIAL_NPCS } from './npcRoster';

/** 해냈다로 치는 주 수. 고를 수 있는 마지막 주에 골라도 남은 학기 주가 이보다 넉넉하다(아래 검사). */
export const GOAL_TARGET_WEEKS = 6;
/**
 * 학기 시작부터 몇 번째 주까지 고를 수 있나(학기 상대 주차, 1부터).
 * 2주인 이유: 칩은 목표가 없으면 이 창 동안 "정하기"로 서 있는다. 8주였을 땐 안 고른 플레이어에게
 * 두 달 내내 같은 권유가 떴다(사용자 판정 — 학기 첫 2주만). 고른 목표의 진행 칩은 창과 무관하게 학기 내내 남는다.
 * Y1 W1은 튜토리얼 오버레이가 칩을 덮지만 튜토리얼은 W1 안에서 끝나므로 W1 후반·W2가 남는다.
 */
export const GOAL_PICK_WINDOW = 2;

/** 활동 계열 목표 → 활동 category. 친구 목표는 category가 아니라 동행으로 센다. */
export const GOAL_ACTIVITY_CATEGORY: Record<Exclude<SemesterGoalKind, 'friend'>, Activity['category']> = {
  exercise: 'exercise',
  study: 'study',
  craft: 'talent',
};

/**
 * 각 활동 계열에서 **학기 중 언제나 무료로 고를 수 있는** 활동 하나 — 도달 가능성의 증인이다.
 * 목표를 돈으로 채우게 만들지 않는다는 약속을 이 표가 들고, 테스트가 카탈로그(비용 0·학기 게이트 없음·
 * requires 없음·1칸·category 일치)와 대조한다. 도달성 sim의 "목표를 좇는 플레이어"도 이 활동을 쓴다.
 */
export const GOAL_FREE_ACTIVITY: Record<Exclude<SemesterGoalKind, 'friend'>, string> = {
  exercise: 'light-exercise',
  study: 'library',
  craft: 'creative',
};

/**
 * 고르는 시점엔 재적이지만 그 해에 떠나기로 정해진 친구. 도윤은 Y2 W2 학군 이사(doyun-school-split)로
 * 떠난다 — Y2 W1에 고르면 한 번도 못 채울 목표가 된다. 그래서 후보에서 뺀다.
 * (그래도 어떤 경로로든 학기 중에 떠나면 판정이 'lapsed'로 접는다 — 아래 settle 참조.)
 */
const FRIEND_LEAVING_FROM_YEAR: Readonly<Record<string, number>> = { doyun: 2 };

// ===== 학기 경계 — getWeekInfo에서 파생(표를 따로 박지 않는다) =====
function boundsOf(semester: 1 | 2): { start: number; end: number } {
  let start = 0;
  let end = 0;
  for (let w = 1; w <= 48; w++) {
    const info = getWeekInfo(w);
    if (info.semester !== semester || info.isVacation) continue;
    if (start === 0) start = w;
    end = w;
  }
  return { start, end };
}
export const SEMESTER_BOUNDS: Readonly<Record<1 | 2, { start: number; end: number }>> = {
  1: boundsOf(1),
  2: boundsOf(2),
};

/** 지금 주가 학기 중이면 그 학기, 방학이면 null. */
function semesterOfWeek(week: number): 1 | 2 | null {
  const info = getWeekInfo(week);
  return info.isVacation ? null : info.semester;
}

function isCurrentGoal(goal: ActiveSemesterGoal, state: Pick<GameState, 'year' | 'week'>): boolean {
  return goal.year === state.year && semesterOfWeek(state.week) === goal.semester;
}

// ===== 고르기 =====
export interface GoalOffer {
  kind: SemesterGoalKind;
  npcId?: string;
}

/** 친구 목표 후보 — 동행 후보(MainWeekScreen companionNpcs)와 같은 조건 + 떠나기로 정해진 친구 제외. */
export function friendGoalCandidate(state: GameState): string | undefined {
  const pool = state.npcs.filter(n =>
    n.met && isNpcEnrolled(n, state)
    && !(FRIEND_LEAVING_FROM_YEAR[n.id] !== undefined && state.year >= FRIEND_LEAVING_FROM_YEAR[n.id]));
  if (pool.length === 0) return undefined;
  // 가장 오래 못 본 친구 — '챙기기' 단서(relationshipSignals)와 같은 축. 동률이면 명단 순서.
  let best = pool[0];
  for (const n of pool) {
    if ((n.lastInteractionWeek ?? 0) < (best.lastInteractionWeek ?? 0)) best = n;
  }
  return best.id;
}

/**
 * 지금 목표를 고를 수 있나. 학기 중 앞쪽 `GOAL_PICK_WINDOW`주, 주 계획 단계, 이번 학기 목표가 아직 없을 때.
 * 이미 골랐어도 **한 번도 안 채웠으면** 다시 고를 수 있다(잘못 누른 선택을 되돌리는 길).
 */
export function canPickSemesterGoal(state: GameState): boolean {
  // 주 계획 화면에서만(MainWeekScreen이 그려지는 phase). 결산·사건·학년말·엔딩 중엔 못 고른다.
  if (state.phase === 'event' || state.phase === 'result' || state.phase === 'year-end'
    || state.phase === 'ending' || state.phase === 'setup') return false;
  if (state.year < 1 || state.year > 7) return false;
  const sem = semesterOfWeek(state.week);
  if (sem === null) return false;
  if (state.week - SEMESTER_BOUNDS[sem].start + 1 > GOAL_PICK_WINDOW) return false;
  if ((state.semesterGoalLog ?? []).some(r => r.year === state.year && r.semester === sem)) return false;
  const g = state.semesterGoal;
  if (g && isCurrentGoal(g, state) && g.markedWeeks.length > 0) return false;
  return true;
}

export function offerSemesterGoals(state: GameState): GoalOffer[] {
  if (!canPickSemesterGoal(state)) return [];
  const offers: GoalOffer[] = (['exercise', 'study', 'craft'] as const).map(kind => ({ kind }));
  const npcId = friendGoalCandidate(state);
  if (npcId) offers.push({ kind: 'friend', npcId });
  return offers;
}

/** 고른 목표를 state에 세운다(mutate). 제시된 후보가 아니면 아무것도 안 하고 false. */
export function pickSemesterGoal(state: GameState, offer: GoalOffer): boolean {
  const valid = offerSemesterGoals(state).find(o => o.kind === offer.kind && o.npcId === offer.npcId);
  const sem = semesterOfWeek(state.week);
  if (!valid || sem === null) return false;
  state.semesterGoal = {
    kind: valid.kind, year: state.year, semester: sem,
    ...(valid.npcId ? { npcId: valid.npcId } : {}),
    markedWeeks: [],
  };
  return true;
}

// ===== 엔진: 주 기록과 학기말 판정 (processWeek이 부른다) =====

/**
 * 이번 주가 목표 조건을 채웠으면 표시한다(mutate). processWeek이 주말 활동 실행 **직후** 부른다.
 *
 * @param appliedChoices 이번 주 주말/방학 선택 슬롯에서 **실제로 실행된** 활동 id(엔진이 돌린 것만)
 * @param npcActivityMap UI가 고른 동행 — 키는 `${activityId}:${slotIdx}` 또는 레거시 `activityId`
 */
export function markSemesterGoalWeek(
  state: GameState,
  appliedChoices: readonly string[],
  npcActivityMap: Record<string, string> | undefined,
): void {
  const goal = state.semesterGoal;
  if (!goal || !isCurrentGoal(goal, state)) return;
  const stamp = absWeek(state.year, state.week);
  if (goal.markedWeeks.includes(stamp)) return;
  let hit = false;
  if (goal.kind === 'friend') {
    if (goal.npcId && npcActivityMap) {
      hit = Object.entries(npcActivityMap).some(([key, npcId]) =>
        npcId === goal.npcId && appliedChoices.includes(key.split(':')[0]));
    }
  } else {
    const cat = GOAL_ACTIVITY_CATEGORY[goal.kind];
    hit = appliedChoices.some(id => ACTIVITIES.find(a => a.id === id)?.category === cat);
  }
  if (hit) goal.markedWeeks.push(stamp);
}

export function outcomeOf(goal: ActiveSemesterGoal, state: GameState): SemesterGoalOutcome {
  const n = goal.markedWeeks.length;
  if (n >= GOAL_TARGET_WEEKS) return 'achieved';
  if (goal.kind === 'friend') {
    const npc = state.npcs.find(x => x.id === goal.npcId);
    if (!npc || !isNpcEnrolled(npc, state)) return 'lapsed';
  }
  return n > 0 ? 'partial' : 'missed';
}

function settle(state: GameState, goal: ActiveSemesterGoal): void {
  const record: SemesterGoalRecord = {
    kind: goal.kind, year: goal.year, semester: goal.semester,
    ...(goal.npcId ? { npcId: goal.npcId } : {}),
    outcome: outcomeOf(goal, state),
  };
  state.semesterGoalLog = [...(state.semesterGoalLog ?? []), record];
  state.semesterGoal = undefined;
}

/**
 * 학기 마지막 주면 판정해 기록으로 옮긴다(mutate). processWeek이 주 기록 **뒤**, week++ **전**에 부른다.
 * 그래서 결산 화면은 그 주 로그(`weekLog.year/week`)와 기록의 학기를 맞춰 보기만 하면 된다.
 */
export function settleSemesterGoalIfDue(state: GameState): void {
  const goal = state.semesterGoal;
  if (!goal || !isCurrentGoal(goal, state)) return;
  if (state.week === SEMESTER_BOUNDS[goal.semester].end) settle(state, goal);
}

/**
 * 낡은 목표(다른 학기·학년에 남은 것)를 정산한다. 정상 흐름에선 학기 마지막 주에 이미 정산되므로
 * 여기 닿지 않는다 — 디버그 건너뛰기나 손상 세이브가 목표를 다음 학기로 끌고 오는 경우의 그물이다.
 * 그대로 두면 다음 학기엔 영영 못 고르고(칩이 낡은 목표를 보여 준다) 기록도 안 남는다.
 */
export function settleStaleSemesterGoal(state: GameState): void {
  const goal = state.semesterGoal;
  if (!goal || isCurrentGoal(goal, state)) return;
  // 학기 중 그 학기 안이면 현재 목표다. 여기 온 건 방학이거나 다른 학기·학년이다.
  // 방학이면서 같은 학년·같은 학기의 방학(=학기 끝난 직후)이어도 정산한다 — 학기는 이미 끝났다.
  settle(state, goal);
}

// ===== 화면 =====

const KIND_TITLE: Record<SemesterGoalKind, Record<'elementary' | 'middle' | 'high', string>> = {
  exercise: { elementary: '주말엔 밖에서 뛰어놀기', middle: '주말마다 땀 흘리기', high: '주말 운동 지키기' },
  study: { elementary: '주말에 혼자 공부해 보기', middle: '주말 공부 습관 들이기', high: '주말에도 책상 지키기' },
  craft: { elementary: '좋아하는 것 하나 꾸준히', middle: '주말마다 내 것 만들기', high: '주말엔 내 작업 붙잡기' },
  friend: { elementary: '', middle: '', high: '' },
};

const KIND_HINT: Record<SemesterGoalKind, string> = {
  exercise: '주말 하루를 몸 쓰는 데 쓴다.',
  study: '주말 하루를 공부하는 데 쓴다.',
  craft: '주말 하루를 특기 활동에 쓴다.',
  friend: '주말 동행으로 함께 시간을 보낸다.',
};

export function npcNameOf(npcId: string | undefined): string {
  return INITIAL_NPCS.find(n => n.id === npcId)?.name ?? '친구';
}

/** 목표 이름. 학교급은 **고른 학년** 기준(학년말 회고에서 지난 학년을 읽어도 그때 말로 나온다). */
export function goalTitle(g: { kind: SemesterGoalKind; year: number; npcId?: string }): string {
  if (g.kind === 'friend') return `${josa(npcNameOf(g.npcId), '와/과')} 주말 보내기`;
  return KIND_TITLE[g.kind][getSchoolLevel(g.year)];
}

export function goalHint(kind: SemesterGoalKind): string {
  return KIND_HINT[kind];
}

export type GoalStageTone = 'idle' | 'progress' | 'done' | 'tight';

/**
 * 진행 단계 — 숫자 대신 말. 남은 학기 주(이번 주 포함)로 더는 못 채우면 '빠듯하다'고 정직하게 말한다.
 * 친구가 떠났으면 '사정이 바뀌었다'.
 */
export function goalStage(goal: ActiveSemesterGoal, state: GameState): { label: string; tone: GoalStageTone } {
  const n = goal.markedWeeks.length;
  if (n >= GOAL_TARGET_WEEKS) return { label: '해냈다', tone: 'done' };
  if (goal.kind === 'friend') {
    const npc = state.npcs.find(x => x.id === goal.npcId);
    if (!npc || !isNpcEnrolled(npc, state)) return { label: '사정이 바뀌었다', tone: 'tight' };
  }
  const end = SEMESTER_BOUNDS[goal.semester].end;
  const remaining = isCurrentGoal(goal, state) ? Math.max(0, end - state.week + 1) : 0;
  if (n + remaining < GOAL_TARGET_WEEKS) return { label: '이번 학기엔 빠듯하다', tone: 'tight' };
  if (n === 0) return { label: '아직 시작 전', tone: 'idle' };
  if (n * 2 < GOAL_TARGET_WEEKS) return { label: '첫발을 뗐다', tone: 'progress' };
  return { label: '자리 잡아 가는 중', tone: 'progress' };
}

/** 주간 화면 칩이 보여 줄 목표 — 지금 학기의 것만. 낡은 목표는 칩에 안 나간다. */
export function currentSemesterGoal(state: GameState): ActiveSemesterGoal | null {
  const g = state.semesterGoal;
  return g && isCurrentGoal(g, state) ? g : null;
}

const ACHIEVED_LINE: Record<SemesterGoalKind, string> = {
  exercise: '주말마다 몸을 움직인 학기였다. 계단을 오를 때 숨이 덜 찼다.',
  study: '주말에도 책상 앞에 앉던 학기였다. 펼친 문제집이 손에 익었다.',
  craft: '주말마다 내 것을 붙잡던 학기였다. 서랍에 쌓인 게 조금 뿌듯했다.',
  friend: '',
};

/** 학기말 결산의 결과 한 줄. 보상 대신 이 문장이 목표의 끝이다. */
export function goalOutcomeLine(r: SemesterGoalRecord): string {
  const name = npcNameOf(r.npcId);
  switch (r.outcome) {
    case 'achieved':
      return r.kind === 'friend'
        ? `${josa(name, '와/과')} 주말을 자주 함께한 학기였다. 이제 말없이 있어도 어색하지 않다.`
        : ACHIEVED_LINE[r.kind];
    case 'partial':
      return '마음먹은 만큼은 아니어도, 몇 번은 해냈다.';
    case 'lapsed':
      return `${josa(name, '이/가')} 떠나면서, 정해 둔 목표도 그대로 접었다.`;
    case 'missed':
      return '정해 둔 목표는 어느새 잊고 학기가 지나갔다.';
  }
}

/** 학년말 회고용 짧은 결과 말. */
export const OUTCOME_SHORT: Record<SemesterGoalOutcome, string> = {
  achieved: '해냈다',
  partial: '몇 번은 했다',
  missed: '잊고 지나갔다',
  lapsed: '사정이 바뀌었다',
};

/**
 * 이 결산 로그가 학기 마지막 주의 것이면, 그 학기 목표의 판정 기록. 아니면 null.
 * 결산 화면의 유일한 판정 — 이벤트를 거쳐 왔든 곧장 왔든 같은 로그를 읽으므로 두 입구가 같은 답을 낸다.
 */
export function goalRecordForWeekLog(state: Pick<GameState, 'weekLog' | 'semesterGoalLog'>): SemesterGoalRecord | null {
  const log = state.weekLog;
  if (!log || log.year == null || log.week == null) return null;
  const sem = semesterOfWeek(log.week);
  if (sem === null || SEMESTER_BOUNDS[sem].end !== log.week) return null;
  return (state.semesterGoalLog ?? []).find(r => r.year === log.year && r.semester === sem) ?? null;
}

/** 학년말 회고 — 그 해의 기록(학기 순). */
export function goalRecordsForYear(log: readonly SemesterGoalRecord[] | undefined, year: number): SemesterGoalRecord[] {
  return (log ?? []).filter(r => r.year === year).sort((a, b) => a.semester - b.semester);
}

// ===== 세이브 정규화 (stateMigration이 로드·매주 부른다 — 멱등) =====
const KINDS: readonly SemesterGoalKind[] = ['exercise', 'study', 'craft', 'friend'];
const OUTCOMES: readonly SemesterGoalOutcome[] = ['achieved', 'partial', 'missed', 'lapsed'];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isYear = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 7;
const isSem = (v: unknown): v is 1 | 2 => v === 1 || v === 2;

/**
 * 손상된 목표는 **버린다**(undefined = 목표 없음). 판을 거부할 일은 아니다 — 목표는 보상이 없는 기록이라
 * 잃어도 7년이 안 바뀐다. 반대로 살려서 쓰면 문자열 스탬프 같은 값이 '같은 주 두 번 안 세기'를 깨뜨린다.
 * friend인데 npcId가 없으면 판정이 'lapsed'로만 떨어지는 유령 목표라 같이 버린다.
 */
export function sanitizeSemesterGoal(v: unknown): ActiveSemesterGoal | undefined {
  if (!isObj(v)) return undefined;
  if (!KINDS.includes(v.kind as SemesterGoalKind) || !isYear(v.year) || !isSem(v.semester)) return undefined;
  if (!Array.isArray(v.markedWeeks)) return undefined;
  const kind = v.kind as SemesterGoalKind;
  if (kind === 'friend' && typeof v.npcId !== 'string') return undefined;
  const marked = [...new Set(v.markedWeeks.filter((w): w is number => typeof w === 'number' && Number.isInteger(w)))];
  return {
    kind, year: v.year, semester: v.semester,
    ...(kind === 'friend' ? { npcId: v.npcId as string } : {}),
    markedWeeks: marked,
  };
}

/** 기록은 항목 단위로 거른다 — 한 줄이 깨졌다고 다른 학기의 기록까지 버리지 않는다. */
export function sanitizeSemesterGoalLog(v: unknown): SemesterGoalRecord[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.filter((r): r is SemesterGoalRecord =>
    isObj(r) && KINDS.includes(r.kind as SemesterGoalKind) && isYear(r.year) && isSem(r.semester)
    && OUTCOMES.includes(r.outcome as SemesterGoalOutcome)
    && (r.kind !== 'friend' || typeof r.npcId === 'string'));
}
