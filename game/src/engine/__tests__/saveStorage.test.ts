// @vitest-environment jsdom
// 세이브 로드의 버전 게이트 — 과거 버전은 살리고(단계형 마이그레이션 경로),
// 미래 버전(다운그레이드)만 거부한다. 과거엔 version 불일치 = 세이브 전체 증발이었다.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadFromStorage, useGameStore } from '../store';
import { CURRENT_SAVE_VERSION } from '../stateMigration';
import { createInitialState } from '../gameEngine';
import { GameState } from '../types';

const SAVE_KEY = 'lifetrack_save';

function putSave(payload: { version?: unknown; state?: unknown; savedAt?: string }) {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ savedAt: '2026-01-01T00:00:00Z', ...payload }));
}

function serializedState(): GameState {
  return JSON.parse(JSON.stringify(createInitialState('male', ['emotional', 'info'], { rngSeed: 7 })));
}

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState({ state: null });
});

describe('loadFromStorage 버전 게이트', () => {
  it('세이브가 없으면 null', () => {
    expect(loadFromStorage()).toBeNull();
  });

  it('현재 버전 세이브를 그대로 돌려준다', () => {
    putSave({ version: CURRENT_SAVE_VERSION, state: serializedState() });
    expect(loadFromStorage()?.version).toBe(CURRENT_SAVE_VERSION);
  });

  it('버전 스탬프가 없거나 손상된 세이브는 v1로 정규화해 살린다', () => {
    putSave({ state: serializedState() });
    expect(loadFromStorage()?.version).toBe(1);
    putSave({ version: 'abc', state: serializedState() });
    expect(loadFromStorage()?.version).toBe(1);
  });

  it('미래 버전(다운그레이드) 세이브는 거부한다 — 미지의 구조를 구버전 step으로 못 다룬다', () => {
    putSave({ version: CURRENT_SAVE_VERSION + 1, state: serializedState() });
    expect(loadFromStorage()).toBeNull();
  });

  it('state가 없거나 JSON이 깨진 세이브는 null', () => {
    putSave({ version: 1 });
    expect(loadFromStorage()).toBeNull();
    localStorage.setItem(SAVE_KEY, '{broken');
    expect(loadFromStorage()).toBeNull();
  });
});

describe('loadSavedGame 마이그레이션 와이어링', () => {
  it('구세이브(레거시 필드)가 로드 경로에서 정규화되어 들어온다', () => {
    const legacy = serializedState();
    legacy.parents = ['gene', 'info'] as unknown as GameState['parents'];
    putSave({ version: 1, state: legacy });

    expect(useGameStore.getState().loadSavedGame()).toBe(true);
    expect(useGameStore.getState().state?.parents).toEqual(['resilience', 'info']);
  });
});
