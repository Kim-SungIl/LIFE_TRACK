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
// dist가 공유되지 않는다. 이 스크립트를 verify:ci에 넣으면 dist가 없어 항상 통과하거나
// "dist 없음"으로만 실패하고, 개발용 파일이 공개되는 사실은 영구히 못 잡는다.
// 그래서 verify:dist-fonts와 같이 **build job, 빌드 직후**에 둔다.
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

// html 화이트리스트가 못 보는 확장자(.json·.txt·.js …)로 들어오는 개발용 산출물.
const DEV_BASENAME_GLOBS: readonly string[] = [
  '*-review.*',
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
  return entry === '*' || entry === '**' || entry === '*.*' || /[*?]/.test(entry);
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

const DEV_BASENAME_RE = DEV_BASENAME_GLOBS.map(globToRegExp);

function isDevArtifact(rel: string): boolean {
  const name = basename(rel);
  return DEV_BASENAME_RE.some(re => re.test(name) || re.test(rel));
}

function walkFiles(dir: string, root = dir): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
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

console.log('\n=== 2. 화이트리스트가 닫혀 있다 (자기 무력화 방지) ===');
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

console.log('\n=== 3. dist의 html은 화이트리스트뿐이다 ===');
const files = walkFiles(DIST);
const htmlFiles = files.filter(f => f.toLowerCase().endsWith('.html'));
assert(`html이 있다 (${htmlFiles.join(', ') || '없음'})`, htmlFiles.length > 0);

const extraHtml = htmlFiles.filter(f => !(ALLOWED_HTML as readonly string[]).includes(f));
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
const topLevel = readdirSync(DIST).filter(name => !name.startsWith('.'));
const extraTop = topLevel.filter(name => !(ALLOWED_TOP_LEVEL as readonly string[]).includes(name));
assert(
  extraTop.length === 0
    ? `최상위는 화이트리스트뿐이다 (${ALLOWED_TOP_LEVEL.join(', ')})`
    : `허용되지 않은 최상위: ${extraTop.join(', ')}`,
  extraTop.length === 0,
  extraTop.length === 0 ? '' : PUBLIC_LEAK,
);

console.log(`\n=== 결과: ${failed === 0 ? '통과' : `${failed}건 실패`} ===\n`);
process.exit(failed === 0 ? 0 : 1);
