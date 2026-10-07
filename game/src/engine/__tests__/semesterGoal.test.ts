// T68 학기 목표 — 판정 계약.
//
// 이 파일이 잠그는 것: 고를 수 있는 때(창), 무엇을 세는가(주말 실행·동행만), 임계(양방향),
// 학기말 정산 배선(processWeek), 낡은 목표 정산, 구세이브·손상값, 그리고 **경제·이벤트 불변**
// (같은 계획이면 목표 유무와 무관하게 같은 판). 화면 배선은 components/__tests__/semesterGoalWiring.
// 도달 가능성(실플레이 7년)은 scripts/sim/sim-semester-goal.ts가 잰다 — 여기 단위 픽스처는 픽 가능성만 본다.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  GOAL_TARGET_WEEKS, GOAL_PICK_WINDOW, GOAL_FREE_ACTIVITY, GOAL_ACTIVITY_CATEGORY, SEMESTER_BOUNDS,
  canPickSemesterGoal, offerSemesterGoals, pickSemesterGoal, friendGoalCandidate, outcomeOf, goalStage,
  goalRecordForWeekLog, goalRecordsForYear, goalOutcomeLine, goalTitle,
  sanitizeSemesterGoal, sanitizeSemesterGoalLog, settleStaleSemesterGoal,
} from '../semesterGoal';
import { processWeek, createInitialState } from '../gameEngine';
import { ACTIVITIES, canApplyActivity } from '../activities';
import { migrateLoadedState } from '../stateMigration';
import { absWeek } from '../weekMath';
import { useGameStore } from '../store';
import { makeState, withNpc } from '../../test/fixtures';
import type { ActiveSemesterGoal, GameState, SemesterGoalKind } from '../types';

function semState(patch: Partial<GameState> = {}): GameState {
  return makeState({
    phase: 'weekday', year: 1, week: 2, isVacation: false, semester: 1, money: 10,
    routineSlot2: 'self-study', routineSlot3: 'self-study', currentEvent: null,
    ...patch,
  });
}

function goal(patch: Partial<ActiveSemesterGoal> = {}): ActiveSemesterGoal {
  return { kind: 'exercise', year: 1, semester: 1, markedWeeks: [], ...patch };
}

/** n주 표시된 목표 — 스탬프는 학기 첫 주부터 연속. */
function marks(n: number, year = 1, start = 1): number[] {
  return Array.from({ length: n }, (_, i) => absWeek(year, start + i));
}

describe('상수 — 착지값을 먼저 박는다', () => {
  it('임계 6주 · 창 2주 · 학기 경계는 getWeekInfo에서 파생된 W1~19 / W25~42', () => {
    expect(GOAL_TARGET_WEEKS).toBe(6);
    expect(GOAL_PICK_WINDOW).toBe(2);
    expect(SEMESTER_BOUNDS).toEqual({ 1: { start: 1, end: 19 }, 2: { start: 25, end: 42 } });
  });

  it('창의 마지막 주에 골라도 남은 학기 주가 임계보다 넉넉하다 (고르는 순간 이미 못 채우는 목표는 없다)', () => {
    for (const sem of [1, 2] as const) {
      const lastPick = SEMESTER_BOUNDS[sem].start + GOAL_PICK_WINDOW - 1;
      const remaining = SEMESTER_BOUNDS[sem].end - lastPick + 1;
      expect(remaining).toBeGreaterThanOrEqual(GOAL_TARGET_WEEKS);
    }
  });

  it('활동 계열마다 증인 활동은 무료·1칸·category 일치이고, 7년 내내 돈 0으로도 학기 중에 실행된다', () => {
    for (const [kind, id] of Object.entries(GOAL_FREE_ACTIVITY) as [Exclude<SemesterGoalKind, 'friend'>, string][]) {
      const a = ACTIVITIES.find(x => x.id === id)!;
      expect(a, id).toBeDefined();
      expect(a.category).toBe(GOAL_ACTIVITY_CATEGORY[kind]);
      expect(a.moneyCost).toBe(0);
      expect(a.yearlyCost).toBeUndefined();
      expect(a.slots).toBe(1);
      for (let year = 1; year <= 7; year++) {
        for (const week of [1, 19, 25, 42]) {
          expect(canApplyActivity(semState({ year, week, money: 0 }), id), `${id} Y${year} W${week}`).toBe(true);
        }
      }
    }
  });
});

