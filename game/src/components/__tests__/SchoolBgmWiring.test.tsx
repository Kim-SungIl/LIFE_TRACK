// @vitest-environment jsdom
// 학교급 → 배경음 **배선** 계약.
//
// bgm.test.ts는 곡 자체(작곡 불변식·스케줄러)를 본다. 그것만으로는 "곡은 3개 다 있는데
// 아무도 안 거는" 상태가 통과한다 — 훅을 잠가도 부르는 쪽은 별개라는 걸 #397에서 겪었다
// (useAudioUnlock 호출을 지워도 547개가 전부 초록이었다 = 게임 전체 무음).
// 그래서 여기서는 GameScreen을 실제로 렌더해서 store의 year가 곡을 고르는지 본다.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => {
  let id = 'main';
  return {
    setBgmTrack: vi.fn((next: string) => { id = next; }),
    getBgmTrackId: vi.fn(() => id),
  };
});

import { GameScreen } from '../GameScreen';
import { setBgmTrack } from '../../audio/bgm';
import { useGameStore } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { getSchoolLevel } from '../../engine/backgrounds';
import type { GameState, ParentStrength } from '../../engine/types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];

function stateAt(year: number, patch: Partial<GameState> = {}): GameState {
  const s = createInitialState('male', PARENTS, { rngSeed: 12345 });
  return Object.assign(s, { year, week: 1, phase: 'weekday' as const, currentEvent: null }, patch);
}

function setYear(year: number): void {
  useGameStore.setState({ state: stateAt(year) });
}

/** setBgmTrack이 받은 인자들 — 호출 순서 그대로. */
const swaps = (): unknown[] =>
  (setBgmTrack as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(c => c[0]);

beforeEach(() => {
  localStorage.clear();
  // 반복 플레이어로 둔다 — 첫 플레이 튜토리얼 오버레이는 이 계약과 무관한데,
  // jsdom에 scrollIntoView가 없어서 렌더가 통째로 터진다.
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
  vi.clearAllMocks();
});

describe('학교급이 곡을 고른다', () => {
  // 학년이 아니라 **학교급**이 축이다. Y2~Y4가 같은 곡이어야 중1→중3에서 곡이 흔들리지 않는다.
  it.each([
    [1, 'elementary', '초6'],
    [2, 'middle', '중1'],
    [4, 'middle', '중3'],
    [5, 'high', '고1'],
    [7, 'high', '고3'],
  ])('Y%i → %s (%s)', (year, expected) => {
    setYear(year);
    render(<GameScreen />);
    expect(swaps()).toContain(expected);
  });

  it('학교급 경계에서 곡이 바뀐다 (Y1→Y2, Y4→Y5)', () => {
    setYear(1);
    const { rerender } = render(<GameScreen />);
    expect(swaps()).toEqual(['elementary']);

    setYear(2);
    rerender(<GameScreen />);
    expect(swaps()).toEqual(['elementary', 'middle']);

    setYear(5);
    rerender(<GameScreen />);
    expect(swaps()).toEqual(['elementary', 'middle', 'high']);
  });

  // 같은 학교급 안에서 다시 걸면 setBgmTrack이 stopBgm→startBgm을 돌려 곡이 한 번 끊긴다.
  // Y2→Y3→Y4마다 음악이 끊기면 학년말이 버그처럼 들린다.
  it('같은 학교급 안에서 학년만 올라가면 다시 걸지 않는다 (Y2→Y3→Y4)', () => {
    setYear(2);
    const { rerender } = render(<GameScreen />);
    vi.clearAllMocks();

    setYear(3);
    rerender(<GameScreen />);
    setYear(4);
    rerender(<GameScreen />);

    expect(swaps()).toEqual([]);
  });

  // 타이틀·기록실엔 학년이 없다. 되돌리지 않으면 새 판을 시작하기 전 타이틀에서
  // 직전 판의 고등학교 테마가 계속 흐른다.
  it('게임 화면을 떠나면 메인 테마로 되돌린다', () => {
    setYear(5);
    const { unmount } = render(<GameScreen />);
    expect(swaps()).toEqual(['high']);

    unmount();
    expect(swaps()).toEqual(['high', 'main']);
  });

  // 이 매핑이 곧 계약이다 — 학교급이 늘거나 이름이 바뀌면 여기서 먼저 깨져야 한다.
  it('매핑이 getSchoolLevel의 결과를 빠짐없이 덮는다', () => {
    const levels = [1, 2, 3, 4, 5, 6, 7].map(getSchoolLevel);
    expect(new Set(levels)).toEqual(new Set(['elementary', 'middle', 'high']));

    for (const year of [1, 2, 3, 4, 5, 6, 7]) {
      vi.clearAllMocks();
      setYear(year);
      const { unmount } = render(<GameScreen />);
      expect(swaps()[0], `Y${year}에 곡이 안 걸렸다`).toBeTruthy();
      unmount();
    }
  });
});
