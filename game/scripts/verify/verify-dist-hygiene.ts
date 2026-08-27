// 배포 산출물(dist) 위생 — **빌드 뒤에만 돌 수 있다.**
//
// 소스 층에서 "public/에 개발용 html이 없다"를 검사하면 우회된다:
//   - public/ 밖에 두었다가 빌드 플러그인이 다시 복사하는 경로
//   - 일반 build에는 두고 release에서만 지우는 경로(지우기를 빼먹으면 실서버에 공개)
//   - 파일명이 cg-review.html 이 아닌 foo-review.html / notes.dev.json 등
// 실제로 사용자에게 나가는 것은 dist다. 그래서 dist를 본다.
//
// 같은 층위 착오가 이미 한 번 터졌다: verify-fonts.ts가 라이선스 고지를 리포 CSS 주석에서
// 확인했는데, 그 주석이 미니파이가 지우는 것이었다 — 소스 검증은 그린인데 dist에는 고지가 0건.
//
// CI에서 verify:ci(content-verify job)와 build:release(build job)는 별도 러너라
// dist가 공유되지 않는다. **이 스크립트를 verify:ci에 넣으면 dist가 아예 없어 섹션 1에서
// 곧바로 실패한다 — 통과하는 경로는 없다.** 문제는 조용한 통과가 아니라 그 실패가
// 배포 산출물에 대해 아무것도 말해주지 않는다는 것이다(상시 빨강). 진짜로 조용히 통과하는
// 위험은 **낡은 dist**다 — 로컬에 남은 이전 빌드를 검사하면 지금 나갈 산출물이 아닌 것을
// 통과시킨다. 그래서 verify:dist-fonts와 같이 **build job, 빌드 직후**에 둔다.
//
// **커버리지 한계(과신 금지).** 이 검사가 잡는 것은 ① dist 어디든 화이트리스트 밖의 html
// ② 개발용 파일명 글롭 ③ dist 최상위의 화이트리스트 밖 항목 ④ 허용 디렉터리 하위의
// 화이트리스트 밖 확장자다. **잡지 못하는 것**: 정상 확장자로 위장한 파일(예: assets/에
// 섞인 여분의 .js, images/에 섞인 여분의 .png). 이름·확장자만 보고 내용은 보지 않는다.
//
// 실행: cd game && npm run build:release && npx tsx scripts/verify/verify-dist-hygiene.ts

import { existsSync, readdirSync, statSync } from 'fs';
import { basename, join, relative, resolve } from 'path';

const DIST = resolve(import.meta.dirname, '../../dist');

// 정확한 상대경로만. glob을 넣으면 이 검사가 무력화되므로 아래 단언이 * 를 거절한다.
const ALLOWED_HTML: readonly string[] = ['index.html'];

// dist 최상위 — public/에서 복사되는 정당한 자산 + vite assets/.
// favicon.svg·icons.svg는 개발용 html이 아니다. 여기 없으면 오탐이 난다.
const ALLOWED_TOP_LEVEL: readonly string[] = [
  'index.html',
  'favicon.svg',
  'icons.svg',
  'assets',
  'images',
  'fonts',
];

// 허용된 최상위 디렉터리 **하위**에 올 수 있는 확장자. 최상위 이름만 닫으면 그 안은
// 무주공산이라, 실제로 dist/images/PROMPTS.md(내부 프롬프트 시트)가 공개되고 있었다.
// images가 png·webp 둘 다인 이유: 일반 build는 png를 남기고 build:release만 webp로 바꾼다.
const NESTED_ALLOWED_EXT: Readonly<Record<string, readonly string[]>> = {
  images: ['png', 'webp'],
  assets: ['js', 'css', 'woff2'],
  fonts: ['txt'],
};

// dist에 남아도 되는 도트파일. **도트파일을 통째로 건너뛰면 안 된다** —
// public/.internal/cg-review.html 처럼 점 하나로 검사 전체를 우회할 수 있었다(vite는
// public/의 도트파일도 그대로 복사한다).
const ALLOWED_DOTFILE_BASENAMES: readonly string[] = ['.gitkeep'];

// html 화이트리스트가 못 보는 확장자(.json·.txt·.js …)로 들어오는 개발용 산출물.
const DEV_BASENAME_GLOBS: readonly string[] = [
  '*review*',
  '*.dev.*',
  '*debug*',
];

const PUBLIC_LEAK =
  '이 파일은 GitHub Pages 배포 산출물에 들어가 실서버에 공개된다';