describe('고를 수 있는 때', () => {
  it('학기 1~2주차만 — 3주차·방학·다음 학기 3주차는 못 고른다', () => {
    expect(canPickSemesterGoal(semState({ week: 1 }))).toBe(true);
    expect(canPickSemesterGoal(semState({ week: 2 }))).toBe(true);
    expect(canPickSemesterGoal(semState({ week: 3 }))).toBe(false);
    expect(canPickSemesterGoal(semState({ week: 20, isVacation: true }))).toBe(false);
    expect(canPickSemesterGoal(semState({ week: 25 }))).toBe(true);
    expect(canPickSemesterGoal(semState({ week: 26 }))).toBe(true);
    expect(canPickSemesterGoal(semState({ week: 27 }))).toBe(false);
  });

  it('결산·사건·학년말 화면 중엔 못 고른다', () => {
    for (const phase of ['result', 'event', 'year-end', 'ending'] as const) {
      expect(canPickSemesterGoal(semState({ phase }))).toBe(false);
    }
  });

  it('한 번이라도 채운 목표는 못 바꾼다 — 아직 시작 전이면 다시 고를 수 있다', () => {
    expect(canPickSemesterGoal(semState({ semesterGoal: goal() }))).toBe(true);
    expect(canPickSemesterGoal(semState({ semesterGoal: goal({ markedWeeks: marks(1) }) }))).toBe(false);
  });

  it('후보는 활동 셋 + 친구 하나, 제시 안 된 후보는 세워지지 않는다', () => {
    const s = semState();
    const offers = offerSemesterGoals(s);
    expect(offers.map(o => o.kind)).toEqual(['exercise', 'study', 'craft', 'friend']);
    expect(pickSemesterGoal(s, { kind: 'friend', npcId: 'minjae' })).toBe(false);   // 안 만난 친구
    expect(s.semesterGoal).toBeUndefined();
    expect(pickSemesterGoal(s, { kind: 'study' })).toBe(true);
    expect(s.semesterGoal).toEqual({ kind: 'study', year: 1, semester: 1, markedWeeks: [] });
  });

  it('친구 후보는 동행 가능한(만남·재적) 친구 중 가장 오래 못 본 사람, 떠나기로 정해진 도윤은 Y2부터 빠진다', () => {
    let npcs = withNpc(makeState().npcs, 'subin', { met: true, lastInteractionWeek: 1 });
    npcs = withNpc(npcs, 'jihun', { lastInteractionWeek: 3 });
    expect(friendGoalCandidate(semState({ npcs }))).toBe('subin');
    const y2 = withNpc(withNpc(npcs, 'doyun', { met: true, lastInteractionWeek: 0 }), 'subin', { lastInteractionWeek: 50 });
    expect(friendGoalCandidate(semState({ npcs: y2, year: 1 }))).toBe('doyun');
    expect(friendGoalCandidate(semState({ npcs: y2, year: 2, week: 1 }))).not.toBe('doyun');
  });
});

