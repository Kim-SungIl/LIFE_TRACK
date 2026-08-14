// 폰트 탑재 검증
// 목적: **"font-family에 이름만 적고 실제로는 안 실린" 상태를 막는다.**
//   이 게임은 오랫동안 game.css에 'Pretendard'를 적어두고도 @font-face도 폰트 파일도 없어서
//   조용히 시스템 폰트로 렌더되고 있었다. 눈으로는 "글자가 잘 나오니까" 알아채기 어렵고,
//   빌드도 통과하고, 테스트도 통과한다. 그래서 스크립트로 잠근다.
//
// 검사 항목:
//  (1) game.css가 1순위로 쓰는 family에 대응하는 @font-face가 실제로 있다
//  (2) @font-face의 모든 url()이 가리키는 파일이 리포에 존재한다 (경로 오타·파일 유실)
//  (3) 각 폰트 파일이 진짜 woff2다 (0바이트·HTML 에러 페이지가 받아진 경우 차단)
//  (4) 동적 서브셋 구조가 유지된다 — 한 덩어리로 합치면 첫 로드가 무거워진다
//  (5) SIL OFL 라이선스 파일이 동봉돼 있다 (재배포 조건)
//
// 실행: cd game && npx tsx scripts/verify/verify-fonts.ts

import { readFileSync, existsSync, statSync } from 'fs';
import { dirname, resolve } from 'path';

const STYLES_DIR = resolve(import.meta.dirname, '../../src/styles');
const FONT_CSS = resolve(STYLES_DIR, 'pretendard.css');
const GAME_CSS = resolve(STYLES_DIR, 'game.css');
const LICENSE = resolve(import.meta.dirname, '../../src/assets/fonts/pretendard/OFL.txt');

// 서브셋을 이 수 아래로 줄이면(=조각을 합치면) 첫 화면에서 받는 양이 급격히 커진다.
// 92개가 upstream 기본값이고, 여기서 크게 벗어나면 의도적인 변경인지 확인이 필요하다.
const MIN_SUBSETS = 50;

let failed = 0;
function assert(label: string, ok: boolean, detail = ''): void {
  if (ok) { console.log(`  ✓ ${label}`); return; }
  failed++;
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

console.log('\n=== 1. @font-face 선언과 실제 탑재 ===');

assert('폰트 CSS가 존재한다 (src/styles/pretendard.css)', existsSync(FONT_CSS));
if (!existsSync(FONT_CSS)) { console.log('\n=== 결과: 중단 ==='); process.exit(1); }

// 주석을 걷어내고 센다 — 주석에 적은 설명("@font-face도 없어서…")까지 세면 오탐이 난다.
// (이 스크립트를 쓰면서 실제로 걸렸다: @font-face 93 vs unicode-range 92)
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const fontCss = stripComments(readFileSync(FONT_CSS, 'utf8'));
const gameCss = stripComments(readFileSync(GAME_CSS, 'utf8'));
const fontCssRaw = readFileSync(FONT_CSS, 'utf8');   // 라이선스 고지는 주석에 있다

// game.css의 body font-family 1순위 = 반드시 우리가 싣는 family여야 한다.
const famMatch = gameCss.match(/font-family:\s*'([^']+)'/);
const primaryFamily = famMatch?.[1] ?? '';
assert('game.css가 body font-family를 선언한다', !!primaryFamily);

const declaredFamilies = new Set(
  [...fontCss.matchAll(/font-family:\s*'([^']+)'/g)].map(m => m[1]),
);
assert(
  `1순위 family '${primaryFamily}'에 대응하는 @font-face가 있다`,
  declaredFamilies.has(primaryFamily),
  `@font-face에 선언된 family: ${[...declaredFamilies].join(', ') || '(없음)'}`,
);

console.log('\n=== 2. url()이 가리키는 파일이 실제로 있다 ===');

const urls = [...fontCss.matchAll(/url\(([^)]+)\)/g)]
  .map(m => m[1].replace(/^['"]|['"]$/g, '').trim())
  .filter(u => !u.startsWith('data:') && !u.startsWith('http'));

assert(`url() 참조가 있다 (${urls.length}개)`, urls.length > 0);

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

console.log('\n=== 3. 동적 서브셋 구조 ===');

const faceCount = (fontCss.match(/@font-face/g) ?? []).length;
const rangeCount = (fontCss.match(/unicode-range:/g) ?? []).length;

assert(`@font-face가 충분히 쪼개져 있다 (${faceCount}개 ≥ ${MIN_SUBSETS})`, faceCount >= MIN_SUBSETS,
  '조각을 합치면 첫 화면에서 한글 전체를 통째로 받게 된다');
assert('모든 @font-face에 unicode-range가 있다', rangeCount === faceCount,
  `@font-face ${faceCount} vs unicode-range ${rangeCount} — 하나라도 빠지면 그 조각은 항상 받아진다`);
assert('font-display: swap이다 (폰트 지연 시 텍스트 먼저)', /font-display:\s*swap/.test(fontCss));

console.log('\n=== 4. 라이선스 동봉 (SIL OFL) ===');

assert('OFL.txt가 폰트와 함께 있다', existsSync(LICENSE));
if (existsSync(LICENSE)) {
  const ofl = readFileSync(LICENSE, 'utf8');
  assert('OFL 본문이다', /SIL OPEN FONT LICENSE/i.test(ofl));
}
assert('폰트 CSS가 출처·라이선스를 밝힌다', /Open Font License/i.test(fontCssRaw));

const totalBytes = urls.reduce((sum, url) => {
  const abs = resolve(dirname(FONT_CSS), url.split('?')[0]);
  return sum + (existsSync(abs) ? statSync(abs).size : 0);
}, 0);
console.log(`\n  (참고) 번들된 서브셋 총량: ${(totalBytes / 1024 / 1024).toFixed(2)} MB / ${urls.length}개`);
console.log('        한 화면이 실제로 받는 양은 그 글자가 든 조각뿐이다.');

console.log(`\n=== 결과: ${failed === 0 ? '통과' : `${failed}건 실패`} ===\n`);
process.exit(failed === 0 ? 1 - 1 : 1);
