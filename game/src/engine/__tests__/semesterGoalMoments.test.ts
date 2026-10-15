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
    // 2학기도 같다(W42 마지막 주·W43 겨울방학) — 조건을 1학기로 좁히는 회귀를 막는다.
    const base2 = processWeek(plannedWeek(41, [26, 27], 'exercise', 2));
    expect(goalMomentForWeekLog(base2)?.stage, '전제: 같은 상태의 W41은 장면이 뜬다').toBe('habit');
    for (const week of [42, 43]) {
      const s = cloneGameState(base2);
      s.weekLog!.week = week;
      s.semesterGoal!.markedWeeks = [absWeek(1, 26), absWeek(1, 27), absWeek(1, week)];
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
    // 목표가 **작년** 것인데 로그는 올해인 경우 — 개수 필터만으로는 올해 표지를 1로 세어 'first'가 된다.
    // 학년 가드(goal.year !== log.year)가 이 경우를 혼자 막는다.
    const lastYearGoal = cloneGameState(after);
    lastYearGoal.weekLog!.year = 2;
    lastYearGoal.semesterGoal!.markedWeeks = [absWeek(2, 2)];
    for (const s of [wrongYear, wrongSemester, legacy, lastYearGoal]) expect(goalMomentForWeekLog(s)).toBeNull();
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

  // 단계·학교급 배정을 문장 단위로 잠근다. 개수·동등성만 보면 중등↔고교 묶음 맞바꿈이나
  // habit↔achieved 맞바꿈이 그대로 통과했다(2라운드 검수 실측).
  const GOLDEN: Record<'exercise' | 'study' | 'craft', Record<1 | 2 | 5, [string, string, string]>> = {
    exercise: {
      1: ['몸을 움직이고 돌아왔다.', '몸을 움직일 시간을 먼저 남겨 뒀다.', '여러 주말을 그렇게 보냈다.'],
      2: ['주말 하루를 몸 쓰는 데 썼다.', '따로 결심하지 않아도', '내가 지킨 약속이었다.'],
      5: ['주말에 몸을 움직일 시간을 냈다.', '계획에서 쉽게 지우고 싶지 않다.', '그 시간만큼은 내가 골랐다.'],
    },
    study: {
      1: ['학기 초에 내가 정했던 일이다.', '처음 적었을 때보다는 덜 낯설다.', '내가 나를 조금 믿어도'],
      2: ['마음먹었던 일을 하나 시작했다.', '책상 앞에 앉는 일이 처음보다 익숙해졌다.', '얼마나 달라졌는지는 아직 모르겠다.'],
      5: ['주말의 한 자리를 공부에 썼다.', '정해 둔 시간을 지키는 일이 조금 덜 어렵다.', '확실히 아는 게 하나 있다.'],
    },
    craft: {
      1: ['직접 해 봤다는 게 먼저 생각났다.', '다음에도 해 보고 싶다는', '내 주말 이야기 하나가 됐다.'],
      2: ['아직 보여 줄 게 없어도 시작은 했다.', '다음 주말이 조금 기다려진다.', '계속해 보겠다는 약속은 지켰다.'],
      5: ['정해 둔 일을 미루지 않았다.', '이 시간은 계속 지키고 싶다.', '이 학기를 그렇게도 기억하고 싶다.'],
    },
  };
  const STAGE_COUNTS = [1, Math.ceil(GOAL_TARGET_WEEKS / 2), GOAL_TARGET_WEEKS] as const;

  function momentAt(kind: SemesterGoalKind, year: number, count: number, npcId?: string) {
    // 판정 함수는 weekLog 좌표와 목표 기록만 읽는다 — 친구 목표는 processWeek 경로에서 동행이 없으면
    // 표지가 안 남으므로, 실제 결산 로그 위에 목표 기록을 직접 놓는다(경로 배선은 위 테스트들이 잠근다).
    const s = processWeek(plannedWeek(2));
    s.weekLog!.year = year;
    s.weekLog!.week = count + 1;
    s.semesterGoal = { kind, year, semester: 1, npcId,
      markedWeeks: Array.from({ length: count }, (_, i) => absWeek(year, i + 2)) };
    return goalMomentForWeekLog(s);
  }

  it('목표·학교급·단계마다 정해진 문장이 나온다(맞바꿈 금지)', () => {
    for (const kind of ['exercise', 'study', 'craft'] as const) {
      for (const year of [1, 2, 5] as const) {
        STAGE_COUNTS.forEach((count, i) => {
          const m = momentAt(kind, year, count);
          expect(m?.stage, `${kind} Y${year} count ${count}`).toBe(['first', 'habit', 'achieved'][i]);
          expect(m!.text, `${kind} Y${year} ${m!.stage}`).toContain(GOLDEN[kind][year][i]);
        });
      }
    }
  });

  it('친구 목표는 단계마다 다른 문장이고, 열 명 모두 조사가 맞다', () => {
    const texts = STAGE_COUNTS.map(c => momentAt('friend', 1, c, 'jihun')!.text);
    expect(texts[0]).toContain('지훈과 주말을 보냈다');
    expect(texts[1]).toContain('지훈과 보낸 주말이 조금씩 쌓인다');
    expect(texts[2]).toContain('지훈과 시간을 보내려고');
    const expected: Record<string, string> = {
      jihun: '지훈과', subin: '수빈과', minjae: '민재와', yuna: '유나와', doyun: '도윤과',
      haeun: '하은과', junha: '준하와', seoa: '서아와', siwoo: '시우와', yerin: '예린과',
    };
    for (const [id, withName] of Object.entries(expected)) {
      expect(momentAt('friend', 1, 1, id)!.text.startsWith(`${withName} `), id).toBe(true);
    }
  });

  // 실행 기록(그 주에 그 계열 활동을 했다)으로는 알 수 없는 처지·동기·결과를 문장이 단정하지 않는다.
  it('장면 문장은 기록 밖의 처지·동기·결과를 단정하지 않는다', () => {
    const banned = /바쁜|바빴|할 일 사이|해야 할 일|남들|잘되는 날|결과|성적표|진로|입시/;
    let checked = 0;
    for (const kind of ['exercise', 'study', 'craft', 'friend'] as const) {
      for (const year of [1, 2, 5]) {
        for (const count of STAGE_COUNTS) {
          const text = momentAt(kind, year, count, kind === 'friend' ? 'jihun' : undefined)!.text;
          expect(text, `${kind} Y${year} count ${count}`).not.toMatch(banned);
          checked++;
        }
      }
    }
    expect(checked).toBe(4 * 3 * 3);
  });
});
