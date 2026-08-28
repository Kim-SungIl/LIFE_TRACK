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
  parseFontFaceSubsets,
  subsetIndexCovering,
  FIRST_PAINT_TEXT,
  FIRST_PAINT_EXCEPTION_GLYPHS,
  MAX_FIRST_PAINT_PRELOAD_BYTES,
  MAX_FIRST_PAINT_PRELOAD_SUBSETS,
} from '../../src/styles/first-paint-fonts';

// 지상검증 앵커 — 계산을 거치지 않은 리터럴. 조각당 1자씩.
//
// **왜 필요한가**: 주입하는 쪽(vite 플러그인)과 검사하는 이쪽이 같은 `expectedPreloadUrls`
// / `parseFontFaceSubsets`를 쓴다. 그 공유 코드가 틀리면 양쪽이 사이좋게 틀려서 아래
// "집합이 계산된 집합과 같다"가 통과한다. 실측: @font-face 블록의 url↔unicode-range 짝을
// 한 칸 밀면 **틀린 9조각 218.4KB가 배포되는데 이 섹션도 잠금 테스트도 전부 통과**했다.
// 리터럴을 박아 두면 그 드리프트가 여기서 터진다.
//
// 서브셋을 다시 생성했다면 이 표를 갱신하되, 갱신 전에 실제 unicode-range를 눈으로 볼 것.
// (표를 화면에 맞춰 고치는 게 아니라, 매핑이 왜 바뀌었는지를 먼저 확인하라는 뜻이다.)
const SUBSET_ANCHORS: ReadonlyArray<readonly [string, number]> = [
  ['꾼', 82], ['됨', 83], ['씩', 84], ['긴', 86], ['친', 87],
  ['초', 88], ['년', 89], ['의', 90], ['7', 91],
];

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

// woff2를 가리키는 **모든** link. `as=font`만 걸러 보면, 같은 폰트를 다른 hint로 한 번 더
// 거는 태그(as=fetch 등)를 못 본다 — 그건 CSS의 폰트 페치와 재사용되지 않아 또 받는다.
const woff2Links = linkTags.filter(tag => (linkAttr(tag, 'href') ?? '').endsWith('.woff2'));
assert(
  `woff2를 가리키는 link가 전부 font preload다 (${fontPreloads.length}/${woff2Links.length})`,
  woff2Links.length === fontPreloads.length,
  woff2Links.filter(t => !fontPreloads.includes(t)).slice(0, 2).join(' | '),
);

const expectedUrls = expectedPreloadUrls(css);
const actualUrls = fontPreloads.map(tag => linkAttr(tag, 'href') ?? '');
const expectedSet = new Set(expectedUrls);
const actualSet = new Set(actualUrls);

// 바닥 — expected와 actual이 **둘 다 0**이면 아래 집합 동일성은 조용히 통과한다.
// (파서가 조각을 하나도 못 읽은 상태가 정확히 그렇다.)
assert(`preload 기댓값이 비지 않았다 (${expectedUrls.length}개 ≥ 5)`, expectedUrls.length >= 5,
  '0개면 파서가 조각을 못 읽은 것이다 — 집합 동일성만으론 안 걸린다');

// [지상검증 A] 앵커 — 공유 파서가 드리프트하면 계산된 집합도 함께 틀어져 집합 동일성이
// 통과한다. 리터럴 기댓값은 같이 안 틀어진다.
{
  const faces = parseFontFaceSubsets(css);
  const drifted = SUBSET_ANCHORS
    .filter(([ch, idx]) => subsetIndexCovering(ch, faces) !== idx)
    .map(([ch, idx]) => `${ch}: 기대 ${idx} / 실제 ${subsetIndexCovering(ch, faces)}`);
  assert(`앵커 글자 ${SUBSET_ANCHORS.length}자가 기대 조각에 있다`, drifted.length === 0,
    `${drifted.slice(0, 4).join(' · ')} — unicode-range 파싱이 드리프트했다`);
}

assert(
  `font preload href 집합이 계산된 집합과 같다 (${expectedUrls.length}개)`,
  actualSet.size === expectedSet.size
    && actualUrls.length === expectedUrls.length
    && expectedUrls.every(u => actualSet.has(u)),
  `expected=[${expectedUrls.join(', ')}] actual=[${actualUrls.join(', ')}]`,
);

// [지상검증 B] 실제로 주입된 조각들의 unicode-range가 첫 화면 텍스트를 전부 덮는가.
// A와 겹치지 않는다 — A는 파서 드리프트를, B는 선택 로직(`expectedPreloadUrls`)이 통째로
// 엉뚱한 조각을 고르는 경우를 잡는다. 실측: 선택을 조각 70~78로 바꾸면 208.6KB라 조각 수·
// 바이트 상한을 둘 다 통과하고 집합 동일성도 통과한다(양쪽이 같은 함수를 쓰므로). B만 잡는다.
// 반대로 A가 잡는 파서 드리프트는 B가 못 잡는다(range를 같은 파서로 읽으므로). 둘 다 필요하다.
{
  const faces = parseFontFaceSubsets(css);
  const byUrl = new Map(faces.map(f => [f.url, f]));
  const loaded = actualUrls.map(u => byUrl.get(u)).filter((f): f is NonNullable<typeof f> => !!f);
  const uncovered: string[] = [];
  for (const ch of new Set(FIRST_PAINT_TEXT)) {
    if ((FIRST_PAINT_EXCEPTION_GLYPHS as readonly string[]).includes(ch)) continue;
    const cp = ch.codePointAt(0);
    if (cp === undefined || subsetIndexCovering(ch, faces) === undefined) continue;
    if (!loaded.some(f => f.ranges.some(r => cp >= r.start && cp <= r.end))) uncovered.push(ch);
  }
  assert('preload된 조각이 첫 화면 텍스트를 전부 덮는다', uncovered.length === 0,
    `안 덮이는 글자: ${uncovered.slice(0, 12).join('')} — 조각을 골랐는데 그 글자가 거기 없다`);
}

for (const tag of fontPreloads) {
  const href = linkAttr(tag, 'href') ?? '';
  // **값까지 봐야 한다.** 속성 존재만 보면 `crossorigin="use-credentials"`가 통과하는데,
  // 실측하면 브라우저 요청이 9건 → 17건이 된다(8개 이중 다운로드). CSS의 폰트 페치는
  // 익명 CORS라, 자격증명 모드로 미리 받아 둔 건 재사용되지 않는다. 빈 값 = anonymous.
  const co = linkAttr(tag, 'crossorigin');
  assert(`crossorigin이 anonymous다 (${href.slice(-32)})`,
    co === '' || co?.toLowerCase() === 'anonymous',
    co === undefined ? '속성이 없다' : `crossorigin="${co}" — 익명이 아니면 두 번 받는다`);
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
