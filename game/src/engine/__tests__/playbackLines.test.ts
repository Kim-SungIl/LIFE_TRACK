// 재생 카드의 한 줄(설계안 §11) — 그 주에 실제로 한 루틴·활동이 카드 문장이 되는가.
//   ① 엔진 기록 — WeekLog.played는 실제로 실행된 칸만 담고, 루틴 단계·도달은 보너스 티어와 같은 축이다
//   ② 표 — 없는 활동 id·빈 줄·중복·"주말"·방학 아닌 활동의 "방학"이 없다
//   ③ 고르기 — 도달한 루틴 > 활동 > 루틴 단계, 그리고 48주 전체에서 변이가 실제로 갈린다(모듈로 축 퇴화 방지)
//   ④ 카드 머리 줄 — 번아웃·시험·마일스톤 주는 결산 독백이 앞선다
import { describe, expect, it } from 'vitest';
import { ACTIVITIES } from '../activities';
import { ROUTINE_TIER_WEEKS, createInitialState, getWeekInfo, processWeek } from '../gameEngine';
import { CHOICE_LINES, ROUTINE_LINES, ROUTINE_STAGES, cardLine, playbackLine } from '../talkData/playbackLines';
import type { GameState, ParentStrength, WeekLog } from '../types';

const SEMESTER_WEEK = 5;
const VACATION_WEEK = (() => { for (let w = 20; w <= 48; w++) if (getWeekInfo(w).isVacation) return w; throw new Error('방학 주 없음'); })();

function run(patch: Partial<GameState>, parents: [ParentStrength, ParentStrength] = ['emotional', 'info']): WeekLog {
  const s = createInitialState('male', parents, { rngSeed: 5 });
  const week = patch.week ?? SEMESTER_WEEK;
  Object.assign(s, {
    year: 2, week, isVacation: getWeekInfo(week).isVacation, semester: getWeekInfo(week).semester, phase: 'weekend',
    money: 999, eventTimeCost: 0, routineSlot2: null, routineSlot3: null, routineSlot2Weeks: 0, routineSlot3Weeks: 0,
    weekendChoices: [], vacationChoices: [], currentEvent: null,
  }, patch);
  return processWeek(s).weekLog!;
}

const log = (played: WeekLog['played'], week = 6, year = 2): WeekLog => ({
  statChanges: {}, fatigueChange: 0, moneyChange: 0, messages: [], skipped: [], milestoneMessages: [], year, week, played,
});

describe('① 엔진 기록 — WeekLog.played', () => {
  it('실행한 루틴과 주말 활동을 순서대로 담는다', () => {
    const w = run({ routineSlot2: 'academy', routineSlot3: 'gym', weekendChoices: ['reading', 'rest'] });
    expect(w.played?.routines.map(r => r.id)).toEqual(['academy', 'gym']);
    expect(w.played?.choices).toEqual(['reading', 'rest']);
  });

  it('방학 칸도 담는다(루틴은 방학에 안 돈다)', () => {
    const w = run({ week: VACATION_WEEK, routineSlot2: 'academy', vacationChoices: ['countryside', 'countryside', 'countryside', 'rest', 'rest'] });
    expect(w.played?.routines).toEqual([]);
    expect(w.played?.choices).toEqual(['countryside', 'rest', 'rest']);
  });

  it('돈이 없어 빠진 칸은 없다', () => {
    const w = run({ money: 0, monthlyMoney: false, routineSlot2: 'academy', routineSlot3: 'self-study', weekendChoices: ['art-lesson', 'rest'] });
    expect(w.skipped.map(k => k.activityId), '전제: 학원·레슨이 돈으로 빠졌다').toEqual(expect.arrayContaining(['academy', 'art-lesson']));
    expect(w.played?.routines.map(r => r.id)).toEqual(['self-study']);
    expect(w.played?.choices).toEqual(['rest']);
  });

  it('이벤트로 방과후를 빠진 주(timeCost)는 그 루틴이 없다 — 1이면 두 번째만, 2면 둘 다', () => {
    const one = run({ eventTimeCost: 1, routineSlot2: 'academy', routineSlot3: 'gym', weekendChoices: ['reading', 'rest'] });
    expect(one.played?.routines.map(r => r.id)).toEqual(['academy']);
    const two = run({ eventTimeCost: 2, routineSlot2: 'academy', routineSlot3: 'gym', weekendChoices: ['reading', 'rest'] });
    expect(two.played?.routines ?? []).toEqual([]);
  });

  it('아무것도 안 한 주에는 기록이 없다', () => {
    expect(run({}).played).toBeUndefined();
  });

  it('단계는 보너스 티어 축이다 — 3·6·8주째에 닿고, 그 사이엔 안 닿는다', () => {
    const stageAt = (before: number) => run({ routineSlot2: 'self-study', routineSlot2Weeks: before }).played!.routines[0];
    expect(ROUTINE_TIER_WEEKS).toEqual([3, 6, 8]);
    expect(stageAt(0)).toEqual({ id: 'self-study', stage: 0, reached: false });
    expect(stageAt(1)).toEqual({ id: 'self-study', stage: 0, reached: false });
    expect(stageAt(2)).toEqual({ id: 'self-study', stage: 1, reached: true });
    expect(stageAt(3)).toEqual({ id: 'self-study', stage: 1, reached: false });
    expect(stageAt(4)).toEqual({ id: 'self-study', stage: 1, reached: false });
    expect(stageAt(5)).toEqual({ id: 'self-study', stage: 2, reached: true });
    expect(stageAt(6)).toEqual({ id: 'self-study', stage: 2, reached: false });
    expect(stageAt(7)).toEqual({ id: 'self-study', stage: 3, reached: true });
    expect(stageAt(20)).toEqual({ id: 'self-study', stage: 3, reached: false });
  });

  it('엄격한 부모는 한 주 앞당겨 닿는다(엔진 보너스와 같은 보정)', () => {
    const strict = (before: number) => run({ routineSlot2: 'self-study', routineSlot2Weeks: before }, ['strict', 'emotional']).played!.routines[0];
    expect(strict(1)).toEqual({ id: 'self-study', stage: 1, reached: true });
    expect(strict(2)).toEqual({ id: 'self-study', stage: 1, reached: false });
    expect(strict(6)).toEqual({ id: 'self-study', stage: 3, reached: true });
  });
});

