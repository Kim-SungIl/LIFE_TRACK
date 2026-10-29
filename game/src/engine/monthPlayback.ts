// 한 달 자동 진행(재생) — 짜 둔 계획대로 주가 저절로 흐르고, 사건은 그 자리에서 장면으로 나온다.
// 설계: docs/monthly-plan-design-2026-10.md §5(재생과 멈춤)·§7(월말 결산)·§8(주간 기회)·§10(저장).
//
// **엔진은 그대로 주 단위다.** 재생은 새 진행 경로가 아니다 — 그 주 계획 칸을 꺼내 store.confirmWeek을 부를 뿐이고,
// 그래서 사람이 한 주씩 누른 판과 매주 같은 상태가 나온다(monthPlaybackEquivalence.test.ts가 잠근다).
// 이 파일은 그 앞뒤의 판단만 갖는다: 이번 주를 재생해도 되나(계획 성립), 처리한 주를 어떻게 적나, 언제 멈추나,
// 재생이 지나친 대화 기회를 어떻게 모으나, 월말에 무엇을 보이나. store가 이 함수들을 부르고 상태를 쓴다.
//
// **멈춤은 주 경계에서만 일어난다.** 사건 중이나 결산 카드 중에 정해진 멈춤(번아웃·계절 경계·⏸·💬·🛒)은
// `stopAtBoundary`에 적어 두고, 카드에서 다음으로 넘어갈 때(store.continuePlayback) 적용한다. 두 processWeek 사이의
// 계획 단계(phase weekday/vacation)가 곧 지금의 주간 화면이라, 멈추면 그 화면이 말걸기·상점·손 확정을 그대로 준다.
import { NPC_COMPANION_ACTIVITIES } from './activities';
import { predictWeekOutcome } from './gameEngine';
import { josa } from './korean';
import { getCurrentMonthPlan, getPlannedWeek } from './monthPlan';
import { isNpcEnrolled, isNpcInteractable } from './relationshipSignals';
import { getAvailableHomeEvents, getAvailableNpcEvents, getEligibleParentClimax } from './talkSystem';
import { STAT_LABELS } from './types';
import { getConfirmGate } from './weekendPlan';
import { getMonthBlock, getWeekInfo } from './weekMath';
import type { GameState, MonthRun, MonthRunWeek, PlaybackStop, StatKey, TalkBank, TalkCounts } from './types';

/** 한 달에 모을 수 있는 놓친 대화 기회 상한(디렉터 결정 2026-10-20 "최대 4, 다음 달로 안 넘어감"). */
export const MAX_TALK_BANK = 4;

/** 지금 달의 재생 상태. 없거나 지난달 것이면 null(학년 전환 대기 W49 포함). */
export function getMonthRun(state: Pick<GameState, 'monthRun' | 'year' | 'week'>): MonthRun | null {
  const run = state.monthRun;
  if (!run || state.week < 1 || state.week > 48) return null;
  return run.year === state.year && run.month === getMonthBlock(state.week).index ? run : null;
}

/**
 * 세이브에서 읽은 재생 장부가 쓸 수 있는 모양인가 — 손상·수동 편집 세이브의 방어선(loadSavedGame).
 * `log`가 배열이 아니면 다음 확정에서 `run.log.map`이 터진다(3자 검수 실측: load는 성공, confirm에서 TypeError).
 * 판정할 수 없는 장부는 접지 않고 **버린다** — 재생 상태만 잃고 판은 그대로 이어진다(#441 규약: 손상값은 거부).
 */
export function isWellFormedMonthRun(run: unknown): run is MonthRun {
  if (!run || typeof run !== 'object') return false;
  const r = run as Record<string, unknown>;
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  // 주 기록은 결산(buildMonthSummary)이 필드마다 읽는다 — 겉 모양만 보면 `promises` 없는 기록이 결산에서 터진다(3자 재검수).
  const okWeek = (w: unknown) => {
    if (!w || typeof w !== 'object') return false;
    const x = w as Record<string, unknown>;
    return num(x.week) && typeof x.auto === 'boolean' && num(x.timeCost) && num(x.routineMissed) && num(x.choiceMissed)
      && typeof x.burnout === 'boolean' && Array.isArray(x.promises)
      && x.promises.every(p => !!p && typeof p === 'object' && typeof (p as Record<string, unknown>).npcId === 'string'
        && typeof (p as Record<string, unknown>).kept === 'boolean');
  };
  return num(r.year) && num(r.month) && (r.status === 'playing' || r.status === 'paused')
    && Array.isArray(r.log) && r.log.every(okWeek)
    && isTalkCounts(r.missedTalks) && num(r.startMoney)
    && !!r.startStats && typeof r.startStats === 'object' && !!r.startIntimacy && typeof r.startIntimacy === 'object';
}

