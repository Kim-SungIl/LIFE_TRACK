// 기록 레코드 공유 복제(stateClone.ts)의 전제를 잠근다.
//   ① 공유해도 예전 깊은 복사와 같은 값·같은 바이트다(세이브·지문이 안 바뀐다).
//   ② 배열은 새것이다 — 사본에 기록을 더해도 원본 기록이 늘지 않는다.
//   ③ 레코드는 처음부터 JSON 모양이다(함수·undefined 키 없음) — 그래서 ①이 성립한다.
//   ④ 레코드는 얼어 있다(개발·테스트) — 제자리 변경은 그 자리에서 던진다.
//   ⑤ 미리보기는 사본을 제자리에서 진행시키지만 원본은 그대로다.
import { describe, expect, it } from 'vitest';
import { cloneGameState } from '../stateClone';
import { createInitialState, predictWeekOutcome } from '../gameEngine';
import { recordResolvedEvent } from '../eventResolution';
import { GAME_EVENTS } from '../events';
import type { GameEvent, GameState } from '../types';

const deepClone = (s: GameState): GameState => JSON.parse(JSON.stringify(s)) as GameState;

function stateWithRecords(): GameState {
  const s = createInitialState('female', ['emotional', 'info'], { rngSeed: 7 });
  // 선택지에 함수(condition)가 달린 카탈로그 이벤트를 골라 ③이 실제로 걷어 내는지 본다.
  const withFn = GAME_EVENTS.find(e => e.choices.some(c => typeof c.condition === 'function'));
  expect(withFn).toBeDefined();
  recordResolvedEvent(s, withFn!, 0, s.week, true);
  recordResolvedEvent(s, { ...GAME_EVENTS[0], week: s.week } as GameEvent, 1, s.week, true);
  return s;
}

describe('cloneGameState — 기록 레코드 공유', () => {
  it('① 깊은 복사와 바이트가 같고 키 순서도 같다', () => {
    const s = stateWithRecords();
    expect(JSON.stringify(cloneGameState(s))).toBe(JSON.stringify(deepClone(s)));
  });

  it('② 레코드는 공유하고 배열은 새로 만든다', () => {
    const s = stateWithRecords();
    const c = cloneGameState(s);
    expect(c.events).not.toBe(s.events);
    c.events.forEach((e, i) => expect(e).toBe(s.events[i]));
    c.events.push({ ...c.events[0] });
    expect(s.events).toHaveLength(2);
  });

  it('events가 배열이 아닌 손상 상태는 예전처럼 통째로 깊은 복사한다', () => {
    const s = { ...createInitialState('male', ['emotional', 'info'], { rngSeed: 1 }), events: undefined } as unknown as GameState;
    expect(JSON.stringify(cloneGameState(s))).toBe(JSON.stringify(deepClone(s)));
  });
});

describe('recordResolvedEvent — 레코드 모양', () => {
  it('③ 함수·undefined 키가 없는 JSON 모양으로 기록한다', () => {
    const s = stateWithRecords();
    for (const e of s.events) expect(e).toEqual(JSON.parse(JSON.stringify(e)));
    for (const e of s.events) {
      for (const c of e.choices) expect(typeof c.condition).toBe('undefined');
    }
  });

  it('④ 개발·테스트에서는 얼려서 제자리 변경을 던진다', () => {
    const s = stateWithRecords();
    const rec = s.events[0];
    expect(Object.isFrozen(rec)).toBe(true);
    expect(Object.isFrozen(rec.choices)).toBe(true);
    expect(() => { (rec as { resolvedChoice?: number }).resolvedChoice = 9; }).toThrow(TypeError);
    expect(() => { delete (rec as { romancePlan?: unknown }).romancePlan; }).not.toThrow(); // 없는 키 삭제는 허용(엄격 모드 규칙)
  });
});

describe('predictWeekOutcome — 사본을 한 번만 만든다', () => {
  it('⑤ 원본 상태를 바꾸지 않는다', () => {
    const s = stateWithRecords();
    s.routineSlot2 = 'self-study';
    const before = JSON.stringify(s);
    const eventsRef = s.events;
    predictWeekOutcome(s, ['reading', 'library'], {});
    expect(JSON.stringify(s)).toBe(before);
    expect(s.events).toBe(eventsRef);
    expect(s.events).toHaveLength(2);
  });
});