describe('② 표', () => {
  const ids = new Set(ACTIVITIES.map(a => a.id));
  const vacationOnly = new Set(ACTIVITIES.filter(a => a.seasonGate === 'vacation-only').map(a => a.id));
  const all = [
    ...Object.entries(ROUTINE_LINES).flatMap(([id, stages]) => stages.flatMap(two => two.map(line => ({ id, line, kind: 'routine' })))),
    ...Object.entries(CHOICE_LINES).flatMap(([id, two]) => two.map(line => ({ id, line, kind: 'choice' }))),
  ];

  it('규모 — 루틴 8종 × 단계 4 × 변이 2, 활동 32종 × 변이 2', () => {
    expect(Object.keys(ROUTINE_LINES)).toHaveLength(8);
    for (const stages of Object.values(ROUTINE_LINES)) expect(stages).toHaveLength(ROUTINE_STAGES);
    expect(Object.keys(CHOICE_LINES)).toHaveLength(32);
    expect(all).toHaveLength(8 * 4 * 2 + 32 * 2);
  });

  it('모든 id가 실제 활동이고, 루틴 표엔 방학 전용 활동이 없다', () => {
    for (const { id } of all) expect(ids.has(id), id).toBe(true);
    for (const id of Object.keys(ROUTINE_LINES)) expect(vacationOnly.has(id), id).toBe(false);
  });

  it('빈 줄·중복 줄이 없다', () => {
    for (const { id, line } of all) expect(line.trim().length, id).toBeGreaterThan(0);
    const lines = all.map(x => x.line);
    expect(new Set(lines).size).toBe(lines.length);
  });

  it('때 말 — "주말"은 어디에도 없고, "방학"은 방학 전용 활동에만 있다', () => {
    for (const { id, line } of all) {
      expect(line, id).not.toMatch(/주말/);
      if (!vacationOnly.has(id)) expect(line, id).not.toMatch(/방학/);
    }
  });
});

