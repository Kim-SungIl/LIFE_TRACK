// @vitest-environment jsdom
// 엔딩 화면의 **다회차 입구 배선**.
//
// 이 자리는 오랫동안 `window.location.reload()` 한 줄이었다 — 라벨은 "다시 시작하기"인데
// 아무것도 시작하지 않고, 세이브는 phase='ending'으로 남아 타이틀의 "이어하기"가 이 화면으로
// 되돌아왔다. 그 상태에서도 화면은 정상으로 보이고 테스트는 초록이었다.
//
// 그래서 **컴포넌트 단독 렌더로 끝내지 않는다.** prop을 받는 컴포넌트 테스트는 그 prop을
// 만드는 층의 누락을 원리상 못 잡는다(#431 교훈). 아래 절반은 GameScreen을 실제로 세워
// 스토어까지 왕복한다.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../engine/assetWebp', () => ({ webpSrc: (p: string) => `WEBP::${p}` }));
vi.mock('../../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
vi.mock('../../../engine/assetPrefetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../engine/assetPrefetch')>()),
  runWhenIdle: () => () => {},
}));

import { EndingScreen } from '../EndingScreen';
import { GameScreen } from '../../GameScreen';
import { calculateEnding } from '../../../engine/ending';
import { getBackground } from '../../../engine/backgrounds';
import { createInitialState } from '../../../engine/gameEngine';
import { useGameStore, loadFromStorage } from '../../../engine/store';
import { saveLastSetup } from '../../../engine/lastSetup';
import { CURRENT_SAVE_VERSION } from '../../../engine/stateMigration';
import { clearArchive } from '../../../engine/archive';
import type { GameState, ParentStrength } from '../../../engine/types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];

function endedState(): GameState {
  const s = createInitialState('male', PARENTS, { rngSeed: 7 });
  // 엔딩 시점의 실제 좌표 — applyYearTransition이 Y7 마감에서 year++ 후 phase='ending'.
  s.year = 8;
  s.week = 1;
  s.phase = 'ending';
  return s;
}

beforeEach(() => {
  clearArchive();
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

describe('EndingScreen — 버튼 존재 계약', () => {
  function renderEnding(onRestartSameHome: (() => void) | null, onExitToTitle = () => {}) {
    const state = endedState();
    return render(
      <EndingScreen
        ending={calculateEnding(state)}
        track={state.track}
        stats={state.stats}
        parents={state.parents}
        burnoutCount={0}
        money={0}
        bgProps={{ bg: getBackground(state.week, false, 'normal', 7), bgImgError: true, onImgError: vi.fn() }}
        runDelta={null}
        gender={state.gender}
        onRestartSameHome={onRestartSameHome}
        onExitToTitle={onExitToTitle}
      />,
    );
  }

  it('직전 설정이 있으면 두 버튼이 뜬다', () => {
    renderEnding(() => {});
    expect(screen.getByText('같은 집에서 다시')).toBeTruthy();
    expect(screen.getByText('타이틀로')).toBeTruthy();
  });

  // 눌러도 아무 일 없는 버튼보다 없는 편이 낫다.
  it('직전 설정이 없으면 재시작 버튼을 그리지 않는다 (나가는 길은 남는다)', () => {
    renderEnding(null);
    expect(screen.queryByText('같은 집에서 다시')).toBeNull();
    expect(screen.getByText('타이틀로')).toBeTruthy();
  });

  it('두 버튼이 각자의 콜백을 부른다', () => {
    const restart = vi.fn();
    const exit = vi.fn();
    renderEnding(restart, exit);
    fireEvent.click(screen.getByText('같은 집에서 다시'));
    expect(restart).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('타이틀로'));
    expect(exit).toHaveBeenCalledTimes(1);
  });
});

describe('GameScreen 배선 — 스토어까지 왕복', () => {
  function seedSaveAndState(): void {
    const state = endedState();
    localStorage.setItem('lifetrack_save', JSON.stringify({
      version: CURRENT_SAVE_VERSION, state, savedAt: new Date().toISOString(),
    }));
    useGameStore.setState({ state, runDelta: null, npcActivityMap: {} });
  }

  it('"같은 집에서 다시"가 직전 설정으로 새 판을 시작한다', async () => {
    saveLastSetup({ gender: 'female', parents: ['wealth', 'info'], useReducedRecovery: true });
    seedSaveAndState();
    render(<GameScreen />);
    fireEvent.click(await waitFor(() => screen.getByText('같은 집에서 다시')));

    const s = useGameStore.getState().state!;
    expect(s.phase, '엔딩에 머물러 있으면 아무것도 시작되지 않은 것이다').not.toBe('ending');
    expect(s.year).toBe(1);
    expect(s.week).toBe(1);
    expect(s.gender).toBe('female');
    expect(s.parents).toEqual(['wealth', 'info']);
    expect(s.useReducedRecovery).toBe(true);
  });

  it('"타이틀로"는 세이브를 남긴 채 나간다 (엔딩 다시 보기의 근거)', async () => {
    saveLastSetup({ gender: 'male', parents: PARENTS, useReducedRecovery: false });
    seedSaveAndState();
    render(<GameScreen />);
    fireEvent.click(await waitFor(() => screen.getByText('타이틀로')));

    expect(useGameStore.getState().state).toBeNull();
    const save = loadFromStorage();
    expect(save, '여기서 세이브를 지우면 그 판의 엔딩은 두 번 다시 못 본다').not.toBeNull();
    expect(save!.state.phase).toBe('ending');
  });

  it('직전 설정이 없는 판이면 재시작 버튼이 아예 안 걸린다', async () => {
    seedSaveAndState();   // saveLastSetup 없음 = 이 키가 배포되기 전의 세이브
    render(<GameScreen />);
    await waitFor(() => screen.getByText('타이틀로'));
    expect(screen.queryByText('같은 집에서 다시')).toBeNull();
  });
});
