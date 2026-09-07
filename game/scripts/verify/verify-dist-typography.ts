// 배포 산출물(dist)의 한글 줄바꿈 계약 — **빌드 뒤에만 돌 수 있다.**
//
// 지키려는 것: 한글 텍스트가 **어절 한가운데서 끊기지 않는다.**
// 브라우저 기본값(word-break: normal)은 한중일을 음절 단위로 자른다. 전역 선언이 없던 동안
// 엔딩 부모 회고가 320px에서 "얼마나 컸는 / 지 알았다", "가장 다정 / 한 문장이었다"처럼
// 끊겼다(실측: 줄바꿈 11곳 중 9곳이 어절 내부, keep-all 적용 후 0곳).
//
// **왜 소스가 아니라 dist인가.** 같은 층위 착오가 이 리포에서 이미 터졌다 — 라이선스 고지를
// 리포 CSS 주석에서 확인했는데 그 주석은 미니파이가 지우는 것이었고 dist엔 0건이었다.
// CSS 선언도 같다: 소스에 있어도 번들에서 빠지거나 플러그인 순서가 바뀌면 실서버에서만 깨지고,
// 증상은 "글이 좀 이상하게 끊김"이라 눈에 잘 안 띈다.
//
// **왜 셀렉터까지 보는가(3자 검수 지적).** 첫 판은 "번들 어딘가에 두 선언이 같은 블록에 있다"만
// 확인했는데, 그건 이 변경의 요지(전역 body 규칙)를 놓친다. 실측으로 확인했다 — 선언을 body에서
// 빼고 `.some-narrow-thing{…}`으로 옮겼더니 **3/3 그린 통과**했다. 가장 그럴듯한 회귀
// 시나리오(다른 레이아웃 이슈 때문에 규칙을 좁은 셀렉터로 옮김)를 통째로 통과시킨 것이다.
// 그래서 지금은 body 규칙 블록을 먼저 잘라내고 그 안에서만 찾는다.
//
// **커버리지 한계(과신 금지).** 선언이 body 블록에 **존재하는지**만 본다. 더 뒤에 오는 규칙이
// 같은 속성을 덮는 경우(예: `*{word-break:break-all!important}`)는 잡지 못한다 — 그건 실제
// 렌더에서 계산된 스타일을 봐야 하고 브라우저가 필요하다. 여기서 잡는 것은 "선언이 사라지거나
// body를 떠나는" 회귀다.
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

/**
 * `body`를 대상으로 하는 규칙 블록들의 선언부만 모은다.
 * `[^{}]*`가 중괄호를 넘지 못하므로 @media 등 중첩 블록의 안쪽 규칙도 개별로 잡힌다.
 * 셀렉터 목록(`html,body{…}`)과 후손 셀렉터(`.x body{…}`)를 함께 받되, `body`가 온전한
 * 토큰일 때만 인정한다 — `.bodytext`가 통과하면 검사가 무의미해진다.
 */
function bodyDeclarations(source: string): string[] {
  const out: string[] = [];
  const rule = /(^|[{}])\s*([^{}@]+?)\s*\{([^{}]*)\}/g;
  for (let m = rule.exec(source); m; m = rule.exec(source)) {
    const [, , selectorList, decls] = m;
    const targetsBody = selectorList.split(',').some(sel => /(^|[\s>+~])body$/.test(sel.trim()));
    if (targetsBody) out.push(decls);
  }
  return out;
}

const bodyBlocks = bodyDeclarations(css);
if (bodyBlocks.length === 0) {
  bad('body 규칙 블록을 못 찾았다', '번들 구조가 바뀌었거나 셀렉터가 사라졌다');
} else {
  ok(`body 규칙 블록 ${bodyBlocks.length}개를 찾았다`);
}

// 값 뒤에 word-boundary를 둔다 — `keep-all`이 `keep-allsomething`의 접두로 매칭되면 안 된다.
const declRe = (prop: string, value: string) =>
  new RegExp(`(^|[;{\\s])${prop}\\s*:\\s*${value}(?![\\w-])`, 'i');

const inBody = (re: RegExp) => bodyBlocks.some(b => re.test(b));

// 1) 어절 단위 줄바꿈
if (inBody(declRe('word-break', 'keep-all'))) ok('body에 word-break: keep-all 이 있다');
else bad('body에 word-break: keep-all 이 없다', '한글이 음절 단위로 끊긴다');

// 2) 컨테이너보다 긴 한 어절의 안전망.
//    keep-all만 있으면 긴 어절이 가로로 삐져나가고, body의 overflow-x:hidden이 그걸 잘라 먹는다.
//    미니파이어를 갈아타면 레거시 별칭(word-wrap)만 방출될 수 있으므로 둘 다 받는다.
if (inBody(declRe('(overflow-wrap|word-wrap)', '(break-word|anywhere)'))) ok('body에 overflow-wrap 안전망이 있다');
else bad('body에 overflow-wrap 안전망이 없다', 'keep-all 단독은 긴 어절을 잘라 먹는다');

// 3) 두 선언이 **같은** body 블록에 있어야 짝이 성립한다.
//    서로 다른 블록에 흩어져 있으면 캐스케이드에 따라 한쪽만 적용되는 요소가 생긴다.
const paired = bodyBlocks.some(b =>
  declRe('word-break', 'keep-all').test(b)
  && declRe('(overflow-wrap|word-wrap)', '(break-word|anywhere)').test(b));
if (paired) ok('두 선언이 같은 body 블록에 함께 있다');
else bad('두 선언이 같은 body 블록에 없다', '한쪽만 적용되는 요소가 생긴다');

console.log(`\n=== 결과: ${4 - failed} passed / ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