describe('③ 고르기', () => {
  const R = ROUTINE_LINES;
  const C = CHOICE_LINES;

  it('기록이 없거나 표에 없는 활동뿐이면 null', () => {
    expect(playbackLine(log(undefined))).toBeNull();
    expect(playbackLine(log({ routines: [{ id: 'night-study', stage: 2, reached: true }], choices: ['overdue-meetup'] }))).toBeNull();
  });

  it('이번 주에 단계에 닿은 루틴이 활동보다 앞선다', () => {
    const line = playbackLine(log({ routines: [{ id: 'academy', stage: 1, reached: true }], choices: ['rest'] }));
    expect(R.academy[1]).toContain(line);
  });

  it('안 닿은 주는 활동이 앞선다 — 루틴은 한 달 내내 같아서', () => {
    const line = playbackLine(log({ routines: [{ id: 'academy', stage: 1, reached: false }], choices: ['rest'] }));
    expect(C.rest).toContain(line);
  });

  it('활동 줄이 없으면 루틴의 지금 단계', () => {
    for (let stage = 0; stage < ROUTINE_STAGES; stage++) {
      const line = playbackLine(log({ routines: [{ id: 'gym', stage, reached: false }], choices: ['overdue-meetup'] }));
      expect(R.gym[stage]).toContain(line);
    }
  });

  it('표에 없는 루틴이 앞에 있어도 다음 루틴의 줄을 쓴다', () => {
    const line = playbackLine(log({ routines: [{ id: 'night-study', stage: 3, reached: true }, { id: 'club', stage: 2, reached: true }], choices: [] }));
    expect(R.club[2]).toContain(line);
  });

  it('결정론 — 같은 로그는 같은 줄', () => {
    const l = log({ routines: [], choices: ['reading', 'rest'] }, 9, 3);
    expect(playbackLine(l)).toBe(playbackLine({ ...l }));
  });

  // 모듈로 축은 조용히 죽는다 — 길이 하나에서만 보지 말고 학년 전체 주차로 잰다.
  it.each([1, 2, 3, 4, 5])('같은 활동 %i개를 한 해 내내 해도 (활동 × 변이) 조합이 전부 나온다', n => {
    const pool = Object.keys(C).slice(0, n);
    for (const year of [1, 2]) {
      const seen = new Set<string>();
      for (let week = 1; week <= 48; week++) seen.add(playbackLine(log({ routines: [], choices: pool }, week, year))!);
      expect(seen.size, `year ${year}`).toBe(n * 2);
    }
  });

  it('칸을 여럿 채운 활동도 한 번으로 센다 — 휴식 두 칸이 한 칸짜리 활동보다 자주 뽑히지 않는다', () => {
    const count = { rest: 0, 'vacation-library': 0 };
    for (let week = 1; week <= 48; week++) {
      const line = playbackLine(log({ routines: [], choices: ['vacation-library', 'rest', 'rest'] }, week))!;
      if (C.rest.includes(line)) count.rest++;
      if (C['vacation-library'].includes(line)) count['vacation-library']++;
    }
    expect(count).toEqual({ rest: 24, 'vacation-library': 24 });
  });

  it('루틴 줄도 이웃한 주끼리 변이가 갈린다', () => {
    const a = playbackLine(log({ routines: [{ id: 'library', stage: 3, reached: false }], choices: [] }, 10));
    const b = playbackLine(log({ routines: [{ id: 'library', stage: 3, reached: false }], choices: [] }, 11));
    expect(a).not.toBe(b);
    expect(new Set([a, b])).toEqual(new Set(R.library[3]));
  });
});

describe('④ 카드 머리 줄', () => {
  const C = CHOICE_LINES;
  const s = createInitialState('male', ['emotional', 'info'], { rngSeed: 1 });
  const played: WeekLog['played'] = { routines: [], choices: ['rest'] };

  it('평범한 주는 활동 한 줄, 고를 게 없으면 결산 독백', () => {
    expect(C.rest).toContain(cardLine(s, log(played), '결산'));
    expect(cardLine(s, log(undefined), '결산')).toBe('결산');
  });

  it('번아웃 주는 결산 독백', () => {
    expect(cardLine({ ...s, mentalState: 'burnout' }, log(played), '결산')).toBe('결산');
  });

  it('시험 주·마일스톤 주는 결산 독백(그 주의 사건이다)', () => {
    const exam = { ...log(played), examResult: { average: 90, mockGrade: undefined } as unknown as WeekLog['examResult'] };
    expect(cardLine(s, exam, '결산')).toBe('결산');
    expect(cardLine(s, { ...log(played), milestoneMessages: ['학업 한 단계'] }, '결산')).toBe('결산');
  });

  it('잘 는 주(우선순위 60)는 활동 한 줄이 앞선다 — 변화는 배지가 보인다', () => {
    expect(C.rest).toContain(cardLine(s, { ...log(played), statChanges: { academic: 3 } }, '결산'));
  });
});
