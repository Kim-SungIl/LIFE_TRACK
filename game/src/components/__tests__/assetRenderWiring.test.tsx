// @vitest-environment jsdom
// 이미지 URL 배선 — 렌더 결과에서 확인하는 몫.
//
// assetUrlContract.test.tsx 의 소스 스캔은 "그 파일이 webpSrc를 import 하는가"만 본다.
// import 은 남긴 채 개별 경로의 래핑만 벗기면(= 실제로 배포된 적 있는 버그의 형태)
// 스캔은 전부 통과한다. 그래서 렌더 트리의 img src 를 직접 본다.
//
// 여기서 다루는 두 파일은 렌더 커버리지가 없던 곳이다:
//   Portrait.tsx        — src={webpSrc(src)}
//   YearEndScreen.tsx   — CG 썸네일 src={webpSrc(cg)} / 엠블럼 src={webpSrc(cat.art)}
//   EndingScreen.tsx    — 회상 갤러리/썸네일. 두 화면이 memoryVisuals.tsx를 공유하지만
//                         **URL을 만드는 건 각 화면**이라(resolveEventCgUrl 호출부가 따로다)
//                         한쪽만 잠그면 다른 쪽의 래핑 누락은 dev에서 안 보이고 릴리즈만 404다.
//   EventScene.tsx      — 이벤트 전신 스프라이트. 같은 파일의 배경 img는 assetUrlContract가 보지만
//                         **캐릭터 img는 아무도 안 봤다.** 여기서 래핑·성별·학년을 함께 잠근다.
// (TitleScreen 은 TitleScreenAssets.test.tsx, GameScreen prefetch 는 assetExistence.test.ts 가 잡는다.)
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { getBackground } from '../../engine/backgrounds';
import type { MemorySlot, Stats } from '../../engine/types';

vi.mock('../../engine/assetWebp', () => ({
  webpSrc: (p: string) => `WEBP::${p}`,
}));

import { Portrait } from '../Portrait';
import { EventScene } from '../EventScene';
import { YearEndScreen } from '../screens/YearEndScreen';
import { EndingScreen } from '../screens/EndingScreen';
import { calculateEnding } from '../../engine/ending';
import { makeState, makeEvent } from '../../test/fixtures';

vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));

const BASE = import.meta.env.BASE_URL;

function imgSrcs(container: HTMLElement): string[] {
  return [...container.querySelectorAll('img')].map(i => i.getAttribute('src') ?? '');
}

/** 렌더 트리 안의 모든 이미지 경로가 webpSrc 마커를 달고 있어야 한다. */
function expectNoUnwrappedImage(container: HTMLElement): void {
  const unwrapped = imgSrcs(container).filter(s => s.includes('images/') && !s.startsWith('WEBP::'));
  expect(unwrapped, 'webpSrc를 안 거친 이미지 경로').toEqual([]);
}

describe('Portrait — 캐릭터 초상 경로', () => {
  it('Y1(초등) 초상이 WEBP:: + BASE + images/characters/{id}_elementary_{expr}.png 로 붙는다', () => {
    const { container } = render(<Portrait characterId="jihun" year={1} expression="neutral" />);

    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.getAttribute('src')).toBe(`WEBP::${BASE}images/characters/jihun_elementary_neutral.png`);
    expectNoUnwrappedImage(container);
  });

  // **이 단언은 원래 `jihun_high_happy.png`였다 — 즉 결함을 잠그고 있었다.**
  // 그 파일은 실재한 적이 없고(표정 실물은 부모 happy 2장뿐), Portrait은 그걸 요청했다가
  // 실패한 뒤 neutral로 되돌아왔다. 이제 manifest로 먼저 걸러 실재하는 것만 요청한다.
  // 학년 프리픽스(_high)가 유지되는지는 그대로 본다 — 원래 이 테스트의 관심사다.
  it('Y6(고등) 초상은 _high 프리픽스로 붙는다 — 없는 표정은 요청하지 않는다', () => {
    const { container } = render(<Portrait characterId="jihun" year={6} expression="happy" />);

    expect(container.querySelector('img')!.getAttribute('src'))
      .toBe(`WEBP::${BASE}images/characters/jihun_high_neutral.png`);
    expectNoUnwrappedImage(container);
  });

  // 실재하는 표정은 그대로 간다 — 위 단언이 "표정을 통째로 무시"로 퇴화하지 않게 잠근다.
  // (부모 happy 2장이 지금 유일한 양성 표본이다. 표정 발주가 들어오면 여기가 넓어진다.)
  it('실재하는 표정은 요청한다 (부모 happy)', () => {
    const { container } = render(<Portrait characterId="mother" year={3} expression="happy" />);

    expect(container.querySelector('img')!.getAttribute('src'))
      .toBe(`WEBP::${BASE}images/characters/mother_middle_happy.png`);
  });
});

