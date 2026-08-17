// 폰트 탑재 검증 — 소스 층
// 목적: **"font-family에 이름만 적고 실제로는 안 실린" 상태를 막는다.**
//   이 게임은 오랫동안 game.css에 'Pretendard'를 적어두고도 @font-face도 폰트 파일도 없어서
//   조용히 시스템 폰트로 렌더되고 있었다. 눈으로는 "글자가 잘 나오니까" 알아채기 어렵고,
//   빌드도 통과하고, 테스트도 통과한다. 그래서 스크립트로 잠근다.
//
// 검사 항목:
//  (1) 엔트리가 pretendard.css를 실제로 import한다  ← **배선**. 이게 없으면 나머지가 다 무의미하다
//  (2) game.css의 body 1순위 family에 대응하는 @font-face가 있다
//  (3) @font-face 92블록 **각각**이 온전하다 (family·src·unicode-range·display·weight)
//  (4) 각 블록이 서로 다른 파일을 가리킨다 (전부 같은 조각을 참조하면 나머지 글자가 폴백된다)
//  (5) url()이 가리키는 파일이 실제로 있고, 진짜 woff2다
//  (6) SIL OFL 라이선스 파일이 리포에 동봉돼 있다
//
// **왜 face 단위인가**: 이전 버전은 CSS 전체를 상대로 정규식을 한 번씩 돌렸다. 그래서
//   `urls.length > 0` / `swap`이 어딘가 하나만 있으면 통과했고, 92개 중 91개의 src를 지워도,
//   91개를 font-display:block으로 바꿔도 그린이었다(3자 검수에서 뮤테이션으로 재현됨).
//   집계값이 아니라 블록별로 세야 잠긴다.
//
// **배포 산출물(dist)은 이 스크립트가 검사하지 않는다.** CI에서 verify:ci(content-verify job)와
//   build:release(build job)는 별도 러너라 여기서는 dist가 존재하지 않는다.
//   해시된 경로(/LIFE_TRACK/...)와 라이선스 고지 잔존은 verify-dist-fonts.ts가 빌드 뒤에 본다.
//
// 실행: cd game && npx tsx scripts/verify/verify-fonts.ts

import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { dirname, resolve, join } from 'path';

const SRC_DIR = resolve(import.meta.dirname, '../../src');
const STYLES_DIR = resolve(SRC_DIR, 'styles');
const FONT_CSS = resolve(STYLES_DIR, 'pretendard.css');
const GAME_CSS = resolve(STYLES_DIR, 'game.css');
const LICENSE = resolve(SRC_DIR, 'assets/fonts/pretendard/OFL.txt');

// 서브셋을 이 수 아래로 줄이면(=조각을 합치면) 첫 화면에서 받는 양이 급격히 커진다.
// 92개가 upstream 기본값이고, 여기서 크게 벗어나면 의도적인 변경인지 확인이 필요하다.
const MIN_SUBSETS = 50;

