// @vitest-environment jsdom
// **앨범 격자가 축소본을, 라이트박스가 원본을 쓰는가.**
//
// `cgThumbSrc` 자체는 assetWebp.test.ts가 잠근다. 하지만 순수함수가 옳아도 **격자가 그걸
// 부르는지는 별개**다 — 격자를 `cgUrl`로 되돌리면 44px 셀이 다시 1440x810을 받고(지훈
// 여주판 54칸 6.19MB), 테스트는 전부 초록인 채로 회귀가 나간다. 같은 계열 선례가 #397·#431.
//
// 테스트 환경에서는 `__WEBP_ENABLED__`가 false라 두 함수가 **같은 값**을 낸다. 그래서
// assetWebp를 구분 가능한 값으로 목해서 두 경로가 실제로 갈리는지 본다.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// importOriginal을 전개하는 이유: vi.mock의 factory는 모듈을 **통째로** 대체한다. 나열하지
// 않은 export는 undefined가 되므로, assetWebp에 export가 하나 늘 때마다 이 파일이 아니라
// **무관한 다른 테스트**가 터진다(실제로 겪었다 — archiveWiring 16건). 아래 두 함수는 어차피
// 덮어쓰므로 오늘 동작은 동일하고, 내일 늘어날 export만 원본에서 새어 들어온다.
vi.mock('../../../engine/assetWebp', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../engine/assetWebp')>()),
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
    // 라이트박스는 두 장이다 — 자리표시(축소본) + 원본. 아래 blur-up 테스트가 그 계약을 본다.
    expect(after.length, '전제 붕괴: 라이트박스가 안 열렸다').toBe(before + 2);
    const opened = after.filter(i => (i.getAttribute('src') ?? '').startsWith('FULL::'));
    expect(opened.length, '라이트박스가 축소본만 쓰고 있다').toBe(1);
  });

  // blur-up 자리표시 — 이걸 지우면 칸을 누른 뒤 원본 115KB가 도착할 때까지 검은 화면에
  // 빈 칸이 남는다(격자가 축소본만 갖고 있으므로 캐시 적중이 없다). 눈에만 보이는 회귀라
  // 배선으로 잠근다. 원본 <img>가 opacity 0으로 시작하는 것까지 함께 본다 —
  // opacity 전환을 지우면 자리표시가 있어도 덜 로드된 원본이 위에서 가린다.
  it('라이트박스는 축소본 자리표시를 깔고 원본을 그 위에 덮는다', () => {
    renderAlbum();
    fireEvent.click(cgImgs()[0]);
    const lightbox = cgImgs().slice(-2);
    const [placeholder, fullImg] = lightbox;
    expect(placeholder.getAttribute('src') ?? '', '자리표시가 축소본이 아니다').toMatch(/^THUMB::/);
    expect(placeholder.getAttribute('aria-hidden'), '자리표시가 접근성 트리에 노출된다').toBe('true');
    expect(fullImg.getAttribute('src') ?? '').toMatch(/^FULL::/);
    expect(fullImg.style.opacity, '원본이 로드 전부터 불투명하다 — 전환이 죽었다').toBe('0');
  });

  it('격자와 라이트박스가 같은 그림의 서로 다른 경로를 쓴다', () => {
    renderAlbum();
    const gridSrc = cgImgs()[0].getAttribute('src') ?? '';
    fireEvent.click(cgImgs()[0]);
    const lightbox = cgImgs().find(i => (i.getAttribute('src') ?? '').startsWith('FULL::'));
    const rel = gridSrc.replace('THUMB::', '');
    expect(lightbox?.getAttribute('src')).toBe(`FULL::${rel}`);
    // 자리표시도 **같은 그림**의 축소본이어야 한다 — 다른 칸의 축소본을 깔면 순간 엉뚱한 그림이 뜬다.
    expect(cgImgs().slice(-2)[0].getAttribute('src')).toBe(`THUMB::${rel}`);
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