/** 이번 달 재생을 처음 시작할 때의 상태 — 결산이 비교할 시작 능력치·친밀도·잔액을 박는다. */
export function createMonthRun(state: GameState): MonthRun {
  return {
    year: state.year,
    month: getMonthBlock(state.week).index,
    status: 'playing',
    log: [],
    missedTalks: { npc: 0, home: 0 },
    startStats: { ...state.stats },
    startIntimacy: Object.fromEntries(state.npcs.filter(n => n.met).map(n => [n.id, n.intimacy])),
    startMoney: state.money,
  };
}

/**
 * 이번 주를 계획대로 재생할 수 있나 — 되면 null, 안 되면 사람이 읽는 이유(멈춤 'plan-invalid').
 *   · 이번 주 칸이 계획에 있어야 한다.
 *   · 동행 친구가 아직 같은 학교에 있고 만날 수 있어야 한다(전출·졸업).
 *   · 확정 잠금(getConfirmGate — 화면과 같은 판정)이 열려 있어야 한다: 루틴비·주말 활동비가 모자라지 않고 루틴이 있다.
 */
export function checkPlannedWeek(state: GameState): string | null {
  const planned = getPlannedWeek(state);
  if (!planned) return '이번 주 계획이 없어요';
  for (const [key, npcId] of Object.entries(planned.npcChoices)) {
    const npc = state.npcs.find(n => n.id === npcId);
    const activity = key.replace(/:\d+$/, '');
    if (!npc || !NPC_COMPANION_ACTIVITIES.includes(activity) || !isNpcEnrolled(npc, state) || !isNpcInteractable(npc, state)) {
      return `${npc ? josa(npc.name, '와/과') : '친구와'} 같이 할 수 없게 됐어요`;
    }
  }
  const gate = getConfirmGate(state, predictWeekOutcome(state, planned.activities, planned.npcChoices));
  if (gate.missingRoutine) return '방과후 루틴이 비어 있어요';
  if (gate.routineTooExpensive) return '학원비가 모자라요';
  if (gate.unaffordableIds.length > 0) return '이번 주 활동비가 모자라요';
  if (gate.reserveBreached) return '다음 주 계획 몫까지 쓰게 돼요';
  // 잠금 사유를 하나씩 묻다 보면 새 사유가 생길 때 여기만 빠진다(봉투 잠금이 실제로 빠졌다 — 3자 재검수).
  // 화면이 확정을 못 하는 주는 재생도 처리하지 않는다.
  if (gate.disabled) return '이번 주를 이대로는 확정할 수 없어요';
  return null;
}

/**
 * 이번 주에 **지나치면 사라지는** 대화 기회 — 재생이 그 주를 지나치면 그 쪽(친구/가정) 적립(§8)에 1을 더한다.
 *   · 친구: 말걸기 미니 이벤트(친밀도 30+ 친구 중 남은 이야기가 있는 친구)
 *   · 가정: 가정 미니 이벤트
 * 둘을 한 통으로 세면 놓친 가정 기회가 다음 달 친구 미니 이벤트(절친 통로)로 바뀐다 — 주 단위 판보다 대화가 늘었다
 * (sim-monthly-vs-weekly: 친구 +10~14%, 가정 +20%). 절정 순간은 넣지 않는다 — 기한이 없어 지나쳐도 남아 있다.
 * 화면 배지(MainWeekScreen homeHasEvent)와 같은 근거를 쓴다 — 실제로 뜰 게 없으면 놓친 것도 아니다.
 */
export function talkChances(state: GameState): TalkCounts {
  const npc = state.npcEventPendingThisWeek && state.npcs.some(n =>
    n.met && n.intimacy >= 30 && isNpcInteractable(n, state) && getAvailableNpcEvents(state, n.id).length > 0);
  const home = state.parentEventPendingThisWeek && getAvailableHomeEvents(state).length > 0;
  return { npc: npc ? 1 : 0, home: home ? 1 : 0 };
}

