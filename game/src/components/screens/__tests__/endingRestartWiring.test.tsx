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
import { useGameStore, loadFromStorage, isStorageSaveFailed } from '../../../engine/store';
import { saveLastSetup, loadLastSetup } from '../../../engine/lastSetup';
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

/**
 * 저장이 죽은 환경(사파리 프라이빗 · 용량 초과)을 만든다. 반환값을 부르면 되돌린다.
 *
 * **전역 자체를 갈아끼운다.** 인스턴스의 setItem만 덮는 방식은 환경을 탄다. 실측:
 * 로컬(Node 25 shim)의 localStorage는 평범한 Object라 메서드 대입이 먹지만, CI(jsdom)의
 * 것은 진짜 Storage **프록시**라 `localStorage.setItem = fn`이 속성 정의가 아니라
 * **저장소 키 쓰기**로 처리된다 — 던지지 않고 조용히 통과했다.
 * 아래 전제 단언이 없었으면 "저장이 멀쩡한 화면"을 보고 초록이 났을 것이다.
 *
 * 읽기는 살려 둔다 — 세이브 로드와 튜토리얼 플래그가 돌아야 화면이 정상 렌더된다.
 */
function breakStorage(): () => void {
  const orig = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const mem = new Map<string, string>();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k !== null) mem.set(k, localStorage.getItem(k) ?? '');
  }
  const fake: Storage = {
    get length() { return mem.size; },
    key: (i: number) => [...mem.keys()][i] ?? null,
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: (k: string) => { mem.delete(k); },
    clear: () => { mem.clear(); },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true });
  return () => {
    // own 서술자가 있으면 그대로 되돌리고(로컬·jsdom 둘 다 여기), 없던 환경이라면
    // 우리가 씌운 그림자를 걷어 프로토타입의 접근자를 되살린다.
    // 복원이 새면 이 파일의 뒤 테스트가 전부 "저장 죽은" 화면을 보게 된다.
    if (orig) Object.defineProperty(globalThis, 'localStorage', orig);
    else delete (globalThis as unknown as Record<string, unknown>).localStorage;
  };
}

beforeEach(() => {
  clearArchive();
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  // isStorageSaveFailed()는 모듈 전역이고 **성공 저장으로만** 내려간다. 저장 실패 케이스가
  // 뒤 테스트의 문구를 조용히 바꾸지 않게, 매번 성공 저장을 한 번 일으켜 되돌린다.
  useGameStore.setState({ state: endedState(), runDelta: null, npcActivityMap: {} });
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
  localStorage.removeItem('lifetrack_save');
});

