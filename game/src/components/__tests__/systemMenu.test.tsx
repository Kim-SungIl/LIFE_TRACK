// @vitest-environment jsdom
// 플레이 중 **나가는 길이 존재하는가**. (#445)
//
// 예전에는 없었다. GameScreen이 마운트되면 popstate마다 무조건 history를 다시 push해서
// 뒤로가기가 전 구간(주차·이벤트·결산·학년말)에서 먹혔고, `exitToTitle`은 엔딩 화면에만
// 연결돼 있었다. `beforeunload`도 무조건 걸려 새로고침마다 확인창이 떴다.
// 둘이 합쳐지면 **플레이 중 탭을 떠나는 정상 경로가 0개**였다.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => `WEBP::${p}` }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
vi.mock('../../engine/assetPrefetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../engine/assetPrefetch')>()),
  runWhenIdle: () => () => {},
}));

import { GameScreen } from '../GameScreen';
import { SystemMenu } from '../SystemMenu';
import { useGameStore, loadFromStorage } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { CURRENT_SAVE_VERSION } from '../../engine/stateMigration';
import { clearArchive } from '../../engine/archive';
import type { GameState } from '../../engine/types';

function inPlay(patch: Partial<GameState> = {}): GameState {
  const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 11 });
  return { ...s, year: 2, week: 10, routineSlot2: 'self-study', ...patch };
}

function seedAndMount(state: GameState) {
  localStorage.setItem('lifetrack_save', JSON.stringify({
    version: CURRENT_SAVE_VERSION, state, savedAt: new Date().toISOString(),
  }));
  useGameStore.setState({ state, runDelta: null, npcActivityMap: {} });
  return render(<GameScreen />);
}

/** 브라우저 뒤로가기 제스처. */
function pressBack() {
  act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
}

