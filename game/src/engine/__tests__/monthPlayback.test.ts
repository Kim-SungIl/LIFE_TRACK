// 한 달 자동 진행 — monthPlayback.ts + store 재생 액션(설계안 §5 재생과 멈춤 · §7 월말 결산 · §8 월 적립 · §10 저장).
// 재생 = 손 진행의 바이트 동일성은 monthPlaybackEquivalence.test.ts가 336주 단위로 잠근다. 여기는 멈춤 규칙 하나하나와
// 장부(기록·적립·결산)의 값을 잠근다.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../gameEngine';
import { cloneGameState } from '../stateClone';
import { firstPickableChoice } from '../eventPresentation';
import { generateMonthInvites } from '../monthInvites';
import {
  MAX_TALK_BANK, VERDICT_PRIORITY, boundaryStopAfter, buildMonthSummary, getMonthRun, hadTalkChance, isPlaying, recordWeek,
  talkBankCount,
} from '../monthPlayback';
import { getAvailableHomeEvents, getAvailableNpcEvents, getEligibleParentClimax } from '../talkSystem';
import { getWeekInfo } from '../weekMath';
import { installMemoryStorage } from '../../../scripts/lib/week-driver';
import type { useGameStore as UseGameStore } from '../store';
import type { GameState, MonthPlan, MonthRun, MonthRunWeek } from '../types';

let store: typeof UseGameStore;
let storage: Map<string, string>;
beforeAll(async () => {
  storage = installMemoryStorage();
  store = (await import('../store')).useGameStore;
});

const api = () => store.getState();
const now = () => api().state!;

/** Y2 그 주(학기·방학은 달력대로), 무료 루틴, 넉넉한 돈, 친구 없음(초대 0). 사건이 안 걸리게 이벤트 압력은 그대로 둔다. */
function at(week: number, patch: Partial<GameState> = {}): GameState {
  const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 11 });
  return Object.assign(s, {
    year: 2, week, phase: 'weekday' as const, currentEvent: null, isVacation: getWeekInfo(week).isVacation,
    semester: getWeekInfo(week).semester, routineSlot2: 'self-study', routineSlot3: null, money: 30, monthlyMoney: true,
  }, patch);
}

/** 지금 주부터 그 달 끝까지 — 학기 주는 [독서, 휴식], 방학 주는 휴식 5칸. 받은 초대는 전부 거절. */
function planFor(s: GameState, weekend: string[] = ['reading', 'rest']): MonthPlan {
  const end = Math.ceil(s.week / 4) * 4;
  return {
    year: s.year, month: Math.ceil(s.week / 4),
    weeks: Array.from({ length: end - s.week + 1 }, (_, i) => s.week + i).map(week => ({
      week, activities: getWeekInfo(week).isVacation ? ['rest', 'rest', 'rest', 'rest', 'rest'] : [...weekend], npcChoices: {},
    })),
    invites: generateMonthInvites(s).map(i => ({ ...i, accepted: false })),
  };
}

/** 사건이 걸려 있으면 보이는 첫 선택지로 끝까지 푼다(화면의 선택과 같은 판정). */
function settle() {
  for (let i = 0; i < 20 && now().phase === 'event'; i++) {
    const s = now();
    const e = s.currentEvent!;
    api().resolveEvent(firstPickableChoice(s, s.gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices));
  }
}

function startAt(s: GameState, plan = planFor(s)) {
  store.setState({ state: s, npcActivityMap: {} });
  expect(api().setMonthPlan(plan)).toBeNull();
  api().startMonthPlayback();
  settle();
}

beforeEach(() => storage.clear());

