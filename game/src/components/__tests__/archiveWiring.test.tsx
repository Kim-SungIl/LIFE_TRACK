// @vitest-environment jsdom
// 런간 기록(archive)이 화면에 닿는 세 자리를 잠근다. 엔진 쪽 적립은 engine/__tests__/archive.test.ts가
// 보지만, 아래 셋은 컴포넌트 한 줄이라 엔진 테스트로는 전부 그린인 채 되돌려질 수 있다
// (검수에서 실제로 세 뮤테이션 모두 635개 전부 통과했다).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => `WEBP::${p}` }));

// idle 예약을 삼킨다 — 이 파일은 prefetch를 단언하지 않지만, 실행되게 두면 테스트 도중
// 청크 import가 떠서 비결정적이 된다. prefetch 계약 자체는 archivePrefetch.test.tsx가 본다.
vi.mock('../../engine/assetPrefetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../engine/assetPrefetch')>()),
  runWhenIdle: () => () => {},
}));

import { TitleScreen } from '../TitleScreen';
import { RunArchiveSummary } from '../screens/RunArchiveSummary';
import { EventResultScreen } from '../screens/EventResultScreen';
import { ArchiveScreen } from '../screens/ArchiveScreen';
import { clearArchive, loadArchive, accrueResolvedEvent, commitRun } from '../../engine/archive';
import { INITIAL_NPCS } from '../../engine/npcRoster';
import { isBarelyTouched, npcStoryRows } from '../../engine/npcStoryPool';
import { npcAlbum, albumFor, isSlotFilled, slotPath } from '../../engine/npcAlbum';
import { NpcAlbumScreen } from '../screens/NpcAlbumScreen';
import { SOLO_ROOT, soloStoryRow } from '../../engine/npcStoryPool';
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

  // 여기서 멈춘다 — 누른 뒤의 lazy 경계·fallback·prefetch는 이 파일에 두지 않는다.
  // 이 파일은 위쪽에서 ArchiveScreen을 정적 import하고(픽스처용) 여러 테스트가 기록실을
  // 반복해서 여는데, React.lazy는 resolve된 payload를 캐시하므로 **두 번째부터는 fallback
  // 프레임이 존재하지 않는다.** 그래서 호출부 배선은 lazyScreenWiring.test.tsx,
  // prefetch는 archivePrefetch.test.tsx가 각각 전용 파일에서 본다.
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

  // 엔진 필터를 잠가도 화면이 npcPeak을 넘기는지는 별개다 — 인자를 빼면 엔진 테스트는
  // 전부 그린인 채 엔딩 화면이 다시 미접촉 이름을 쓴다.
  it('엔딩 요약도 만나지 않은 사람 이름을 쓰지 않는다', () => {
    const metIds = INITIAL_NPCS.map(n => n.id).filter(id => id !== 'yerin');
    const s = state({ events: [ev('some-solo-event')] });
    s.npcs = s.npcs.map(n => metIds.includes(n.id) ? { ...n, met: true, intimacy: 30 } : n);
    commitRun(s, '수도권 대학');

    render(<RunArchiveSummary runDelta={null} />);
    expect(screen.getByText(/스치기만 하고 지나간 사람/), '이정표 블록 자체가 없으면 무의미').toBeTruthy();
    const listed = screen.getByText(/·/).textContent ?? '';
    expect(listed, '만난 적 없는 예린이 이정표에 올랐다').not.toContain('예린');
    expect(listed, '만난 사람은 그대로 올라야 한다').toContain('도윤');
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

// 사람 줄이 문이 됐는지, 그리고 그 문이 목록을 **교체**하는지(아코디언이 아닌지) 잠근다.
// 포화 상태의 지훈이 52칸이라, 목록 위에 펼치면 화면이 무너진다.
describe('기록실 → 인물 앨범 드릴다운', () => {
  /** 지훈이 화자인 첫 장면을 적립한다 — 실제 CG가 붙는 이벤트여야 칸이 채워진다. */
  function accrueFirstWeek() {
    accrueResolvedEvent(state({ events: [ev('first-week')] }));
    const cg = loadArchive().cgFiles;
    expect(cg.length, '전제: first-week에 CG가 붙어 있어야 이 테스트가 의미 있다').toBe(1);
    return cg;
  }

  it('사람 줄을 누르면 앨범이 열리고 목록은 사라진다', () => {
    accrueFirstWeek();
    render(<ArchiveScreen onBack={() => {}} />);
    expect(screen.getByText('👥 함께한 사람들')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /지훈/ }));

    expect(screen.queryByText('👥 함께한 사람들'), '목록이 남아 있다 — 교체가 아니라 아코디언이다').toBeNull();
    expect(screen.getByText('초6'), '학년 행이 없다').toBeTruthy();
  });

  it('학년 행마다 몇 개 중 몇 개인지 보여준다', () => {
    accrueFirstWeek();
    render(<ArchiveScreen onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /지훈/ }));

    const y1 = npcAlbum('jihun').find(b => b.key === 'y1')!;
    expect(screen.getByText(`1 / ${y1.slots.length}`), '초6 행의 채움 수가 안 맞는다').toBeTruthy();
  });

  // 빈 칸에 그림을 싣는 순간 **안 본 그림을 받아오는** 것이 된다(장당 105KB).
  it('안 본 칸은 이미지를 싣지 않는다', () => {
    const cg = accrueFirstWeek();
    render(<ArchiveScreen onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /지훈/ }));

    // 픽스처는 남주판이므로 첫 탭이 남주판이다(dominantGender).
    const filled = albumFor('jihun', 'male').flatMap(b => b.slots).filter(s => isSlotFilled(s, cg, 'male')).length;
    expect(filled, '전제: 채운 칸이 있어야 한다').toBeGreaterThan(0);

    // 초상화(alt가 "... neutral")를 뺀 나머지가 CG 타일이다.
    const tiles = screen.getAllByRole('img').filter(el => !/ neutral$/.test(el.getAttribute('alt') ?? ''));
    expect(tiles.length, '안 본 칸이 이미지를 싣고 있다').toBe(filled);
  });

  // 전면 보기는 닫는 길이 두 개다 — 명시적 버튼과 배경 탭. 버튼이 없으면 조작 안내 문장을
  // 다시 넣어야 하고, 그 문장은 세계관 어투와 섞여 사무적으로 읽힌다.
  it('칸을 누르면 전면 보기가 열리고 닫기 버튼으로 닫힌다', () => {
    accrueFirstWeek();
    render(<ArchiveScreen onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /지훈/ }));

    const tile = screen.getAllByRole('img').find(el => !/ neutral$/.test(el.getAttribute('alt') ?? ''))!;
    expect(screen.queryByRole('button', { name: '닫기' }), '열기 전에 이미 닫기 버튼이 있다').toBeNull();

    fireEvent.click(tile.closest('button')!);
    const close = screen.getByRole('button', { name: '닫기' });
    expect(close, '전면 보기가 안 열렸다').toBeTruthy();

    fireEvent.click(close);
    expect(screen.queryByRole('button', { name: '닫기' }), '닫기 버튼이 안 닫았다').toBeNull();
    expect(screen.getByText('초6'), '닫은 뒤 앨범으로 돌아와야 한다').toBeTruthy();
  });

  // 배경 탭으로도 닫힌다 — 버튼을 넣었어도 이 길을 없애지 않았음을 잠근다.
  it('전면 보기는 배경을 눌러도 닫힌다', () => {
    accrueFirstWeek();
    render(<ArchiveScreen onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /지훈/ }));
    const tile = screen.getAllByRole('img').find(el => !/ neutral$/.test(el.getAttribute('alt') ?? ''))!;
    const title = tile.getAttribute('alt')!;
    fireEvent.click(tile.closest('button')!);

    // 오버레이 쪽 이미지는 버튼에 감싸이지 않은 쪽이다(칸 타일은 button의 자식).
    const overlayImg = screen.getAllByAltText(title).find(el => !el.closest('button'))!;
    expect(overlayImg, '전면 보기 이미지를 못 찾았다').toBeTruthy();
    fireEvent.click(overlayImg);
    expect(screen.queryByRole('button', { name: '닫기' }), '배경 탭으로 닫히지 않는다').toBeNull();
  });

  // 판본 탭 — 엔진 쪽(npcAlbum.test)이 판정을 잠그지만, 화면이 그 판정을 **부르는지**는 별개다.
  // gender를 상수 'male'로 굳혀도 엔진 테스트는 전부 그린이다.
  it('판본 탭이 두 개 있고, 첫 탭은 실제로 모은 판본이다', () => {
    accrueFirstWeek();   // 픽스처는 남주판
    render(<ArchiveScreen onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /지훈/ }));

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length, '판본 탭이 두 개가 아니다').toBe(2);
    expect(screen.getByRole('tab', { name: /남자 주인공/ }).getAttribute('aria-selected'),
      '남주판으로 모았는데 첫 탭이 남주판이 아니다').toBe('true');
    expect(screen.getByRole('tab', { name: /여자 주인공/ }).getAttribute('aria-selected')).toBe('false');
  });

  // 첫 탭을 상수로 굳혀도 위 테스트는 그린이다(픽스처가 남주판이니까). 여주판 기록으로도
  // 확인해야 화면이 dominantGender를 실제로 부른다는 게 잠긴다.
  it('여주판으로 모은 기록이면 첫 탭이 여주판이다', () => {
    const s = createInitialState('female', PARENTS, { rngSeed: 12345 });
    s.events = [ev('first-week')];
    s.talkEventsFired = [];
    accrueResolvedEvent(s);
    const cg = loadArchive().cgFiles;
    expect(cg[0], '전제: 여주판 CG가 적립돼야 한다').toMatch(/_f\.png$/);

    render(<ArchiveScreen onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /지훈/ }));
    expect(screen.getByRole('tab', { name: /여자 주인공/ }).getAttribute('aria-selected'),
      '여주판으로 모았는데 첫 탭이 남주판이다').toBe('true');
  });

  it('여주 탭으로 바꾸면 남주판으로 채운 칸이 빈 칸이 된다', () => {
    const cg = accrueFirstWeek();
    expect(cg[0], '전제: 픽스처 CG가 남주판 파일이어야 한다').toMatch(/_m\.png$/);
    render(<ArchiveScreen onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /지훈/ }));

    const y1 = albumFor('jihun', 'male').find(b => b.key === 'y1')!;
    expect(screen.getByText(`1 / ${y1.slots.length}`), '남주 탭의 채움 수가 안 맞는다').toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /여자 주인공/ }));

    const y1f = albumFor('jihun', 'female').find(b => b.key === 'y1')!;
    expect(screen.getByText(`0 / ${y1f.slots.length}`),
      '여주 탭이 0으로 시작하지 않는다 — 판본을 합쳐 세고 있다').toBeTruthy();
    // 그림 타일도 사라져야 한다(초상화 제외). 남으면 남주 그림을 여주 탭에 싣는 것이다.
    const tiles = screen.getAllByRole('img').filter(el => !/ neutral$/.test(el.getAttribute('alt') ?? ''));
    expect(tiles.length, '여주 탭에 남주판 그림이 남아 있다').toBe(0);

    // 다시 남주 탭으로 돌아오면 복구된다(탭이 상태를 잃지 않는다).
    fireEvent.click(screen.getByRole('tab', { name: /남자 주인공/ }));
    expect(screen.getByText(`1 / ${y1.slots.length}`)).toBeTruthy();
  });

  // 전면 보기는 판본 전환의 **핵심 소비처**인데 기본 탭(dominantGender) 밖에서 여는 테스트가
  // 없었다. 그래서 `filledPath(open, seenCgFiles, 'male')`로 굳혀도 704개 전부 그린이었다
  // (3자 검수에서 지적받아 뮤테이션으로 확인). 되돌아가면 여주 탭에서 칸을 눌러도 오버레이
  // 가드(`open && openPath`)에 막혀 **아무 반응 없이 안 열린다** — 에러도 안 난다.
  it('여주 탭에서 칸을 누르면 여주판 그림이 전면으로 열린다', () => {
    const s = createInitialState('female', PARENTS, { rngSeed: 12345 });
    s.events = [ev('first-week')];
    s.talkEventsFired = [];
    accrueResolvedEvent(s);
    const cg = loadArchive().cgFiles;
    expect(cg[0], '전제: 여주판 CG가 적립돼야 한다').toMatch(/_f\.png$/);

    render(<ArchiveScreen onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /지훈/ }));
    // 첫 탭이 여주판이므로 탭 전환 없이 바로 채운 칸이 있다.
    const tile = screen.getAllByRole('img').find(el => !/ neutral$/.test(el.getAttribute('alt') ?? ''))!;
    expect(tile, '여주 탭에 채운 칸이 없다').toBeTruthy();

    fireEvent.click(tile.closest('button')!);
    expect(screen.getByRole('button', { name: '닫기' }), '전면 보기가 안 열렸다').toBeTruthy();

    // 오버레이 이미지는 버튼에 감싸이지 않은 쪽이다. 남주 그림이 뜨면 판본 구분이 무의미하다.
    const overlay = screen.getAllByAltText(tile.getAttribute('alt')!).find(el => !el.closest('button'))!;
    expect(overlay.getAttribute('src'), '전면 보기에 여주판 그림이 아닌 것이 떴다').toMatch(/_f\.png$/);
  });

  // 지훈은 남·여 칸 수가 같아서, 화면이 탭을 무시하고 늘 남주 칸 목록을 그려도 위 테스트들이
  // 전부 그린이다(뮤테이션으로 확인했다 — albumFor(npcId, 'male') 고정이 통과했다).
  // 도윤 첫 만남만 남주판·여주판이 서로 다른 이벤트라, 여기서만 "어느 목록을 그렸나"가 드러난다.
  it('여주 탭은 여주판 칸 목록을 그린다 (도윤 첫 만남)', () => {
    const s = createInitialState('female', PARENTS, { rngSeed: 12345 });
    s.events = [ev('doyun-meet-elementary-f')];
    s.talkEventsFired = [];
    accrueResolvedEvent(s);
    const cg = loadArchive().cgFiles;
    expect(cg, '전제: 여주 전용 CG가 적립돼야 한다').toEqual(['elementary/doyun-meet-elementary-f_c0_f.png']);
    expect(npcStoryRows(loadArchive().events).find(r => r.id === 'doyun')!.seen,
      '전제: 도윤 줄이 보여야 앨범 문이 열린다').toBeGreaterThan(0);

    render(<ArchiveScreen onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /도윤/ }));
    expect(screen.getByRole('tab', { name: /여자 주인공/ }).getAttribute('aria-selected')).toBe('true');

    const y1 = albumFor('doyun', 'female').find(b => b.key === 'y1')!;
    expect(screen.getByText(`1 / ${y1.slots.length}`),
      '여주판 칸 목록이 아니다 — 남주 칸을 그리고 있으면 이 그림이 어느 칸에도 없어 0이 된다').toBeTruthy();
  });

  it('돌아가기로 목록으로 복귀한다', () => {
    accrueFirstWeek();
    render(<ArchiveScreen onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /지훈/ }));
    fireEvent.click(screen.getByRole('button', { name: '돌아가기' }));
    expect(screen.getByText('👥 함께한 사람들'), '목록으로 못 돌아왔다').toBeTruthy();
  });
});