describe('무엇을 세는가 — processWeek 배선', () => {
  const run = (s: GameState, map?: Record<string, string>) => processWeek(s, map);

  it('주말에 실행된 그 계열 활동이 있으면 그 주를 표시한다', () => {
    const after = run(semState({ semesterGoal: goal(), weekendChoices: ['light-exercise', 'rest'] }));
    expect(after.semesterGoal!.markedWeeks).toEqual([absWeek(1, 2)]);
  });

  it('루틴(방과후)의 같은 계열은 세지 않는다 — 세면 고르는 순간 달성이다', () => {
    const after = run(semState({ semesterGoal: goal(), routineSlot3: 'light-exercise', weekendChoices: ['rest'] }));
    expect(after.semesterGoal!.markedWeeks).toEqual([]);
  });

  it('돈이 모자라 스킵된 활동은 세지 않는다 (엔진이 실행한 것만)', () => {
    const after = run(semState({ semesterGoal: goal(), money: 0, routineSlot2: 'self-study', weekendChoices: ['gym'] }));
    expect(after.weekLog!.skipped.map(k => k.activityId)).toContain('gym');
    expect(after.semesterGoal!.markedWeeks).toEqual([]);
  });

  it('이벤트 timeCost로 잘린 꼬리 슬롯은 세지 않는다', () => {
    const after = run(semState({ semesterGoal: goal(), eventTimeCost: 1, weekendChoices: ['rest', 'light-exercise'] }));
    expect(after.semesterGoal!.markedWeeks).toEqual([]);
  });

  it('친구 목표 = 그 친구와 동행했고 그 활동이 실행됐다. 다른 친구·실행 안 된 동행은 안 센다', () => {
    const npcs = withNpc(makeState().npcs, 'subin', { met: true });
    const base = { npcs, semesterGoal: goal({ kind: 'friend', npcId: 'jihun' }) };
    expect(run(semState({ ...base, weekendChoices: ['club', 'rest'] }), { 'club:0': 'jihun' })
      .semesterGoal!.markedWeeks).toHaveLength(1);
    expect(run(semState({ ...base, weekendChoices: ['club', 'rest'] }), { 'club:0': 'subin' })
      .semesterGoal!.markedWeeks).toHaveLength(0);
    // timeCost 2 = 주말 두 칸 다 잘림 → 동행 키는 남아도 활동이 실행되지 않았다
    expect(run(semState({ ...base, eventTimeCost: 2, weekendChoices: ['club', 'rest'] }), { 'club:0': 'jihun' })
      .semesterGoal!.markedWeeks).toHaveLength(0);
    // 레거시 키(activityId 단독)
    expect(run(semState({ ...base, weekendChoices: ['club'] }), { club: 'jihun' })
      .semesterGoal!.markedWeeks).toHaveLength(1);
  });

  it('같은 주를 두 번 세지 않는다 (스탬프)', () => {
    const s = semState({ semesterGoal: goal({ markedWeeks: [absWeek(1, 2)] }), weekendChoices: ['light-exercise'] });
    expect(run(s).semesterGoal!.markedWeeks).toEqual([absWeek(1, 2)]);
  });

  it('방학 주는 세지 않는다', () => {
    const s = semState({ week: 21, isVacation: true, semesterGoal: goal(), vacationChoices: ['light-exercise'] });
    const after = run(s);
    // 방학 W21에 남은 목표는 낡은 것이라 첫머리에서 정산된다 — 방학 실행분은 안 들어간다
    expect(after.semesterGoal).toBeUndefined();
    expect(after.semesterGoalLog).toEqual([{ kind: 'exercise', year: 1, semester: 1, outcome: 'missed' }]);
  });
});