describe('시작 — 이번 주를 계획대로 confirmWeek', () => {
  it('재생 상태를 만들고(시작 능력치·잔액 스냅샷) 첫 주를 계획한 칸으로 처리해 결산 카드에 선다', () => {
    const s = at(5);
    const startStats = { ...s.stats };
    startAt(s);
    const after = now();
    expect(after.phase).toBe('result');
    expect(after.week).toBe(6);
    expect(after.lastWeekendPlan?.activities).toEqual(['reading', 'rest']);
    const run = getMonthRun(after)!;
    expect(run.status).toBe('playing');
    expect(run.startStats).toEqual(startStats);
    expect(run.log.map(w => [w.week, w.auto])).toEqual([[5, true]]);
  });

  it('계획이 없으면 시작하지 않는다', () => {
    store.setState({ state: at(5) });
    api().startMonthPlayback();
    expect(now().week).toBe(5);
    expect(now().monthRun).toBeUndefined();
  });
});

describe('카드 → 다음 주, 멈춤 · 재개', () => {
  it('카드에서 다음으로 가면 다음 주를 재생한다', () => {
    startAt(at(5));
    api().continuePlayback();
    settle();
    expect(now().week).toBe(7);
    expect(getMonthRun(now())!.log.map(w => w.week)).toEqual([5, 6]);
  });

  it('카드에서 ⏸ → 경계에서 멈춘다(주를 처리하지 않는다) → ▶ 이어서 재생하면 다음 주를 처리한다', () => {
    startAt(at(5));
    api().pausePlayback('player');
    api().continuePlayback();
    expect(now().phase).toBe('weekday');
    expect(now().week).toBe(6);
    expect(getMonthRun(now())).toMatchObject({ status: 'paused', stop: 'player' });
    api().resumePlayback();
    settle();
    expect(now().week).toBe(7);
    expect(getMonthRun(now())!.status).toBe('playing');
  });

  it('💬로 멈춘 이유는 talk — 화면이 그 창을 열고 연다', () => {
    startAt(at(5));
    api().pausePlayback('talk');
    api().continuePlayback();
    expect(getMonthRun(now())?.stop).toBe('talk');
  });

  it('멈춘 채 손으로 확정한 주는 기록에 auto=false로 남고, 재생은 멈춘 그대로다', () => {
    startAt(at(5));
    api().pausePlayback('player');
    api().continuePlayback();
    api().confirmWeek(['rest', ''], {});
    settle();
    const run = getMonthRun(now())!;
    expect(run.log.map(w => [w.week, w.auto])).toEqual([[5, true], [6, false]]);
    expect(run.status).toBe('paused');
  });
});

