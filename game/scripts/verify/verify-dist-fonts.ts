// 폰트 검증 — 배포 산출물(dist) 층
// **빌드 뒤에만 돌 수 있다.** verify-fonts.ts는 소스를 보지만, 소스가 옳아도 배포본이 틀릴 수 있다:
//   - 엔트리 import가 사라지면 dist에 woff2가 아예 안 나온다(소스 파일은 그대로 남아 있다)
//   - base('/LIFE_TRACK/')가 붙지 않으면 배포에서 폰트가 전부 404다 — 증상은 "그냥 시스템 폰트로
//     보임"이라 이 PR이 고친 버그와 눈으로 구분되지 않는다
//   - 미니파이가 @font-face/unicode-range를 유실하거나 저작권 고지를 지울 수 있다
//     (일반 `/*` 주석은 실제로 전부 제거된다. 그래서 고지는 `/*!` 로 열어야 한다)
//
// CI에서 verify:ci(content-verify job)와 build:release(build job)는 별도 러너라
// dist가 공유되지 않는다. 그래서 이 스크립트는 build job 안에서 빌드 직후에 돈다.
//
// 실행: cd game && npm run build && npx tsx scripts/verify/verify-dist-fonts.ts

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import {
  expectedPreloadUrls,
  MAX_FIRST_PAINT_PRELOAD_BYTES,
  MAX_FIRST_PAINT_PRELOAD_SUBSETS,
} from '../../src/styles/first-paint-fonts';

const DIST = resolve(import.meta.dirname, '../../dist');
const ASSETS = join(DIST, 'assets');
const EXPECTED_BASE = '/LIFE_TRACK/';
const MIN_SUBSETS = 50;