describe('임계 — 양방향', () => {
  const s = semState();
  it('임계-1주는 몇 번은, 임계 주는 해냈다', () => {
    expect(outcomeOf(goal({ markedWeeks: marks(GOAL_TARGET_WEEKS - 1) }), s)).toBe('partial');
    expect(outcomeOf(goal({ markedWeeks: marks(GOAL_TARGET_WEEKS) }), s)).toBe('achieved');
    expect(outcomeOf(goal({ markedWeeks: marks(1) }), s)).toBe('partial');
    expect(outcomeOf(goal(), s)).toBe('missed');
  });

  it('단계 말도 같은 임계를 쓴다 (5주=자리 잡아 가는 중, 6주=해냈다, 0주=아직 시작 전, 1주=첫발)', () => {
    expect(goalStage(goal({ markedWeeks: marks(GOAL_TARGET_WEEKS - 1) }), s).label).toBe('자리 잡아 가는 중');
    expect(goalStage(goal({ markedWeeks: marks(GOAL_TARGET_WEEKS) }), s).label).toBe('해냈다');
    expect(goalStage(goal(), s).label).toBe('아직 시작 전');
    expect(goalStage(goal({ markedWeeks: marks(1) }), s).label).toBe('첫발을 뗐다');
    expect(goalStage(goal({ markedWeeks: marks(3) }), s).label).toBe('자리 잡아 가는 중');
  });

  it('남은 학기 주로 더는 못 채우면 빠듯하다고 정직하게 말한다 (경계 양쪽)', () => {
    // W19(마지막 주)에 5주 = 이번 주에 하면 6 → 아직 가능
    expect(goalStage(goal({ markedWeeks: marks(5) }), semState({ week: 19 })).label).toBe('자리 잡아 가는 중');
    // W19에 4주 = 이번 주에 해도 5 → 불가능
    expect(goalStage(goal({ markedWeeks: marks(4) }), semState({ week: 19 })).label).toBe('이번 학기엔 빠듯하다');
    // W14에 0주 = 남은 6주(14~19)를 다 하면 6 → 가능 / W15면 불가능
    expect(goalStage(goal(), semState({ week: 14 })).label).toBe('아직 시작 전');
    expect(goalStage(goal(), semState({ week: 15 })).label).toBe('이번 학기엔 빠듯하다');
  });

  it('친구가 떠나면 접는다 — 단 이미 해냈으면 해냈다', () => {
    const departed = semState({
      year: 2, week: 10,
      npcs: withNpc(makeState().npcs, 'doyun', { met: true }),
      events: [{ id: 'doyun-school-split', title: '', description: '', choices: [], year: 2, week: 2 }],
    });
    const g = goal({ kind: 'friend', npcId: 'doyun', year: 2 });
    expect(outcomeOf(g, departed)).toBe('lapsed');
    expect(goalStage(g, departed).label).toBe('사정이 바뀌었다');
    expect(outcomeOf({ ...g, markedWeeks: marks(6, 2) }, departed)).toBe('achieved');
  });
});

describe('학기말 정산 — processWeek의 W19·W42', () => {
  function playSemester(start: number, end: number, year: number, plan: string[]): GameState {
    let s = semState({ year, week: start, semesterGoal: goal({ year, semester: start < 25 ? 1 : 2 }) });
    for (let w = start; w <= end; w++) {
      s = { ...s, phase: 'weekday', currentEvent: null, weekendChoices: plan };
      s = processWeek(s);
      if (w < end) expect(s.semesterGoal, `W${w}에 미리 정산됐다`).toBeDefined();
    }
    return s;
  }

  it('1학기: 마지막 주 결산에서 기록으로 옮겨지고 그 로그가 결과를 가리킨다', () => {
    const s = playSemester(1, 19, 1, ['light-exercise', 'rest']);
    expect(s.semesterGoal).toBeUndefined();
    expect(s.semesterGoalLog).toEqual([{ kind: 'exercise', year: 1, semester: 1, outcome: 'achieved' }]);
    expect(s.weekLog!.week).toBe(19);
    expect(goalRecordForWeekLog(s)).toEqual(s.semesterGoalLog![0]);
  });

  it('2학기도 같다 (W42) — 계획을 안 바꾸면 잊고 지나갔다', () => {
    const s = playSemester(25, 42, 3, ['rest', 'rest']);
    expect(s.semesterGoalLog).toEqual([{ kind: 'exercise', year: 3, semester: 2, outcome: 'missed' }]);
    expect(goalRecordForWeekLog(s)?.outcome).toBe('missed');
  });

  it('학기 마지막 주가 아닌 결산은 결과를 안 가리킨다 (W18, 방학 W20)', () => {
    const rec = { kind: 'exercise' as const, year: 1, semester: 1 as const, outcome: 'achieved' as const };
    const log = (week: number) => ({ ...semState().weekLog!, statChanges: {}, fatigueChange: 0, moneyChange: 0, messages: [], skipped: [], milestoneMessages: [], year: 1, week });
    expect(goalRecordForWeekLog({ weekLog: log(19), semesterGoalLog: [rec] })).toEqual(rec);
    expect(goalRecordForWeekLog({ weekLog: log(18), semesterGoalLog: [rec] })).toBeNull();
    expect(goalRecordForWeekLog({ weekLog: log(20), semesterGoalLog: [rec] })).toBeNull();
    // 다른 학년의 같은 학기 기록은 안 가리킨다
    expect(goalRecordForWeekLog({ weekLog: { ...log(19), year: 2 }, semesterGoalLog: [rec] })).toBeNull();
  });

  it('낡은 목표(다음 학기까지 끌려온 것)는 첫 processWeek이 정산한다 — 다음 학기에 다시 고를 수 있다', () => {
    const s = semState({ week: 26, semesterGoal: goal({ markedWeeks: marks(6) }) });
    expect(canPickSemesterGoal(s)).toBe(true);   // 낡은 목표는 지금 학기 것이 아니다
    const after = processWeek(s);
    expect(after.semesterGoal).toBeUndefined();
    expect(after.semesterGoalLog).toEqual([{ kind: 'exercise', year: 1, semester: 1, outcome: 'achieved' }]);
    const t = semState({ semesterGoal: goal() });
    settleStaleSemesterGoal(t);   // 현재 목표는 건드리지 않는다
    expect(t.semesterGoal).toEqual(goal());
  });
});