describe('멈춤 조건(§5)', () => {
  it('계획이 성립하지 않으면(이번 주 활동비 부족) 처리하지 않고 plan-invalid로 멈춘다', () => {
    // 레슨(2만) 계획에 잔액 1만 — 화면이라면 확정이 잠기는 주.
    const s = at(5, { money: 1 });
    store.setState({ state: s });
    expect(api().setMonthPlan(planFor(s, ['art-lesson', 'rest']))).toBeNull();
    api().startMonthPlayback();
    expect(now().week).toBe(5);
    expect(now().phase).toBe('weekday');
    expect(getMonthRun(now())).toMatchObject({ status: 'paused', stop: 'plan-invalid', stopDetail: '이번 주 활동비가 모자라요' });
  });

  it('동행 친구가 더는 만날 수 없으면(전출) plan-invalid', () => {
    const s = at(5);
    const npc = s.npcs.find(n => n.id === 'jihun')!;
    npc.met = true;
    npc.intimacy = 10;
    const plan = planFor(s, ['hang-out', 'rest']);
    plan.weeks[1].npcChoices = { 'hang-out:0': 'jihun' };
    store.setState({ state: s });
    expect(api().setMonthPlan(plan)).toBeNull();
    api().startMonthPlayback();
    settle();
    // W5는 동행이 없어 돈다. W6 계획 직전에 지훈을 안 만난 상태로 돌려 "같이 할 수 없게 됨"을 만든다.
    const mid = cloneGameState(now());
    mid.npcs.find(n => n.id === 'jihun')!.met = false;
    store.setState({ state: mid });
    api().continuePlayback();
    expect(now().week).toBe(6);
    expect(getMonthRun(now())).toMatchObject({ stop: 'plan-invalid', stopDetail: '지훈과 같이 할 수 없게 됐어요' });
  });

  it('번아웃이 나면 다음 경계에서 멈추고, 그 이유가 다른 멈춤 요청보다 앞선다', () => {
    // 번아웃 진입은 tired + 멘탈 < 20(gameEngine checkMentalStateTransition).
    startAt(at(5, { stats: { ...at(5).stats, mental: 5 }, fatigue: 95, mentalState: 'tired', burnoutCooldown: 0 }));
    expect(now().burnoutCount).toBe(1);
    const run = getMonthRun(now())!;
    expect(run.log[0].burnout).toBe(true);
    expect(run.stopAtBoundary).toBe('burnout');
    api().pausePlayback('talk');
    api().continuePlayback();
    expect(getMonthRun(now())).toMatchObject({ status: 'paused', stop: 'burnout' });
    expect(now().week, '번아웃 뒤 다음 주를 재생해 버렸다').toBe(6);
  });

  it('섞인 달 7월 — W19(학기 마지막) 뒤 W20(방학) 앞에서 멈춘다. W17·W18 뒤엔 안 멈춘다', () => {
    const entry = (week: number): MonthRunWeek => ({ week, auto: true, timeCost: 0, routineMissed: 0, choiceMissed: 0, burnout: false, promises: [] });
    expect(boundaryStopAfter(entry(17))).toBeNull();
    expect(boundaryStopAfter(entry(18))).toBeNull();
    expect(boundaryStopAfter(entry(19))).toBe('season');
    expect(boundaryStopAfter(entry(20)), '달의 끝은 멈춤이 아니라 월말 결산').toBeNull();
    expect(boundaryStopAfter(entry(42)), '1월 — W42(학기 마지막) 뒤 W43 방학').toBe('season');
    expect(boundaryStopAfter(entry(43))).toBeNull();
    expect(boundaryStopAfter(entry(8))).toBeNull();
    // store 경로 — W19에서 시작하면 첫 카드 뒤 멈춘다.
    startAt(at(19));
    expect(getMonthRun(now())?.stopAtBoundary).toBe('season');
    api().continuePlayback();
    expect(getMonthRun(now())).toMatchObject({ status: 'paused', stop: 'season' });
    expect(now().week).toBe(20);
  });
});

describe('월말 — 결산과 다음 달', () => {
  it('양성 짝: 달 중간 재생은 isPlaying이 참이다', () => {
    startAt(at(5));
    expect(getMonthRun(now())?.status).toBe('playing');
    expect(isPlaying(now())).toBe(true);
  });

  it('달의 마지막 주를 처리하면 재생 상태는 남아 있되 지금 달 것이 아니고, finishMonth가 지우고 계획 단계로 보낸다', () => {
    startAt(at(8));
    const after = now();
    expect(after.week).toBe(9);
    expect(getMonthRun(after), '다음 달 좌표에서 지난달 재생을 지금 것으로 읽었다').toBeNull();
    // 장부의 status는 그대로라도 지금 달 재생이 아니다 — 화면(빨리 넘기기 해제)은 이 판정 하나를 읽는다.
    expect(after.monthRun?.status, '전제: 장부는 아직 playing').toBe('playing');
    expect(isPlaying(after), '지난달 장부를 재생 중으로 읽었다').toBe(false);
    expect(after.monthRun?.log.map(w => w.week)).toEqual([8]);
    api().finishMonth();
    expect(now().monthRun).toBeUndefined();
    expect(now().phase).toBe('weekday');
  });

  it('학년이 바뀌면 재생 상태와 적립이 사라진다', () => {
    const s = at(48, { phase: 'year-end', week: 49, monthRun: { year: 2, month: 12 } as MonthRun, talkBank: { year: 2, month: 12, count: 2 } });
    store.setState({ state: s });
    api().advanceFromYearEnd();
    expect(now().monthRun).toBeUndefined();
    expect(now().talkBank).toBeUndefined();
  });
});

