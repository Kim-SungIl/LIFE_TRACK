// @vitest-environment jsdom
// 기록실 청크 idle prefetch. 타이틀만 배경 사진이 깔린 화면이라, 청크를 눌러서 받으면
// 사진 → 단색 fallback → 기록실의 2단 깜빡임이 된다 — 깜빡임을 막으려는 fallback이
// 여기선 깜빡임을 만든다. 예약을 지워도 기능은 멀쩡하므로(느려질 뿐) 다른 테스트로는 안 잡힌다.
//
// **예약 여부만 보면 절반이다.** `idleTasks.length === 1`만 단언하던 동안, 태스크 본문의
// `void import('./screens/ArchiveScreen')` 한 줄을 지워도 878개가 전부 통과했다(검수 실측).
// 그래서 태스크를 **실제로 실행해** 그 모듈이 요청됐는지까지 센다.
//
// 이 파일은 ArchiveScreen을 mock으로 대체한다 — 팩토리 호출 수가 곧 "받았는가"다.
// 그래서 진짜 ArchiveScreen을 렌더하는 테스트를 여기 두면 안 된다.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => `WEBP::${p}` }));

// 팩토리는 호이스팅되므로 카운터는 vi.hoisted 경유로 만든다.
const { loads, idleTasks } = vi.hoisted(() => ({
  loads: { n: 0 },
  idleTasks: [] as Array<() => void>,
}));

// 모듈이 실제로 로드될 때만 팩토리가 돈다(vitest가 결과를 캐시하므로 첫 로드에 1회).
vi.mock('../screens/ArchiveScreen', () => {
  loads.n++;
  return { ArchiveScreen: () => null };
});

// idle 예약을 붙잡아 둔다 — 실행 시점을 테스트가 정해야 "예약 전 0회 → 실행 후 1회"를 볼 수 있다.
vi.mock('../../engine/assetPrefetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../engine/assetPrefetch')>()),
  runWhenIdle: (task: () => void) => { idleTasks.push(task); return () => {}; },
}));

import { TitleScreen } from '../TitleScreen';
import { clearArchive, accrueResolvedEvent } from '../../engine/archive';
import { useGameStore } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import type { GameEvent, GameState, ParentStrength } from '../../engine/types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const ev = (id: string): GameEvent =>
  ({ id, title: id, description: '', choices: [] }) as GameEvent;

function state(overrides: Partial<GameState> = {}): GameState {
  const s = createInitialState('male', PARENTS, { rngSeed: 12345 });
  s.events = [];
  s.talkEventsFired = [];
  return Object.assign(s, overrides);
}

function withArchive() {
  accrueResolvedEvent(state({ events: [ev('a')] }));
}

beforeEach(() => {
  clearArchive();
  localStorage.clear();
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
  idleTasks.length = 0;
  loads.n = 0;
});

describe('기록실 청크 idle prefetch', () => {
  it('기록실이 열려 있으면 idle에 예약한다', () => {
    withArchive();
    render(<TitleScreen />);
    expect(idleTasks.length, '예약이 없다 — 진입 때 fallback이 번쩍인다').toBe(1);
  });

  // 조건을 지워 늘 prefetch하게 만들면 위 테스트는 그대로 통과한다. 첫 플레이어에게는
  // 그 판에 영원히 안 쓸 청크라 받지 않아야 한다.
  it('기록실이 없는 사람에겐 예약하지 않는다', () => {
    render(<TitleScreen />);
    expect(idleTasks.length, '버튼도 없는데 기록실 청크를 받는다').toBe(0);
  });

  // **여기가 본문을 잠근다.** 잡아야 할 변조: ⓐ `void import(...)` 줄 삭제(예약만 남음)
  // ⓑ 다른 모듈로 교체(`./screens/EndingScreen`). 둘 다 위 두 테스트로는 그린이다.
  it('예약된 태스크를 실행하면 기록실 모듈을 실제로 받는다', async () => {
    withArchive();
    render(<TitleScreen />);
    expect(loads.n, '렌더만으로 이미 받았다면 이 테스트가 아무것도 구분하지 못한다').toBe(0);

    idleTasks[0]!();

    await vi.waitFor(() => {
      expect(loads.n, '태스크가 기록실 모듈을 받지 않았다 (본문이 비었거나 다른 모듈을 가리킨다)')
        .toBe(1);
    });
  });
});
