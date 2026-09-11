// @vitest-environment jsdom
// 다회차 입구의 **화면 계약**. 엔진 락(lastSetup.test.ts)이 값을 잠그지만,
// 그것만으로는 "모듈은 완벽한데 아무 화면도 안 부르는" 상태가 통과한다 —
// 이 리포의 전례가 여럿이다(EventResultSound / useAudioUnlock / #431).
//
// 첫 화면 버튼을 늘리지 않기로 했으므로(5그룹 논의 2번 결정) 두 갈래는 "새 게임" 아래에
// 접혀 있다. 그래서 **접힘 자체가 계약이다** — 직전 설정이 없는 사람은 이 화면을 보면 안 된다.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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
import { saveLastSetup } from '../../engine/lastSetup';
import { CURRENT_SAVE_VERSION } from '../../engine/stateMigration';
import { clearArchive, accrueResolvedEvent } from '../../engine/archive';
import type { GameState, ParentStrength } from '../../engine/types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];

/** 세이브를 직접 심는다 — 스토어의 saveToStorage는 비공개다. */
function seedSave(patch: Partial<GameState> = {}): void {
  const state = Object.assign(createInitialState('male', PARENTS, { rngSeed: 1 }), patch);
  localStorage.setItem('lifetrack_save', JSON.stringify({
    version: CURRENT_SAVE_VERSION, state, savedAt: new Date().toISOString(),
  }));
}

const started = () => useGameStore.getState().state;

beforeEach(() => {
  clearArchive();
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

describe('입구 접힘 — 직전 설정이 없는 사람', () => {
  it('"새 게임"이 곧장 성별 선택으로 간다 (두 갈래를 보지 않는다)', () => {
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('새 게임'));
    expect(screen.getByLabelText('남자 주인공으로 시작')).toBeTruthy();
    expect(screen.queryByText('같은 집에서 다시')).toBeNull();
  });

  it('손상된 설정도 없는 것으로 취급한다 (부분 복구로 화면을 열지 않는다)', () => {
    localStorage.setItem('lifetrack_last_setup', JSON.stringify({ gender: 'male', parents: ['strict'] }));
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('새 게임'));
    expect(screen.getByLabelText('남자 주인공으로 시작')).toBeTruthy();
    expect(screen.queryByText('같은 집에서 다시')).toBeNull();
  });
});

describe('입구 — 직전 설정이 있는 사람', () => {
  beforeEach(() => {
    saveLastSetup({ gender: 'male', parents: PARENTS, useReducedRecovery: false });
  });

  // 접힌 입구를 알리는 **유일한** 사전 신호다. 사라지면 두 갈래가 있다는 걸 아무도 모른다.
  it('"새 게임" 버튼이 두 갈래가 있다는 것을 미리 알린다', () => {
    render(<TitleScreen />);
    expect(screen.getByText('같은 집에서 다시 / 처음부터')).toBeTruthy();
  });

  it('"새 게임"을 누르면 두 갈래가 나온다', () => {
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('새 게임'));
    expect(screen.getByText('같은 집에서 다시')).toBeTruthy();
    expect(screen.getByText('처음부터 고르기')).toBeTruthy();
  });

  it('무엇이 "같은" 집인지 고른 기억으로 보여준다', () => {
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('새 게임'));
    // strict / emotional 의 scene 문장. 라벨 표를 새로 만들지 않고 MEMORIES를 그대로 쓴다.
    expect(screen.getByText(/공부 먼저/)).toBeTruthy();
    expect(screen.getByText(/오늘 학교 어땠어/)).toBeTruthy();
  });

  it('누르면 그 설정으로 판이 시작된다', () => {
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('새 게임'));
    fireEvent.click(screen.getByText('같은 집에서 다시'));
    const s = started();
    expect(s, '세이브가 없으면 확인 없이 바로 시작한다').not.toBeNull();
    expect(s!.gender).toBe('male');
    expect(s!.parents).toEqual(PARENTS);
    expect(s!.year).toBe(1);
    expect(s!.week).toBe(1);
  });

  it('도전 모드도 함께 물려받는다', () => {
    saveLastSetup({ gender: 'female', parents: ['wealth', 'info'], useReducedRecovery: true });
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('새 게임'));
    fireEvent.click(screen.getByText('같은 집에서 다시'));
    expect(started()!.useReducedRecovery).toBe(true);
  });

  it('"처음부터 고르기"는 평소 흐름으로 보낸다', () => {
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('새 게임'));
    fireEvent.click(screen.getByText('처음부터 고르기'));
    expect(screen.getByLabelText('남자 주인공으로 시작')).toBeTruthy();
    expect(started()).toBeNull();
  });
});