/** 친밀도 60 친구 하나 + 그 친구 미니 이벤트가 남아 있는 상태(전제를 단언한다). */
function withTalkChance(week: number, patch: Partial<GameState> = {}): GameState {
  const s = at(week, patch);
  for (const id of ['jihun', 'subin', 'minjae', 'yuna']) {
    const n = s.npcs.find(x => x.id === id)!;
    n.met = true;
    n.intimacy = 60;
  }
  s.npcEventPendingThisWeek = true;
  const npc = s.npcs.find(n => getAvailableNpcEvents(s, n.id).length > 0);
  expect(npc, '전제: 미니 이벤트가 남은 친구').toBeTruthy();
  return s;
}

describe('놓친 대화 월 적립(§8) — 최대 4, 다음 달에만', () => {
  it('기회가 있는 주를 재생이 지나치면 1을 세고, 기회가 없으면 안 센다', () => {
    const s = withTalkChance(5);
    expect(hadTalkChance(s)).toBe(true);
    startAt(s, { ...planFor(s), invites: generateMonthInvites(s).map(i => ({ ...i, accepted: false })) });
    expect(getMonthRun(now())!.missedTalks).toBe(1);
    const none = at(5);
    none.npcEventPendingThisWeek = false;
    none.parentEventPendingThisWeek = false;
    expect(hadTalkChance(none)).toBe(false);
    startAt(none);
    expect(getMonthRun(now())!.missedTalks).toBe(0);
  });

  it('세는 값은 4에서 멈춘다(경계 3→4, 4→4)', () => {
    const s = withTalkChance(5);
    startAt(s, { ...planFor(s), invites: generateMonthInvites(s).map(i => ({ ...i, accepted: false })) });
    const forced = (n: number) => {
      const t = cloneGameState(now());
      t.monthRun = { ...t.monthRun!, missedTalks: n, status: 'paused' };
      t.phase = 'weekday';
      t.npcEventPendingThisWeek = true;
      store.setState({ state: t });
      expect(hadTalkChance(t)).toBe(true);
      api().resumePlayback();
      return now().monthRun!.missedTalks;
    };
    expect(MAX_TALK_BANK).toBe(4);
    expect(forced(3)).toBe(4);
    expect(forced(4)).toBe(4);
  });

  it('달을 마치면 놓친 수가 다음 달 적립이 되고, 그 달이 끝나면 사라진다', () => {
    const s = at(8, { monthRun: undefined });
    store.setState({ state: s });
    expect(api().setMonthPlan(planFor(s))).toBeNull();
    api().startMonthPlayback();
    settle();
    const t = cloneGameState(now());
    t.monthRun!.missedTalks = 3;
    store.setState({ state: t });
    api().finishMonth();
    expect(now().talkBank).toEqual({ year: 2, month: 3, count: 3 });
    expect(talkBankCount(now())).toBe(3);
    // 다음 달(W13, 4월이 아닌 4번째 달)이면 지난 적립은 안 읽힌다.
    expect(talkBankCount({ ...now(), week: 13 })).toBe(0);
    // 놓친 게 없는 달을 마치면 남은 적립도 지운다(다음 달로 안 넘어감).
    const u = cloneGameState(now());
    u.monthRun = { ...(t.monthRun as MonthRun), missedTalks: 0 };
    store.setState({ state: u });
    api().finishMonth();
    expect(now().talkBank).toBeUndefined();
  });

  it('적립이 있으면 이번 주 기회가 없어도 친구 미니 이벤트가 뜨고 적립을 하나 쓴다 — 다른 달 적립은 안 쓴다', () => {
    const s = withTalkChance(9);
    s.npcEventPendingThisWeek = false;
    const target = s.npcs.find(n => getAvailableNpcEvents({ ...s, npcEventPendingThisWeek: true }, n.id).length > 0)!;
    store.setState({ state: { ...s, talkBank: { year: 2, month: 3, count: 2 } } });
    expect(api().talkToNpc(target.id).kind).toBe('event');
    expect(now().talkBank?.count).toBe(1);
    expect(now().npcEventPendingThisWeek).toBe(false);
    store.setState({ state: { ...s, talkBank: { year: 2, month: 2, count: 2 } } });
    expect(api().talkToNpc(target.id).kind, '지난달 적립을 이번 달에 썼다').toBe('smalltalk');
    // 이번 주 기회가 있으면 그걸 먼저 쓰고 적립은 그대로다.
    store.setState({ state: { ...s, npcEventPendingThisWeek: true, talkBank: { year: 2, month: 3, count: 2 } } });
    expect(api().talkToNpc(target.id).kind).toBe('event');
    expect(now().talkBank?.count).toBe(2);
  });
});

