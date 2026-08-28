// 배포 산출물의 청크 분할 — **빌드 뒤에만 돌 수 있다.**
//
// 잠그는 계약: "첫 화면을 그리는 데 필요 없는 화면은 부팅에 받지 않는다."
//
// 왜 소스 층이 아니라 dist인가. 소스에서 `lazy(() => import(...))`를 확인하면 우회된다:
//   - lazy()는 그대로 둔 채 **다른 파일에서 정적으로도** import하면 rollup이 그 모듈을
//     부팅 청크에 넣는다. 소스 스캔은 그린인데 실제로는 부팅에 실려 나간다.
//   - manualChunks/codeSplitting 설정으로 청크를 도로 합치면 소스는 한 글자도 안 변한다.
//   - `import('./screens/ArchivesScreen')` 같은 오탈자는 소스 스캔이 오히려 통과시킨다.
// 실제로 사용자가 받는 것은 dist다. 그래서 dist를 본다.
//
// 이 리포는 같은 층위 착오를 이미 두 번 겪었다: verify-fonts.ts가 라이선스 고지를 리포 CSS
// 주석에서 확인했는데 그 주석은 미니파이가 지우는 것이었고(dist엔 0건), 개발용 html은
// public/만 봐서 다른 경로로 dist에 다시 들어오는 것을 못 잡았다.
//
// CI에서 verify:ci(content-verify job)와 build:release(build job)는 별도 러너라 dist가
// 공유되지 않는다. **이 스크립트를 verify:ci에 넣으면 dist가 없어 섹션 1에서 곧바로 실패한다**
// — verify:dist-fonts·verify:dist-hygiene와 같이 **build job, 빌드 직후**에 둔다.
//
// **파일 존재만 보면 안 된다(실측).** 정적 import로 되돌려도 rollup은 ArchiveScreen-*.js를
// 여전히 내보낸다 — 본문만 부팅 청크로 옮겨가고 껍데기가 남아서, 3절(청크 분리)은 그린이다.
// 5절이 본문 문자열의 **위치**를 보는 이유가 이것이다.
//
// **커버리지 한계(과신 금지).** 이 검사가 보는 것은 ① 지연 화면이 자기 청크로 갈렸는가
// ② 그 청크가 부팅 그래프(엔트리 + modulepreload)에 없는가 ③ (ArchiveScreen 한정)
// 그 화면의 본문이 부팅이 아니라 자기 청크에 있는가 뿐이다. ③은 화면 하나만 본다 —
// 나머지 넷은 ①②까지다. **잡지 못하는 것**: 청크 크기 회귀, 부팅 그래프 자체가 비대해지는 것,
// 지연 화면이 실제로 열리는지(그건 컴포넌트 테스트 몫 — archiveWiring.test.tsx가 클릭 왕복과
// Suspense 프레임을 본다).
//
// 실행: cd game && npm run build && npx tsx scripts/verify/verify-dist-chunks.ts

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { basename, join, resolve } from 'path';

const DIST = resolve(import.meta.dirname, '../../dist');
const ASSETS = join(DIST, 'assets');
const SRC_COMPONENTS = resolve(import.meta.dirname, '../../src/components');

/** 지연 로딩이어야 하는 화면들. 청크 파일명은 rollup이 모듈 파일명에서 딴다. */
const LAZY_SCREENS: readonly string[] = [
  'ArchiveScreen',
  'EventScene',
  'EventResultScreen',
  'YearEndScreen',
  'EndingScreen',
];

// 파일명 검사만으로는 "청크는 갈렸는데 내용이 부팅에도 **중복**으로 들어간" 경우를 못 본다.
// 그래서 화면 본문에만 있는 문자열이 부팅 그래프에 0회인지도 본다. 문자열 결합(content
// coupling)이라 문구가 바뀌면 여기도 같이 고쳐야 하므로, 잘 안 바뀌는 섹션 헤더 하나만 쓴다.
// 앵커가 사라지면 4절이 공허하게 통과하므로 2절에서 "정확히 1회 존재"를 먼저 확인한다.
const ANCHOR = { chunk: 'ArchiveScreen', text: '함께한 사람들' } as const;

// 검사기 자기 방어용 프로브 — **부팅 그래프에 반드시 있는** 문자열(타이틀 h1).
// 부팅 그래프를 잘못 찾았거나 파일을 못 읽었으면 이 카운트가 0이 되어 먼저 걸린다.
const BOOT_PROBE = '7년의 시간표';

