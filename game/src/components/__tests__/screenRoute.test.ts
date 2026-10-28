// decideScreen — 상태만 넣고 어느 화면인지 단언한다(렌더 없이). 월 단위 계획 플래그를 켜면 바뀌는 분기가
// 전부 여기라, 플래그 전환 전후를 이 표로 잠근다. GameScreen이 이 결과로 그리는지는 아래 배선 블록과
// monthPlaybackScreen.test.tsx(실제 렌더)가 본다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decideScreen, type ScreenRouteInput } from '../screenRoute';
import { createInitialState } from '../../engine/gameEngine';
import { getMonthBlock } from '../../engine/weekMath';
import type { GameEvent, GameState, MonthPlan, MonthRun, WeekLog } from '../../engine/types';

function base(patch: Partial<GameState> = {}): GameState {
  const s = createInitialState('male', ['info', 'wealth'], { rngSeed: 5 });
  s.year = 2;
  s.week = 6;
  s.phase = 'weekday';
  s.currentEvent = null;
  return Object.assign(s, patch);
}

function input(state: GameState, patch: Partial<ScreenRouteInput> = {}): ScreenRouteInput {
  return { state, eventResult: null, endingReady: false, monthlyEnabled: false, bigResultSeen: null, replanning: false, ...patch };
}

/** 결산 단계 — 로그는 지난주(logWeek) 좌표, state.week은 그 다음 주. */
function resultAt(logWeek: number, patch: Partial<WeekLog> = {}, statePatch: Partial<GameState> = {}): GameState {
  const weekLog = { statChanges: {}, fatigueChange: 0, moneyChange: 0, messages: [], skipped: [], milestoneMessages: [], year: 2, week: logWeek, ...patch } as WeekLog;
  return base({ phase: 'result', week: logWeek + 1, weekLog, ...statePatch });
}

function runFor(week: number, auto: boolean): MonthRun {
  return { year: 2, month: getMonthBlock(week).index, status: 'playing', log: [{ week, auto }], missedTalks: 0 } as unknown as MonthRun;
}

function planFor(state: GameState): MonthPlan {
  return { year: state.year, month: getMonthBlock(state.week).index, weeks: [] } as unknown as MonthPlan;
}

const MID = 6;   // 달 중간 주
const END = getMonthBlock(MID).endWeek;   // 같은 달의 마지막 주

describe('decideScreen — 단계별 화면', () => {
  it('결과 연출이 있으면 학년말보다 먼저다(W48 사건의 결과가 일기장에 묻히지 않게)', () => {
    const r = decideScreen(input(base({ phase: 'year-end' }), { eventResult: { eventId: 'x', choiceIndex: 1 } }));
    expect(r).toMatchObject({ kind: 'event-result', key: 'event-result:x#1' });
  });

  it('학년말·엔딩은 느린 전환, 엔딩 데이터가 없으면 엔딩 화면을 못 그린다', () => {
    expect(decideScreen(input(base({ phase: 'year-end' })))).toMatchObject({ kind: 'year-end', key: 'year-end:2', pace: 'slow' });
    expect(decideScreen(input(base({ phase: 'ending' }), { endingReady: true }))).toMatchObject({ kind: 'ending', pace: 'slow' });
    expect(decideScreen(input(base({ phase: 'ending' }))).kind).not.toBe('ending');
  });

  it('사건 화면은 사건 id가 키다', () => {
    const ev = { id: 'jihun-birthday' } as GameEvent;
    expect(decideScreen(input(base({ phase: 'event', currentEvent: ev })))).toMatchObject({ kind: 'event', key: 'event:jihun-birthday' });
  });

  it('느린 전환은 학년말·엔딩 둘뿐이다 — 고빈도 화면(사건·결산·메인)은 normal', () => {
    const ev = { id: 'e' } as GameEvent;
    const normal = [
      decideScreen(input(base({ phase: 'event', currentEvent: ev }))),
      decideScreen(input(resultAt(MID))),
      decideScreen(input(base())),
    ];
    for (const r of normal) expect(r.pace, r.kind).toBe('normal');
  });
});

