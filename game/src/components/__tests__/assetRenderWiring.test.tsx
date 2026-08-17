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
// (TitleScreen 은 TitleScreenAssets.test.tsx, GameScreen prefetch 는 assetExistence.test.ts 가 잡는다.)
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { getBackground } from '../../engine/backgrounds';
import type { MemorySlot, Stats } from '../../engine/types';

vi.mock('../../engine/assetWebp', () => ({
  webpSrc: (p: string) => `WEBP::${p}`,
}));

import { Portrait } from '../Portrait';
import { YearEndScreen } from '../screens/YearEndScreen';

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

  it('Y6(고등) 초상은 _high 프리픽스로 붙는다 — 학년이 바뀌어도 래핑은 유지된다', () => {
    const { container } = render(<Portrait characterId="jihun" year={6} expression="happy" />);

    expect(container.querySelector('img')!.getAttribute('src'))
      .toBe(`WEBP::${BASE}images/characters/jihun_high_happy.png`);
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