let failed = 0;
function assert(label: string, ok: boolean, detail = ''): void {
  if (ok) { console.log(`  ✓ ${label}`); return; }
  failed++;
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

function countOccurrences(haystack: string, needle: string): number {
  let n = 0;
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + needle.length)) n++;
  return n;
}

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__') continue;          // 테스트의 정적 import는 번들과 무관하다
      out.push(...walkTsx(full));
    } else if (name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/** 소스에서 `lazy(() => import('...'))` 로 선언된 화면 이름들. LAZY_SCREENS 완전성 대조용. */
function lazyScreensInSource(): string[] {
  const re = /lazy\(\s*\(\)\s*=>\s*\n?\s*import\(\s*'([^']+)'/g;
  const found = new Set<string>();
  for (const file of walkTsx(SRC_COMPONENTS)) {
    const text = readFileSync(file, 'utf-8');
    for (const m of text.matchAll(re)) found.add(basename(m[1]));
  }
  return [...found].sort();
}

console.log('\n=== 1. dist가 있다 (빌드 선행) ===');
assert('dist/assets/가 존재한다', existsSync(ASSETS), 'npm run build 를 먼저 돌려라');
if (!existsSync(ASSETS)) {
  console.log('\n=== 결과: 중단 ===\n');
  process.exit(1);
}

const jsFiles = readdirSync(ASSETS).filter(f => f.endsWith('.js'));

// index.html이 부팅에 받는 것 = 엔트리 모듈 + modulepreload. preload(폰트·이미지)나
// stylesheet는 JS 그래프가 아니므로 제외한다.
const html = readFileSync(join(DIST, 'index.html'), 'utf-8');
const entrySrcs = [...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)].map(m => m[1]);
const preloadHrefs = [...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)].map(m => m[1]);
const bootNames = [...entrySrcs, ...preloadHrefs].map(u => basename(u));

console.log('\n=== 2. 검사기 자신이 살아 있다 (공허한 통과 방지) ===');
// `.map(basename)`으로 쓰면 map이 넘기는 index가 basename의 suffix 인자로 들어가 죽는다.
assert(`엔트리 모듈을 찾았다 (${entrySrcs.map(u => basename(u)).join(', ') || '없음'})`,
  entrySrcs.length === 1,
  'index.html의 <script type="module">를 못 찾았거나 여러 개다. 부팅 그래프 판정이 무의미해진다');
assert(`modulepreload를 찾았다 (${preloadHrefs.length}개)`, preloadHrefs.length > 0,
  '0개면 파싱이 깨진 것이다 — 이 빌드는 실제로 modulepreload를 낸다. ' +
  '진짜로 0개가 됐다면 3·4절이 엔트리만 보게 되어 커버리지가 줄어든다');
// 부팅 그래프 파일을 **실제로 읽을 수 있어야** 한다. 못 읽는데 0회로 세면 전부 통과한다.
const missingBoot = bootNames.filter(n => !jsFiles.includes(n));
assert(`부팅 그래프 파일이 전부 dist/assets에 있다${missingBoot.length ? `: 없음=${missingBoot.join(', ')}` : ''}`,
  missingBoot.length === 0,
  '경로 파싱이 어긋났다. 내용을 못 읽으면 4절이 무조건 0회로 통과한다');
// **목록에서 한 줄 지우면 그 화면은 무검사가 된다** — `length > 0`만 보면 조용히 통과한다
// (실측: 'ArchiveScreen' 한 줄을 지웠더니 전 절이 그린이었다). 그래서 소스의 lazy() 선언과
// 대조한다. 이 대조는 계약이 아니라 **목록 완전성 점검**이다 — 계약은 어디까지나 dist다.
// 새 지연 화면을 추가하면 여기서 걸리므로 LAZY_SCREENS에 같이 등록하면 된다.
const srcLazy = lazyScreensInSource();
assert(`소스의 lazy 화면을 찾았다 (${srcLazy.join(', ') || '없음'})`, srcLazy.length > 0,
  '정규식이 죽었다 — 0개면 아래 대조가 무조건 통과한다');
const unregistered = srcLazy.filter(n => !LAZY_SCREENS.includes(n));
assert(
  unregistered.length === 0
    ? 'LAZY_SCREENS가 소스의 lazy 화면을 전부 덮는다'
    : `LAZY_SCREENS에 없는 지연 화면: ${unregistered.join(', ')}`,
  unregistered.length === 0,
  '목록에 없으면 그 화면은 부팅 번들에 실려도 아무도 안 본다. LAZY_SCREENS에 추가해라',
);
assert(`앵커 화면(${ANCHOR.chunk})이 LAZY_SCREENS에 있다`, LAZY_SCREENS.includes(ANCHOR.chunk),
  '5절의 앵커 검사와 3·4절이 서로 다른 화면을 보게 된다');

const bootText = bootNames
  .filter(n => jsFiles.includes(n))
  .map(n => readFileSync(join(ASSETS, n), 'utf-8'))
  .join('\n');