/** 재생 카드의 💬 배지 — 지나칠 기회가 있거나 절정 순간이 열려 있다. */
export function hadTalkChance(state: GameState): boolean {
  const c = talkChances(state);
  return c.npc > 0 || c.home > 0 || getEligibleParentClimax(state) != null;
}

/** 이번 주 놓친 기회를 장부에 더한다 — 합쳐 MAX_TALK_BANK를 넘지 않게, 친구 몫부터. */
export function addMissedTalks(missed: TalkCounts, chances: TalkCounts): TalkCounts {
  const npc = Math.min(missed.npc + chances.npc, MAX_TALK_BANK - missed.home);
  const home = Math.min(missed.home + chances.home, MAX_TALK_BANK - npc);
  return { npc, home };
}

export function totalTalks(c: TalkCounts): number {
  return c.npc + c.home;
}

/** 지금 쓸 수 있는 지난달 적립 대화 수 — `kind`를 주면 그 쪽만, 없으면 합(화면 안내문). */
export function talkBankCount(state: Pick<GameState, 'talkBank' | 'year' | 'week'>, kind?: keyof TalkCounts): number {
  const bank = state.talkBank;
  if (!bank || state.week < 1 || state.week > 48) return 0;
  if (bank.year !== state.year || bank.month !== getMonthBlock(state.week).index) return 0;
  return kind ? bank[kind] : totalTalks(bank);
}

function isTalkCounts(v: unknown): v is TalkCounts {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  return [c.npc, c.home].every(x => typeof x === 'number' && Number.isInteger(x) && x >= 0);
}

/**
 * 세이브에서 읽은 대화 장부를 지금 모양으로 — 판정은 isWellFormedMonthRun보다 먼저.
 * 분리 전 세이브는 친구·가정을 한 수(`number` / `count`)로 셌다. 어느 쪽이었는지 모르므로 **친구 몫**으로 옮긴다
 * (그 장부는 원래 말걸기에도 쓸 수 있었다 — 플레이어가 본 "못 다한 이야기 N"이 사라지지 않게).
 * 판정할 수 없는 talkBank는 접지 않고 버린다(#441 규약). monthRun의 손상은 isWellFormedMonthRun이 거부한다.
 */
export function migrateTalkLedgers(state: GameState): void {
  const run = state.monthRun as (MonthRun & { missedTalks: unknown }) | undefined;
  if (run && typeof run.missedTalks === 'number' && Number.isInteger(run.missedTalks) && run.missedTalks >= 0) {
    state.monthRun = { ...run, missedTalks: { npc: Math.min(MAX_TALK_BANK, run.missedTalks), home: 0 } };
  }
  const bank = state.talkBank as unknown;
  if (bank === undefined) return;
  const b = (bank && typeof bank === 'object' ? bank : {}) as Record<string, unknown>;
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (!num(b.year) || !num(b.month)) { delete state.talkBank; return; }
  if (isTalkCounts(b)) return;
  if (typeof b.count === 'number' && Number.isInteger(b.count) && b.count >= 0) {
    state.talkBank = { year: b.year as number, month: b.month as number, npc: Math.min(MAX_TALK_BANK, b.count), home: 0 } satisfies TalkBank;
    return;
  }
  delete state.talkBank;
}

/**
 * 처리한 한 주를 적는다 — `pre`는 확정 직전, `post`는 processWeek 직후(사건이 걸렸으면 사건 전) 상태.
 * 시간 소모(eventTimeCost)는 **지난주 사건**이 남긴 것이라 이번 주 칸을 지운다(gameEngine applyRoutineActivities).
 */
export function recordWeek(pre: GameState, post: GameState, auto: boolean): MonthRunWeek {
  const log = post.weekLog;
  const timeCost = Math.max(0, Math.min(2, pre.eventTimeCost || 0));
  const skipped = log?.skipped ?? [];
  const semester = !pre.isVacation;
  const routines = semester ? [pre.routineSlot2, pre.routineSlot3].filter(Boolean).length : 0;
  // 시간 소모는 루틴 슬롯3 → 슬롯2 순으로 지운다(timeCost 1 = 슬롯3만, 2 = 둘 다). 빈 슬롯3은 지울 게 없다.
  const routineCut = !semester ? 0 : timeCost >= 2 ? routines : timeCost === 1 && pre.routineSlot3 ? 1 : 0;
  // 주말(방학) 칸은 뒤에서부터 timeCost개를 지운다(applyWeekendActivities). 꼬리만 잘린 여러 칸 활동은 그대로 돌므로
  // 남은 칸에 같은 id가 있으면 빠진 걸로 세지 않는다.
  const plannedChoices = (pre.isVacation ? pre.vacationChoices : pre.weekendChoices) ?? [];
  const kept = plannedChoices.slice(0, Math.max(0, plannedChoices.length - timeCost));
  const choiceCut = new Set(plannedChoices.slice(kept.length).filter(id => id && !kept.includes(id))).size;
  return {
    week: pre.week,
    auto,
    timeCost,
    routineMissed: routineCut + skipped.filter(s => s.origin === 'routine').length,
    choiceMissed: choiceCut + skipped.filter(s => s.origin === 'choice').length,
    burnout: post.burnoutCount > pre.burnoutCount,
    promises: log?.promises ? log.promises.map(p => ({ ...p })) : [],
  };
}