let failed = 0;
function assert(label: string, ok: boolean, detail = ''): void {
  if (ok) { console.log(`  ✓ ${label}`); return; }
  failed++;
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

// 주석을 걷어내고 센다 — 주석에 적은 설명("@font-face도 없어서…")까지 세면 오탐이 난다.
// (이 스크립트를 쓰면서 실제로 걸렸다: @font-face 93 vs unicode-range 92)
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

console.log('\n=== 1. 엔트리가 폰트 CSS를 실제로 import한다 (배선) ===');

assert('폰트 CSS가 존재한다 (src/styles/pretendard.css)', existsSync(FONT_CSS));
if (!existsSync(FONT_CSS)) { console.log('\n=== 결과: 중단 ===\n'); process.exit(1); }

// 파일이 있어도 아무도 import하지 않으면 번들에 안 들어가고, 렌더는 시스템 폰트로 돌아간다.
// = 이 PR이 고치기 전과 완전히 같은 상태. 파일 존재만 보면 이걸 놓친다.
function walkSource(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      walkSource(p, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

const importers = walkSource(SRC_DIR).filter(f =>
  /^\s*import\s+['"][^'"]*pretendard\.css['"]/m.test(readFileSync(f, 'utf8')),
);
assert(
  `pretendard.css를 import하는 소스가 있다 (${importers.length}곳)`,
  importers.length > 0,
  'src/ 어디서도 import하지 않으면 @font-face가 번들에 들어가지 않는다 — 선언만 있고 미탑재 상태로 되돌아간다',
);
if (importers.length > 0) {
  console.log(`    (${importers.map(f => f.replace(`${SRC_DIR}/`, 'src/')).join(', ')})`);
}

console.log('\n=== 2. body 1순위 family ↔ @font-face 대응 ===');

const fontCss = stripComments(readFileSync(FONT_CSS, 'utf8'));
const gameCss = stripComments(readFileSync(GAME_CSS, 'utf8'));
const fontCssRaw = readFileSync(FONT_CSS, 'utf8');   // 라이선스 고지는 주석에 있다

// **body 규칙 안에서** 뽑는다. 파일 전체의 첫 font-family를 잡으면, body보다 앞선 다른
// 셀렉터에 font-family가 생기는 순간 엉뚱한 family를 1순위로 판정한다(3자 검수 지적).
const bodyBlock = gameCss.match(/(?:^|\})\s*body\s*\{([^}]*)\}/)?.[1] ?? '';
assert('game.css에 body 규칙이 있다', !!bodyBlock);

const primaryFamily = bodyBlock.match(/font-family:\s*'([^']+)'/)?.[1] ?? '';
assert('body가 font-family를 선언한다', !!primaryFamily);

