// @vitest-environment jsdom
// 엔딩 회상의 **그림 배선** 계약.
//
// 이 화면은 오래 <img>가 0개였다 — 런이 "그 판의 장면"을 memorySlots에 다 적어두고도
// MemorialHighlight가 recallText/year만 남기고 출처를 버려서, 7년의 끝이 화요일 하루짜리
// 결과 화면보다 초라했다. 여기서 잠그는 건 "그림이 뜬다"가 아니라 **어긋나도 조용한 네 경로**다:
//
//   G1 엔진은 slot을 채우는데 화면이 안 읽는다 → selectMemorialHighlights 순수함수 테스트는 통과.
//   G2 gender를 안 넘긴다/틀리게 넘긴다 → resolveEventCgUrl이 male 아닌 값을 전부 여성으로
//      접으므로(eventCg.ts) **남주 런에 여주 CG가 뜨는데 에러도 경고도 없다.**
//   G3 슬롯의 year 대신 state.year를 읽는다 → 엔딩의 state.year는 7이 아니라 **8**이라
//      학교급-무관 폴백이 없는 슬롯의 그림이 전부 사라진다(엉뚱한 CG가 아니라 소멸).
//   G4 후회 층에 그림이 새어든다 → regretHighlights도 같은 타입이라 slot을 갖고 있어서,
//      회상 블록을 복사해 오는 것만으로 "닿지 못한 것"이 전시장이 된다.
//
// (webpSrc 래핑은 assetRenderWiring.test.tsx가 렌더 트리 전수로 잡는다 — 그쪽에 블록 추가.)
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { EndingScreen } from '../EndingScreen';
import { calculateEnding } from '../../../engine/ending';
import { resolveEventCgUrl } from '../../../engine/eventCg';
import { getBackground } from '../../../engine/backgrounds';
import { makeState } from '../../../test/fixtures';
import type { Gender, MemorySlot } from '../../../engine/types';

vi.mock('../../../audio/bgm', () => ({
  setBgmTrack: vi.fn(),
  getBgmTrackId: vi.fn(() => 'main'),
}));
vi.mock('../../../audio/sfx', () => ({ playSfx: vi.fn() }));

// 실존 CG 픽스처 — cg-manifest에 elementary/doyun-graduation-sign_c{0,1}_{m,f}.png 4장이 있다.
// **초등(Y1) 자산인 것이 핵심이다**: 엔딩 시점 state.year(=8)로 해석하면 high가 되어 후보가 0개다.
const cgSlot = (patch?: Partial<MemorySlot>): MemorySlot => ({
  id: 'growth_1_10_0',
  category: 'growth',
  week: 10,
  year: 1,
  sourceEventId: 'doyun-graduation-sign',
  choiceIndex: 0,
  recallText: '그날 교실에서 이름을 적어 넣었다',
  importance: 9,
  phaseTag: 'early',
  ...patch,
});

// CG가 없는 슬롯 — 그림 0장이 되는 게 아니라 초상/엠블럼으로 떨어져야 한다.
const npcSlot = (): MemorySlot => ({
  id: 'discovery_3_20_0',
  category: 'discovery',
  week: 20,
  year: 3,
  sourceEventId: 'no-such-event-with-cg',
  choiceIndex: 0,
  recallText: '그 말을 듣고 나서야 알았다',
  npcIds: ['jihun'],
  importance: 6,
  phaseTag: 'mid',
});

// 후회 풀(failure + regret 톤)로 빨려가는 슬롯. **CG가 실제로 있는 id를 쓴다** —
// "자산이 없어서 안 뜬다"가 아니라 "있는데도 안 붙인다"를 잠그기 위해서다.
const regretSlot = (): MemorySlot => ({
  id: 'failure_1_30_0',
  category: 'failure',
  week: 30,
  year: 1,
  sourceEventId: 'doyun-graduation-sign',
  choiceIndex: 1,
  recallText: '그때 끝내 하지 못한 말이 있었다',
  importance: 7,
  phaseTag: 'early',
  toneTag: 'regret',
});

function renderEnding(slots: MemorySlot[], gender: Gender = 'male') {
  // 엔딩 시점의 실제 좌표: applyYearTransition이 Y7 마감에서 year++ 후 phase='ending' → year=8, week=1.
  const state = makeState({ year: 8, week: 1, memorySlots: slots });
  return render(
    <EndingScreen
      ending={calculateEnding(state)}
      track={state.track}
      stats={state.stats}
      parents={state.parents}
      burnoutCount={0}
      money={0}
      bgProps={{ bg: getBackground(state.week, false, 'normal', state.year), bgImgError: true, onImgError: vi.fn() }}
      runDelta={null}
      gender={gender}
    />,
  );
}

const imgSrcs = (c: HTMLElement): string[] =>
  [...c.querySelectorAll('img')].map(i => i.getAttribute('src') ?? '');
const cgSrcs = (c: HTMLElement): string[] => imgSrcs(c).filter(s => s.includes('images/events/'));

/** 섹션 헤더 문구로 그 블록(헤더의 부모)을 집는다. 못 찾으면 단언 자체가 무의미하므로 함께 검사. */
function sectionOf(container: HTMLElement, header: string): HTMLElement {
  const label = [...container.querySelectorAll('div')].find(d => d.textContent?.trim() === header);
  expect(label, `"${header}" 섹션 헤더를 못 찾았다 — 이 단언이 무의미해진다`).toBeTruthy();
  return label!.parentElement as HTMLElement;
}