describe('학년말·문장', () => {
  it('그 해 기록만 학기 순으로', () => {
    const log = [
      { kind: 'study' as const, year: 2, semester: 2 as const, outcome: 'partial' as const },
      { kind: 'exercise' as const, year: 1, semester: 1 as const, outcome: 'achieved' as const },
      { kind: 'craft' as const, year: 2, semester: 1 as const, outcome: 'missed' as const },
    ];
    expect(goalRecordsForYear(log, 2).map(r => r.semester)).toEqual([1, 2]);
    expect(goalRecordsForYear(undefined, 2)).toEqual([]);
  });

  it('제목은 고른 학년의 학교급 말, 친구는 조사까지 맞는다', () => {
    expect(goalTitle({ kind: 'exercise', year: 1 })).toBe('주말엔 밖에서 뛰어놀기');
    expect(goalTitle({ kind: 'exercise', year: 3 })).toBe('주말마다 땀 흘리기');
    expect(goalTitle({ kind: 'exercise', year: 6 })).toBe('주말 운동 지키기');
    expect(goalTitle({ kind: 'friend', year: 1, npcId: 'jihun' })).toBe('지훈과 주말 보내기');
    expect(goalTitle({ kind: 'friend', year: 1, npcId: 'subin' })).toBe('수빈과 주말 보내기');
    expect(goalTitle({ kind: 'friend', year: 1, npcId: 'yuna' })).toBe('유나와 주말 보내기');
  });

  it('결과 문장에 숫자가 없다 (hide-numbers)', () => {
    for (const kind of ['exercise', 'study', 'craft', 'friend'] as const) {
      for (const outcome of ['achieved', 'partial', 'missed', 'lapsed'] as const) {
        const line = goalOutcomeLine({ kind, year: 2, semester: 1, outcome, ...(kind === 'friend' ? { npcId: 'jihun' } : {}) });
        expect(line.length).toBeGreaterThan(0);
        expect(line).not.toMatch(/\d/);
      }
    }
  });
});

