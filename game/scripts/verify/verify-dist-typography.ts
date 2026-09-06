// 배포 산출물(dist)의 한글 줄바꿈 계약 — **빌드 뒤에만 돌 수 있다.**
//
// 지키려는 것: 한글 텍스트가 **어절 한가운데서 끊기지 않는다.**
// 브라우저 기본값(word-break: normal)은 한중일을 음절 단위로 자른다. 이 선언이 없던 동안
// 엔딩 부모 회고가 320px에서 "얼마나 컸는 / 지 알았다", "가장 다정 / 한 문장이었다"처럼
// 끊겼다(실측: 줄바꿈 11곳 중 9곳이 어절 내부, keep-all 적용 후 0곳).
//
// **왜 소스가 아니라 dist인가.** 같은 층위 착오가 이 리포에서 이미 터졌다 — 라이선스 고지를
// 리포 CSS 주석에서 확인했는데 그 주석은 미니파이가 지우는 것이었다(dist엔 0건).
// CSS 선언도 같다: 소스에 있어도 번들에서 빠지거나(미사용 판정·플러그인 순서) 뒤에 오는
// 규칙이 덮으면 실서버에서만 깨지고, 증상은 "글이 좀 이상하게 끊김"이라 눈에 잘 안 띈다.
//
// **커버리지 한계(과신 금지).** 이 검사는 선언이 번들에 **존재하는지**만 본다.
// 더 뒤에 오는 규칙이 같은 속성을 덮는 경우(캐스케이드)는 잡지 못한다 — 그건 실제 렌더에서
// 계산된 스타일을 봐야 하고, 브라우저가 필요하다. 여기서 잡는 것은 "선언이 사라지는" 회귀다.
//
// 실행: cd game && npm run build && npx tsx scripts/verify/verify-dist-typography.ts

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

const DIST = resolve(import.meta.dirname, '../../dist');
const ASSETS = join(DIST, 'assets');

let failed = 0;
const ok = (label: string) => console.log(`  ✓ ${label}`);
const bad = (label: string, detail: string) => { failed++; console.log(`  ✗ ${label} — ${detail}`); };

console.log('=== dist 타이포그래피 — 한글 줄바꿈 계약 ===\n');

if (!existsSync(ASSETS)) {
  console.log(`dist/assets가 없다: ${ASSETS}\n먼저 npm run build 를 돌릴 것.`);
  process.exit(1);
}

const cssFiles = readdirSync(ASSETS).filter(f => f.endsWith('.css'));
if (cssFiles.length === 0) {
  console.log('dist/assets에 css가 없다 — 번들 구성이 바뀌었는지 확인할 것.');
  process.exit(1);
}
const css = cssFiles.map(f => readFileSync(join(ASSETS, f), 'utf8')).join('\n');
console.log(`  (css ${cssFiles.length}개, ${Math.round(css.length / 1024)}KB)\n`);

// 미니파이는 공백을 지우므로 공백 유무 양쪽을 받는다.
const has = (prop: string, value: string) =>
  new RegExp(`${prop}\\s*:\\s*${value}`, 'i').test(css);

// 1) 어절 단위 줄바꿈
if (has('word-break', 'keep-all')) ok('word-break: keep-all 이 번들에 있다');
else bad('word-break: keep-all 이 번들에 없다', '한글이 음절 단위로 끊긴다');

// 2) 컨테이너보다 긴 한 어절의 안전망.
//    keep-all만 있으면 긴 어절이 가로로 삐져나가고, body의 overflow-x:hidden이 그걸 잘라 먹는다.
if (has('overflow-wrap', '(break-word|anywhere)')) ok('overflow-wrap 안전망이 있다');
else bad('overflow-wrap 안전망이 없다', 'keep-all 단독은 긴 어절을 잘라 먹는다');

// 3) 두 선언이 같은 규칙 블록에 있어야 짝이 성립한다 — 서로 다른 셀렉터에 흩어져 있으면
//    한쪽만 적용되는 요소가 생긴다.
const paired = /\{[^{}]*word-break\s*:\s*keep-all[^{}]*\}/i.test(css)
  && /\{[^{}]*word-break\s*:\s*keep-all[^{}]*overflow-wrap\s*:\s*(break-word|anywhere)[^{}]*\}/i.test(css)
  || /\{[^{}]*overflow-wrap\s*:\s*(break-word|anywhere)[^{}]*word-break\s*:\s*keep-all[^{}]*\}/i.test(css);
if (paired) ok('두 선언이 같은 규칙 안에 함께 있다');
else bad('두 선언이 같은 규칙에 있지 않다', '한쪽만 적용되는 요소가 생긴다');

console.log(`\n=== 결과: ${3 - failed} passed / ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