/**
 * 처리한 주 뒤 다음 경계에서 멈춰야 하나 — 멈출 이유 또는 null. 달의 마지막 주는 멈춤이 아니라 월말 결산이라 여기서 안 다룬다.
 *   · 번아웃이 났다(디렉터 결정).
 *   · 다음 주가 같은 달인데 학기 ↔ 방학이 바뀐다(섞인 달 7월·1월) — 방학 부분은 이미 짜 둔 걸 확인만 한다.
 */
export function boundaryStopAfter(entry: MonthRunWeek): PlaybackStop | null {
  if (entry.burnout) return 'burnout';
  const block = getMonthBlock(entry.week);
  if (entry.week < block.endWeek && getWeekInfo(entry.week).isVacation !== getWeekInfo(entry.week + 1).isVacation) return 'season';
  return null;
}

/** 이 주가 그 달의 마지막 주인가(처리 뒤 월말 결산을 띄울 자리). */
export function isMonthEndWeek(week: number): boolean {
  return week >= 1 && week <= 48 && getMonthBlock(week).endWeek === week;
}

/** 멈춘 이유를 화면의 한 줄로. */
export function stopLine(run: Pick<MonthRun, 'stop' | 'stopDetail'>): string {
  switch (run.stop) {
    case 'burnout': return '한계였다. 잠깐 멈춰서 남은 주를 다시 보자.';
    case 'season': return '여기서부터 방학이다. 짜 둔 방학 계획을 확인하자.';
    case 'plan-invalid': return `계획대로 할 수 없는 주예요 — ${run.stopDetail ?? '계획을 다시 봐 주세요'}`;
    case 'talk': return '잠깐 멈췄어요. 친구나 가족과 이야기해 보세요.';
    case 'shop': return '잠깐 멈췄어요. 상점에 들러 보세요.';
    case 'reload': return '이어서 할 준비가 됐어요.';
    default: return '일시정지했어요.';
  }
}

// ── 월말 결산(§7) ───────────────────────────────────────────────

export interface MonthSummary {
  label: string;
  /** 그 달의 가장 강한 신호 하나로 쓴 한 줄 총평. */
  verdict: string;
  /** 방과후 — 학기 주에 계획한 루틴이 다 돌았던 주 / 학기 주 수. 학기 주가 없으면 null. */
  routine: { kept: number; total: number } | null;
  /** 주말·방학 칸이 빠진 주 수. */
  choiceMissedWeeks: number;
  promises: { npcId: string; name: string; kept: boolean }[];
  /** 능력치 방향(숫자 없음). */
  statDirs: { key: StatKey; label: string; dir: 'up' | 'down' }[];
  /** 친밀도가 눈에 띄게 움직인 친구. */
  friendDirs: { npcId: string; name: string; dir: 'up' | 'down' }[];
  burnout: boolean;
}

/** 능력치 방향 배지를 붙이는 최소 변화(한 달 누적). 그보다 작으면 "그대로"로 본다. */
const STAT_DIR_MIN = 1;
/** 친밀도 배지 최소 변화(한 달 누적). */
const FRIEND_DIR_MIN = 3;

