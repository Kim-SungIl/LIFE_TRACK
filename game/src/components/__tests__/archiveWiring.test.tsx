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
import { ArchiveScreen } from '../screens/ArchiveScreen';
import { clearArchive, loadArchive, accrueResolvedEvent, commitRun } from '../../engine/archive';
import { INITIAL_NPCS } from '../../engine/npcRoster';
import { isBarelyTouched, npcStoryRows } from '../../engine/npcStoryPool';
import { GAME_EVENTS } from '../../engine/events';
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

// 적립층 이후 기록실은 완주 없이도 열린다(1학년 2주만 하고 접어도). 그래서 로스터를 그대로
// 그리면 아직 만나지도 않은 인물의 이름·얼굴·이야기 총수가 첫 판 도중에 새어나간다.
// 엔진 테스트로는 잡히지 않는다 — 감춤은 화면 한 줄(filter)이기 때문이다.
describe('기록실 — 만나지 않은 사람은 이름도 얼굴도 없다', () => {
  const NEVER_MET_IN_Y1 = ['서아', '시우', '예린', '하은', '준하'];

  /** 이벤트 하나를 적립한다. metIds에 든 인물은 "만난 적 있음"으로 npcPeak에 남는다. */
  function accrue(eventId: string, metIds: readonly string[]) {
    const s = state({ events: [ev(eventId)] });
    s.npcs = s.npcs.map(n => metIds.includes(n.id) ? { ...n, met: true, intimacy: 30 } : n);
    accrueResolvedEvent(s);
  }
  // 지훈은 초기값이 met: true다(npcRoster.ts) — 첫 이벤트만 적립돼도 그는 항상 보인다.
  const portraitAlts = () => screen.getAllByAltText(/ neutral$/).map(el => el.getAttribute('alt'));

  it('첫 판 도중이면 지훈만 남고 미접촉 인물의 이름·초상화·분모가 전부 없다', () => {
    accrue('some-solo-event', []);
    render(<ArchiveScreen onBack={() => {}} />);

    expect(screen.getByText('지훈')).toBeTruthy();
    for (const name of NEVER_MET_IN_Y1) {
      expect(screen.queryByText(name), `${name}는 만난 적이 없으므로 이름이 없어야 한다`).toBeNull();
    }
    expect(screen.queryByAltText('seoa neutral'), '초상화도 함께 사라져야 한다').toBeNull();
    // 줄 수까지 잠근다 — 이름만 가리고 줄을 남기면 몇 명이 남았는지 세어진다.
    expect(portraitAlts(), '보이는 줄은 만난 사람 수와 같아야 한다').toEqual(['jihun neutral']);
  });

  it('만난 사람은 이름과 초상화가 나온다', () => {
    accrue('some-solo-event', ['seoa']);
    render(<ArchiveScreen onBack={() => {}} />);

    expect(screen.getByText('서아')).toBeTruthy();
    expect(screen.getByAltText('seoa neutral')).toBeTruthy();
  });

  // npcPeak이 비어 있는 아주 오래된 기록에서 이름이 통째로 사라지지 않게 하는 OR 가지.
  it('npcPeak에 없어도 그 사람 이야기를 봤다면 남는다 (레거시 기록)', () => {
    accrue('seoa-onehalf-earphone', []);   // 서아 도달형 — 만나지 않은 채 이벤트만 적립된 상태
    render(<ArchiveScreen onBack={() => {}} />);

    expect(screen.getByText('서아'), '본 이야기가 있으면 만난 것으로 본다').toBeTruthy();
  });

  it('감춘 사람이 있을 때만 힌트가 뜨고, 수는 말하지 않는다', () => {
    accrue('some-solo-event', []);
    const { unmount } = render(<ArchiveScreen onBack={() => {}} />);
    const hint = screen.getByText('아직 이름을 모르는 얼굴들이 있다.');
    expect(hint.textContent, '남은 인원 수가 새면 감춘 의미가 없다').not.toMatch(/\d/);
    unmount();

    clearArchive();
    accrue('some-solo-event', INITIAL_NPCS.map(n => n.id));
    render(<ArchiveScreen onBack={() => {}} />);
    expect(screen.queryByText('아직 이름을 모르는 얼굴들이 있다.'), '전원 만났으면 문구도 없다').toBeNull();
  });

  // "그 학년에 곁에 있어야 열린다"는 다음 판을 향한 말이다. 완주 전에 띄우면 보이는 사람이
  // 지훈뿐인데 7년을 함께할 소꿉친구를 스치기만 한 사람이라 부르게 된다.
  it('이정표 문구는 완주 전에는 뜨지 않고 완주 후에 뜬다', () => {
    accrue('some-solo-event', []);
    const { unmount } = render(<ArchiveScreen onBack={() => {}} />);
    expect(screen.queryByText(/거의 스치기만 한 이름/)).toBeNull();
    unmount();

    commitRun(state({ events: [ev('some-solo-event')] }), '수도권 대학');
    render(<ArchiveScreen onBack={() => {}} />);
    expect(screen.getByText(/거의 스치기만 한 이름/)).toBeTruthy();
  });
  // 이정표 문구가 "감춘 사람의 0%"를 근거로 뜨면, 안 보이는 사람이 있다는 사실이 문구로 새고
  // 보이는 사람을 다 봤어도 문구가 사라지지 않는다.
  it('이정표는 감춘 사람을 세지 않는다', () => {
    // 지훈만 화자인 이벤트 전부를 본 판. 그의 풀은 38개라 이 픽스처로 0.25 선을 넘는다.
    // (정의에서 뽑으므로 콘텐츠가 늘면 픽스처도 같이 늘어난다 — 전제는 아래에서 직접 확인한다.)
    const jihunSolo = GAME_EVENTS
      .filter(e => !e.reach?.npc && e.speakers?.length === 1 && e.speakers[0] === 'jihun')
      .map(e => e.id);
    commitRun(state({ events: jihunSolo.map(ev) }), '수도권 대학');

    const a = loadArchive();
    const jihun = npcStoryRows(a.events, a.npcPeak).find(r => r.id === 'jihun')!;
    expect(
      isBarelyTouched(jihun),
      '전제 붕괴: 지훈이 여전히 "스치기만 한" 쪽이라 이 테스트가 아무것도 구분하지 못한다',
    ).toBe(false);

    render(<ArchiveScreen onBack={() => {}} />);
    expect(
      screen.queryByText(/거의 스치기만 한 이름/),
      '보이는 사람은 충분히 봤는데 문구가 떴다 — 감춘 사람의 0%를 세고 있다',
    ).toBeNull();
  });
});
