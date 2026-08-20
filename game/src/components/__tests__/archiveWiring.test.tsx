// @vitest-environment jsdom
// 런간 기록(archive)이 화면에 닿는 세 자리를 잠근다. 엔진 쪽 적립은 engine/__tests__/archive.test.ts가
// 보지만, 아래 셋은 컴포넌트 한 줄이라 엔진 테스트로는 전부 그린인 채 되돌려질 수 있다
// (검수에서 실제로 세 뮤테이션 모두 635개 전부 통과했다).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => `WEBP::${p}` }));

import { TitleScreen } from '../TitleScreen';
import { RunArchiveSummary } from '../screens/RunArchiveSummary';
import { EventResultScreen } from '../screens/EventResultScreen';
import { clearArchive, accrueResolvedEvent, commitRun } from '../../engine/archive';
import { createInitialState } from '../../engine/gameEngine';
import { useGameStore } from '../../engine/store';
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

beforeEach(() => {
  clearArchive();
  localStorage.removeItem('lifetrack_save');
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

// 이건 엣지가 아니라 본선이다: 엔딩 화면의 유일한 버튼이 window.location.reload()이므로
// 모든 완주가 "엔딩 → 리로드"로 끝난다. 리로드하면 store의 runDelta(메모리)가 사라지고,
// 이어하기로 돌아온 엔딩 화면은 archive.lastRunDelta만 남는다.
describe('엔딩 요약 — 새로고침 후에도 "처음 본 이야기"가 유지된다', () => {
  it('store의 runDelta가 없으면 archive의 lastRunDelta로 떨어진다', () => {
    // 2회차 이상 + 신규 있음이어야 그 줄이 그려진다(첫 완주엔 전부 처음이라 의미가 없다)
    commitRun(state({ events: [ev('a')] }), '수도권 대학');
    accrueResolvedEvent(state({ events: [ev('b')] }));
    const d = commitRun(state({ events: [ev('b')] }), 'SKY 경영대 합격');
    expect(d).toMatchObject({ runs: 2, newEvents: 1 });

    render(<RunArchiveSummary runDelta={null} />);
    expect(
      screen.queryByText('이번 판에서 처음 본 이야기'),
      'runDelta가 null일 때 폴백이 없어 요약이 사라졌다',
    ).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });
});

// 기록실 버튼은 "쌓인 게 있으면" 열린다. runs만 보면 이벤트를 100개 본 미완주 플레이어에게
// 빈 선반을 감추는 셈이 되고, 그게 이 변경으로 얻는 것의 절반이다.
describe('기록실 진입 게이트', () => {
  it('완주 전이라도 적립된 이야기가 있으면 기록실이 열린다', () => {
    accrueResolvedEvent(state({ events: [ev('a')] }));
    render(<TitleScreen />);
    expect(
      screen.queryByRole('button', { name: /기록실/ }),
      '이야기를 적립했는데 기록실 버튼이 없다 (게이트가 runs만 본다)',
    ).toBeTruthy();
  });

  it('아무것도 없으면 기록실을 권하지 않는다', () => {
    render(<TitleScreen />);
    expect(screen.queryByRole('button', { name: '기록실' })).toBeNull();
  });
});

// W48 이벤트는 결과 화면이 뜨기 전에 학년 전환이 끝나 있다. 결과 화면이 state.year를 그대로
// 읽으면 다음 학교급에서 CG를 찾고, 그 id가 그 학교급에 없으면 후보가 0개가 된다(= 그림 없음).
describe('이벤트 결과 화면의 CG는 발생 학년으로 해석된다', () => {
  const cgSrcs = (c: HTMLElement) =>
    [...c.querySelectorAll('img')].map(i => i.getAttribute('src') ?? '');

  it('학년이 넘어간 뒤에도 발생 학년(elementary)의 CG를 쓴다', () => {
    const { container } = render(
      <EventResultScreen
        gender="male"
        year={1}                                  // 발생 학년 — eventResultData.year에서 온 값
        eventResultData={{
          message: 'm', effects: [],
          event: ev('doyun-graduation-sign'), choiceIndex: 0, year: 1,
        }}
        cgLoaded cgError={false}
        onCgLoaded={() => {}} onCgError={() => {}} onContinue={() => {}}
      />,
    );
    expect(
      cgSrcs(container).some(s => s.includes('elementary/doyun-graduation-sign_c0_m.png')),
      '발생 학년 CG가 안 걸렸다',
    ).toBe(true);
  });

  // 위 둘은 "props를 주면 옳게 그린다"까지만 본다. GameScreen이 그 props를 실제로 넘기는지는
  // 렌더로 잡을 수 없다 — **어긋남이 현재 도달 불가**라 두 값이 항상 같기 때문이다(아래 전제 테스트).
  // 그래서 `eventResultData.year`는 방어용이고, 그걸 방어용으로 만들어 주는 전제를 대신 잠근다.
  it('전환 후 학년(middle)으로 해석하면 그 CG는 사라진다 — 회귀 시 증상 고정', () => {
    const { container } = render(
      <EventResultScreen
        gender="male"
        year={2}                                  // state.year를 그대로 읽었을 때의 값
        eventResultData={{
          message: 'm', effects: [],
          event: ev('doyun-graduation-sign'), choiceIndex: 0, year: 1,
        }}
        cgLoaded cgError={false}
        onCgLoaded={() => {}} onCgError={() => {}} onContinue={() => {}}
      />,
    );
    expect(
      cgSrcs(container).some(s => s.includes('doyun-graduation-sign')),
      'middle에는 이 id의 CG가 없으므로 후보가 0개여야 한다 (이 단언이 깨지면 위 테스트가 무의미)',
    ).toBe(false);
  });
});