// 주인 없는 장면 줄. 이 줄이 없으면 수능 전야·번아웃·졸업 준비가 앨범 어디에도 뜨지 않는다.
describe('기록실 — 혼자 지나온 것 줄', () => {
  it('그런 장면을 본 적 있으면 줄이 생기고, 누르면 앨범이 열린다', () => {
    accrueResolvedEvent(state({ events: [ev('suneung-eve')] }));
    render(<ArchiveScreen onBack={() => {}} />);

    const row = screen.getByRole('button', { name: /혼자 지나온 것/ });
    expect(row, 'solo 줄이 없다').toBeTruthy();

    fireEvent.click(row);
    expect(screen.queryByText('👥 함께한 사람들'), '목록이 안 교체됐다').toBeNull();
    expect(screen.getByText('개학과 시험, 졸업 준비 — 곁에 아무도 없던 시간')).toBeTruthy();
    expect(npcAlbum(SOLO_ROOT).length, '전제: solo 앨범에 행이 있어야 한다').toBeGreaterThan(0);
  });

  it('아직 그런 장면을 안 봤으면 빈 방의 문을 만들지 않는다', () => {
    accrueResolvedEvent(state({ events: [ev('first-week')] }));   // 지훈 장면 — solo가 아니다
    expect(soloStoryRow(loadArchive().events).seen, '전제: solo 본 것이 0이어야 한다').toBe(0);

    render(<ArchiveScreen onBack={() => {}} />);
    expect(screen.queryByRole('button', { name: /혼자 지나온 것/ }), '빈 solo 줄이 떴다').toBeNull();
    expect(screen.getByRole('button', { name: /지훈/ }), '사람 줄은 그대로 있어야 한다').toBeTruthy();
  });

  // 앨범 화면의 엠블럼은 아래 테스트가 잠그지만 **목록 줄**은 안 잠겨 있었다(검수 지적, 뮤테이션
  // 확인). 분기를 지우면 `Portrait characterId="solo"`가 되어 자산 없는 CSS 아바타 얼굴이 뜬다.
  // 줄의 접근명은 그대로라 다른 테스트는 전부 그린이다.
  it('목록의 solo 줄도 초상화가 아니라 엠블럼이다', () => {
    accrueResolvedEvent(state({ events: [ev('suneung-eve')] }));
    render(<ArchiveScreen onBack={() => {}} />);

    const row = screen.getByRole('button', { name: /혼자 지나온 것/ });
    const img = row.querySelector('img')!;
    expect(img, 'solo 줄에 그림이 없다').toBeTruthy();
    expect(img.getAttribute('alt'), 'solo 줄에 사람 초상화가 들어갔다').toBe('혼자 지나온 것');
    expect(img.getAttribute('src')).toContain('emblems/growth.png');
  });

  // solo 줄의 진행 바. 사람 줄의 ratio는 isBarelyTouched 경유로 간접 잠금이 있는데 solo만
  // 비어 있어서, ratio를 상수 0으로 굳혀도 전부 그린이었다(검수 지적, 뮤테이션 확인).
  it('solo 줄의 진행 바는 본 만큼 찬다', () => {
    accrueResolvedEvent(state({ events: [ev('suneung-eve')] }));
    const solo = soloStoryRow(loadArchive().events);
    expect(solo.seen, '전제: 본 것이 있어야 바가 찬다').toBeGreaterThan(0);

    render(<ArchiveScreen onBack={() => {}} />);
    const row = screen.getByRole('button', { name: /혼자 지나온 것/ });
    const widths = [...row.querySelectorAll('div')]
      .map(d => (d as HTMLElement).style.width).filter(w => w.endsWith('%'));
    expect(widths.length, '진행 바를 못 찾았다').toBeGreaterThan(0);
    expect(widths.some(w => w !== '0%'), `진행 바가 비어 있다(${widths.join(',')})`).toBe(true);
  });

  it('solo 앨범에는 초상화가 아니라 엠블럼이 뜬다', () => {
    accrueResolvedEvent(state({ events: [ev('suneung-eve')] }));
    render(<ArchiveScreen onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /혼자 지나온 것/ }));

    const alts = screen.getAllByRole('img').map(el => el.getAttribute('alt') ?? '');
    // 판본 탭의 주인공 초상(player_m/player_f)은 정상이다. 로스터 인물의 얼굴이 없어야 한다.
    const roster = new Set(INITIAL_NPCS.map(n => n.id));
    const npcFace = alts.find(a => roster.has(a.replace(/ \w+$/, '')));
    expect(npcFace, `solo 앨범에 사람 초상화가 떴다: ${npcFace}`).toBeUndefined();
    expect(alts).toContain('혼자 지나온 것');
  });
});

