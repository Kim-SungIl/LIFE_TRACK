// @vitest-environment jsdom
// 다회차 입구가 새로 살려낸 두 경로의 **배경음 소유권** 계약.
//
// 곡을 정하는 주체가 GameScreen(부모)과 EndingScreen(자식) 둘이면 React의 실행 순서가
// 승자를 정해 버린다 — 삭제 시 cleanup은 **부모→자식**, 마운트 시 effect는 **자식→부모**다.
// PR 전에는 state를 null로 만드는 프로덕션 호출부가 없어(resetGame 호출부 0) 이 순서가
// 드러나지 않았고, `타이틀로`와 `엔딩 다시 보기`가 그 경로를 처음 살렸다.
//
// **mock이 상태를 가져야 한다.** 무상태 `vi.fn()`으로는 "마지막에 어떤 곡이 걸렸나"를
// 원리상 볼 수 없고, 호출이 있었다는 것만 보인다 — 이 버그는 호출 순서 문제라 그걸론 안 잡힌다.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../engine/assetPrefetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../engine/assetPrefetch')>()),
  runWhenIdle: () => () => {},
}));
vi.mock('../../audio/bgm', () => {
  let id = 'main';
  return {
    setBgmTrack: vi.fn((next: string) => { id = next; }),
    getBgmTrackId: vi.fn(() => id),
    syncBgmWithSettings: vi.fn(),
    startBgm: vi.fn(),
    stopBgm: vi.fn(),
  };
});

import App from '../../App';
import { setBgmTrack, getBgmTrackId } from '../../audio/bgm';
import { useGameStore } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { getSchoolLevel } from '../../engine/backgrounds';
import type { GameState, ParentStrength } from '../../engine/types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];

function endedState(): GameState {
  const s = createInitialState('male', PARENTS, { rngSeed: 7 });
  // 엔딩 시점의 실제 좌표 — Y7 마감에서 year++ 후 phase='ending'.
  return Object.assign(s, { year: 8, week: 1, phase: 'ending' as const, currentEvent: null });
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  vi.clearAllMocks();
  setBgmTrack('main');
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

describe('엔딩을 거쳐 나온 뒤의 곡', () => {
  // 전제 확인 — year 8은 고등이라, 부모가 곡을 고르면 회상 테마가 이 곡에 덮인다.
  it('전제: 엔딩 시점의 학교급은 고등이다', () => {
    expect(getSchoolLevel(8)).toBe('high');
  });

  it('엔딩 화면에서는 회상 테마가 걸린다', async () => {
    useGameStore.setState({ state: endedState() });
    render(<App />);
    await waitFor(() => screen.getByText('타이틀로'));
    expect(getBgmTrackId()).toBe('endingRecall');
  });

  // 수정 전 실측: 'high'. 부모(GameScreen)의 언마운트 cleanup이 main을 걸고,
  // 그 뒤 자식(EndingScreen)의 복원이 진입 시점의 곡(high)을 되돌려 놓았다.
  it('타이틀로 나가면 메인 테마다 (학교급 곡이 따라 나오지 않는다)', async () => {
    useGameStore.setState({ state: endedState() });
    render(<App />);
    await waitFor(() => screen.getByText('타이틀로'));
    act(() => { useGameStore.getState().exitToTitle(); });
    await waitFor(() => screen.getByText('새 게임'));
    expect(getBgmTrackId(), '타이틀에서 고등학교 곡이 흐르면 안 된다').toBe('main');
  });

  // **실플레이 경로 — 위 케이스만으로는 부족하다.** 위는 엔딩 상태로 화면을 새로 세우므로
  // 학교급 곡이 한 번도 안 걸리고, 그래서 "타이틀이 자기 곡을 소유한다"는 수정을 지워도
  // 통과한다(뮤테이션 N01 MISSED로 실제로 드러났다). 실제 플레이는 Y7을 달리던 중
  // **제자리에서** phase가 ending으로 바뀌므로, 그 시점의 곡은 이미 고등학교 곡이다.
  it('Y7을 달리다 엔딩에 닿아 타이틀로 나가도 메인 테마다', async () => {
    const playing = createInitialState('male', PARENTS, { rngSeed: 7 });
    Object.assign(playing, { year: 7, week: 10, phase: 'weekday' as const, currentEvent: null });
    useGameStore.setState({ state: playing });
    render(<App />);
    await waitFor(() => expect(getBgmTrackId()).toBe('high'));

    act(() => { useGameStore.setState({ state: { ...useGameStore.getState().state!, ...endedState() } }); });
    await waitFor(() => screen.getByText('타이틀로'));
    expect(getBgmTrackId(), '엔딩 화면에서는 회상 테마다').toBe('endingRecall');

    act(() => { useGameStore.getState().exitToTitle(); });
    await waitFor(() => screen.getByText('새 게임'));
    expect(getBgmTrackId(), '엔딩을 거쳐 나오면 학교급 곡이 따라 나오던 자리다').toBe('main');
  });

  // 수정 전 실측: 'high'. 첫 진입은 EndingScreen이 lazy라 늦게 붙어 우연히 정상이고,
  // 청크가 캐시된 **두 번째**부터 같은 커밋에 동기 마운트되어 부모 effect가 나중에 이긴다.
  it('세션 안에서 두 번째로 엔딩에 들어가도 회상 테마다', async () => {
    useGameStore.setState({ state: endedState() });
    const first = render(<App />);
    await waitFor(() => screen.getByText('타이틀로'));
    first.unmount();

    setBgmTrack('main');
    useGameStore.setState({ state: endedState() });
    render(<App />);
    await waitFor(() => screen.getByText('타이틀로'));
    expect(getBgmTrackId(), '학교급 곡이 회상 테마를 덮으면 안 된다').toBe('endingRecall');
  });

  // 제자리 재시작(엔딩 → 새 판)은 자식 삭제와 부모 effect가 같은 커밋이라 원래 정상이었다.
  // 부모 effect에 phase 게이트를 넣으면서 깨지지 않았는지 함께 잠근다.
  it('엔딩에서 제자리 재시작하면 새 학년의 곡으로 바뀐다', async () => {
    useGameStore.setState({ state: endedState() });
    render(<App />);
    await waitFor(() => screen.getByText('타이틀로'));
    act(() => { useGameStore.getState().startGame('male', PARENTS); });
    await waitFor(() => expect(useGameStore.getState().state!.year).toBe(1));
    await waitFor(() => expect(getBgmTrackId()).not.toBe('endingRecall'));
    expect(getBgmTrackId()).toBe('elementary');
  });
});