const faceBlocks = [...fontCss.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(m => m[1]);
const declaredFamilies = new Set(
  faceBlocks.flatMap(b => [...b.matchAll(/font-family:\s*'([^']+)'/g)].map(m => m[1])),
);
assert(
  `1순위 family '${primaryFamily}'에 대응하는 @font-face가 있다`,
  !!primaryFamily && declaredFamilies.has(primaryFamily),
  `@font-face에 선언된 family: ${[...declaredFamilies].join(', ') || '(없음)'}`,
);

console.log('\n=== 3. @font-face 블록별 무결성 ===');

const faceCount = faceBlocks.length;
assert(`@font-face가 충분히 쪼개져 있다 (${faceCount}개 ≥ ${MIN_SUBSETS})`, faceCount >= MIN_SUBSETS,
  '조각을 합치면 첫 화면에서 한글 전체를 통째로 받게 된다');

// 집계가 아니라 블록별로 센다 — 하나라도 빠진 블록을 이름으로 지목할 수 있어야 한다.
const noSrc: number[] = [];
const noRange: number[] = [];
const noSwap: number[] = [];
const badWeight: number[] = [];
const blockUrls: string[] = [];

faceBlocks.forEach((block, i) => {
  const src = block.match(/src:\s*url\(([^)]+)\)/);
  if (!src) noSrc.push(i);
  else blockUrls.push(src[1].replace(/^['"]|['"]$/g, '').trim());
  if (!/unicode-range:\s*U\+/.test(block)) noRange.push(i);
  if (!/font-display:\s*swap/.test(block)) noSwap.push(i);
  // 가변 폰트는 `font-weight: 45 920`처럼 범위를 준다. 단일 값으로 바뀌면 500~900이
  // 조용히 합성 볼드(브라우저가 굵게 흉내낸 것)로 렌더된다 — 눈으로 잡기 어렵다.
  if (!/font-weight:\s*\d+\s+\d+/.test(block)) badWeight.push(i);
});

const brief = (xs: number[]) => `블록 ${xs.slice(0, 5).join(', ')}${xs.length > 5 ? ` 외 ${xs.length - 5}개` : ''}`;

assert(`모든 @font-face에 src url이 있다 (${blockUrls.length}/${faceCount})`, noSrc.length === 0, brief(noSrc));
assert(`모든 @font-face에 unicode-range가 있다 (${faceCount - noRange.length}/${faceCount})`,
  noRange.length === 0, `${brief(noRange)} — 빠진 조각은 조건 없이 항상 받아진다`);
assert(`모든 @font-face가 font-display: swap이다 (${faceCount - noSwap.length}/${faceCount})`,
  noSwap.length === 0, `${brief(noSwap)} — block이면 그 글자가 폰트 도착까지 안 보인다(FOIT)`);
assert(`모든 @font-face가 가변 weight 범위를 준다 (${faceCount - badWeight.length}/${faceCount})`,
  badWeight.length === 0, `${brief(badWeight)} — 단일 값이면 굵은 웨이트가 합성 볼드가 된다`);

// 92블록이 서로 다른 파일을 가리켜야 한다. 전부 같은 조각을 참조해도 "파일이 존재하고
// 진짜 woff2"라는 검사는 전부 통과하지만, 그 조각에 없는 글자는 모두 폴백된다.
assert(`각 블록이 서로 다른 조각을 가리킨다 (고유 ${new Set(blockUrls).size}/${faceCount})`,
  new Set(blockUrls).size === faceCount,
  '여러 블록이 같은 파일을 참조한다 — 해당 unicode-range의 글자가 폴백된다');

console.log('\n=== 4. url()이 가리키는 파일이 실제로 있다 ===');

const urls = [...fontCss.matchAll(/url\(([^)]+)\)/g)]
  .map(m => m[1].replace(/^['"]|['"]$/g, '').trim())
  .filter(u => !u.startsWith('data:') && !u.startsWith('http'));

assert(`url() 참조 수가 @font-face 수와 같다 (${urls.length}/${faceCount})`, urls.length === faceCount);

const missing: string[] = [];
const empty: string[] = [];
const notWoff2: string[] = [];

for (const url of urls) {
  const abs = resolve(dirname(FONT_CSS), url.split('?')[0]);
  if (!existsSync(abs)) { missing.push(url); continue; }
  const size = statSync(abs).size;
  if (size === 0) { empty.push(url); continue; }
  // woff2 매직 넘버 'wOF2' — CDN이 404 HTML을 돌려준 걸 그대로 저장한 경우를 잡는다.
  const head = readFileSync(abs).subarray(0, 4).toString('latin1');
  if (head !== 'wOF2') notWoff2.push(`${url} (머리 4바이트: ${JSON.stringify(head)})`);
}

assert('모든 참조 파일이 존재한다', missing.length === 0, missing.slice(0, 3).join(', '));
assert('0바이트 파일이 없다', empty.length === 0, empty.slice(0, 3).join(', '));
assert('모두 실제 woff2다 (매직 넘버 wOF2)', notWoff2.length === 0, notWoff2.slice(0, 2).join(', '));

console.log('\n=== 5. 라이선스 동봉 (SIL OFL) ===');

assert('OFL.txt가 폰트와 함께 있다', existsSync(LICENSE));
if (existsSync(LICENSE)) {
  const ofl = readFileSync(LICENSE, 'utf8');
  assert('OFL 본문이다', /SIL OPEN FONT LICENSE/i.test(ofl));
}
// 고지는 **bang 주석**이어야 한다. 일반 주석은 미니파이가 지워서 배포 산출물에 고지가 남지 않는다.
// (dist에 실제로 남는지는 verify-dist-fonts.ts가 빌드 뒤에 확인한다)
assert('폰트 CSS의 저작권 고지가 bang 주석이다 (미니파이 후에도 남는다)',
  /\/\*![\s\S]*?Open Font License[\s\S]*?\*\//i.test(fontCssRaw),
  '`/*` 로 시작하면 esbuild가 제거해 배포본에 고지가 사라진다 — `/*!` 로 열어라');

const totalBytes = urls.reduce((sum, url) => {
  const abs = resolve(dirname(FONT_CSS), url.split('?')[0]);
  return sum + (existsSync(abs) ? statSync(abs).size : 0);
}, 0);
console.log(`\n  (참고) 번들된 서브셋 총량: ${(totalBytes / 1024 / 1024).toFixed(2)} MB / ${urls.length}개`);
console.log('        한 화면이 실제로 받는 양은 그 글자가 든 조각뿐이다.');

console.log(`\n=== 결과: ${failed === 0 ? '통과' : `${failed}건 실패`} ===\n`);
process.exit(failed === 0 ? 0 : 1);