describe('EventScene — 이벤트 전신 스프라이트 경로', () => {
  // **이 describe 하나가 생존 뮤테이션 4종을 닫는다.** 추가 전에는 아래 넷이 전부
  // 전체 스위트를 초록으로 통과했다(실측):
  //   · src={webpSrc(src)} → src={src}          — dev는 멀쩡하고 릴리즈만 전 스프라이트 404
  //   · manifest 선선택 제거                     — 헛 요청이 되살아나도 순수함수 테스트는 초록
  //   · gender를 'male'로 고정                   — 여주 변주가 영구 미노출
  //   · year 인자 제거                           — 학년 프리픽스가 죽는다
  // 순수함수(spriteCandidates)는 characterManifest.test.ts가 잠그지만, **그걸 부르는 층**은
  // 여기서만 보인다(#431: prop을 받는 쪽 테스트는 prop을 만드는 층의 누락을 원리상 못 잡는다).
  function spriteSrc(gender: 'male' | 'female', year: number): string {
    const { container } = render(
      <EventScene
        event={makeEvent({ speakers: ['jihun'] })}
        gender={gender}
        year={year}
        onChoice={() => {}}
      />,
    );
    const img = container.querySelector('img[alt="jihun"]');
    expect(img, `jihun 스프라이트가 렌더되지 않았다 (${gender}, Y${year})`).toBeTruthy();
    return img!.getAttribute('src') ?? '';
  }

  it('여주 Y1 — 실재하는 _f 변주를 webpSrc로 감싸 요청한다', () => {
    // jihun_elementary_fullbody_f.png 는 리포에서 유일한 `_f` 실물이다.
    // 성별 분기가 죽으면 이 단언이 공용 전신으로 떨어져 실패한다.
    expect(spriteSrc('female', 1))
      .toBe(`WEBP::${BASE}images/characters/jihun_elementary_fullbody_f.png`);
  });

  it('남주 Y1 — _f를 건너뛰고 공용 전신으로 간다', () => {
    expect(spriteSrc('male', 1))
      .toBe(`WEBP::${BASE}images/characters/jihun_elementary_fullbody.png`);
  });

  it('여주 Y6 — _f 실물이 없는 학년은 공용 전신, 학년 프리픽스는 _high', () => {
    // year를 안 넘기면 _middle로 떨어지므로 학년 전달이 여기서 잠긴다.
    expect(spriteSrc('female', 6))
      .toBe(`WEBP::${BASE}images/characters/jihun_high_fullbody.png`);
  });

  it('렌더 트리에 래핑 안 된 이미지 경로가 없다', () => {
    const { container } = render(
      <EventScene
        event={makeEvent({ speakers: ['jihun'] })}
        gender="female"
        year={1}
        onChoice={() => {}}
      />,
    );
    expectNoUnwrappedImage(container);
  });
});

const STATS: Stats = { academic: 50, social: 50, talent: 50, mental: 50, health: 50 };

