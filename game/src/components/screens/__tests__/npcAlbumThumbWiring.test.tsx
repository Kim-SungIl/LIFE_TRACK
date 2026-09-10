// @vitest-environment jsdom
// **앨범 격자가 축소본을, 라이트박스가 원본을 쓰는가.**
//
// `cgThumbSrc` 자체는 assetWebp.test.ts가 잠근다. 하지만 순수함수가 옳아도 **격자가 그걸
// 부르는지는 별개**다 — 격자를 `cgUrl`로 되돌리면 44px 셀이 다시 1440x810을 받고(지훈
// 여주판 54칸 7.4MB), 테스트는 전부 초록인 채로 회귀가 나간다. 같은 계열 선례가 #397·#431.
//
// 테스트 환경에서는 `__WEBP_ENABLED__`가 false라 두 함수가 **같은 값**을 낸다. 그래서
// assetWebp를 구분 가능한 값으로 목해서 두 경로가 실제로 갈리는지 본다.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../../engine/assetWebp', () => ({
  webpSrc: (p: string) => `FULL::${p}`,
  cgThumbSrc: (p: string) => `THUMB::${p}`,
}));

import { NpcAlbumScreen } from '../NpcAlbumScreen';
import { albumFor, slotPath } from '../../../engine/npcAlbum';

const NPC = 'jihun';
const GENDER = 'male' as const;

/** 그 인물 남주판의 실제 슬롯 경로 전부 — 이걸 "본 것"으로 주면 모든 칸이 그림을 싣는다. */
function allPaths(): string[] {
  return albumFor(NPC, GENDER)
    .flatMap(b => b.slots)
    .map(s => slotPath(s, GENDER))
    .filter((p): p is string => p !== null);
}

function renderAlbum() {
  const seen = allPaths();
  render(
    <NpcAlbumScreen
      npcId={NPC}
      story={{ seen: seen.length, total: seen.length }}
      seenCgFiles={seen}
      onBack={() => {}}
    />,
  );
  return seen;
}

/** CG만 고른다 — 초상·엠블럼은 이 배선의 대상이 아니다. */
function cgImgs(): HTMLImageElement[] {
  return [...document.querySelectorAll('img')].filter(i => i.getAttribute('src')?.includes('images/events/')) as HTMLImageElement[];
}

describe('인물 앨범 — 격자는 축소본, 라이트박스는 원본', () => {
  it('전제: 격자에 CG가 실제로 그려진다 (0장이면 아래 단언이 공허해진다)', () => {
    const seen = renderAlbum();
    expect(seen.length, '전제 붕괴: 지훈 남주판 슬롯이 사라졌다').toBeGreaterThan(20);
    expect(cgImgs().length, '전제 붕괴: 격자에 CG가 한 장도 없다').toBeGreaterThan(20);
  });

  it('격자의 CG는 전부 축소본 경로다', () => {
    renderAlbum();
    const srcs = cgImgs().map(i => i.getAttribute('src') ?? '');
    expect(srcs.every(s => s.startsWith('THUMB::')), `원본을 쓰는 칸이 있다: ${srcs.find(s => !s.startsWith('THUMB::'))}`).toBe(true);
    expect(srcs.some(s => s.startsWith('FULL::'))).toBe(false);
  });

  it('칸을 열면 라이트박스는 원본을 쓴다 (축소본을 76vh로 늘리면 뭉갠다)', () => {
    renderAlbum();
    const before = cgImgs().length;
    fireEvent.click(cgImgs()[0]);
    const after = cgImgs();
    expect(after.length, '전제 붕괴: 라이트박스가 안 열렸다').toBe(before + 1);
    const opened = after.filter(i => (i.getAttribute('src') ?? '').startsWith('FULL::'));
    expect(opened.length, '라이트박스가 축소본을 쓰고 있다').toBe(1);
  });

  it('격자와 라이트박스가 같은 그림의 서로 다른 경로를 쓴다', () => {
    renderAlbum();
    const gridSrc = cgImgs()[0].getAttribute('src') ?? '';
    fireEvent.click(cgImgs()[0]);
    const lightbox = cgImgs().find(i => (i.getAttribute('src') ?? '').startsWith('FULL::'));
    const rel = gridSrc.replace('THUMB::', '');
    expect(lightbox?.getAttribute('src')).toBe(`FULL::${rel}`);
  });
});

describe('닫기', () => {
  it('라이트박스를 닫으면 원본 요청이 사라진다', () => {
    renderAlbum();
    fireEvent.click(cgImgs()[0]);
    expect(cgImgs().some(i => (i.getAttribute('src') ?? '').startsWith('FULL::'))).toBe(true);
    fireEvent.click(screen.getByLabelText('닫기'));
    expect(cgImgs().some(i => (i.getAttribute('src') ?? '').startsWith('FULL::'))).toBe(false);
  });
});
