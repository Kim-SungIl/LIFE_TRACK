// @vitest-environment jsdom
// 타이틀 화면 이미지 경로 계약 — 릴리즈 빌드(webp-gen)가 dist의 png를 전부 삭제하므로
// 모든 이미지 소비 지점은 webpSrc를 경유해야 한다. 경유를 빠뜨리면 dev는 멀쩡하고
// 배포본에서만 404가 나서 로컬에서 잡히지 않는다(실제로 그렇게 새어나간 적 있음).
//  - <img src>: webpSrc 경유 여부를 모킹으로 직접 확인
//  - CSS url(): 번들된 CSS는 플러그인이 스왑해주지 않으므로 아예 참조가 없어야 한다
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';

// webpSrc를 마커로 대체 — 경유하지 않은 경로는 마커가 없어 즉시 드러난다.
vi.mock('../../engine/assetWebp', () => ({
  webpSrc: (p: string) => `WEBP::${p}`,
}));

import { TitleScreen } from '../TitleScreen';

// vitest cwd = game/ — jsdom 환경에선 import.meta.url이 file: 스킴이 아니라 cwd 기준으로 잡는다
const CSS_PATH = resolve(process.cwd(), 'src/styles/game.css');

describe('타이틀 화면 이미지 경로', () => {
  it('전신 이미지 2장은 webpSrc를 경유한다 (릴리즈에서 png 삭제됨)', () => {
    render(<TitleScreen />);
    const figures = document.querySelectorAll<HTMLImageElement>('.title-screen__figure');
    expect(figures.length).toBe(2);
    for (const img of figures) {
      expect(img.getAttribute('src')).toMatch(/^WEBP::/);
      expect(img.getAttribute('src')).toMatch(/images\/characters\/player_[mf]_\w+_fullbody\.png$/);
    }
  });

  it('배경 사진은 CSS가 아니라 --title-bg-image로 주입되고 webpSrc를 경유한다', () => {
    render(<TitleScreen />);
    const bg = document.querySelector<HTMLElement>('.title-screen__bg');
    expect(bg).toBeTruthy();
    const injected = bg!.style.getPropertyValue('--title-bg-image');
    expect(injected).toContain('WEBP::');
    expect(injected).toMatch(/images\/backgrounds\/[\w-]+\.png/);
  });

  it('game.css는 이미지 png를 url()로 직접 참조하지 않는다 (번들 CSS는 webp 스왑 대상이 아님)', () => {
    const css = readFileSync(CSS_PATH, 'utf8');
    const pngUrls = css.match(/url\([^)]*images\/[^)]*\.png[^)]*\)/gi) ?? [];
    expect(pngUrls).toEqual([]);
    // 양성 짝 — 파일을 제대로 읽었는지(정규식이 빈 문자열을 훑고 통과하는 것 방지)
    expect(css).toContain('.title-screen__bg');
  });
});

describe('타이틀 화면 인물 배치', () => {
  it('cast 컨테이너는 장식이라 스크린리더에서 숨기고 클릭을 가로채지 않는다', () => {
    render(<TitleScreen />);
    const cast = document.querySelector('.title-screen__cast');
    expect(cast).toBeTruthy();
    expect(cast!.getAttribute('aria-hidden')).toBe('true');
    // 인물이 버튼 위를 덮어도 조작을 막지 않아야 한다 → 새 게임 버튼이 접근 가능
    expect(screen.getByRole('button', { name: /새 게임/ })).toBeInTheDocument();
  });
});
