// @vitest-environment jsdom
// lazy 화면 **호출부** 배선 — Suspense 경계가 실제로 서고, 그 자리에 ScreenChunkFallback이
// 걸리는가. 컴포넌트 고립 렌더(ScreenChunkFallback.test.tsx)로는 이걸 못 본다:
// 호출부에서 `fallback={null}`로 바꿔도, 인라인 스피너 div로 갈아끼워도 878개가 전부 통과했다.
//
// **⚠ 이 파일은 순서에 민감하다.** `React.lazy`는 resolve된 payload를 모듈 인스턴스에 캐시하고
// 모듈 레지스트리는 파일 단위로 공유되므로, **같은 화면을 두 번째로 여는 렌더에는 fallback
// 프레임이 아예 존재하지 않는다.** 화면당 "여는 테스트"는 이 파일에 하나씩만 둘 것.
// (검수 실측: 기록실을 먼저 여는 테스트를 하나 앞에 넣자 즉시 실패했고, 그 메시지는
//  "Suspense 경계가 없다"라 멀쩡한 제품 코드를 고치러 가게 만든다.)
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => `WEBP::${p}` }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
// 실제 idle 예약이 돌면 청크를 미리 받아 프레임 관측이 비결정적이 된다.
vi.mock('../../engine/assetPrefetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../engine/assetPrefetch')>()),
  runWhenIdle: () => () => {},
}));

import { TitleScreen } from '../TitleScreen';
import { GameScreen } from '../GameScreen';
import { expectChunkFallback, watchFallbackWrapper, hiddenAncestor } from './chunkFallbackHelpers';
import { clearArchive, accrueResolvedEvent } from '../../engine/archive';
import { useGameStore } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { GAME_EVENTS } from '../../engine/events';
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

const fallbackEl = () => screen.queryByRole('status');

beforeEach(() => {
  clearArchive();
  localStorage.clear();
  // 첫 플레이 튜토리얼 오버레이는 이 계약과 무관한데 jsdom에 scrollIntoView가 없어 렌더가 터진다.
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

describe('타이틀 → 기록실 (이 파일에서 기록실을 여는 유일한 테스트)', () => {
  it('누르면 fallback이 서고, 청크가 오면 기록실이 뜬다', async () => {
    accrueResolvedEvent(state({ events: [ev('a')] }));
    render(<TitleScreen />);
    expect(fallbackEl(), '누르기 전엔 fallback이 없어야 한다').toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /기록실/ }));

    // 도착 단언만으로는 Suspense 경계 삭제를 못 잡는다 — 경계가 없으면 React가 루트까지
    // 올라가 트리를 비웠다가 청크 도착 후 다시 그려서 **결국 기록실이 뜬다**(실측).
    // 차이는 그 사이 프레임뿐이라 그 프레임을 직접 본다.
    expectChunkFallback(fallbackEl(), '기록실 진입');
    const assertNoWrapper = watchFallbackWrapper(fallbackEl(), '기록실 진입');

    expect(
      await screen.findByText('👥 함께한 사람들'),
      '청크가 와도 기록실이 안 뜬다 (import 경로 오타·Suspense 누락)',
    ).toBeTruthy();
    expect(fallbackEl(), '청크가 온 뒤에도 fallback이 남아 있다').toBeNull();
    assertNoWrapper();
  });
});

describe('게임 화면 → 이벤트 (이 파일에서 이벤트 화면을 여는 유일한 테스트)', () => {
  // GameScreen의 fallback 자리는 이 PR에서 ScreenChunkFallback으로 **교체된** 곳이다.
  // 두 소비처 중 어느 쪽도 보지 않으면, 호출부를 `fallback={null}`로 되돌려도 전부 그린이다(실측).
  it('이벤트 화면 진입에도 같은 fallback이 선다', async () => {
    const evt = GAME_EVENTS.find(e => e.choices.length > 0);
    expect(evt, '전제: 선택지 있는 이벤트가 있어야 EventScene이 그려진다').toBeTruthy();
    useGameStore.setState({
      state: state({ phase: 'event', currentEvent: evt!, week: 2 }),
    });

    render(<GameScreen />);
    expectChunkFallback(fallbackEl(), '이벤트 화면 진입');
    const assertNoWrapper = watchFallbackWrapper(fallbackEl(), '이벤트 화면 진입');

    // 내용 문자열에 결합하지 않는다 — 청크가 풀렸다는 것만 본다.
    await waitFor(() => expect(fallbackEl(), 'EventScene 청크가 끝내 안 왔다').toBeNull());
    assertNoWrapper();
  });
});

describe('게임 화면 → 기록장 오버레이 (이 파일에서 기록장을 여는 유일한 테스트)', () => {
  // GameScreen에는 fallback 자리가 **둘**이다 — 바깥 phase 라우터와 이 오버레이.
  // 바깥만 잠갔더니 이쪽을 `fallback={null}`로 바꿔도 880개가 전부 통과했다(뮤테이션 실측).
  // 오버레이는 MainWeek 위에 겹쳐 뜨므로 fallback이 없으면 빈 검은 화면이 잠깐 덮인다.
  it('기록장을 열 때도 같은 fallback이 선다', async () => {
    useGameStore.setState({ state: state({ year: 3, week: 5, phase: 'weekday' }) });
    render(<GameScreen />);
    expect(fallbackEl(), '메인 화면엔 fallback이 없어야 한다').toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /기록장/ }));
    expectChunkFallback(fallbackEl(), '기록장 오버레이');
    const assertNoWrapper = watchFallbackWrapper(fallbackEl(), '기록장 오버레이');

    // **이 경계가 안쪽에 있어야 하는 이유를 잠근다.** 안쪽 Suspense를 지우면 바깥 경계가
    // 대신 받아 fallback은 여전히 뜨고 위 단언은 통과한다 — 그런데 그때는 MainWeek가
    // 통째로 단색에 먹힌다(GameScreen 주석이 말하는 바로 그것). 881개 전부 그린이었다.
    //
    // 두 단계로 나눠 묻는다. 기본 byRole 하나로 합치면 접근성 트리 필터(aria-hidden·
    // display:none을 한꺼번에 거른다)를 타서, 오버레이에 배경 `aria-hidden`을 붙이는
    // **표준 모달 a11y 개선**만으로 "경계가 바깥으로 올라갔다"고 오진한다(검수 실측).
    //
    // 그렇다고 `hidden: true`만 쓰면 반대로 양성 대조가 죽는다 — **React는 suspend 시
    // 이전 내용을 언마운트하지 않고 감춘다.** 안쪽 경계를 지워도 버튼은 DOM에 그대로 남고
    // 조상만 `display:none`이 된다(실측: BTN=true, HIDDEN_ANCESTOR=true).
    // 그래서 "DOM에 있나" + "감춰진 조상이 없나"를 따로 본다.
    const albumBtn = screen.queryByRole('button', { name: /기록장/, hidden: true });
    expect(albumBtn, 'MainWeek가 통째로 언마운트됐다').toBeTruthy();
    expect(
      hiddenAncestor(albumBtn!),
      '오버레이가 뜨는 동안 MainWeek가 통째로 fallback에 먹혔다 — 경계가 바깥으로 올라갔다',
    ).toBeNull();

    await waitFor(() => expect(fallbackEl(), 'YearEndScreen 청크가 끝내 안 왔다').toBeNull());
    assertNoWrapper();
  });
});