// 카운터와 부팅 그래프 식별이 둘 다 살아 있는지 — 상수 프로브.
assert(`부팅 그래프에서 프로브('${BOOT_PROBE}')를 찾는다`,
  countOccurrences(bootText, BOOT_PROBE) > 0,
  '타이틀 화면은 eager라 부팅 그래프에 반드시 있다. 0회면 파일을 안 읽었거나 카운터가 죽은 것 ' +
  `(문구가 바뀌었다면 BOOT_PROBE를 고쳐라)`);

console.log('\n=== 3. 지연 화면은 자기 청크로 갈라진다 ===');
for (const name of LAZY_SCREENS) {
  const hits = jsFiles.filter(f => f.startsWith(`${name}-`));
  assert(
    hits.length === 1
      ? `${name} → ${hits[0]}`
      : `${name} 청크가 ${hits.length}개다 (${hits.join(', ') || '없음'})`,
    hits.length === 1,
    hits.length === 0
      ? `정적 import가 다시 생겼거나(다른 파일에서라도) 청크가 합쳐졌다. ` +
        `이 화면이 부팅 번들에 실려 첫 페인트를 늦춘다`
      : '같은 이름의 청크가 여러 개다 — 아래 부팅 그래프 판정이 어느 쪽인지 모호해진다',
  );
}

console.log('\n=== 4. 지연 청크는 부팅 그래프에 없다 ===');
// 청크로 갈렸어도 modulepreload가 걸리면 부팅에 같이 받는다 — 분할한 의미가 없어진다.
for (const name of LAZY_SCREENS) {
  const inBoot = bootNames.filter(n => n.startsWith(`${name}-`));
  assert(
    inBoot.length === 0
      ? `${name}은 부팅에 받지 않는다`
      : `${name}이 부팅 그래프에 있다: ${inBoot.join(', ')}`,
    inBoot.length === 0,
    'modulepreload가 걸렸다. 청크는 갈렸지만 부팅에 같이 내려받으므로 전송량은 그대로다',
  );
}

console.log('\n=== 5. 지연 화면 본문이 부팅 청크에 있지 않다 ===');
// **3절만으로는 부족하다(실측).** 정적 import로 되돌려도 rollup은 ArchiveScreen-*.js 청크를
// 여전히 내보낸다 — 본문만 부팅 청크로 옮겨가고 껍데기가 남는다. 그래서 파일 존재가 아니라
// **본문이 어디 있는지**를 봐야 한다.
const anchorChunk = jsFiles.find(f => f.startsWith(`${ANCHOR.chunk}-`));
const anchorInBoot = countOccurrences(bootText, ANCHOR.text);
const anchorInOwn = anchorChunk
  ? countOccurrences(readFileSync(join(ASSETS, anchorChunk), 'utf-8'), ANCHOR.text)
  : 0;
const anchorTotal = jsFiles
  .reduce((n, f) => n + countOccurrences(readFileSync(join(ASSETS, f), 'utf-8'), ANCHOR.text), 0);

// 셋을 나눠 세는 이유는 **진단 메시지를 구분하기 위해서**다. 하나로 합치면 "정적 참조가
// 살아났다"와 "문구가 바뀌었다"가 같은 실패로 보여서, 엉뚱한 곳을 고치게 된다.
assert(
  `앵커('${ANCHOR.text}')가 산출물 어딘가에 있다 (총 ${anchorTotal}회)`,
  anchorTotal > 0,
  `산출물 어디에도 없다 — 제품 결함이 아니라 **검사기 노후화**다. ${ANCHOR.chunk}의 문구가 ` +
  `바뀌었으니 ANCHOR.text를 현재 문구로 고쳐라. 이대로 두면 아래 단언이 ` +
  `"어디에도 없으니 부팅에도 없다"로 공허하게 통과한다`,
);
assert(
  '앵커가 부팅 그래프에 0회다',
  anchorInBoot === 0,
  `${ANCHOR.chunk}의 본문이 부팅에 실렸다(${anchorInBoot}회) — **정적 참조가 살아났다.** ` +
  `lazy() 선언이 남아 있어도 다른 파일에서 정적으로 import하면 이렇게 된다. ` +
  `청크 파일이 따로 보여도 부팅 전송량은 줄지 않는다`,
);
assert(
  `앵커가 ${anchorChunk ?? ANCHOR.chunk} 청크에 정확히 1회 있다`,
  anchorInOwn === 1,
  anchorInOwn === 0
    ? '지연 청크가 껍데기다 — 본문이 다른 청크로 옮겨갔다(정적 참조 또는 청크 병합)'
    : `같은 문구가 ${anchorInOwn}회다 — 앵커로 쓰기엔 모호하니 더 고유한 문구로 바꿔라`,
);

console.log(`\n=== 결과: ${failed === 0 ? '통과' : `${failed}건 실패`} ===\n`);
process.exit(failed === 0 ? 0 : 1);
