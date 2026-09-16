// @vitest-environment jsdom
// **발주 명세가 주장하는 렌더 박스를 코드에 묶는다.**
//
// docs/character-expression-commission-2026-09.md §8은 화가에게 안전영역을 지시한다:
//   "52×65px 라운드 사각형, 2:3 원본이 세로 16.7%(상하 각 8.3%) 잘린다"
// 이 숫자가 틀리면 **돈을 주고 받은 그림의 정수리가 잘린다.** 문서와 코드가 갈리는 순간
// 아무도 모르게 틀린 채로 발주가 나가므로, 여기서 두 값을 한 번에 본다.
//
// 앞서 실제로 틀렸던 부분: 문서가 "52px 원형"이라고 적고 있었는데 실물은 원형이 아니고
// 52px는 가로일 뿐이며, cover 때문에 세로가 잘린다는 사실이 아예 빠져 있었다.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p }));

import { Portrait } from '../Portrait';

/** HUD·주간결산이 쓰는 크기. 두 곳 다 size={52}다. */
const HUD_SIZE = 52;
/** 납품 비율 2:3 → 가로/세로 */
const DELIVERED_RATIO = 2 / 3;

const DOC = resolve(process.cwd(), '../docs/character-expression-commission-2026-09.md');

function styleOf(size: number): CSSStyleDeclaration {
  const { container } = render(<Portrait characterId="jihun" year={1} expression="neutral" size={size} />);
  const img = container.querySelector('img');
  expect(img, '초상 img가 없다 — 이 테스트의 전제가 무너졌다').toBeTruthy();
  return img!.style;
}

describe('초상 렌더 박스 — 발주 안전영역의 근거', () => {
  it('가로는 size, 세로는 1:1.25 비율이다 (원형이 아니다)', () => {
    const st = styleOf(HUD_SIZE);
    expect(st.width).toBe(`${HUD_SIZE}px`);
    expect(st.aspectRatio.replace(/\s/g, '')).toBe('1/1.25');
    expect(st.height).toBe('auto');
    // cover가 아니면 잘림 자체가 없어져 문서의 안전영역 지시가 통째로 거짓이 된다.
    expect(st.objectFit).toBe('cover');
  });

  it('모서리는 size의 15% — 라운드 사각형이지 원이 아니다', () => {
    expect(styleOf(HUD_SIZE).borderRadius).toBe(`${HUD_SIZE * 0.15}px`);
    // 원이라면 반경이 세로의 절반(32.5px) 이상이어야 한다.
    expect(HUD_SIZE * 0.15).toBeLessThan((HUD_SIZE * 1.25) / 2);
  });

  it('2:3 납품본은 세로 16.7%(상하 각 8.3%)가 잘린다 — 문서의 숫자와 일치', () => {
    const boxRatio = 1 / 1.25;                       // 0.8
    // cover: 가로를 채우면 세로가 넘친다(납품이 더 홀쭉하므로).
    expect(DELIVERED_RATIO).toBeLessThan(boxRatio);
    const cropped = 1 - DELIVERED_RATIO / boxRatio;  // 넘쳐서 잘리는 세로 비율
    expect(cropped * 100).toBeCloseTo(16.7, 1);
    expect((cropped / 2) * 100).toBeCloseTo(8.3, 1);
    // 1536px 원본 기준 상하 128px씩 — 문서가 화가에게 주는 절대값이다.
    expect(Math.round((cropped / 2) * 1536)).toBe(128);
  });

  it('발주 문서가 같은 숫자를 적고 있다', () => {
    const doc = readFileSync(DOC, 'utf8');
    // 문서만 고치고 코드를 안 고치거나, 그 반대를 막는다.
    for (const needle of ['52×65', '16.7%', '8.3%', '128px', 'aspect-ratio:1/1.25']) {
      expect(doc, `발주 문서에 "${needle}"가 없다 — 코드와 문서가 갈렸다`).toContain(needle);
    }
    // 예전 오기가 되살아나지 않게 한다.
    expect(doc, '"52px 원형"은 틀린 표현이다(원이 아니다)').not.toContain('52px 원형');
  });
});