describe('가정 대화도 적립을 쓴다', () => {
  it('이번 주 기회가 없고 적립이 있으면 적립 하나를 이번 주 기회로 바꿔 가정 미니 이벤트를 띄운다 — 적립이 없으면 잡담', () => {
    const s = at(9);
    s.parentEventPendingThisWeek = false;
    const probe = { ...s, parentEventPendingThisWeek: true };
    expect(getAvailableHomeEvents(probe).length, '전제: 남은 가정 이벤트').toBeGreaterThan(0);
    expect(getEligibleParentClimax(s), '전제: 절정 순간 없음(그건 기회와 무관하게 뜬다)').toBeNull();
    store.setState({ state: { ...s, talkBank: { year: 2, month: 3, count: 2 } } });
    expect(api().talkToHome().kind).toBe('event');
    expect(now().talkBank?.count).toBe(1);
    store.setState({ state: { ...s, talkBank: undefined } });
    expect(api().talkToHome().kind).toBe('smalltalk');
  });
});

describe('저장 — 재생 중에 껐다 켜면 멈춤으로 연다(§10)', () => {
  it('세이브의 재생 상태가 playing이면 paused/reload로 읽는다', () => {
    startAt(at(5));
    expect(storage.get('lifetrack_save')).toContain('"monthRun"');
    store.setState({ state: null });
    expect(api().loadSavedGame()).toBe(true);
    expect(getMonthRun(now())).toMatchObject({ status: 'paused', stop: 'reload' });
    // 카드에서 이어가면 경계에서 멈춘 채 선다(바로 재생하지 않는다).
    api().continuePlayback();
    expect(now().week).toBe(6);
    expect(now().phase).toBe('weekday');
  });
});

describe('남은 주 다시 짜기 — 초대는 처음 그대로', () => {
  function withInvite(): GameState {
    for (let seed = 0; seed < 3000; seed++) {
      const s = at(5, { rngSeed: seed });
      const n = s.npcs.find(x => x.id === 'jihun')!;
      n.met = true;
      n.intimacy = 40;
      const inv = generateMonthInvites(s);
      if (inv.length === 1 && inv[0].week === 5) return s;
    }
    throw new Error('시드 없음');
  }

  it('처음 짤 때 거절한 친구는 −1, 다시 짤 때 같은 답이면 저장되고 또 깎지 않는다. 답을 바꾸면 거부', () => {
    const s = withInvite();
    store.setState({ state: s });
    expect(api().setMonthPlan(planFor(s))).toBeNull();
    expect(now().npcs.find(n => n.id === 'jihun')!.intimacy).toBe(39);
    // W6 좌표에서 다시 짠다 — W5 초대(지난 주)는 칸 검사를 안 한다.
    const w6 = { ...cloneGameState(now()), week: 6 };
    store.setState({ state: w6 });
    const again = planFor(w6, ['rest', 'rest']);
    again.invites = structuredClone(now().monthPlan!.invites);
    expect(api().setMonthPlan(again)).toBeNull();
    expect(now().npcs.find(n => n.id === 'jihun')!.intimacy, '다시 짤 때 거절을 또 깎았다').toBe(39);
    const flipped = structuredClone(again);
    flipped.invites![0].accepted = true;
    expect(api().setMonthPlan(flipped)).toMatch(/처음과 다르다/);
    expect(api().setMonthPlan({ ...again, invites: [] })).toMatch(/처음과 다르다/);
  });
});

