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
// `ever`는 beforeEach에서 **되돌리지 않는다** — 아래 순서 함정을 정확히 진단하기 위해서다.
const { loads, idleTasks } = vi.hoisted(() => ({
  loads: { n: 0, ever: false },
  idleTasks: [] as Array<() => void>,
}));

// 모듈이 실제로 로드될 때만 팩토리가 돈다(vitest가 결과를 캐시하므로 파일당 첫 로드에 1회).
vi.mock('../screens/ArchiveScreen', () => {
  loads.n++;
  loads.ever = true;
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

  // **계약은 "미리 받는다"가 아니라 "idle 예약으로 받는다"다.** 실시간 플러시로는
  // 이걸 못 잠근다 — idle을 우회하는 현실적인 대안 구현들이 그냥 통과한다(검수 실측 MISS):
  //   double-rAF(`다음 페인트 뒤`) · `setTimeout(..., 300)`(`첫 페인트 뒤 300ms`)
  // 그래서 시간을 **앞당겨** 본다. 태스크를 부르지 않은 채 충분히 흘려도 0이어야 한다.
  //
  // 가짜 타이머는 **대상이 타이머를 만들기 전에** 켠다 — 렌더 뒤에 켜면 이미 만들어진
  // 실제 타이머를 추적하지 못해 단언이 공허하게 통과한다(이 리포가 세 번 겪은 함정).
  it('idle 태스크를 부르지 않으면 아무리 기다려도 받지 않는다', async () => {
    vi.useFakeTimers();
    try {
      withArchive();
      render(<TitleScreen />);
      await vi.advanceTimersByTimeAsync(5000);
      expect(
        loads.n,
        'idle 예약과 무관하게 받았다 — rAF·setTimeout 등으로 우회했다(계약은 idle 예약이다)',
      ).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  // **여기가 본문을 잠근다.** 잡아야 할 변조: ⓐ `void import(...)` 줄 삭제(예약만 남음)
  // ⓑ 다른 모듈로 교체(`./screens/EndingScreen`) ⓒ **태스크 밖으로 끌어올리기**
  // (= 첫 페인트와 경쟁하며 즉시 받는다 — runWhenIdle을 쓰는 이유가 통째로 사라진다).
  //
  // ⚠ 이 테스트는 **이 파일에서 기록실 모듈을 처음 건드리는 테스트여야 한다.** vitest의
  // mock 팩토리는 파일당 1회만 돌고 모듈 레지스트리는 beforeEach로 되돌아가지 않으므로,
  // 앞선 테스트가 먼저 로드해 버리면 여기서 loads.n이 영영 안 오른다. `loads.ever`가
  // 그 상황을 "제품 결함"이 아니라 "테스트 순서 문제"로 정확히 지목한다.
  it('예약된 태스크를 실행하면 기록실 모듈을 실제로 받는다', async () => {
    withArchive();
    render(<TitleScreen />);

    // 매크로태스크까지 흘려보낸 뒤에 본다 — 이게 없으면 변조 ⓒ(태스크 밖으로 끌어올리기)가
    // 아직 도착 전이라 0으로 보여 통과한다(검수 실측: 셔플 10회 중 6회 전부 그린).
    await new Promise(r => setTimeout(r, 0));
    // 원인이 **둘**이다: 제품이 idle 밖에서 받거나, 이 파일의 앞선 테스트가 먼저 로드했거나.
    // 한쪽만 단정하면 오진한다 — 실제로 변조 ⓒ에서는 첫 테스트의 렌더가 eager import를
    // 돌려 팩토리를 소진시키므로 여기서 걸리는데, 원인은 제품 쪽이다(검수 실측).
    expect(
      loads.ever,
      '렌더만으로 이미 기록실 모듈을 받았다. ⓐ 제품이 idle 태스크 밖에서 import하거나 ' +
      'ⓑ 이 파일의 앞선 테스트가 먼저 로드했다 — TitleScreen의 effect부터 확인해라',
    ).toBe(false);
    expect(loads.n, 'idle 예약 없이 이미 받았다 — 첫 페인트와 경쟁한다').toBe(0);

    idleTasks[0]!();

    await vi.waitFor(() => {
      expect(loads.n, '태스크가 기록실 모듈을 받지 않았다 (본문이 비었거나 다른 모듈을 가리킨다)')
        .toBe(1);
    });
  });
});
