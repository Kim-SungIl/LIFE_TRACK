// @vitest-environment jsdom
// 직전 판 시작 설정의 **왕복·검증 계약**과 그 배선.
//
// 이 락이 없으면 다회차 입구가 조용히 죽는 방식이 두 가지다:
// (1) startGame이 기록을 안 해도 화면은 "새 게임"만 보여주고 아무 에러가 없다.
// (2) 손상된 값을 부분 복구하면 "같은 집에서 다시"가 플레이어가 고른 적 없는 조합으로
//     판을 시작한다 — 이건 에러보다 나쁘다(라벨이 거짓말을 한다).
import { describe, it, expect, beforeEach } from 'vitest';
import { saveLastSetup, loadLastSetup, clearLastSetup } from '../lastSetup';
import { useGameStore, loadFromStorage } from '../store';
import type { ParentStrength } from '../types';

const KEY = 'lifetrack_last_setup';
const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

describe('lastSetup — 왕복', () => {
  it('저장한 값을 그대로 돌려준다', () => {
    saveLastSetup({ gender: 'female', parents: ['wealth', 'freedom'], useReducedRecovery: true });
    const got = loadLastSetup();
    expect(got).not.toBeNull();
    expect(got!.gender).toBe('female');
    expect(got!.parents).toEqual(['wealth', 'freedom']);
    expect(got!.useReducedRecovery).toBe(true);
  });

  it('도전 모드 false도 false로 온다 (undefined로 흐르지 않는다)', () => {
    saveLastSetup({ gender: 'male', parents: PARENTS, useReducedRecovery: false });
    expect(loadLastSetup()!.useReducedRecovery).toBe(false);
  });

  it('아무것도 없으면 null', () => {
    expect(loadLastSetup()).toBeNull();
  });

  it('clearLastSetup 후엔 null', () => {
    saveLastSetup({ gender: 'male', parents: PARENTS, useReducedRecovery: false });
    clearLastSetup();
    expect(loadLastSetup()).toBeNull();
  });
});

describe('lastSetup — 손상값은 전부 null (부분 복구 금지)', () => {
  // 각 케이스가 **한 필드만** 망가뜨린다. 통째로 이상한 값을 넣으면 어느 검증이 잡았는지
  // 알 수 없고, 검증 하나를 지워도 통과한다.
  const cases: [string, unknown][] = [
    ['JSON이 아님', undefined],
    ['gender가 이상함', { gender: 'other', parents: PARENTS, useReducedRecovery: false }],
    ['gender 누락', { parents: PARENTS, useReducedRecovery: false }],
    ['기억이 1개', { gender: 'male', parents: ['strict'], useReducedRecovery: false }],
    ['기억이 3개', { gender: 'male', parents: ['strict', 'emotional', 'wealth'], useReducedRecovery: false }],
    ['기억이 배열이 아님', { gender: 'male', parents: 'strict', useReducedRecovery: false }],
    ['모르는 강점', { gender: 'male', parents: ['strict', 'nonexistent'], useReducedRecovery: false }],
    // 선택 UI의 toggle이 만들 수 없는 조합 — 통과시키면 "같은 집"이 강점 1개짜리 집이 된다.
    ['같은 강점 2개', { gender: 'male', parents: ['strict', 'strict'], useReducedRecovery: false }],
  ];
  for (const [label, value] of cases) {
    it(label, () => {
      localStorage.setItem(KEY, value === undefined ? '{{{' : JSON.stringify(value));
      expect(loadLastSetup(), `${label}에서 null이 아니면 없는 조합으로 판이 시작된다`).toBeNull();
    });
  }
});

describe('배선 — startGame이 설정을 기록한다', () => {
  it('시작하면 인자 그대로 남는다 (도전 모드 포함)', () => {
    expect(loadLastSetup(), '전제: 시작 전엔 비어 있다').toBeNull();
    useGameStore.getState().startGame('female', ['info', 'resilience'], { useReducedRecovery: true });
    const got = loadLastSetup();
    expect(got).not.toBeNull();
    expect(got!.gender).toBe('female');
    expect(got!.parents).toEqual(['info', 'resilience']);
    expect(got!.useReducedRecovery).toBe(true);
  });

  it('옵션 없이 시작하면 도전 모드는 false다', () => {
    useGameStore.getState().startGame('male', PARENTS);
    expect(loadLastSetup()!.useReducedRecovery).toBe(false);
  });

  it('두 번째 판이 첫 판의 설정을 덮어쓴다 (직전 판이라는 뜻)', () => {
    useGameStore.getState().startGame('male', ['strict', 'info'], { useReducedRecovery: true });
    useGameStore.getState().startGame('female', ['wealth', 'freedom'], { useReducedRecovery: false });
    const got = loadLastSetup()!;
    expect(got.gender).toBe('female');
    expect(got.parents).toEqual(['wealth', 'freedom']);
    expect(got.useReducedRecovery).toBe(false);
  });
});

describe('배선 — 타이틀로 나가는 두 길은 세이브 처리가 다르다', () => {
  // 양성 짝: 한쪽만 두면 "둘 다 지운다"·"둘 다 남긴다"가 통과한다.
  it('exitToTitle은 세이브를 남긴다 (엔딩 다시 보기의 근거)', () => {
    useGameStore.getState().startGame('male', PARENTS);
    expect(loadFromStorage(), '전제: 시작하면 세이브가 있다').not.toBeNull();
    useGameStore.getState().exitToTitle();
    expect(useGameStore.getState().state).toBeNull();
    expect(loadFromStorage(), 'exitToTitle이 세이브를 지우면 그 판의 엔딩은 두 번 다시 못 본다').not.toBeNull();
  });

  it('resetGame은 세이브를 지운다', () => {
    useGameStore.getState().startGame('male', PARENTS);
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().state).toBeNull();
    expect(loadFromStorage()).toBeNull();
  });

  it('exitToTitle은 직전 판 설정도 남긴다 (같은 집으로 되돌아올 수 있다)', () => {
    useGameStore.getState().startGame('female', ['wealth', 'info'], { useReducedRecovery: false });
    useGameStore.getState().exitToTitle();
    expect(loadLastSetup()!.parents).toEqual(['wealth', 'info']);
  });
});
