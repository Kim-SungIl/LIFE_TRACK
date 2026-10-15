import { describe, expect, it } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import { goalMomentForWeekLog } from '../semesterGoalMoments';
import { GOAL_TARGET_WEEKS, goalRecordForWeekLog } from '../semesterGoal';
import { absWeek } from '../weekMath';
import { cloneGameState } from '../stateClone';
import type { GameState, SemesterGoalKind } from '../types';

function plannedWeek(week: number, previous: number[] = [], kind: SemesterGoalKind = 'exercise', semester: 1 | 2 = 1): GameState {
  const s = createInitialState('male', ['emotional', 'info'], { rngSeed: 4242 });
  Object.assign(s, {
    phase: 'weekday', currentEvent: null, week, money: 100,
    routineSlot2: 'reading', routineSlot3: 'light-exercise',
    weekendChoices: ['light-exercise'],
    semesterGoal: { kind, year: 1, semester, markedWeeks: previous.map(w => absWeek(1, w)) },
  });
  return s;
}

describe('학기 목표의 작은 장면', () => {
  it('실제로 첫 실천·중간·달성한 주만 보여 주고, 이후 실천에는 반복하지 않는다', () => {
    const expected = new Map([[1, 'first'], [Math.ceil(GOAL_TARGET_WEEKS / 2), 'habit'], [GOAL_TARGET_WEEKS, 'achieved']]);
    for (let count = 1; count <= GOAL_TARGET_WEEKS + 1; count++) {
      const before = plannedWeek(count + 1, Array.from({ length: count - 1 }, (_, i) => i + 2));
      const after = processWeek(before);
      expect(after.weekLog?.week).toBe(count + 1);
      expect(goalMomentForWeekLog(after)?.stage ?? null).toBe(expected.get(count) ?? null);
    }
  });

  it('실천하지 않은 주에는 이전 장면을 다시 띄우지 않는다 — 루틴 운동도 실천으로 세지 않는다', () => {
    const s = plannedWeek(4, [2]);
    s.weekendChoices = ['reading'];
    const after = processWeek(s);
    expect(after.semesterGoal?.markedWeeks).toEqual([absWeek(1, 2)]);
    expect(goalMomentForWeekLog(after)).toBeNull();
  });

  it('돈 부족·시간 비용으로 실행 못 한 활동에는 장면을 만들지 않는다', () => {
    const money = plannedWeek(2);
    money.money = 0;
    money.weekendChoices = ['gym'];
    const time = plannedWeek(2);
    time.eventTimeCost = 4;
    for (const s of [money, time]) {
      expect(goalMomentForWeekLog(processWeek(s))).toBeNull();
    }
  });

  it('친구 목표는 실제 동행한 사람의 이름을 쓰고 다른 친구와의 활동을 가로채지 않는다', () => {
    const s = plannedWeek(2, [], 'friend');
    s.semesterGoal!.npcId = 'jihun';
    s.weekendChoices = ['club'];
    const after = processWeek(s, { 'club:0': 'jihun' });
    expect(goalMomentForWeekLog(after)?.text).toContain('지훈과 주말을 보냈다');
    expect(goalMomentForWeekLog(processWeek(s, { 'club:0': 'minjae' }))).toBeNull();
  });

  it('학기 첫 주(1학기 W1·2학기 W25)의 첫 실천도 장면이 된다', () => {
    expect(goalMomentForWeekLog(processWeek(plannedWeek(1)))?.stage).toBe('first');
    expect(goalMomentForWeekLog(processWeek(plannedWeek(25, [], 'exercise', 2)))?.stage).toBe('first');
  });

  // processWeek는 학기말에 목표를 먼저 정산해 지우므로, 아래 통합 테스트만으로는 배제 조건이 잠기지 않는다.
  // 목표가 살아 있는 채로 학기말·방학 좌표가 들어오는 경우를 직접 만든다(정산 순서가 바뀌어도 겹치지 않게).
  it('목표가 남아 있어도 학기 마지막 주·방학 좌표에는 장면을 내지 않는다', () => {
    const base = processWeek(plannedWeek(18, [2, 3]));
    expect(goalMomentForWeekLog(base)?.stage, '전제: 같은 상태의 W18은 장면이 뜬다').toBe('habit');
    for (const week of [19, 20]) {
      // 세 번째 실천을 그 주로 옮긴다 — 배제 조건이 없으면 'habit'이 뜨는 모양이다.
      const s = cloneGameState(base);
      s.weekLog!.week = week;
      s.semesterGoal!.markedWeeks = [absWeek(1, 2), absWeek(1, 3), absWeek(1, week)];
      expect(s.semesterGoal, '전제: 목표가 정산되지 않고 남아 있다').toBeTruthy();
      expect(goalMomentForWeekLog(s)).toBeNull();
    }
  });

  it('학기 마지막 주에 첫 실천/달성을 해도 기존 학기말 회고만 표시한다', () => {
    for (const marks of [[], [2, 3, 4, 5, 6]]) {
      const after = processWeek(plannedWeek(19, marks));
      expect(goalRecordForWeekLog(after)?.outcome).toBe(marks.length ? 'achieved' : 'partial');
      expect(goalMomentForWeekLog(after)).toBeNull();
    }
  });

  it('다른 학기·학년/좌표 없는 구세이브에서는 잘못된 장면을 보여 주지 않는다', () => {
    const after = processWeek(plannedWeek(2));
    const wrongYear = cloneGameState(after);
    wrongYear.semesterGoal!.year = 2;
    const wrongSemester = cloneGameState(after);
    wrongSemester.semesterGoal!.semester = 2;
    const legacy = cloneGameState(after);
    delete legacy.weekLog!.week;
    for (const s of [wrongYear, wrongSemester, legacy]) expect(goalMomentForWeekLog(s)).toBeNull();
  });

  it('저장·불러오기 뒤에도 같은 장면이며 표시가 상태/난수를 바꾸지 않는다', () => {
    const after = processWeek(plannedWeek(2));
    const saved = JSON.stringify(after);
    const moment = goalMomentForWeekLog(after);
    expect(goalMomentForWeekLog(JSON.parse(saved))).toEqual(moment);
    expect(JSON.stringify(after)).toBe(saved);
  });

  it('활동 목표마다 학교급에 맞는 문장이 있고 숫자 실적을 노출하지 않는다', () => {
    for (const kind of ['exercise', 'study', 'craft'] as const) {
      const lines = new Set<string>();
      const byYear = new Map<number, string>();
      for (const year of [1, 2, 4, 5, 7]) {
        const s = processWeek(plannedWeek(2, [], kind));
        s.semesterGoal!.year = year;
        s.semesterGoal!.markedWeeks = [absWeek(year, 2)];
        s.weekLog!.year = year;
        const moment = goalMomentForWeekLog(s)!;
        expect(moment).not.toBeNull();
        expect(moment.text).not.toMatch(/\d|undefined/);
        lines.add(moment.text);
        byYear.set(year, moment.text);
      }
      expect(lines.size).toBe(3);
      // 학교급 경계(getSchoolLevel: Y1 초 · Y2~4 중 · Y5~ 고)까지 — 문장 맞교환은 개수만으로는 통과한다.
      expect(byYear.get(4)).toBe(byYear.get(2));
      expect(byYear.get(7)).toBe(byYear.get(5));
      expect(new Set([byYear.get(1), byYear.get(2), byYear.get(5)]).size).toBe(3);
    }
  });
});