const VERDICTS: Record<string, readonly ((v: { name: string; n: number; t: number; routine: string }) => string)[]> = {
  burnout: [
    () => '한 번 무너졌다. 쉬는 법을 다시 배워야 했던 달.',
    () => '버티다 결국 주저앉은 주가 있었다. 몸이 먼저 신호를 보냈다.',
  ],
  broken: [
    ({ name }) => `${josa(name, '와/과')} 한 약속을 못 지켰다. 그게 제일 마음에 걸린다.`,
    ({ name }) => `${name}한테 미안한 달. 약속한 날에 거기 없었다.`,
  ],
  missed: [
    ({ n }) => `방과후를 ${n}번 빠졌다. 계획대로만 흘러가진 않았다.`,
    ({ n, t }) => `일이 자꾸 끼어들었다. 방과후는 ${t}번 중 ${t - n}번만 갔다.`,
  ],
  kept: [
    ({ name }) => `${josa(name, '와/과')} 한 약속은 지켰다. 그날이 이번 달의 한가운데였다.`,
    ({ name }) => `약속한 날 ${josa(name, '와/과')} 만났다. 그걸로 충분한 달.`,
  ],
  steady: [
    ({ routine }) => `${josa(routine, '은/는')} 한 번도 안 빠졌다. 꾸준함이 몸에 붙는 중.`,
    ({ routine }) => `계획한 대로 굴러간 달. ${routine}도 빠짐없이 갔다.`,
  ],
  quiet: [
    () => '별일 없이 지나간 달. 그래도 조금은 달라졌다.',
    () => '조용한 한 달이었다. 기억에 남는 건 많지 않아도.',
  ],
};

/** 총평 틀의 신호 종류 — 강한 순서. 테스트가 이 순서를 잠근다. */
export const VERDICT_PRIORITY = ['burnout', 'broken', 'missed', 'kept', 'steady', 'quiet'] as const;

/**
 * 월말 결산 한 장의 내용. `state`는 그 달 마지막 주를 처리한 뒤(다음 달 첫 주 좌표), `run`은 그 달의 재생 기록.
 * 사건 기억 회수·CG는 쓰지 않는다(학년말·엔딩의 몫, §7).
 */
export function buildMonthSummary(state: GameState, run: MonthRun, routineName: string | null): MonthSummary {
  const label = getMonthBlockLabel(run.month);
  const semesterWeeks = run.log.filter(w => !getWeekInfo(w.week).isVacation);
  const routine = semesterWeeks.length > 0
    ? { kept: semesterWeeks.filter(w => w.routineMissed === 0).length, total: semesterWeeks.length }
    : null;
  const name = (id: string) => state.npcs.find(n => n.id === id)?.name ?? id;
  const promises = run.log.flatMap(w => w.promises.map(p => ({ npcId: p.npcId, name: name(p.npcId), kept: p.kept })));
  const burnout = run.log.some(w => w.burnout);

  const statDirs = (Object.keys(STAT_LABELS) as StatKey[]).flatMap(key => {
    const d = (state.stats[key] ?? 0) - (run.startStats[key] ?? 0);
    return Math.abs(d) >= STAT_DIR_MIN ? [{ key, label: STAT_LABELS[key], dir: d > 0 ? 'up' as const : 'down' as const }] : [];
  });
  const friendDirs = state.npcs.flatMap(n => {
    if (!n.met) return [];
    const d = n.intimacy - (run.startIntimacy[n.id] ?? 0);
    return Math.abs(d) >= FRIEND_DIR_MIN ? [{ npcId: n.id, name: n.name, dir: d > 0 ? 'up' as const : 'down' as const }] : [];
  });

  const broken = promises.find(p => !p.kept);
  const kept = promises.find(p => p.kept);
  const missedN = routine ? routine.total - routine.kept : 0;
  const kind: (typeof VERDICT_PRIORITY)[number] = burnout ? 'burnout'
    : broken ? 'broken'
    : missedN > 0 ? 'missed'
    : kept ? 'kept'
    : routine && routineName ? 'steady'
    : 'quiet';
  const variants = VERDICTS[kind];
  const verdict = variants[(run.year * 12 + run.month) % variants.length]({
    name: (broken ?? kept)?.name ?? '',
    n: missedN,
    t: routine?.total ?? 0,
    routine: routineName ?? '',
  });
  return {
    label, verdict, routine,
    choiceMissedWeeks: run.log.filter(w => w.choiceMissed > 0).length,
    promises, statDirs, friendDirs, burnout,
  };
}

/** 월 블록 번호 → "4월". */
export function getMonthBlockLabel(month: number): string {
  return getMonthBlock((month - 1) * 4 + 1).label;
}

/** 이 상태가 그 달 계획이 있고 재생 중인가(화면 라우팅용). */
export function isPlaying(state: GameState): boolean {
  return getMonthRun(state)?.status === 'playing' && !!getCurrentMonthPlan(state);
}