describe('decideScreen — 결산 단계와 월 재생(플래그)', () => {
  it('플래그가 꺼져 있으면 재생 장부가 있어도 예전 주간 결산 → 계획 단계', () => {
    const s = resultAt(MID, {}, { monthRun: runFor(MID, true) });
    expect(decideScreen(input(s))).toMatchObject({ kind: 'weekly', continueTo: 'to-weekday' });
  });

  it('재생이 처리한 평범한 주는 카드', () => {
    const s = resultAt(MID, {}, { monthRun: runFor(MID, true) });
    expect(decideScreen(input(s, { monthlyEnabled: true }))).toMatchObject({ kind: 'card', key: `card:2-${MID + 1}` });
  });

  it('손으로 확정한 주(auto 아님)는 카드가 아니라 주간 결산 → 계획 단계', () => {
    const s = resultAt(MID, {}, { monthRun: runFor(MID, false) });
    expect(decideScreen(input(s, { monthlyEnabled: true }))).toMatchObject({ kind: 'weekly', continueTo: 'to-weekday' });
  });

  it('재생 중 시험 주(큰 주)는 결산 화면을 보이고 넘기면 재생이 이어진다', () => {
    const s = resultAt(MID, { examResult: {} as WeekLog['examResult'] }, { monthRun: runFor(MID, true) });
    expect(decideScreen(input(s, { monthlyEnabled: true }))).toMatchObject({ kind: 'weekly', continueTo: 'continue-playback' });
  });

  it('달의 마지막 주 뒤엔 월말 결산, 큰 주면 결산을 먼저 보고(봤다고 적고) 월말 결산', () => {
    const plain = resultAt(END, {}, { monthRun: runFor(END, true) });
    expect(decideScreen(input(plain, { monthlyEnabled: true }))).toMatchObject({ kind: 'month-summary' });
    const big = resultAt(END, { examResult: {} as WeekLog['examResult'] }, { monthRun: runFor(END, true) });
    const first = decideScreen(input(big, { monthlyEnabled: true }));
    expect(first).toMatchObject({ kind: 'weekly', continueTo: 'mark-big-result-seen' });
    const resultKey = first.kind === 'weekly' ? first.resultKey : '';
    expect(decideScreen(input(big, { monthlyEnabled: true, bigResultSeen: resultKey }))).toMatchObject({ kind: 'month-summary' });
  });

  it('장부가 다른 달 것이면 재생 결산으로 읽지 않는다(로그 좌표로 맞춘다)', () => {
    const otherMonth = { ...runFor(MID, true), month: getMonthBlock(MID).index + 1 };
    const s = resultAt(MID, {}, { monthRun: otherMonth });
    expect(decideScreen(input(s, { monthlyEnabled: true }))).toMatchObject({ kind: 'weekly', continueTo: 'to-weekday' });
  });
});

describe('decideScreen — 계획 단계(플래그)', () => {
  it('이번 달 계획이 없으면 월 계획 화면, 있으면 메인 화면(재생 띠 포함)', () => {
    const none = base();
    expect(decideScreen(input(none, { monthlyEnabled: true }))).toMatchObject({ kind: 'month-plan', existing: null });
    const planned = base();
    planned.monthPlan = planFor(planned);
    const r = decideScreen(input(planned, { monthlyEnabled: true }));
    expect(r).toMatchObject({ kind: 'main' });
    expect(r.kind === 'main' && r.playback).toEqual({ run: null });
  });

  it('남은 주 다시 짜기는 짜 둔 계획을 들고 계획 화면으로(키가 다르다)', () => {
    const planned = base();
    planned.monthPlan = planFor(planned);
    const r = decideScreen(input(planned, { monthlyEnabled: true, replanning: true }));
    expect(r).toMatchObject({ kind: 'month-plan', existing: planned.monthPlan });
    expect(r.key.endsWith(':replan')).toBe(true);
  });

  it('플래그가 꺼져 있으면 계획이 없어도 메인 화면, 재생 띠 없음', () => {
    const r = decideScreen(input(base()));
    expect(r).toMatchObject({ kind: 'main', key: 'main:2-6', playback: null });
  });

  it('학년말 대기(W49)엔 계획 화면을 띄우지 않는다', () => {
    expect(decideScreen(input(base({ week: 49 }), { monthlyEnabled: true })).kind).toBe('main');
  });
});

describe('GameScreen 배선 — 키·속도·분기는 decideScreen에서', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/components/GameScreen.tsx'), 'utf8');
  it('화면 정체성(키·속도)을 따로 계산하지 않는다', () => {
    expect(src).toMatch(/const route = decideScreen\(/);
    expect(src).toMatch(/const screenKey = route\.key;/);
    expect(src).toMatch(/const screenPace: TransitionPace = route\.pace;/);
    // 분기 안에서 키를 다시 대입하던 옛 형태가 돌아오면 라우터와 키가 다시 갈린다.
    expect(src.match(/screenKey = /g) ?? []).toHaveLength(1);
    expect(src).not.toMatch(/screenPace = 'slow'/);
  });
});