describe('EndingScreen — 버튼 존재 계약', () => {
  function renderEnding(onRestartSameHome: (() => void) | null, onExitToTitle = () => {}, saveFailed = false) {
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
        saveFailed={saveFailed}
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

  it('도전 모드가 아니면 그 말을 붙이지 않는다', () => {
    renderEnding(() => {});
    expect(screen.getByText(/같은 부모, 다른 7년/)).toBeTruthy();
  });

  // 바로 위 버튼이 이 엔딩의 세이브를 덮어쓴다 — 조건 없는 보증문이면 그 문장이 거짓이 된다.
  it('"다시 볼 수 있다"는 말에 조건이 붙어 있다', () => {
    renderEnding(() => {});
    expect(screen.getByText(/나가면 이 엔딩을 다시 볼 수 있어요/)).toBeTruthy();
  });

  // 저장이 죽은 환경(사파리 프라이빗·용량 초과)에서는 세이브가 없거나 낡아서 타이틀의
  // "엔딩 다시 보기"가 이 엔딩을 못 가져온다. **나가는 길을 막지 않는다** — 막으면 갇힌다.
  // 대신 약속을 경고로 바꾼다. 이 락이 없으면 화면이 못 지킬 말을 계속 한다.
  it('저장이 죽었으면 "다시 볼 수 있다"고 말하지 않는다', () => {
    renderEnding(() => {}, () => {}, true);
    expect(screen.queryByText(/나가면 이 엔딩을 다시 볼 수 있어요/)).toBeNull();
    expect(screen.getByText(/나가면 이 엔딩은 사라져요/)).toBeTruthy();
    expect(screen.getByText('타이틀로'), '경고가 나가는 길을 없애면 안 된다').toBeTruthy();
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

  // **근거가 state라는 것이 이 테스트의 요점이다.** 저장된 "직전 판 설정"을 일부러 다르게
  // 심어 두고, 새 판이 그것이 아니라 **방금 끝낸 판**을 따라가는지 본다.
  it('"같은 집에서 다시"가 방금 끝낸 판의 설정으로 시작한다 (저장값이 아니라)', async () => {
    saveLastSetup({ gender: 'female', parents: ['wealth', 'info'], useReducedRecovery: true });
    seedSaveAndState();   // 이 판은 male / strict·emotional / 도전 모드 아님
    render(<GameScreen />);
    fireEvent.click(await waitFor(() => screen.getByText('같은 집에서 다시')));

    const s = useGameStore.getState().state!;
    expect(s.phase, '엔딩에 머물러 있으면 아무것도 시작되지 않은 것이다').not.toBe('ending');
    expect(s.year).toBe(1);
    expect(s.week).toBe(1);
    expect(s.gender).toBe('male');
    expect(s.parents).toEqual(PARENTS);
    expect(s.useReducedRecovery).toBeFalsy();
  });

  it('도전 모드로 끝낸 판은 도전 모드로 다시 시작하고, 그 사실을 화면에 밝힌다', async () => {
    const state = endedState();
    state.useReducedRecovery = true;
    localStorage.setItem('lifetrack_save', JSON.stringify({
      version: CURRENT_SAVE_VERSION, state, savedAt: new Date().toISOString(),
    }));
    useGameStore.setState({ state, runDelta: null, npcActivityMap: {} });
    render(<GameScreen />);
    await waitFor(() => screen.getByText('같은 집에서 다시'));
    expect(screen.getByText(/도전 모드/), '이월되는데 말하지 않으면 자리마다 다른 말을 한다').toBeTruthy();
    fireEvent.click(screen.getByText('같은 집에서 다시'));
    expect(useGameStore.getState().state!.useReducedRecovery).toBe(true);
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

  // 구세이브(`lifetrack_last_setup`이 배포되기 전에 저장한 사람)는 이어하기로 완주할 수 있다.
  // 그때 저장된 설정은 없지만 state에는 다 있다 — 기능이 존재하는 바로 그 순간에
  // 입구를 잃지 않아야 한다.
  it('구세이브로 엔딩에 와도 이 판의 설정으로 다시 시작할 수 있다', async () => {
    seedSaveAndState();   // saveLastSetup 호출 없음
    expect(loadLastSetup(), '전제: 저장된 직전 설정이 없다').toBeNull();
    render(<GameScreen />);
    fireEvent.click(await waitFor(() => screen.getByText('같은 집에서 다시')));
    const s = useGameStore.getState().state!;
    expect(s.year).toBe(1);
    expect(s.parents).toEqual(PARENTS);
  });

  // **prop 계약만으로는 부족하다**: GameScreen이 saveFailed를 안 넘겨도 위 테스트는 초록이다
  // (prop을 만드는 층의 누락은 prop을 받는 테스트가 원리상 못 잡는다 — #431).
  // 그래서 실제로 스토리지를 죽여 놓고 화면 문구를 본다.
  it('스토리지가 죽으면 엔딩 문구가 경고로 바뀐다 (배선까지)', async () => {
    seedSaveAndState();
    const restore = breakStorage();
    try {
      // 저장 시도를 한 번 일으켜 플래그를 세운다(자동 저장은 state 변경 구독에서 돈다).
      useGameStore.setState({ state: { ...useGameStore.getState().state! } });
      expect(isStorageSaveFailed(), '전제: 저장이 실패한 상태여야 한다').toBe(true);
      render(<GameScreen />);
      await waitFor(() => screen.getByText('타이틀로'));
      expect(screen.getByText(/나가면 이 엔딩은 사라져요/)).toBeTruthy();
      expect(screen.queryByText(/나가면 이 엔딩을 다시 볼 수 있어요/)).toBeNull();
    } finally {
      restore();
    }
  });

  // 양성 짝 — 저장이 멀쩡하면 원래 약속을 그대로 한다(경고가 상시 켜져 있으면 무의미하다).
  it('저장이 멀쩡하면 원래 약속을 그대로 한다', async () => {
    seedSaveAndState();
    expect(isStorageSaveFailed(), '전제: 저장이 성공한 상태여야 한다').toBe(false);
    render(<GameScreen />);
    await waitFor(() => screen.getByText('타이틀로'));
    expect(screen.getByText(/나가면 이 엔딩을 다시 볼 수 있어요/)).toBeTruthy();
    expect(screen.queryByText(/나가면 이 엔딩은 사라져요/)).toBeNull();
  });

  // 음성 짝 — 부모가 망가진 병리적 세이브에서는 누를 것을 그리지 않는다.
  it('부모가 망가진 세이브면 재시작 버튼이 없다 (나가는 길은 남는다)', async () => {
    const state = endedState();
    (state as unknown as { parents: unknown }).parents = ['strict'];
    useGameStore.setState({ state, runDelta: null, npcActivityMap: {} });
    render(<GameScreen />);
    await waitFor(() => screen.getByText('타이틀로'));
    expect(screen.queryByText('같은 집에서 다시')).toBeNull();
  });
});