describe('주 기록 — recordWeek', () => {
  const pre = (patch: Partial<GameState>) => at(5, { weekendChoices: ['reading', 'rest'], routineSlot3: 'reading', ...patch });
  const post = (p: GameState, patch: Partial<GameState> = {}) => ({ ...p, ...patch, weekLog: { statChanges: {}, fatigueChange: 0, moneyChange: 0, messages: [], skipped: [], milestoneMessages: [], ...(patch.weekLog ?? {}) } }) as GameState;

  it('시간 소모 1 = 루틴 슬롯3·주말 마지막 칸, 2 = 루틴 둘·주말 두 칸, 0 = 없음', () => {
    const p0 = pre({ eventTimeCost: 0 });
    expect(recordWeek(p0, post(p0), true)).toMatchObject({ timeCost: 0, routineMissed: 0, choiceMissed: 0 });
    const p1 = pre({ eventTimeCost: 1 });
    expect(recordWeek(p1, post(p1), true)).toMatchObject({ timeCost: 1, routineMissed: 1, choiceMissed: 1 });
    const p2 = pre({ eventTimeCost: 2 });
    expect(recordWeek(p2, post(p2), true)).toMatchObject({ timeCost: 2, routineMissed: 2, choiceMissed: 2 });
  });

  it('슬롯3이 비면 시간 소모 1은 루틴을 안 지운다 · 방학엔 루틴이 없다 · 꼬리만 잘린 여러 칸 활동은 빠진 게 아니다', () => {
    const p = pre({ eventTimeCost: 1, routineSlot3: null });
    expect(recordWeek(p, post(p), true).routineMissed).toBe(0);
    const v = at(21, { eventTimeCost: 1, vacationChoices: ['sports-camp', 'sports-camp', 'sports-camp', 'rest', 'reading'] });
    expect(recordWeek(v, post(v), true)).toMatchObject({ routineMissed: 0, choiceMissed: 1 });
    const tail = at(21, { eventTimeCost: 1, vacationChoices: ['rest', 'rest', 'sports-camp', 'sports-camp', 'sports-camp'] });
    expect(recordWeek(tail, post(tail), true).choiceMissed).toBe(0);
  });

  it('돈·자격으로 빠진 칸도 센다 · 번아웃은 횟수가 늘었을 때만 · 약속 결과를 옮겨 적는다', () => {
    const p = pre({ eventTimeCost: 0, burnoutCount: 1 });
    const r = recordWeek(p, post(p, {
      burnoutCount: 2,
      weekLog: { skipped: [{ activityId: 'reading', reason: 'money', origin: 'routine' }, { activityId: 'reading', reason: 'gate', origin: 'choice' }], promises: [{ npcId: 'jihun', kept: false }] } as never,
    }), false);
    expect(r).toMatchObject({ auto: false, routineMissed: 1, choiceMissed: 1, burnout: true, promises: [{ npcId: 'jihun', kept: false }] });
    expect(recordWeek(p, post(p, { burnoutCount: 1 }), true).burnout).toBe(false);
  });
});