// 줄과 앨범은 **다른 축**을 센다(줄=겪은 이야기, 앨범=이 판본에서 모은 그림 칸). 이름표 없이
// 나란히 두면 "3개라더니 들어가니 0개"로 읽힌다 — 실제 신고가 그것이었다. 수를 억지로 맞추는
// 대신 앨범이 줄의 수를 **그대로 받아** 이름표를 붙이는 것이 계약이다.
describe('기록실 줄 ↔ 앨범 숫자', () => {
  // 도윤은 두 축이 갈리는 인물이다(이야기 7종 ↔ 남주판 11칸). 갈리지 않는 인물로 재면
  // 앨범이 이야기 자리에 그림 수를 넣어도 통과하므로 판별력이 없다.
  const doyunAxes = () => {
    const a = loadArchive();
    const stories = npcStoryRows(a.events, a.npcPeak).find(r => r.id === 'doyun')!;
    const slots = albumFor('doyun', 'male').reduce((n, b) => n + b.slots.length, 0);
    return { stories, slots };
  };

  it('앨범의 이야기 수는 줄이 보여준 수와 같다', () => {
    accrueResolvedEvent(state({ events: [ev('doyun-comic-share'), ev('doyun-secret-spot')] }));
    const { stories, slots } = doyunAxes();
    expect(slots, '전제: 두 축이 갈리는 인물이어야 이 테스트가 판별한다').not.toBe(stories.total);

    render(<ArchiveScreen onBack={() => {}} />);
    const row = screen.getByRole('button', { name: /도윤/ });
    const shown = (row.textContent ?? '').match(/(\d+)\s*\/\s*(\d+)/);
    expect(shown, `줄에서 수를 못 읽었다: ${row.textContent}`).toBeTruthy();
    expect(Number(shown![2]), '줄이 이야기 총수가 아닌 것을 쓴다').toBe(stories.total);

    fireEvent.click(row);
    expect(
      screen.getByText(`이야기 ${shown![1]} / ${shown![2]}`),
      `앨범이 줄과 다른 수를 말한다 (줄: ${shown![0]}) — 앨범이 story를 다시 계산하면 갈라진다`,
    ).toBeTruthy();
  });

  it('그림 합계는 이 판본의 학교급 칸을 다 더한 것이다', () => {
    accrueResolvedEvent(state({ events: [ev('doyun-comic-share')] }));
    const { slots } = doyunAxes();

    render(<ArchiveScreen onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /도윤/ }));

    const label = screen.getByText('이 판본에서 모은 그림');
    expect(
      label.parentElement?.textContent,
      '그림 합계가 학교급 칸의 합과 다르다 — 머릿속으로 더하게 만드는 그 상태다',
    ).toContain(`/ ${slots}`);
  });

  // 신고의 핵심 장면: 이야기는 봤는데 그림이 0장이라 빈 칸 벽만 보이던 자리.
  // 주인 없는 장면 43종 중 24종엔 CG가 아예 없다(개학·시험·번아웃·반장 선거…).
  it('이야기는 봤는데 그림이 0장이면 그 이유를 말해준다', () => {
    accrueResolvedEvent(state({ events: [ev('sports-day')] }));   // solo · CG 없음
    expect(soloStoryRow(loadArchive().events).seen, '전제: solo 이야기를 봤어야 한다').toBeGreaterThan(0);

    render(<ArchiveScreen onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /혼자 지나온 것/ }));
    expect(
      screen.getByText('본 장면들은 그림 없이 지나갔다.'),
      '그림 0장인데 설명이 없다 — 빈 칸 벽만 보여 고장으로 읽힌다',
    ).toBeTruthy();
  });

  // 양성 짝. 이 대조가 없으면 문장을 **무조건** 띄우게 만들어도 위 테스트는 통과한다.
  it('그림을 한 칸이라도 모았으면 그 문장은 뜨지 않는다', () => {
    const slot = albumFor('doyun', 'male')[0].slots[0];
    const path = slotPath(slot, 'male')!;
    expect(path, '전제: 칸의 그림 경로를 얻어야 채운 상태를 만들 수 있다').toBeTruthy();

    render(
      <NpcAlbumScreen npcId="doyun" story={{ seen: 1, total: 7 }} seenCgFiles={[path]} onBack={() => {}} />,
    );
    const label = screen.getByText('이 판본에서 모은 그림');
    expect(label.parentElement?.textContent, '전제: 한 칸은 채워져 있어야 한다').not.toContain('0 /');
    expect(
      screen.queryByText('본 장면들은 그림 없이 지나갔다.'),
      '그림을 모았는데도 "그림 없이 지나갔다"가 뜬다',
    ).toBeNull();
  });
});
