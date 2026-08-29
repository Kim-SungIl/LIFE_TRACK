// @vitest-environment jsdom
// 세이브 로드의 버전 게이트 — 과거 버전은 살리고(단계형 마이그레이션 경로),
// 미래 버전(다운그레이드)만 거부한다. 과거엔 version 불일치 = 세이브 전체 증발이었다.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadFromStorage, useGameStore } from '../store';
import { CURRENT_SAVE_VERSION } from '../stateMigration';
import { createInitialState } from '../gameEngine';
import { GAME_EVENTS } from '../events';
import { assignCurrentEvent } from '../eventPresentation';
import { GameState, GameEvent } from '../types';

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

// 기록에 남는 것의 계약 — 화면이 무엇을 보여줬는지가 엔딩 분기(resolvedFemale)와
// 세이브 크기를 동시에 결정한다. 선언(presentEvent)만 잠그면 소비 지점은 비어 있다.
describe('recordResolvedEvent — 변이 이벤트의 기록 계약', () => {
  function resolveWith(event: GameEvent, gender: 'male' | 'female', year: number, week: number, choiceIndex = 0) {
    useGameStore.getState().resetGame();
    useGameStore.getState().startGame(gender, ['emotional', 'info']);
    const st = { ...useGameStore.getState().state!, year, week };
    assignCurrentEvent(st, event, week);
    useGameStore.setState({ state: st });
    useGameStore.getState().resolveEvent(choiceIndex);
    const evs = useGameStore.getState().state!.events;
    return evs[evs.length - 1];
  }

  // 변이의 특정 선택지에만 여성 결과문을 얹는다.
  function withFemaleOn(indices: number[]): GameEvent {
    const band = 'high' as const;
    return {
      ...chore,
      schoolVariants: {
        ...chore.schoolVariants!,
        [band]: chore.schoolVariants![band].map(v => ({
          ...v,
          choices: v.choices.map((c, i) => (indices.includes(i) ? { ...c, femaleMessage: `여성 결과 ${i}` } : c)),
        })),
      },
    };
  }

  const chore = GAME_EVENTS.find(e => e.schoolVariants)!;

  it('resolvedFemale_follows_presented_text: 변이의 여성 문장을 봤으면 true로 기록된다', () => {
    // presentEvent가 femaleChoices를 지우므로 `!!event.femaleChoices`만 보던 판정은
    // 변이 이벤트에서 항상 false가 됐다. 화면이 여성 문장을 실제로 그린 경우로 확인한다.
    const rec = resolveWith(withFemaleOn([0, 1, 2]), 'female', 6, 10, 0);
    expect(rec.id).toBe(chore.id);
    expect(rec.resolvedFemale, 'resolvedFemale_follows_presented_text').toBe(true);
    // 그리고 실제로 여성 문장을 집었는지 — 플래그만 보면 무엇이든 true로 둘 수 있다.
    expect(rec.choices[0].message).toBe('여성 결과 0');
  });

  it('resolvedFemale_is_per_choice: 고른 선택지에 여성 문장이 없으면 false다', () => {
    // 검수 지적. 여성 문장이 choice[1]에만 있는데 choice[0]을 골랐다면 여성 경로가 아니다.
    // 이벤트 단위 boolean으로 두면 여기서 조용히 true가 되어 엔딩 분기가 틀어진다.
    const ev = withFemaleOn([1]);
    expect(resolveWith(ev, 'female', 6, 10, 1).resolvedFemale, '고른 선택지에 여성 문장 있음').toBe(true);
    expect(resolveWith(ev, 'female', 6, 10, 0).resolvedFemale, 'resolvedFemale_is_per_choice').toBeFalsy();
  });

  it('resolvedFemale_stays_false_when_no_female_text: 여성 문장이 없으면 false다', () => {
    // 지금의 잡무 3종이 이 경우다. 무조건 true로 바꾸는 반대 방향 변이를 막는다.
    const rec = resolveWith(chore, 'female', 6, 10);
    expect(rec.resolvedFemale, 'resolvedFemale_stays_false_when_no_female_text').toBeFalsy();
  });

  it('남성 플레이어는 여성 변이가 있어도 false다', () => {
    expect(resolveWith(withFemaleOn([0, 1, 2]), 'male', 6, 10, 0).resolvedFemale).toBeFalsy();
  });
});