describe('엔딩 회상 — 그림 배선 (G1)', () => {
  it('memorySlots를 심고 엔진을 통과시키면 회상에 그 판의 CG가 뜬다', () => {
    const { container } = renderEnding([cgSlot()]);

    // 순수함수 테스트로는 절대 안 잡히는 지점: 엔진이 slot을 채워도 화면이 안 읽으면 여기서 0개다.
    expect(cgSrcs(container), '회상 CG가 한 장도 안 붙었다').not.toEqual([]);
    expect(cgSrcs(container)[0]).toContain('doyun-graduation-sign');
  });

  it('CG 없는 회상도 초상/엠블럼으로 그림을 진다 — "그림 0장 엔딩"이 없다', () => {
    const { container } = renderEnding([npcSlot()]);

    expect(cgSrcs(container), 'CG 없는 슬롯인데 이벤트 CG가 붙었다').toEqual([]);
    // npcIds가 있으면 초상(characters/), 없으면 엠블럼(emblems/)으로 떨어진다.
    expect(
      imgSrcs(container).some(s => s.includes('images/characters/')),
      '초상 폴백이 안 붙었다 — 이 회상은 텍스트만 남는다',
    ).toBe(true);
  });
});

describe('엔딩 회상 — 성별 판본 (G2)', () => {
  // resolveEventCgUrl은 gender !== 'male'을 전부 'f'로 접는다. 그래서 "img가 있다"만 보는
  // 단언은 성별 배선이 통째로 끊겨도 통과한다. **양방향**으로 파일명 접미사를 본다 —
  // 한쪽만 두면 반대 성별로 하드코딩한 구현이 그대로 통과한다.
  it('남주 런은 _m 판본을 그린다', () => {
    const { container } = renderEnding([cgSlot()], 'male');
    expect(cgSrcs(container)[0]).toContain('doyun-graduation-sign_c0_m.png');
  });

  it('여주 런은 _f 판본을 그린다', () => {
    const { container } = renderEnding([cgSlot()], 'female');
    expect(cgSrcs(container)[0]).toContain('doyun-graduation-sign_c0_f.png');
  });
});

describe('엔딩 회상 — 학교급은 슬롯의 학년으로 (G3)', () => {
  it('Y1(초등) 회상은 elementary 자산으로 붙는다', () => {
    const { container } = renderEnding([cgSlot()]);
    expect(cgSrcs(container)[0]).toContain('elementary/');
  });

  it('엔딩의 state.year(=8)로 해석하면 그 CG는 사라진다 — 회귀 시 증상 고정', () => {
    // 위 테스트를 의미 있게 만들어 주는 전제. 이 단언이 깨지면(= common/ 폴백이 생기면)
    // 위 테스트는 year를 잘못 읽어도 통과하는 껍데기가 된다.
    expect(
      resolveEventCgUrl('doyun-graduation-sign', 0, 'male', 8),
      'high에는 이 id의 CG가 없으므로 후보가 0개여야 한다',
    ).toBeFalsy();
    expect(resolveEventCgUrl('doyun-graduation-sign', 0, 'male', 1)).toBeTruthy();
  });
});

// 위 G2는 "props를 주면 옳게 그린다"까지다. GameScreen이 그 props를 실제로, 옳은 값으로
// 넘기는지는 별개다 — required prop이라 **빠뜨리면** tsc -b가 막지만, 리터럴을 박거나 다른
// 필드를 넘기는 건 타입이 통과한다(Gender는 유니온 문자열이다). 그래서 라우터를 통과시켜 본다.
describe('엔딩 회상 — GameScreen이 그 판의 성별을 넘긴다 (G2 배선)', () => {
  const seeStore = async (gender: Gender) => {
    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = vi.fn();
    const { useGameStore } = await import('../../../engine/store');
    const { GameScreen } = await import('../../GameScreen');
    const { act, waitFor } = await import('@testing-library/react');

    act(() => { useGameStore.getState().resetGame(); });
    act(() => { useGameStore.getState().startGame(gender, ['emotional', 'wealth']); });
    act(() => {
      useGameStore.setState(s => ({
        state: { ...s.state!, phase: 'ending', year: 8, week: 1, currentEvent: null, memorySlots: [cgSlot()] },
      }));
    });
    const { container } = render(<GameScreen />);
    // EndingScreen은 lazy 청크라 첫 렌더는 Suspense 폴백이다.
    await waitFor(() => expect(cgSrcs(container).length).toBeGreaterThan(0));
    return cgSrcs(container)[0];
  };

  it('male로 시작한 판은 _m, female로 시작한 판은 _f — 양방향', async () => {
    expect(await seeStore('male')).toContain('_c0_m.png');
    expect(await seeStore('female')).toContain('_c0_f.png');
  });
});

describe('엔딩 후회 층 — 그림 없음 (G4)', () => {
  it('"미처 닿지 못한 것"에는 CG가 있어도 붙이지 않는다', () => {
    const { container } = renderEnding([cgSlot(), regretSlot()]);

    // 전제: 그 슬롯은 후회 본문으로 실제로 뽑혔고, 자산도 있다(= 자산 결핍이 아닌 의도).
    const regret = sectionOf(container, '미처 닿지 못한 것');
    expect(regret.textContent, '후회 본문에 그 슬롯이 안 뽑혔다 — 단언이 공허해진다')
      .toContain('끝내 하지 못한 말');
    expect(resolveEventCgUrl('doyun-graduation-sign', 1, 'male', 1)).toBeTruthy();

    expect(regret.querySelectorAll('img').length, '후회 층에 그림이 새어들었다').toBe(0);

    // 양성 짝 — 같은 판에서 회상 층은 그림을 진다(즉 "이 화면엔 원래 img가 없다"가 아니다).
    expect(sectionOf(container, '돌아보면').querySelectorAll('img').length).toBeGreaterThan(0);
  });
});