describe('월말 결산 내용 — buildMonthSummary', () => {
  const week = (w: number, patch: Partial<MonthRunWeek> = {}): MonthRunWeek => ({ week: w, auto: true, timeCost: 0, routineMissed: 0, choiceMissed: 0, burnout: false, promises: [], ...patch });
  const run = (log: MonthRunWeek[], startStats = at(9).stats): MonthRun => ({
    year: 2, month: 2, status: 'playing', log, missedTalks: 0, startStats, startIntimacy: { jihun: 40 }, startMoney: 10,
  });
  const st = (patch: Partial<GameState> = {}) => {
    const s = at(9, patch);
    s.npcs.find(n => n.id === 'jihun')!.met = true;
    s.npcs.find(n => n.id === 'jihun')!.intimacy = 40;
    return s;
  };
  const kindOf = (r: MonthRun, s = st()) => buildMonthSummary(s, r, '독학').verdict;

  it('총평은 가장 강한 신호 하나 — 번아웃 > 깬 약속 > 방과후 결석 > 지킨 약속 > 꾸준함 > 조용함', () => {
    expect(VERDICT_PRIORITY).toEqual(['burnout', 'broken', 'missed', 'kept', 'steady', 'quiet']);
    const all = [week(5, { burnout: true, routineMissed: 1, promises: [{ npcId: 'jihun', kept: false }, { npcId: 'jihun', kept: true }] }), week(6), week(7), week(8)];
    expect(kindOf(run(all))).toMatch(/무너|주저앉/);
    all[0].burnout = false;
    expect(kindOf(run(all))).toMatch(/못 지켰다|미안한/);
    all[0].promises = [{ npcId: 'jihun', kept: true }];
    expect(kindOf(run(all))).toMatch(/방과후/);
    all[0].routineMissed = 0;
    expect(kindOf(run(all))).toMatch(/지켰다|만났다/);
    all[0].promises = [];
    expect(kindOf(run(all))).toMatch(/독학/);
    expect(buildMonthSummary(st(), run(all), null).verdict, '루틴 이름이 없으면 조용함').toMatch(/조용|별일/);
  });

  it('방과후 집계는 학기 주만 — 다 간 주 / 학기 주 수', () => {
    const s = buildMonthSummary(st(), run([week(5), week(6, { routineMissed: 1 }), week(7, { routineMissed: 2 }), week(8)]), '독학');
    expect(s.routine).toEqual({ kept: 2, total: 4 });
    expect(s.verdict).toMatch(/2/);
    const july = buildMonthSummary(st(), run([week(17), week(18), week(19), week(20, { routineMissed: 0 })]), '독학');
    expect(july.routine).toEqual({ kept: 3, total: 3 });
    const aug = buildMonthSummary(st(), run([week(21), week(22)]), '독학');
    expect(aug.routine).toBeNull();
  });

  it('변화 배지는 숫자 없이 방향만, 문턱은 능력치 1·친밀도 3(양방향 경계)', () => {
    // 경계 바로 안쪽 값은 2진수로 정확한 15/16(0.9375)을 쓴다 — 0.9처럼 뺄셈에서 0.8999…가 되면
    // 문턱을 0.9로 내린 뮤턴트도 그 값을 못 넘어 살아남는다(실측).
    const base = { academic: 40, social: 40, talent: 40, mental: 40, health: 40 } as GameState['stats'];
    const s = st({ stats: { ...base, academic: 41, social: 40.9375, talent: 39, mental: 39.0625 } });
    const sum = buildMonthSummary(s, run([week(5)], base), null);
    expect(sum.statDirs.map(d => [d.key, d.dir])).toEqual([['academic', 'up'], ['talent', 'down']]);
    const friend = (v: number) => { const t = st(); t.npcs.find(n => n.id === 'jihun')!.intimacy = v; return buildMonthSummary(t, run([week(5)], t.stats), null).friendDirs; };
    expect(friend(43)).toEqual([{ npcId: 'jihun', name: '지훈', dir: 'up' }]);
    expect(friend(42.9375)).toEqual([]);
    expect(friend(37)).toEqual([{ npcId: 'jihun', name: '지훈', dir: 'down' }]);
    expect(friend(37.0625)).toEqual([]);
  });
});
