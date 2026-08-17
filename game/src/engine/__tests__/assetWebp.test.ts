// webpSrc — 릴리즈 빌드(GEN_WEBP=1)에서 .png → .webp 스왑 계약.
//
// vite define이 테스트 번들에서 `__WEBP_ENABLED__`를 `false`로 인라인하므로,
// import한 모듈에 vi.stubGlobal을 해도 활성 분기에 닿지 않는다. 소스 본문을
// new Function으로 글로벌 스코프에서 실행하면 stubGlobal이 가드에 실제로 닿는다.
// (뮤테이션은 소스 파일을 고치므로 본문을 디스크에서 읽어야 1·2·3을 잡을 수 있다.)
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { webpSrc as exportedWebpSrc } from '../assetWebp';

afterEach(() => {
  vi.unstubAllGlobals();
});

function webpSrcFromSource(path: string): string {
  const src = readFileSync(resolve(process.cwd(), 'src/engine/assetWebp.ts'), 'utf8');
  const m = src.match(/export function webpSrc\(path: string\): string \{\n([\s\S]*?)\n\}/);
  if (!m) throw new Error('webpSrc 본문을 assetWebp.ts에서 찾지 못함');
  const fn = new Function('path', m[1]) as (p: string) => string;
  return fn(path);
}

describe('webpSrc (모듈 export — 테스트 define=false)', () => {
  it('테스트 환경에서는 입력을 그대로 반환한다', () => {
    expect(exportedWebpSrc('a.png')).toBe('a.png');
    expect(exportedWebpSrc('/images/x.png?v=1')).toBe('/images/x.png?v=1');
  });
});

describe('webpSrc (__WEBP_ENABLED__ 양방향)', () => {
  it('비활성(스텁 없음): 입력을 그대로 반환한다', () => {
    expect(webpSrcFromSource('a.png')).toBe('a.png');
    expect(webpSrcFromSource('/images/bg.png')).toBe('/images/bg.png');
  });

  it('비활성(false): 입력을 그대로 반환한다', () => {
    vi.stubGlobal('__WEBP_ENABLED__', false);
    expect(webpSrcFromSource('a.png')).toBe('a.png');
    expect(webpSrcFromSource('a.png?v=1')).toBe('a.png?v=1');
  });

  it('활성(true): .png를 .webp로 스왑한다', () => {
    vi.stubGlobal('__WEBP_ENABLED__', true);
    expect(webpSrcFromSource('a.png')).toBe('a.webp');
    expect(webpSrcFromSource('/images/bg.png')).toBe('/images/bg.webp');
  });

  it('활성: 쿼리·해시를 보존한다', () => {
    vi.stubGlobal('__WEBP_ENABLED__', true);
    expect(webpSrcFromSource('a.png?v=1')).toBe('a.webp?v=1');
    expect(webpSrcFromSource('a.png#x')).toBe('a.webp#x');
    expect(webpSrcFromSource('a.png?v=1#x')).toBe('a.webp?v=1#x');
  });

  it('활성: 비대상(.jpg, 이미 .webp, 확장자 없음)은 무변경', () => {
    vi.stubGlobal('__WEBP_ENABLED__', true);
    expect(webpSrcFromSource('a.jpg')).toBe('a.jpg');
    expect(webpSrcFromSource('a.webp')).toBe('a.webp');
    expect(webpSrcFromSource('a')).toBe('a');
    expect(webpSrcFromSource('/images/bg.jpeg')).toBe('/images/bg.jpeg');
  });

  it('활성: 경로 중간의 .png는 바꾸지 않는다', () => {
    vi.stubGlobal('__WEBP_ENABLED__', true);
    expect(webpSrcFromSource('foo.png.bak')).toBe('foo.png.bak');
    expect(webpSrcFromSource('dir.png/x.jpg')).toBe('dir.png/x.jpg');
  });

  it('활성: 대문자 .PNG도 스왑한다 (i 플래그)', () => {
    vi.stubGlobal('__WEBP_ENABLED__', true);
    expect(webpSrcFromSource('a.PNG')).toBe('a.webp');
    expect(webpSrcFromSource('a.PnG?v=1')).toBe('a.webp?v=1');
  });
});
