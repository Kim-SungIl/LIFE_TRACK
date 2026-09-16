// @vitest-environment jsdom
// 손상된 세이브를 눌렀을 때 **화면이 무슨 말이든 하는가**. (#447)
//
// corruptSaveLoad.test.ts가 "던지지 않고 false"를 잠그지만, 그것만으로는
// 호출부가 그 false를 **버리는** 상태가 통과한다 — 그러면 고치기 전과 똑같이
// 버튼이 안 눌리는 것처럼 보인다. 결함의 본체는 크래시가 아니라 침묵이었다.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => `WEBP::${p}` }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
vi.mock('../../engine/assetPrefetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../engine/assetPrefetch')>()),
  runWhenIdle: () => () => {},
}));

import { TitleScreen } from '../TitleScreen';
import { useGameStore } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { CURRENT_SAVE_VERSION } from '../../engine/stateMigration';
import { clearArchive } from '../../engine/archive';

const KEY = 'lifetrack_save';

function seed(patch: Record<string, unknown>): void {
  const s: Record<string, unknown> = JSON.parse(JSON.stringify(
    createInitialState('male', ['wealth', 'info'], { rngSeed: 5 }),
  ));
  Object.assign(s, { year: 2, week: 10 }, patch);
  localStorage.setItem(KEY, JSON.stringify({
    version: CURRENT_SAVE_VERSION, state: s, savedAt: new Date().toISOString(),
  }));
}

beforeEach(() => {
  clearArchive();
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

describe('손상 세이브 — 타이틀이 사실대로 말한다', () => {
  it('타이틀 자체는 멀쩡히 뜨고 이어하기 버튼도 보인다', () => {
    seed({ parents: 'wealth' });
    render(<TitleScreen />);
    // 타이틀은 loadFromStorage만 읽으므로 손상 세이브에서도 안전했다 —
    // 그 비대칭(타이틀은 뜨는데 바로 옆 버튼만 죽는다)이 이 결함의 모양이었다.
    expect(screen.getByText('이어하기')).toBeTruthy();
  });

  it('이어하기를 누르면 안내가 뜬다 (침묵하지 않는다)', () => {
    seed({ parents: 'wealth' });
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('이어하기'));
    expect(screen.getByText('이 저장을 열 수 없어요'),
      '아무것도 안 뜨면 고치기 전과 똑같이 "버튼이 안 눌린다"로 보인다').toBeTruthy();
    expect(screen.getByText('지우고 새로 시작'), '나갈 길이 없으면 안내가 아니라 막다른 길이다').toBeTruthy();
  });

  it('안내가 기록실이 남는다는 것도 말한다', () => {
    seed({ parents: 'wealth' });
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('이어하기'));
    expect(screen.getByText(/기록실의 이야기는 그대로 남습니다/)).toBeTruthy();
  });

  // 닫기만 하면 세이브는 그대로다 — 사용자가 백업을 뜨고 싶을 수도 있다.
  it('닫기는 세이브를 지우지 않는다', () => {
    seed({ parents: 'wealth' });
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('이어하기'));
    fireEvent.click(screen.getByText('닫기'));
    expect(localStorage.getItem(KEY)).not.toBeNull();
    expect(screen.queryByText('이 저장을 열 수 없어요')).toBeNull();
  });

  it('"지우고 새로 시작"이 세이브를 지우고 이어하기를 없앤다', () => {
    seed({ parents: 'wealth' });
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('이어하기'));
    fireEvent.click(screen.getByText('지우고 새로 시작'));
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(screen.queryByText('이어하기'), '지웠는데 버튼이 남으면 또 같은 벽에 부딪친다').toBeNull();
    expect(screen.getByText('새 게임')).toBeTruthy();
  });

  // 음성 짝 — 멀쩡한 세이브에서 이 안내가 뜨면 정상 플레이가 막힌다.
  it('멀쩡한 세이브에서는 안내가 안 뜨고 게임이 시작된다', () => {
    seed({});
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('이어하기'));
    expect(screen.queryByText('이 저장을 열 수 없어요'),
      '상시 뜨는 경고는 경고가 아니다').toBeNull();
    expect(useGameStore.getState().state, '멀쩡한 세이브는 열려야 한다').not.toBeNull();
  });

  // **예외가 안 나는 손상**도 같은 안내로 가야 한다. 이 축이 통째로 비어 있었다 —
  // 기존 케이스(`parents: 'wealth'`)는 전부 마이그레이션 중 실제로 터지는 값이라
  // try/catch가 잡았고, 안 터지는 손상은 `ret=true`로 조용히 열렸다(실측 4종).
  it.each([
    ['parents가 null(rngSeed 정상)', { parents: null }],
    ['stats가 null', { stats: null }],
    ['npcs가 null', { npcs: null }],
    ['stats가 문자열', { stats: 'broken' }],
  ])('%s → 안내가 뜬다', (_label, patch) => {
    seed(patch);
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('이어하기'));
    expect(screen.getByText('이 저장을 열 수 없어요'),
      '조용히 열리면 깨진 state가 화면에 올라가고 자동저장이 그걸 디스크에 다시 쓴다').toBeTruthy();
  });

  // 끝난 판(엔딩)의 라벨에서도 같은 안내가 나와야 한다 — 버튼 문구만 다르고 경로는 같다.
  it('"엔딩 다시 보기"에서도 안내가 뜬다', () => {
    seed({ phase: 'ending', year: 8, week: 1, parents: 'wealth' });
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('엔딩 다시 보기'));
    expect(screen.getByText('이 저장을 열 수 없어요')).toBeTruthy();
  });
});