let failed = 0;
function assert(label: string, ok: boolean, detail = ''): void {
  if (ok) { console.log(`  ✓ ${label}`); return; }
  failed++;
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

console.log('\n=== 1. dist가 있다 (빌드 선행) ===');
assert('dist/assets가 존재한다', existsSync(ASSETS), 'npm run build 를 먼저 돌려라');
if (!existsSync(ASSETS)) { console.log('\n=== 결과: 중단 ===\n'); process.exit(1); }

const distFiles = readdirSync(ASSETS);

console.log('\n=== 2. 폰트 바이너리가 방출됐다 ===');

const woff2 = distFiles.filter(f => f.endsWith('.woff2'));
// import가 빠지면 여기서 0이 된다 — 소스 검사를 우회해도 이 게이트에서 걸린다.
assert(`woff2가 방출됐다 (${woff2.length}개 ≥ ${MIN_SUBSETS})`, woff2.length >= MIN_SUBSETS,
  woff2.length === 0
    ? '0개 — 아무도 pretendard.css를 import하지 않아 번들에서 빠졌을 가능성이 크다'
    : '조각 수가 줄었다 — 의도적 변경인지 확인해라');
// 해시가 붙어야 폰트 교체 시 캐시가 무효화된다.
const unhashed = woff2.filter(f => !/-[A-Za-z0-9_-]{8}\.woff2$/.test(f));
assert('모든 woff2에 콘텐츠 해시가 붙었다', unhashed.length === 0, unhashed.slice(0, 3).join(', '));

console.log('\n=== 3. CSS의 폰트 경로에 base가 붙었다 ===');

const cssFiles = distFiles.filter(f => f.endsWith('.css'));
assert('dist에 CSS가 있다', cssFiles.length > 0);
const css = cssFiles.map(f => readFileSync(join(ASSETS, f), 'utf8')).join('\n');

const cssFontUrls = [...css.matchAll(/url\(([^)]*\.woff2[^)]*)\)/g)]
  .map(m => m[1].replace(/^['"]|['"]$/g, ''));
assert(`CSS가 woff2를 참조한다 (${cssFontUrls.length}개)`, cssFontUrls.length >= MIN_SUBSETS,
  'CSS에 폰트 참조가 없다 — @font-face가 번들에 안 들어갔다');

// **배포 404를 잡는 유일한 게이트.** 소스에서는 상대경로라 확인할 방법이 없다.
const wrongBase = cssFontUrls.filter(u => !u.startsWith(EXPECTED_BASE));
assert(`모든 폰트 url이 '${EXPECTED_BASE}' 로 시작한다`, wrongBase.length === 0,
  `${wrongBase.slice(0, 3).join(', ')} — 배포 경로가 어긋나면 폰트가 전부 404다`);

// CSS가 가리키는 파일이 실제로 방출됐는지 (해시 재작성이 어긋나는 경우)
const distSet = new Set(woff2);
const dangling = cssFontUrls
  .map(u => u.slice(EXPECTED_BASE.length).replace(/^assets\//, ''))
  .filter(name => !distSet.has(name));
assert('CSS가 가리키는 모든 폰트 파일이 dist에 있다', dangling.length === 0, dangling.slice(0, 3).join(', '));

console.log('\n=== 4. 미니파이 후에도 조각 구조가 남았다 ===');

const faceCount = (css.match(/@font-face/g) ?? []).length;
const rangeCount = (css.match(/unicode-range:/g) ?? []).length;
const swapCount = (css.match(/font-display:\s*swap/g) ?? []).length;

assert(`@font-face가 남았다 (${faceCount}개)`, faceCount >= MIN_SUBSETS);
assert(`unicode-range가 @font-face 수와 같다 (${rangeCount}/${faceCount})`, rangeCount === faceCount,
  'unicode-range가 유실되면 그 조각은 조건 없이 항상 받아진다 — 첫 화면이 무거워진다');
assert(`font-display: swap이 @font-face 수와 같다 (${swapCount}/${faceCount})`, swapCount === faceCount);

console.log('\n=== 5. 배포본에 라이선스가 동봉됐다 (SIL OFL) ===');

// OFL 1.1은 재배포 시 저작권 고지 + 라이선스 사본을 요구한다. 리포에만 있으면 조건 미충족 —
// 실제로 사용자에게 나가는 건 dist다.
assert('CSS에 저작권 고지가 남았다', /Open Font License/i.test(css),
  '미니파이가 고지를 지웠다 — pretendard.css의 고지를 `/*!` 로 열어라');

const licenseCopies = [
  join(DIST, 'fonts/OFL.txt'),
  ...distFiles.filter(f => /OFL/i.test(f)).map(f => join(ASSETS, f)),
].filter(existsSync);
assert('라이선스 사본이 dist에 있다', licenseCopies.length > 0,
  'public/fonts/OFL.txt 가 있으면 Vite가 dist로 복사한다');
if (licenseCopies.length > 0) {
  const ofl = readFileSync(licenseCopies[0], 'utf8');
  assert('사본이 OFL 본문이다', /SIL OPEN FONT LICENSE/i.test(ofl));
}

const totalBytes = woff2.reduce((s, f) => s + readFileSync(join(ASSETS, f)).length, 0);
console.log(`\n  (참고) 배포 폰트 총량: ${(totalBytes / 1024 / 1024).toFixed(2)} MB / ${woff2.length}개`);

console.log('\n=== 6. 첫 화면 폰트 preload (index.html ↔ dist CSS) ===');

const INDEX = join(DIST, 'index.html');
assert('dist/index.html이 있다', existsSync(INDEX));

const indexHtml = existsSync(INDEX) ? readFileSync(INDEX, 'utf8') : '';
const linkTags = [...indexHtml.matchAll(/<link\b[^>]*>/gi)].map(m => m[0]);

function linkAttr(tag: string, name: string): string | undefined {
  const quoted = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  if (quoted) return quoted[1] ?? quoted[2];
  if (new RegExp(`\\b${name}(?:\\s|/|>)`, 'i').test(tag)) return '';
  return undefined;
}

const fontPreloads = linkTags.filter(tag =>
  linkAttr(tag, 'rel') === 'preload' && linkAttr(tag, 'as') === 'font');

const expectedUrls = expectedPreloadUrls(css);
const actualUrls = fontPreloads.map(tag => linkAttr(tag, 'href') ?? '');
const expectedSet = new Set(expectedUrls);
const actualSet = new Set(actualUrls);

assert(
  `font preload href 집합이 계산된 집합과 같다 (${expectedUrls.length}개)`,
  actualSet.size === expectedSet.size
    && actualUrls.length === expectedUrls.length
    && expectedUrls.every(u => actualSet.has(u)),
  `expected=[${expectedUrls.join(', ')}] actual=[${actualUrls.join(', ')}]`,
);

for (const tag of fontPreloads) {
  const href = linkAttr(tag, 'href') ?? '';
  assert(`crossorigin이 있다 (${href.slice(-32)})`, linkAttr(tag, 'crossorigin') !== undefined,
    '없으면 preload 익명 + CSS CORS로 폰트를 두 번 받는다');
  assert(`as=font type=font/woff2 (${href.slice(-32)})`,
    linkAttr(tag, 'as') === 'font' && linkAttr(tag, 'type') === 'font/woff2');
}

const cssUrlSet = new Set(cssFontUrls);
const notInCss = actualUrls.filter(u => !cssUrlSet.has(u));
assert('각 preload href가 dist CSS url과 문자열이 같다', notInCss.length === 0,
  `${notInCss.slice(0, 3).join(', ')} — ./assets 나 다른 해시면 별개 리소스다`);

const missingFiles = actualUrls
  .map(u => u.slice(EXPECTED_BASE.length).replace(/^assets\//, ''))
  .filter(name => !distSet.has(name));
assert('각 preload href 파일이 dist에 있다', missingFiles.length === 0, missingFiles.slice(0, 3).join(', '));

assert(
  `font preload 조각 수 ≤ ${MAX_FIRST_PAINT_PRELOAD_SUBSETS}`,
  actualUrls.length <= MAX_FIRST_PAINT_PRELOAD_SUBSETS,
  `${actualUrls.length}개 — 92조각 전부 preload는 첫 페인트를 늦춘다`,
);

const preloadBytes = actualUrls.reduce((s, u) => {
  const name = u.slice(EXPECTED_BASE.length).replace(/^assets\//, '');
  return s + (distSet.has(name) ? readFileSync(join(ASSETS, name)).length : 0);
}, 0);
assert(
  `font preload 총 바이트 ≤ ${(MAX_FIRST_PAINT_PRELOAD_BYTES / 1024).toFixed(0)}KB (실측 229.2KB)`,
  preloadBytes <= MAX_FIRST_PAINT_PRELOAD_BYTES,
  `${(preloadBytes / 1024).toFixed(1)}KB`,
);

console.log(`  (참고) 첫 화면 preload: ${actualUrls.length}조각 / ${(preloadBytes / 1024).toFixed(1)}KB`);

console.log(`\n=== 결과: ${failed === 0 ? '통과' : `${failed}건 실패`} ===\n`);
process.exit(failed === 0 ? 0 : 1);
