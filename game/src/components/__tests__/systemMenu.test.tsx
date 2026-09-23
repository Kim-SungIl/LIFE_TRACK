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
import { Dialog } from '../Dialog';
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
    expect(save.kind, '세이브를 지우면 그 판이 사라진다 — 라벨이 거짓말이 된다').toBe('ok');
    const data = save.kind === 'ok' ? save.data : null;
    expect(data!.state.year).toBe(2);
    expect(data!.state.week).toBe(10);
  });

  it('닫기는 아무것도 바꾸지 않는다 (음성 짝)', () => {
    seedAndMount(inPlay());
    pressBack();
    fireEvent.click(screen.getByText('닫기'));
    expect(useGameStore.getState().state, '닫기가 게임을 끝내면 안 된다').not.toBeNull();
    expect(loadFromStorage().kind).toBe('ok');
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

// **다른 모달 위에 떠도 최상위로 동작하는가.**
//
// 처음에는 포커스 트랩과 Escape를 SystemMenu가 직접 구현했다. 그러면 이 메뉴가 `Dialog`의
// `dialogStack` 밖에 서고, 상점 같은 기존 Dialog가 열린 채 뒤로가기를 누르면 그 쪽의
// **캡처 단계** 핸들러(Dialog.tsx:116)가 먼저 받아 `stopPropagation`으로 전파를 끊는다.
// 3자 검수가 브라우저로 재현한 증상: Tab이 보이지 않는 상점으로 새고, Escape가 메뉴가 아니라
// **상점을 닫았다**(메뉴를 닫으려면 두 번 눌러야 했다). aria-modal 둘이 동시에 뜬 채
// 둘 다 inert가 아니기도 했다.
//
// 메뉴를 단독 렌더하는 테스트는 이 상황을 **원리상 못 본다** — 그래서 아래는 항상 둘을 함께 띄운다.
describe('다른 다이얼로그 위에서도 최상위다', () => {
  function renderStacked() {
    const onMenuClose = vi.fn();
    const onShopClose = vi.fn();
    const r = render(
      <>
        <Dialog onClose={onShopClose} ariaLabel="상점">
          <button type="button">🏪 편의점</button>
          <button type="button">📚 서점/장비</button>
        </Dialog>
        <SystemMenu onExit={vi.fn()} onClose={onMenuClose} />
      </>,
    );
    return { ...r, onMenuClose, onShopClose };
  }

  it('Escape가 아래 다이얼로그가 아니라 메뉴를 닫는다', () => {
    const { onMenuClose, onShopClose } = renderStacked();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onMenuClose, '메뉴가 최상위인데 안 닫히면 스택 밖에 서 있는 것이다').toHaveBeenCalled();
    expect(onShopClose, '아래 상점이 닫히면 사용자가 누른 적 없는 것을 닫은 셈이다').not.toHaveBeenCalled();
  });

  it('Tab이 아래 다이얼로그로 새지 않는다', () => {
    const { container } = renderStacked();
    const menu = screen.getByRole('dialog', { name: '메뉴' });
    const items = [...menu.querySelectorAll<HTMLElement>('button')];
    expect(items.length, '가둘 요소가 없으면 이 계약은 의미가 없다').toBeGreaterThan(1);

    items[items.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(menu.contains(document.activeElement),
      '포커스가 보이지 않는 상점으로 넘어가면 키보드 사용자는 길을 잃는다').toBe(true);

    // 아래 다이얼로그는 inert 처리돼야 한다 — aria-modal 둘이 다 살아 있으면 거짓말이다.
    const shop = screen.getByRole('dialog', { name: '상점', hidden: true });
    expect(shop.inert, '아래 다이얼로그가 inert가 아니면 보조기술에 둘 다 열린 것으로 보인다').toBe(true);
    expect(container).toBeTruthy();
  });
});

// 저장이 죽었을 때 라벨이 **참인가**. `exitToTitle`은 메모리 state를 버리므로
// 마지막 성공 저장 이후의 진행이 사라진다. 상태 전환이라 beforeunload도 안 뜬다 —
// 여기서 말하지 않으면 아무 데서도 안 말한다.
describe('저장이 죽었으면 라벨이 그렇게 말한다', () => {
  it('저장 실패 중에는 "저장돼 있어요"라고 하지 않는다', () => {
    render(<SystemMenu onExit={vi.fn()} onClose={vi.fn()} saveFailed />);
    expect(screen.queryByText(/진행은 저장돼 있어요/),
      '저장이 안 되는데 저장됐다고 하면 사용자가 진행을 잃는다').toBeNull();
    expect(screen.getByText(/최근 진행이 사라져요/)).toBeTruthy();
  });

  // 음성 짝 — 상시 경고는 경고가 아니다.
  it('저장이 멀쩡하면 평소 문구 그대로다', () => {
    render(<SystemMenu onExit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/진행은 저장돼 있어요/)).toBeTruthy();
    expect(screen.queryByText(/최근 진행이 사라져요/)).toBeNull();
  });

  it('GameScreen이 저장 실패 상태를 메뉴에 넘긴다 (배선)', () => {
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
      act(() => { useGameStore.setState({ state: { ...useGameStore.getState().state! } }); });
      pressBack();
      // prop을 만드는 층이 빠지면 SystemMenu 단독 테스트는 원리상 못 잡는다(#431 전례).
      expect(screen.getByText(/최근 진행이 사라져요/),
        'GameScreen이 saveFailed를 안 넘기면 메뉴는 영원히 거짓말한다').toBeTruthy();
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

// z-index와 align은 렌더 결과에 나타나지만 **아무것도 단언하지 않고 있었다** — 실측으로
// `zIndex={300}`을 100으로, `align="bottom"`을 center로 바꿔도 전부 초록이었다.
// 300을 내리면 메뉴가 상점·슬롯 편집기 **아래로 깔린다**(키보드는 DOM 스택 기준이라 정상
// 동작하므로 테스트가 더더욱 안 걸린다 — 사용자는 안 보이는 메뉴를 조작하게 된다).
describe('메뉴는 다른 다이얼로그보다 위에 그려진다', () => {
  /** 소스에서 `<Dialog ... zIndex={N}>`을 전부 긁는다 — 숫자를 박으면 새 다이얼로그가 늘 때 늙는다. */
  function dialogZIndexes(): { file: string; z: number }[] {
    const files = import.meta.glob('../**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const out: { file: string; z: number }[] = [];
    for (const [file, src] of Object.entries(files)) {
      if (file.includes('__tests__')) continue;
      // `<Dialog` 여는 태그 안의 zIndex만 본다(다른 컴포넌트의 인라인 zIndex와 섞이지 않게).
      for (const tag of src.match(/<Dialog[\s\S]*?>/g) ?? []) {
        const m = tag.match(/zIndex=\{(\d+)\}/);
        if (m) out.push({ file, z: Number(m[1]) });
      }
    }
    return out;
  }

  it('메뉴의 z가 앱 안 모든 다이얼로그보다 높다', () => {
    const all = dialogZIndexes();
    expect(all.length, '코퍼스가 비면 이 검사는 공허하게 참이 된다').toBeGreaterThan(1);

    const menu = all.filter(d => d.file.includes('SystemMenu'));
    expect(menu.length, 'SystemMenu가 zIndex를 명시하지 않으면 Dialog 기본값(100)으로 깔린다').toBe(1);

    const others = all.filter(d => !d.file.includes('SystemMenu'));
    const highest = Math.max(...others.map(d => d.z));
    expect(menu[0].z,
      `메뉴 z=${menu[0].z}인데 다른 다이얼로그 최대가 ${highest}다 — 메뉴가 그 아래로 깔린다`)
      .toBeGreaterThan(highest);
  });

  it('렌더된 메뉴가 아래 다이얼로그보다 실제로 위다', () => {
    render(
      <>
        <Dialog onClose={vi.fn()} ariaLabel="상점" zIndex={250}>
          <button type="button">🏪 편의점</button>
        </Dialog>
        <SystemMenu onExit={vi.fn()} onClose={vi.fn()} />
      </>,
    );
    const z = (name: string) => {
      const el = screen.getByRole('dialog', { name, hidden: true });
      // Dialog는 오버레이에 zIndex를 건다 — 다이얼로그 자신 또는 그 조상에서 찾는다.
      for (let n: HTMLElement | null = el; n; n = n.parentElement) {
        if (n.style.zIndex) return Number(n.style.zIndex);
      }
      return NaN;
    };
    expect(z('메뉴'), '메뉴가 아래 다이얼로그보다 낮으면 사용자는 안 보이는 것을 조작한다')
      .toBeGreaterThan(z('상점'));
  });

  it('메뉴는 화면 아래에 붙는 바텀시트다', () => {
    render(<SystemMenu onExit={vi.fn()} onClose={vi.fn()} />);
    const el = screen.getByRole('dialog', { name: '메뉴' });
    let align = '';
    for (let n: HTMLElement | null = el; n && !align; n = n.parentElement) {
      if (n.style.alignItems) align = n.style.alignItems;
    }
    expect(align, 'center로 바뀌면 엄지가 닿는 자리에서 화면 한가운데로 올라간다').toBe('flex-end');
  });
});
