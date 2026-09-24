// @vitest-environment jsdom
// 손상된 세이브를 열려고 할 때 **던지지 않는가**. (#447)
//
// 이 축은 통째로 비어 있었다 — `parents`가 배열이 아닌 케이스를 잡는 테스트가 0건이었고
// (stateMigration.test.ts는 `['gene','info']` 배열 별칭만, verify-save-load.ts는 필드 누락만),
// 그래서 이어하기가 `TypeError: state.parents.map is not a function`으로 죽는데
// **화면에는 아무 일도 안 일어났다**. onClick 안의 동기 예외라 React 에러 바운더리가 못 잡고
// (바운더리는 렌더 중 예외만 본다) window.onerror로 빠진다 — 에러도 배너도 토스트도 0이었다.
//
// 플레이어가 보는 것은 "버튼이 안 눌림"이다. 크래시보다 이 **침묵**이 결함의 본체다.
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, loadFromStorage } from '../store';
import { CURRENT_SAVE_VERSION } from '../stateMigration';
import { createInitialState } from '../gameEngine';
import type { GameState } from '../types';

const KEY = 'lifetrack_save';

function seed(patch: Record<string, unknown>): void {
  const s: Record<string, unknown> = JSON.parse(JSON.stringify(
    createInitialState('male', ['wealth', 'info'], { rngSeed: 5 }),
  ));
  Object.assign(s, patch);
  localStorage.setItem(KEY, JSON.stringify({
    version: CURRENT_SAVE_VERSION, state: s, savedAt: new Date().toISOString(),
  }));
}

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

describe('손상된 세이브 — 던지지 않고 false를 낸다', () => {
  // 각 케이스가 **한 필드만** 망가뜨린다. 통째로 이상한 값을 넣으면 어느 방어가 잡았는지
  // 알 수 없고, 방어 하나를 지워도 통과한다.
  const cases: [string, Record<string, unknown>][] = [
    ['parents가 문자열', { parents: 'wealth' }],
    ['parents가 숫자', { parents: 3 }],
    ['parents가 객체', { parents: { 0: 'wealth', 1: 'info' } }],
    ['parents가 true', { parents: true }],
    // falsy는 map 가드를 통과한다 — 그 다음 rng.ts의 `.join`에서 터진다(rngSeed 없는 구세이브).
    ['parents가 null + rngSeed 없음', { parents: null, rngSeed: undefined }],
    ['npcs가 문자열', { npcs: 'jihun' }],
    ['vacationChoices가 객체', { vacationChoices: { a: 1 } }],
    ['state 전체가 문자열', {}],   // 아래에서 따로 심는다
  ];

  for (const [label, patch] of cases.slice(0, -1)) {
    it(`${label} → 던지지 않고 false`, () => {
      seed(patch);
      let threw: unknown = null;
      let ret: boolean | undefined;
      try { ret = useGameStore.getState().loadSavedGame(); } catch (e) { threw = e; }
      expect(threw, `던지면 onClick 밖으로 새어 화면이 침묵한다: ${String(threw)}`).toBeNull();
      expect(ret, '못 열었으면 false여야 호출부가 안내할 수 있다').toBe(false);
    });
  }

  it('state 자체가 문자열 → 던지지 않고 false', () => {
    localStorage.setItem(KEY, JSON.stringify({
      version: CURRENT_SAVE_VERSION, state: 'broken', savedAt: new Date().toISOString(),
    }));
    let threw: unknown = null;
    let ret: boolean | undefined;
    try { ret = useGameStore.getState().loadSavedGame(); } catch (e) { threw = e; }
    expect(threw).toBeNull();
    expect(ret).toBe(false);
  });

  // 실패해도 **상태를 반쯤 바꾸지 않는다** — 반쯤 적용된 state로 두면 화면이 엉뚱한 곳에 착지한다.
  it('실패해도 스토어 상태를 건드리지 않는다', () => {
    seed({ parents: 'wealth' });
    useGameStore.getState().loadSavedGame();
    expect(useGameStore.getState().state, '실패했는데 state가 생기면 더 나쁜 화면이 뜬다').toBeNull();
  });

  // 실패해도 세이브를 **지우지 않는다**. 지우는 것은 사용자가 확인한 뒤의 일이다.
  it('실패해도 세이브를 지우지 않는다 (지우기는 사용자 확인 뒤에)', () => {
    seed({ parents: 'wealth' });
    useGameStore.getState().loadSavedGame();
    expect(localStorage.getItem(KEY), '조용히 지우면 사용자가 무슨 일이 났는지 영영 모른다').not.toBeNull();
  });

  // 양성 짝 — 멀쩡한 세이브는 여전히 열린다. 없으면 "항상 false"도 통과한다.
  it('멀쩡한 세이브는 열린다 (양성 짝)', () => {
    seed({ year: 2, week: 10 });
    expect(useGameStore.getState().loadSavedGame()).toBe(true);
    expect(useGameStore.getState().state).not.toBeNull();
    expect(useGameStore.getState().state!.year).toBe(2);
  });

  // 타이틀이 읽는 경로는 원래도 안전했다 — 그 비대칭이 이 결함의 모양이었다
  // (타이틀은 멀쩡히 뜨는데 바로 옆 버튼만 죽는다).
  it('타이틀이 읽는 경로(loadFromStorage)는 손상 세이브에서도 안전하다', () => {
    seed({ parents: 'wealth' });
    expect(() => loadFromStorage()).not.toThrow();
    expect(loadFromStorage().kind).toBe('ok');
  });
});

describe('복구 — 새 게임이 손상 세이브를 덮어쓴다', () => {
  it('새 게임 뒤에는 이어하기가 정상 동작한다', () => {
    seed({ parents: 'wealth' });
    expect(useGameStore.getState().loadSavedGame()).toBe(false);

    useGameStore.getState().startGame('female', ['strict', 'emotional'], {});
    const read = loadFromStorage();
    const after = (read.kind === 'ok' ? read.data.state : null) as GameState;
    expect(Array.isArray(after.parents), '새 판이 손상 세이브를 덮어써야 복구가 끝난다').toBe(true);

    useGameStore.setState({ state: null });
    expect(useGameStore.getState().loadSavedGame()).toBe(true);
  });

  it('resetGame은 손상 세이브를 지운다 (다이얼로그의 "지우고 새로 시작")', () => {
    seed({ parents: 'wealth' });
    useGameStore.getState().resetGame();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
