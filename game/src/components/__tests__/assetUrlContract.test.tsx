// @vitest-environment jsdom
// 이미지 URL 배선 계약 — 릴리즈 빌드(webp-gen)가 dist의 png를 전부 삭제하므로
// DOM에 닿는 경로는 반드시 webpSrc를 경유해야 하고, getEventBackground가 돌려주는
// `/images/...` 는 BASE_URL 접두 + 선행 슬래시 제거를 거쳐야 한다.
//
// BASE_URL: stubEnv/resetModules를 쓰지 않는다. EventScene은 모듈 최상단 const로
// import.meta.env.BASE_URL을 잡지만, 테스트와 같은 Vite 환경에서 로드되므로
// 테스트가 읽은 import.meta.env.BASE_URL 값으로 정확한 문자열을 단언한다.
import { describe, it, expect, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { getBackground } from '../../engine/backgrounds';
import { makeEvent } from '../../test/fixtures';

vi.mock('../../engine/assetWebp', () => ({
  webpSrc: (p: string) => `WEBP::${p}`,
}));

import { BgWrapper } from '../screens/BgWrapper';
import { EventScene } from '../EventScene';
import { EventResultScreen } from '../screens/EventResultScreen';
import type { EventResultData } from '../screens/shared';

const BASE = import.meta.env.BASE_URL;
const SRC_ROOT = resolve(process.cwd(), 'src');

/** getEventBackground('classroom_{school}_afternoon', year=1) 이 만드는 경로 */
const EVENT_BG_KEY = 'classroom_{school}_afternoon';
const EVENT_BG_FILE = 'images/backgrounds/classroom_elementary_afternoon.png';

function expectedSrc(relPng: string, wraps = 1): string {
  return `${'WEBP::'.repeat(wraps)}${BASE}${relPng}`;
}

function assertWiredBgSrc(src: string | null, relPng: string, wraps = 1): void {
  expect(src).toBe(expectedSrc(relPng, wraps));
  expect(src).toContain('WEBP::');
  expect(src).toContain(BASE);
  expect(src).toContain(relPng);
  expect(src).not.toContain('//images');
}

// 경로를 만들지만 URL을 소비하지 않는 파일 — DOM에 안 닿으므로 webpSrc 경유가 없다.
// 이 배열을 늘리려면 이 단언을 함께 고쳐야 한다(리뷰에서 보인다).
const WEBPSRC_NONCONSUMERS = [
  'src/cg-manifest.generated.ts',
  'src/engine/backgrounds.ts',
  'src/engine/eventCg.ts',
] as const;

function listSrcFiles(): string[] {
  return readdirSync(SRC_ROOT, { recursive: true, encoding: 'utf8' })
    .filter(rel => /\.(ts|tsx)$/.test(rel))
    .filter(rel => !rel.includes('__tests__'))
    .filter(rel => !rel.endsWith('.test.ts') && !rel.endsWith('.test.tsx'))
    .map(rel => rel.replaceAll('\\', '/'));
}

function constructsPngImagePath(source: string): boolean {
  return /images\/[^\n'"`]*\.png/.test(source)
    || /['"`]\/?images\/(?:backgrounds|characters|events|emblems)\//.test(source);
}

function importsWebpSrc(source: string): boolean {
  return /import\s*\{[^}]*\bwebpSrc\b[^}]*\}\s*from\s*['"][^'"]*assetWebp['"]/.test(source);
}

describe('소스 스캔 — png 경로 생산자는 webpSrc를 import한다', () => {
  it('비소비 예외 목록은 고정이다', () => {
    expect([...WEBPSRC_NONCONSUMERS]).toEqual([
      'src/cg-manifest.generated.ts',
      'src/engine/backgrounds.ts',
      'src/engine/eventCg.ts',
    ]);
  });

  it('예외 3파일은 존재하고 webpSrc를 import하지 않는다', () => {
    for (const rel of WEBPSRC_NONCONSUMERS) {
      const source = readFileSync(resolve(process.cwd(), rel), 'utf8');
      expect(source.length, rel).toBeGreaterThan(0);
      expect(importsWebpSrc(source), rel).toBe(false);
    }
  });

  it('images/...png 경로를 만드는 소비처는 전부 webpSrc를 import한다', () => {
    const files = listSrcFiles();
    expect(files.length).toBeGreaterThan(20);

    const offenders: string[] = [];
    const producers: string[] = [];
    for (const rel of files) {
      const source = readFileSync(resolve(SRC_ROOT, rel), 'utf8');
      if (!constructsPngImagePath(source)) continue;
      producers.push(`src/${rel}`);
      const listed = `src/${rel}`;
      if (WEBPSRC_NONCONSUMERS.includes(listed as typeof WEBPSRC_NONCONSUMERS[number])) continue;
      if (!importsWebpSrc(source)) offenders.push(listed);
    }

    expect(producers.length, 'png 경로 생산자가 0이면 스캔이 빈 문자열을 통과한다').toBeGreaterThan(5);
    expect(offenders).toEqual([]);
  });
});

describe('렌더 계약 — BASE_URL + 선행 슬래시 제거 + webpSrc 경유', () => {
  it('BgWrapper: getBackground() image가 WEBP:: + BASE + images/... 로 붙는다', () => {
    const bg = getBackground(1, false, 'normal', 1);
    expect(bg.image).toBe('/images/backgrounds/classroom_elementary_spring.png');

    const { container } = render(
      <BgWrapper bg={bg} bgImgError={false} onImgError={() => {}}>
        <span>child</span>
      </BgWrapper>,
    );
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    assertWiredBgSrc(img!.getAttribute('src'), 'images/backgrounds/classroom_elementary_spring.png', 1);
  });

  it('EventScene: event.background 후보가 webpSrc를 두 번 경유한다 (map + img src)', () => {
    // 현재 배선: bgCandidates.map(webpSrc) 후 <img src={webpSrc(bgImageUrl)}>.
    // map만 지우면 마커가 한 겹이 되므로 wraps=2 단언이 자리별 뮤테이션을 잡는다.
    const { container } = render(
      <EventScene
        event={makeEvent({ background: EVENT_BG_KEY })}
        gender="male"
        year={1}
        onChoice={() => {}}
      />,
    );
    const img = container.querySelector('img[alt="background"]');
    expect(img).toBeTruthy();
    assertWiredBgSrc(img!.getAttribute('src'), EVENT_BG_FILE, 2);
  });

  it('EventResultScreen: event.background 후보가 WEBP:: + BASE + images/... 로 붙는다', () => {
    const event = makeEvent({ background: EVENT_BG_KEY });
    const eventResultData: EventResultData = {
      message: '결과',
      effects: [],
      event,
      choiceIndex: 0,
    };
    const { container } = render(
      <EventResultScreen
        gender="male"
        year={1}
        eventResultData={eventResultData}
        cgLoaded={false}
        cgError
        onCgLoaded={() => {}}
        onCgError={() => {}}
        onContinue={() => {}}
      />,
    );
    const img = container.querySelector('img[data-bg-idx="0"]');
    expect(img).toBeTruthy();
    assertWiredBgSrc(img!.getAttribute('src'), EVENT_BG_FILE, 1);
  });
});