/** CG가 실제로 해석되는 슬롯 — cg-manifest 에 elementary/doyun-graduation-sign_c0_m.png 가 있다. */
function cgSlot(): MemorySlot {
  return {
    id: 'growth_1_10_0',
    category: 'growth',
    week: 10,
    year: 1,
    sourceEventId: 'doyun-graduation-sign',
    choiceIndex: 0,
    recallText: '그날 교실에서 이름을 적어 넣었다',
    importance: 8,
    phaseTag: 'early',
  };
}

/** CG도 NPC도 없는 슬롯 → 카테고리 엠블럼 아트로 떨어진다(MemoryThumb). */
function emblemSlot(): MemorySlot {
  return {
    id: 'growth_1_20_0',
    category: 'growth',
    week: 20,
    year: 1,
    sourceEventId: '__no_such_cg_event__',
    choiceIndex: 0,
    recallText: '조용히 지나간 한 주가 있었다',
    importance: 3,
    phaseTag: 'early',
  };
}

describe('YearEndScreen — CG 썸네일과 엠블럼 아트', () => {
  function renderYearEnd() {
    return render(
      <YearEndScreen
        year={1}
        gender="male"
        memorySlots={[cgSlot(), emblemSlot()]}
        milestoneScenes={[]}
        stats={STATS}
        bgProps={{ bg: getBackground(1, false, 'normal', 1), bgImgError: true, onImgError: () => {} }}
        onAdvance={() => {}}
      />,
    );
  }

  it('CG 갤러리 썸네일이 WEBP:: + BASE + images/events/... 로 붙는다', () => {
    const { container } = renderYearEnd();

    expect(imgSrcs(container))
      .toContain(`WEBP::${BASE}images/events/elementary/doyun-graduation-sign_c0_m.png`);
  });

  it('CG 없는 기억은 카테고리 엠블럼 아트가 WEBP:: + BASE + images/emblems/... 로 붙는다', () => {
    const { container } = renderYearEnd();

    expect(imgSrcs(container)).toContain(`WEBP::${BASE}images/emblems/growth.png`);
  });

  it('렌더 트리 어디에도 webpSrc를 안 거친 이미지가 없다', () => {
    const { container } = renderYearEnd();

    // 이 화면 하나에 CG·엠블럼·초상 경로가 모두 모이므로, 개별 단언이 놓친 자리도 여기서 걸린다.
    expect(imgSrcs(container).length).toBeGreaterThan(1);
    expectNoUnwrappedImage(container);
  });
});

describe('EndingScreen — 회상 갤러리와 썸네일', () => {
  function renderEnding() {
    // 엔딩 진입 시점의 실제 좌표(year=8) — 슬롯의 year로 해석해야 elementary 자산이 걸린다.
    const state = makeState({ year: 8, week: 1, memorySlots: [cgSlot(), emblemSlot()] });
    return render(
      <EndingScreen
        ending={calculateEnding(state)}
        track={state.track}
        stats={state.stats}
        parents={state.parents}
        burnoutCount={0}
        money={0}
        bgProps={{ bg: getBackground(1, false, 'normal', 8), bgImgError: true, onImgError: () => {} }}
        runDelta={null}
        gender="male"
        onRestartSameHome={null}
        onExitToTitle={() => {}}
      />,
    );
  }

  it('회상 CG가 WEBP:: + BASE + images/events/... 로 붙는다', () => {
    const { container } = renderEnding();

    expect(imgSrcs(container))
      .toContain(`WEBP::${BASE}images/events/elementary/doyun-graduation-sign_c0_m.png`);
  });

  it('CG 없는 회상의 엠블럼 아트도 WEBP:: 를 거친다', () => {
    const { container } = renderEnding();

    expect(imgSrcs(container)).toContain(`WEBP::${BASE}images/emblems/growth.png`);
  });

  it('렌더 트리 어디에도 webpSrc를 안 거친 이미지가 없다', () => {
    const { container } = renderEnding();

    expect(imgSrcs(container).length).toBeGreaterThan(1);
    expectNoUnwrappedImage(container);
  });
});
