// 기록 레코드 공유 복제(stateClone.ts)의 전제를 잠근다.
//   ① 공유해도 예전 깊은 복사와 같은 값·같은 바이트다(세이브·지문이 안 바뀐다).
//   ② 배열은 새것이다 — 사본에 기록을 더해도 원본 기록이 늘지 않는다.
//   ③ 레코드는 JSON 모양이다(함수·undefined 키 없음, 카탈로그와 객체를 나눠 갖지 않음) — 그래서 ①이 성립한다.
//   ④ 레코드는 깊게 얼어 있다(개발·테스트) — 제자리 변경은 그 자리에서 던진다.
//   ⑤ 미리보기는 원본 상태도, 원본 레코드도 바꾸지 않는다(로드한 판 포함).
//   ⑥ 채택 표시가 없는 레코드(세이브 로드·스크립트가 직접 넣은 기록)도 공유 전에 채택된다 — 출처와 무관하게 ③④.
import { describe, expect, it } from 'vitest';
import { adoptEventRecords, cloneGameState } from '../stateClone';
import { createInitialState, predictWeekOutcome } from '../gameEngine';
import { recordResolvedEvent } from '../eventResolution';
import { migrateLoadedState } from '../stateMigration';
import { GAME_EVENTS } from '../events';
import type { GameEvent, GameState } from '../types';

const deepClone = <T,>(s: T): T => JSON.parse(JSON.stringify(s)) as T;

/** 선택지에 함수(condition)가 달린 카탈로그 이벤트 — ③이 실제로 걷어 내는지 보려고 고른다. */
const WITH_FN = GAME_EVENTS.find(e => e.choices.some(c => typeof c.condition === 'function'))!;

function stateWithRecords(): GameState {
  const s = createInitialState('female', ['emotional', 'info'], { rngSeed: 7 });
  expect(WITH_FN, '전제: 선택지에 함수가 달린 이벤트가 있다').toBeDefined();
  recordResolvedEvent(s, WITH_FN, 0, s.week, true);
  recordResolvedEvent(s, { ...GAME_EVENTS[0], week: s.week } as GameEvent, 1, s.week, true);
  return s;
}

/** 세이브 → 로드를 거친 판 — 레코드는 JSON.parse가 만든 새 객체라 채택 표시도 동결도 없다. */
function loadedState(): GameState {
  return migrateLoadedState(deepClone(stateWithRecords()));
}

/** 값 안의 모든 객체(배열 포함). */
function objectsIn(value: unknown, out = new Set<object>()): Set<object> {
  if (value && typeof value === 'object' && !out.has(value)) {
    out.add(value);
    for (const v of Object.values(value)) objectsIn(v, out);
  }
  return out;
}

function expectDeepFrozen(value: unknown, path = 'record'): void {
  if (!value || typeof value !== 'object') return;
  expect(Object.isFrozen(value), `${path} 가 얼지 않았다`).toBe(true);
  for (const [k, v] of Object.entries(value)) expectDeepFrozen(v, `${path}.${k}`);
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

  it('객체가 아닌 칸은 예전 JSON 왕복과 같은 값이 된다(undefined → null)', () => {
    const s = stateWithRecords();
    (s.events as unknown[]).push(undefined, null);
    expect(JSON.stringify(cloneGameState(s))).toBe(JSON.stringify(deepClone(s)));
    expect(cloneGameState(s).events.slice(-2)).toStrictEqual([null, null]);
  });
});

describe('recordResolvedEvent — 레코드 모양', () => {
  it('③ 함수·undefined 키가 없는 JSON 모양이고, 카탈로그와 객체를 나눠 갖지 않는다', () => {
    const s = stateWithRecords();
    for (const e of s.events) expect(e).toStrictEqual(JSON.parse(JSON.stringify(e)));
    for (const c of s.events[0].choices) expect(Object.hasOwn(c, 'condition')).toBe(false);
    const catalog = objectsIn(WITH_FN);
    for (const o of objectsIn(s.events[0])) expect(catalog.has(o), '레코드가 카탈로그 객체를 참조한다').toBe(false);
    // 카탈로그는 얼지 않는다 — 레코드를 얼리는 일이 카탈로그로 번지면 안 된다.
    expect(Object.isFrozen(WITH_FN.choices[0])).toBe(false);
  });

  it('④ 개발·테스트에서는 깊게 얼려서 제자리 변경을 던진다', () => {
    const s = stateWithRecords();
    const rec = s.events[0];
    expectDeepFrozen(rec);
    expect(rec.choices[0].effects, '전제: 깊이 3의 객체가 있다').toBeTruthy();
    expect(() => { (rec as { resolvedChoice?: number }).resolvedChoice = 9; }).toThrow(TypeError);
    expect(() => { (rec.choices[0] as { text: string }).text = '바뀜'; }).toThrow(TypeError);
  });
});

describe('predictWeekOutcome — 원본을 바꾸지 않는다', () => {
  it.each([
    ['이번 세션에 기록한 판', stateWithRecords],
    ['세이브에서 읽은 판', loadedState],
  ])('⑤ %s: 원본 상태·원본 레코드가 그대로다', (_label, make) => {
    const s = make();
    s.routineSlot2 = 'self-study';
    const before = JSON.stringify(s);
    const eventsRef = s.events;
    const recordsBefore = s.events.map(e => JSON.stringify(e));
    predictWeekOutcome(s, ['reading', 'library'], {});
    expect(JSON.stringify(s)).toBe(before);
    expect(s.events).toBe(eventsRef);
    expect(s.events.map(e => JSON.stringify(e))).toStrictEqual(recordsBefore);
  });
});

describe('채택 — 출처가 어디든 공유 전에 채택된다', () => {
  it('⑥ 세이브 로드: migrateLoadedState가 레코드를 채택해, 로드 뒤 복제들이 같은 레코드를 공유한다', () => {
    const s = loadedState();
    for (const e of s.events) expectDeepFrozen(e);
    const a = cloneGameState(s);
    const b = cloneGameState(s);
    a.events.forEach((e, i) => { expect(e).toBe(s.events[i]); expect(e).toBe(b.events[i]); });
  });

  it('⑥ 스크립트가 카탈로그 이벤트를 그대로 넣은 기록: 복제가 채택본으로 바꿔 담고 원본은 건드리지 않는다', () => {
    const s = createInitialState('male', ['emotional', 'info'], { rngSeed: 3 });
    const raw = { ...WITH_FN, resolvedChoice: 0, week: 1, year: 1, condition: undefined } as GameEvent;
    s.events.push(raw);
    const c = cloneGameState(s);
    expect(c.events[0]).not.toBe(raw);
    expect(c.events[0]).toStrictEqual(JSON.parse(JSON.stringify(raw)));
    expect(Object.hasOwn(c.events[0], 'condition')).toBe(false);
    expectDeepFrozen(c.events[0]);
    expect(Object.isFrozen(raw), '원본(스크립트 소유)을 얼리면 안 된다').toBe(false);
    expect(cloneGameState(c).events[0], '한 번 채택되면 그 뒤로는 공유').toBe(c.events[0]);
  });

  it('⑥ adoptEventRecords는 새 배열을 내고 채택된 레코드는 그대로 지나간다', () => {
    const s = stateWithRecords();
    const out = adoptEventRecords(s.events);
    expect(out).not.toBe(s.events);
    out.forEach((e, i) => expect(e).toBe(s.events[i]));
  });
});