describe('덮어쓰기 확인 — 두 입구가 같은 다이얼로그를 쓴다', () => {
  it('진행 중 세이브가 있으면 "같은 집에서 다시"도 먼저 묻는다', () => {
    saveLastSetup({ gender: 'male', parents: PARENTS, useReducedRecovery: false });
    seedSave({ year: 3, week: 12 });
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('새 게임'));
    fireEvent.click(screen.getByText('같은 집에서 다시'));
    expect(started(), '묻기 전에 시작하면 진행 중인 판이 사라진다').toBeNull();
    expect(screen.getByText(/진행 중인 저장이 있어요/)).toBeTruthy();

    fireEvent.click(screen.getByText('새로 시작'));
    expect(started()!.parents).toEqual(PARENTS);
  });

  it('취소하면 시작하지 않는다', () => {
    saveLastSetup({ gender: 'male', parents: PARENTS, useReducedRecovery: false });
    seedSave({ year: 3, week: 12 });
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('새 게임'));
    fireEvent.click(screen.getByText('같은 집에서 다시'));
    fireEvent.click(screen.getByText('취소'));
    expect(started()).toBeNull();
    expect(screen.getByText('같은 집에서 다시'), '취소는 두 갈래 화면에 머문다').toBeTruthy();
  });

  // 두 갈래가 같은 다이얼로그를 쓰는데, 테스트가 전부 "같은 집에서 다시"만 눌러서
  // `handleStart → requestStart('select')` 경로는 어느 테스트도 지나지 않았다.
  // 그 경로가 확인을 건너뛰도록 바뀌어도 전부 초록이었다(검수 지적).
  it('"처음부터 고르기"로 고른 경우에도 먼저 묻는다', () => {
    saveLastSetup({ gender: 'male', parents: PARENTS, useReducedRecovery: false });
    seedSave({ year: 3, week: 12 });
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('새 게임'));
    fireEvent.click(screen.getByText('처음부터 고르기'));
    fireEvent.click(screen.getByLabelText('남자 주인공으로 시작'));
    fireEvent.click(screen.getByText('기억을 더듬어본다'));
    const cards = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'))
      .filter(c => c.getAttribute('aria-label') === null);
    fireEvent.click(cards[0]);
    fireEvent.click(cards[1]);
    fireEvent.click(screen.getByText('그래, 그런 집이었지'));
    expect(started(), '묻기 전에 시작하면 진행 중인 판이 사라진다').toBeNull();
    expect(screen.getByText(/진행 중인 저장이 있어요/)).toBeTruthy();
    fireEvent.click(screen.getByText('새로 시작'));
    expect(started()).not.toBeNull();
  });

  it('끝난 판이면 문구가 다르다 ("진행 중"이라고 말하지 않는다)', () => {
    saveLastSetup({ gender: 'male', parents: PARENTS, useReducedRecovery: false });
    seedSave({ phase: 'ending', year: 8, week: 1 });
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('새 게임'));
    fireEvent.click(screen.getByText('같은 집에서 다시'));
    expect(screen.queryByText(/진행 중인 저장이 있어요/)).toBeNull();
    expect(screen.getByText(/엔딩은 다시 볼 수 없어요/)).toBeTruthy();
  });
});

describe('끝난 판의 이어하기', () => {
  it('진행 중이면 "이어하기 · N년차 M주차"다', () => {
    seedSave({ year: 3, week: 12 });
    render(<TitleScreen />);
    expect(screen.getByText('이어하기')).toBeTruthy();
    expect(screen.getByText('3년차 12주차')).toBeTruthy();
  });

  it('끝난 판이면 "엔딩 다시 보기"이고 학년 표기가 사라진다', () => {
    seedSave({ phase: 'ending', year: 8, week: 1 });
    render(<TitleScreen />);
    expect(screen.getByText('엔딩 다시 보기')).toBeTruthy();
    expect(screen.queryByText('이어하기')).toBeNull();
    // 7년 게임에 "8년차"가 뜨던 자리 — 엔딩 진입에서 year++가 되기 때문이다.
    expect(document.body.textContent).not.toContain('8년차');
  });

  it('눌러도 기능은 그대로다 (엔딩 화면으로 들어간다)', () => {
    seedSave({ phase: 'ending', year: 8, week: 1 });
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('엔딩 다시 보기'));
    expect(started()!.phase).toBe('ending');
  });
});

describe('기록실에서 새 판을 출발시킨다', () => {
  it('버튼을 누르면 두 갈래 화면이 열린다', async () => {
    saveLastSetup({ gender: 'male', parents: PARENTS, useReducedRecovery: false });
    accrueResolvedEvent(Object.assign(createInitialState('male', PARENTS, { rngSeed: 1 }), {
      events: [{ id: 'a', title: 'a', description: '', choices: [] }],
    }) as GameState);
    render(<TitleScreen />);
    fireEvent.click(screen.getByRole('button', { name: /기록실/ }));
    const startBtn = await waitFor(() => screen.getByText('새 학창시절 시작하기'));
    // 이 화면은 하단 버튼이 하나였어서 간격 규칙이 없었다(`.btn`에 margin이 없다).
    // 두 개가 되는 순간 0px로 맞붙은 것이 실측으로 드러났다.
    const column = startBtn.closest('button')!.parentElement!;
    expect(column.style.gap, '두 버튼이 맞붙으면 경계가 사라진다').toBe('10px');
    fireEvent.click(startBtn);
    expect(screen.getByText('같은 집에서 다시')).toBeTruthy();
  });
});