let failed = 0;
function assert(label: string, ok: boolean, detail = ''): void {
  if (ok) { console.log(`  ✓ ${label}`); return; }
  failed++;
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

function isOpenWhitelistPattern(entry: string): boolean {
  return /[*?]/.test(entry);
}

function globToRegExp(pattern: string): RegExp {
  // `?`도 이스케이프 대상에 넣고 단일 문자 와일드카드로 바꾼다 — 안 그러면 정규식
  // 수량자로 남아 debug?.js 가 debu.js 에 매칭된다. isOpenWhitelistPattern이 `?`를
  // 와일드카드로 취급하므로 두 함수의 해석을 맞춰 둔다.
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\?]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\\\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

const DEV_BASENAME_RE = DEV_BASENAME_GLOBS.map(globToRegExp);

function isDevArtifact(rel: string): boolean {
  const name = basename(rel);
  return DEV_BASENAME_RE.some(re => re.test(name) || re.test(rel));
}

/** 화이트리스트 비교는 **상대경로 전체**다. basename으로 바꾸면 assets/index.html이 통과한다. */
function isAllowedHtml(rel: string): boolean {
  return (ALLOWED_HTML as readonly string[]).includes(rel);
}

const unreadable: string[] = [];

function walkFiles(dir: string, root = dir): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    // 끊어진 심볼릭 링크에서 예외로 죽지 않는다 — 죽으면 뒤 섹션이 아예 안 돈다.
    const st = statSync(full, { throwIfNoEntry: false });
    if (!st) { unreadable.push(relative(root, full).replaceAll('\\', '/')); continue; }
    if (st.isDirectory()) {
      out.push(...walkFiles(full, root));
    } else {
      out.push(relative(root, full).replaceAll('\\', '/'));
    }
  }
  return out;
}

console.log('\n=== 1. dist가 있다 (빌드 선행) ===');
assert('dist/가 존재한다', existsSync(DIST), 'npm run build:release 를 먼저 돌려라');
if (!existsSync(DIST)) {
  console.log('\n=== 결과: 중단 ===\n');
  process.exit(1);
}

console.log('\n=== 2. 검사기 자신이 살아 있다 (공허한 통과 방지) ===');
// 화이트리스트를 전부 허용으로 바꾸는 것 말고도, **목록을 비우거나 매처를 죽이면**
// 이 검사는 조용히 통과한다(실측: DEV_BASENAME_GLOBS = [] 로 두면 foo-review.js가 샌다).
// 그래서 목록이 비었는지와 매처가 실제로 무는지를 먼저 확인한다.
for (const entry of ALLOWED_HTML) {
  assert(
    `ALLOWED_HTML '${entry}'는 와일드카드가 아니다`,
    !isOpenWhitelistPattern(entry),
    `화이트리스트에 '${entry}' 를 넣으면 검사가 전부 허용으로 무력화된다. ${PUBLIC_LEAK}`,
  );
}
for (const entry of ALLOWED_TOP_LEVEL) {
  assert(
    `ALLOWED_TOP_LEVEL '${entry}'는 와일드카드가 아니다`,
    !isOpenWhitelistPattern(entry),
    `화이트리스트에 '${entry}' 를 넣으면 검사가 전부 허용으로 무력화된다. ${PUBLIC_LEAK}`,
  );
}
assert('DEV_BASENAME_GLOBS가 비어 있지 않다', DEV_BASENAME_GLOBS.length > 0,
  '목록을 비우면 4절이 무조건 0건으로 통과한다');
assert('ALLOWED_HTML이 비어 있지 않다', ALLOWED_HTML.length > 0,
  '비우면 index.html 자신이 걸려 오탐이 난다');
assert('NESTED_ALLOWED_EXT가 허용 디렉터리를 전부 덮는다',
  ALLOWED_TOP_LEVEL.filter(n => !n.includes('.')).every(d => NESTED_ALLOWED_EXT[d]?.length),
  '허용된 디렉터리인데 확장자 목록이 없으면 그 하위가 무검사가 된다');
// 매처 자체가 무는지 — 상수 프로브. isDevArtifact를 상시 false로 바꾸면 여기서 걸린다.
assert('isDevArtifact가 개발용 이름을 문다',
  isDevArtifact('probe-review.html') && isDevArtifact('a/b/probe.dev.json')
  && isDevArtifact('x-debug-y.txt'),
  '매처가 죽으면 4절이 조용히 통과한다');