describe('구세이브·손상값', () => {
  it('필드 없는 세이브는 목표 없음으로 동작하고 백필하지 않는다', () => {
    const old = semState();
    delete (old as Partial<GameState>).semesterGoal;
    delete (old as Partial<GameState>).semesterGoalLog;
    const m = migrateLoadedState(old);
    expect(m.semesterGoal).toBeUndefined();
    expect(m.semesterGoalLog).toBeUndefined();
    expect(canPickSemesterGoal(m)).toBe(true);
    // 목표 없이 한 학기를 끝내도 기록이 생기지 않는다 (0/빈 기록이 "잊고 지나갔다"로 둔갑하지 않는다)
    let s = semState({ week: 19 });
    s = processWeek(s);
    expect(s.semesterGoalLog).toBeUndefined();
    expect(goalRecordForWeekLog(s)).toBeNull();
  });

  it('손상된 목표는 버리고, 기록은 깨진 항목만 거른다', () => {
    expect(sanitizeSemesterGoal({ kind: 'money', year: 1, semester: 1, markedWeeks: [] })).toBeUndefined();
    expect(sanitizeSemesterGoal({ kind: 'friend', year: 1, semester: 1, markedWeeks: [] })).toBeUndefined();
    expect(sanitizeSemesterGoal({ kind: 'study', year: 1, semester: 3, markedWeeks: [] })).toBeUndefined();
    expect(sanitizeSemesterGoal({ kind: 'study', year: 1, semester: 1, markedWeeks: 'x' })).toBeUndefined();
    expect(sanitizeSemesterGoal({ kind: 'study', year: 1, semester: 1, markedWeeks: [3, 3, '4', 5] }))
      .toEqual({ kind: 'study', year: 1, semester: 1, markedWeeks: [3, 5] });
    expect(sanitizeSemesterGoalLog([
      { kind: 'study', year: 1, semester: 1, outcome: 'achieved' },
      { kind: 'study', year: 1, semester: 1, outcome: 'won' },
      null,
    ])).toEqual([{ kind: 'study', year: 1, semester: 1, outcome: 'achieved' }]);
    expect(sanitizeSemesterGoalLog('x')).toBeUndefined();
  });

  it('로드 경로(migrateLoadedState)가 실제로 정규화를 부른다 — 함수만 잠그면 배선이 빈다', () => {
    const corrupt = semState({
      semesterGoal: { kind: 'study', year: 1, semester: 1, markedWeeks: 'x' } as unknown as ActiveSemesterGoal,
      semesterGoalLog: [{ kind: 'study', year: 1, semester: 1, outcome: 'won' }] as unknown as GameState['semesterGoalLog'],
    });
    const m = migrateLoadedState(corrupt);
    expect(m.semesterGoal).toBeUndefined();
    expect(m.semesterGoalLog).toEqual([]);
    // 정상값은 그대로 살아남는다 (매주 processWeek 첫머리에서도 돌기 때문)
    const ok = semState({ semesterGoal: goal({ markedWeeks: marks(2) }) });
    expect(migrateLoadedState(ok).semesterGoal).toEqual(goal({ markedWeeks: marks(2) }));
  });
});

describe('불변 — 목표는 기록일 뿐 판을 바꾸지 않는다', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({ state: null, npcActivityMap: {} });
  });

  /** 실제 store 경로(advanceWeek → resolveEvent → 학년말 넘김)로 Y1을 끝까지 + Y2 1학기. */
  function playStore(withGoal: SemesterGoalKind | null): GameState {
    const init = createInitialState('male', ['strict', 'info'], { rngSeed: 777 });
    Object.assign(init, { routineSlot2: 'academy', routineSlot3: 'self-study', money: 30 });
    useGameStore.setState({ state: init, npcActivityMap: {} });
    const st = () => useGameStore.getState();
    for (let i = 0; i < 70; i++) {
      const s = st().state!;
      if (withGoal && canPickSemesterGoal(s) && !s.semesterGoal) {
        const offer = offerSemesterGoals(s).find(o => o.kind === withGoal)!;
        expect(st().chooseSemesterGoal(offer)).toBe(true);
      }
      st().setWeekendChoices(['light-exercise', 'club']);
      st().setNpcActivityMap({ 'club:1': 'jihun' });
      st().advanceWeek();
      let guard = 0;
      while (st().state!.phase === 'event' && guard++ < 10) st().resolveEvent(0);
      if (st().state!.phase === 'result') st().setPhase('weekday');
      if (st().state!.phase === 'year-end') st().advanceFromYearEnd();
    }
    return st().state!;
  }

  it('같은 계획이면 목표가 있든 없든 스탯·피로·돈·친밀도·사건 열·시드가 바이트 동일하다', () => {
    const a = playStore(null);
    for (const kind of ['exercise', 'friend'] as const) {
      const b = playStore(kind);
      expect(b.semesterGoalLog?.length, '목표 판정이 한 번도 안 일어났다 — 대조가 공허하다').toBeGreaterThanOrEqual(2);
      const strip = (s: GameState) => {
        const { semesterGoal: _g, semesterGoalLog: _l, ...rest } = s;
        void _g; void _l;
        return JSON.stringify(rest);
      };
      expect(strip(b)).toBe(strip(a));
    }
  });
});