beforeEach(() => {
  clearArchive();
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  localStorage.setItem('lifetrack_tutorial_done', '1');
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

describe('뒤로가기가 메뉴를 연다', () => {
  it('플레이 중 뒤로가기 → 메뉴', () => {
    seedAndMount(inPlay());
    expect(screen.queryByRole('dialog', { name: '메뉴' }), '전제: 처음엔 메뉴가 닫혀 있다').toBeNull();
    pressBack();
    expect(screen.getByRole('dialog', { name: '메뉴' }),
      '아무 반응이 없으면 모바일에서 "먹통 앱"으로 읽힌다').toBeTruthy();
  });

  // 소비하고 다시 push하지 않으면 두 번째 뒤로가기에 페이지를 떠난다.
  it('메뉴를 닫고 다시 뒤로가기를 눌러도 또 열린다', () => {
    seedAndMount(inPlay());
    pressBack();
    fireEvent.click(screen.getByText('닫기'));
    expect(screen.queryByRole('dialog', { name: '메뉴' })).toBeNull();
    pressBack();
    expect(screen.getByRole('dialog', { name: '메뉴' })).toBeTruthy();
  });

  // 마운트 시 더미 항목을 쌓아야 **첫** 뒤로가기가 페이지를 안 떠난다.
  // 이게 없으면 메뉴가 열릴 기회 자체가 없다(브라우저가 먼저 나가 버린다).
  it('마운트할 때 history에 더미를 쌓는다', () => {
    const spy = vi.spyOn(window.history, 'pushState');
    try {
      seedAndMount(inPlay());
      expect(spy, '더미가 없으면 첫 뒤로가기에 바로 페이지를 떠난다').toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  // **뒤로가기를 소비해야 한다.** 합성 popstate만 쏘면 이 절을 못 본다 —
  // 재push가 없으면 history가 소진돼 두 번째 뒤로가기에 실제로 페이지를 떠난다
  // (그러면 메뉴를 만든 의미가 없다: 한 번은 열리고 그 다음엔 그냥 나가진다).
  it('뒤로가기를 소비해 history를 다시 쌓는다', () => {
    seedAndMount(inPlay());
    const spy = vi.spyOn(window.history, 'pushState');
    try {
      pressBack();
      expect(spy, '재push가 없으면 다음 뒤로가기에 페이지를 떠난다').toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  // 이벤트·결산 화면에서도 나갈 수 있어야 한다 — 뒤로가기는 전 구간에서 먹히므로
  // 응답도 전 구간에서 해야 한다.
  it('이벤트 화면에서도 열린다', () => {
    const s = inPlay();
    seedAndMount({ ...s, phase: 'event' as GameState['phase'] });
    pressBack();
    expect(screen.getByRole('dialog', { name: '메뉴' })).toBeTruthy();
  });
});

describe('HUD의 보이는 진입점', () => {
  // 데스크톱에는 뒤로가기 제스처가 없다. 버튼이 없으면 그쪽은 여전히 길이 없다.
  it('HUD 메뉴 버튼이 같은 메뉴를 연다', () => {
    seedAndMount(inPlay());
    fireEvent.click(screen.getByLabelText('메뉴 열기'));
    expect(screen.getByRole('dialog', { name: '메뉴' })).toBeTruthy();
  });
});

describe('나가기는 세이브를 남긴다', () => {
  it('타이틀로 나가도 세이브가 그대로다 (라벨이 그렇게 약속한다)', () => {
    const s = inPlay();
    seedAndMount(s);
    pressBack();
    expect(screen.getByText(/진행은 저장돼 있어요/), '약속 문구가 없으면 누르기 무섭다').toBeTruthy();
    fireEvent.click(screen.getByText(/타이틀로 나가기/));

    expect(useGameStore.getState().state, '나갔으면 App이 타이틀을 그린다').toBeNull();
    const save = loadFromStorage();
    expect(save, '세이브를 지우면 그 판이 사라진다 — 라벨이 거짓말이 된다').not.toBeNull();
    expect(save!.state.year).toBe(2);
    expect(save!.state.week).toBe(10);
  });

  it('닫기는 아무것도 바꾸지 않는다 (음성 짝)', () => {
    seedAndMount(inPlay());
    pressBack();
    fireEvent.click(screen.getByText('닫기'));
    expect(useGameStore.getState().state, '닫기가 게임을 끝내면 안 된다').not.toBeNull();
    expect(loadFromStorage()).not.toBeNull();
  });
});

describe('새로고침 경고는 저장이 실패했을 때만', () => {
  // 예전엔 무조건 preventDefault라 매번 확인창이 떴다. 이 게임은 state 변경마다 동기로
  // 저장하므로 평소엔 새로고침으로 잃을 게 없다 — 브라우저 문구가 거짓말이었다.
  function fireBeforeUnload(): boolean {
    const e = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  }

  it('저장이 멀쩡하면 확인창을 띄우지 않는다', () => {
    seedAndMount(inPlay());
    expect(fireBeforeUnload(), '평소 새로고침까지 막으면 나가는 길이 또 하나 닫힌다').toBe(false);
  });

  it('저장이 죽었으면 막는다 (양성 짝)', () => {
    seedAndMount(inPlay());
    const orig = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const mem = new Map<string, string>();
    const fake: Storage = {
      get length() { return mem.size; },
      key: (i: number) => [...mem.keys()][i] ?? null,
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: (k: string) => { mem.delete(k); },
      clear: () => { mem.clear(); },
    };
    Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true });
    try {
      // 저장 시도를 한 번 일으켜 플래그를 세운다(자동 저장은 state 변경 구독에서 돈다).
      act(() => { useGameStore.setState({ state: { ...useGameStore.getState().state! } }); });
      expect(fireBeforeUnload(), '저장이 진짜 안 되는 환경에서는 경고가 참이다').toBe(true);
    } finally {
      if (orig) Object.defineProperty(globalThis, 'localStorage', orig);
      else delete (globalThis as unknown as Record<string, unknown>).localStorage;
    }
  });
});

// **aria-modal을 선언했으면 실제로 가둬야 한다.** 이 리포에는 선언만 해 놓고 뒤 요소가
// 전부 탭 순서에 남아 있는 자리가 있다(EventScene의 선택 안내) — 스크린리더에 거짓말을 한다.
describe('모달 계약 — 선언한 대로 동작한다', () => {
  function renderMenu(onExit = vi.fn(), onClose = vi.fn()) {
    const r = render(<SystemMenu onExit={onExit} onClose={onClose} />);
    return { ...r, onExit, onClose };
  }

  it('열리면 포커스가 안으로 들어온다', () => {
    const { container } = renderMenu();
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.contains(document.activeElement),
      '포커스가 밖에 남으면 키보드 사용자는 보이지 않는 버튼 사이를 헤맨다').toBe(true);
  });

  it('Escape로 닫힌다', () => {
    const { onClose } = renderMenu();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('Tab이 마지막에서 처음으로 감긴다 (밖으로 안 빠진다)', () => {
    const { container } = renderMenu();
    const dialog = container.querySelector('[role="dialog"]')!;
    const items = [...dialog.querySelectorAll<HTMLElement>('button')];
    expect(items.length, '가둘 요소가 없으면 이 계약은 의미가 없다').toBeGreaterThan(1);
    items[items.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('Shift+Tab이 처음에서 마지막으로 감긴다', () => {
    const { container } = renderMenu();
    const dialog = container.querySelector('[role="dialog"]')!;
    const items = [...dialog.querySelectorAll<HTMLElement>('button')];
    items[0].focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it('백드롭을 누르면 닫힌다', () => {
    const { container, onClose } = renderMenu();
    fireEvent.click(container.firstChild as HTMLElement);
    expect(onClose).toHaveBeenCalled();
  });

  it('내용을 눌러도 닫히지 않는다 (음성 짝)', () => {
    const { container, onClose } = renderMenu();
    fireEvent.click(container.querySelector('[role="dialog"]')!);
    expect(onClose, '내용 클릭까지 닫히면 메뉴를 쓸 수 없다').not.toHaveBeenCalled();
  });
});