assert('isDevArtifact가 정상 자산을 물지 않는다',
  !isDevArtifact('index.html') && !isDevArtifact('images/a/b.webp'),
  '오탐이면 CI가 상시 빨강이 된다');
// 화이트리스트 비교가 basename이 아니라 상대경로 전체인지 — basename으로 바꾸면 여기서 걸린다.
assert('html 화이트리스트는 상대경로 전체로 비교한다',
  isAllowedHtml('index.html') && !isAllowedHtml('assets/index.html'),
  'basename 비교로 바꾸면 중첩 경로의 index.html이 통과한다');

console.log('\n=== 3. dist의 html은 화이트리스트뿐이다 ===');
const files = walkFiles(DIST);
// 재귀가 죽으면(하위 디렉터리를 안 내려가면) 3·4절이 통째로 공허해진다.
assert('walkFiles가 하위 디렉터리까지 내려간다', files.some(f => f.includes('/')),
  'dist는 assets/·images/를 가진다. 중첩 경로가 하나도 없으면 재귀가 죽은 것이다');
assert(`읽을 수 없는 항목이 없다${unreadable.length ? `: ${unreadable.join(', ')}` : ''}`,
  unreadable.length === 0, '끊어진 심볼릭 링크는 산출물에 있으면 안 된다');

const htmlFiles = files.filter(f => f.toLowerCase().endsWith('.html'));
assert(`html이 있다 (${htmlFiles.join(', ') || '없음'})`, htmlFiles.length > 0);

const extraHtml = htmlFiles.filter(f => !isAllowedHtml(f));
assert(
  extraHtml.length === 0
    ? `html은 화이트리스트뿐이다 (${ALLOWED_HTML.join(', ')})`
    : `허용되지 않은 html: ${extraHtml.join(', ')}`,
  extraHtml.length === 0,
  extraHtml.length === 0 ? '' : PUBLIC_LEAK,
);

console.log('\n=== 4. 개발용 파일명 패턴이 dist에 없다 ===');
const devHits = files.filter(isDevArtifact);
assert(
  devHits.length === 0
    ? `개발용 패턴(${DEV_BASENAME_GLOBS.join(', ')}) 0건`
    : `개발용 패턴에 걸린 파일: ${devHits.join(', ')}`,
  devHits.length === 0,
  devHits.length === 0 ? '' : PUBLIC_LEAK,
);

console.log('\n=== 5. dist 최상위는 화이트리스트뿐이다 ===');
// 도트파일을 거르지 않는다 — .internal/ 하나면 검사 전체를 우회할 수 있었다.
const topLevel = readdirSync(DIST);
const extraTop = topLevel.filter(name => !(ALLOWED_TOP_LEVEL as readonly string[]).includes(name));
assert(
  extraTop.length === 0
    ? `최상위는 화이트리스트뿐이다 (${ALLOWED_TOP_LEVEL.join(', ')})`
    : `허용되지 않은 최상위: ${extraTop.join(', ')}`,
  extraTop.length === 0,
  extraTop.length === 0
    ? ''
    : `산출물에 나가야 하는 자산이면 ALLOWED_TOP_LEVEL에 추가해라. 아니라면 ${PUBLIC_LEAK}`,
);

console.log('\n=== 6. 허용 디렉터리 하위도 확장자가 화이트리스트뿐이다 ===');
const extraNested = files.filter(rel => {
  if (!rel.includes('/')) return false;              // 최상위 파일은 5절 담당
  const name = basename(rel);
  if ((ALLOWED_DOTFILE_BASENAMES as readonly string[]).includes(name)) return false;
  const dir = rel.split('/')[0];
  const allowed = NESTED_ALLOWED_EXT[dir];
  if (!allowed) return true;                         // 매핑 없는 디렉터리 = 무검사 방지
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  return !allowed.includes(ext);
});
assert(
  extraNested.length === 0
    ? '하위 확장자는 화이트리스트뿐이다 ' +
      `(${Object.entries(NESTED_ALLOWED_EXT).map(([d, e]) => `${d}: ${e.join('/')}`).join(', ')})`
    : `허용되지 않은 하위 파일: ${extraNested.join(', ')}`,
  extraNested.length === 0,
  extraNested.length === 0
    ? ''
    : `문서·메모·소스맵은 산출물에 넣지 마라. ${PUBLIC_LEAK}`,
);

console.log(`\n=== 결과: ${failed === 0 ? '통과' : `${failed}건 실패`} ===\n`);
process.exit(failed === 0 ? 0 : 1);