describe('3자 검수 반영 — 손상·드문 경로', () => {
  it('C. 손상 markedWeeks는 그 목표 학기 범위의 절대주차만 남는다 (음수 6칸이 즉시 해냈다가 되지 않는다)', () => {
    const g = sanitizeSemesterGoal({ kind: 'study', year: 2, semester: 2, markedWeeks: [-6, -5, -4, -3, -2, -1] });
    expect(g!.markedWeeks).toEqual([]);
    expect(outcomeOf(g!, semState({ year: 2, week: 30 }))).toBe('missed');
    // 경계: 학기 첫 주·마지막 주는 남고, 바로 바깥(앞 방학·뒤 방학·다른 학년)은 버린다
    const lo = absWeek(2, SEMESTER_BOUNDS[2].start);
    const hi = absWeek(2, SEMESTER_BOUNDS[2].end);
    expect(sanitizeSemesterGoal({ kind: 'study', year: 2, semester: 2, markedWeeks: [lo - 1, lo, hi, hi + 1, absWeek(1, 30)] })!
      .markedWeeks).toEqual([lo, hi]);
    // 로드 경로에서도
    const m = migrateLoadedState(semState({
      year: 2, week: 26,
      semesterGoal: { kind: 'study', year: 2, semester: 2, markedWeeks: [-6, -5, -4, -3, -2, -1] },
    }));
    expect(m.semesterGoal!.markedWeeks).toEqual([]);
  });

  it('D. 이전 학기 목표가 남은 채로 고르면 먼저 정산하고 새 목표를 세운다 (기록이 사라지지 않는다)', () => {
    const s = semState({ year: 1, week: 25, semester: 2, semesterGoal: goal({ markedWeeks: marks(6) }) });
    expect(pickSemesterGoal(s, { kind: 'study' })).toBe(true);
    expect(s.semesterGoalLog).toEqual([{ kind: 'exercise', year: 1, semester: 1, outcome: 'achieved' }]);
    expect(s.semesterGoal).toEqual({ kind: 'study', year: 1, semester: 2, markedWeeks: [] });
  });

  it('E. 친구 동행은 실제 실행된 칸으로 맞춘다 — 같은 활동 두 칸 중 동행 칸만 잘리면 안 센다', () => {
    const base = { semesterGoal: goal({ kind: 'friend', npcId: 'jihun' }), weekendChoices: ['club', 'club'] };
    // timeCost 1 = 둘째 칸(동행 칸) 잘림 → 첫 칸 club은 실행됐지만 지훈과의 동행은 아니다
    expect(processWeek(semState({ ...base, eventTimeCost: 1 }), { 'club:1': 'jihun' }).semesterGoal!.markedWeeks).toHaveLength(0);
    // 잘리지 않으면 센다 (양성 대조)
    expect(processWeek(semState(base), { 'club:1': 'jihun' }).semesterGoal!.markedWeeks).toHaveLength(1);
    // 동행이 남은 칸(첫 칸)에 있으면 센다
    expect(processWeek(semState({ ...base, eventTimeCost: 1 }), { 'club:0': 'jihun' }).semesterGoal!.markedWeeks).toHaveLength(1);
  });
});
