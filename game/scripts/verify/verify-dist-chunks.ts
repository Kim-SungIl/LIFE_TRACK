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
// **파일 존재만 보면 안 된다(실측).** 정적 import로 되돌려도 rollup은 그 이름의 청크를
// 여전히 내보낸다 — 본문은 부팅 청크로 옮겨가고 **재수출 껍데기**만 남는다:
//     EventScene-BTgUeR7g.js (0.06 kB) = import{t as e}from"./index-*.js";export{e as EventScene};
// 그래서 5절이 "이 청크가 자기 코드를 갖고 있는가"를 본다.
//
// **엔트리 청크를 import하는지로 판별하면 안 된다(실측).** 정상 청크 5개도 전부
// `./index-*.js`를 정적 import한다(React 등 공유 코드가 엔트리에 호이스팅되므로).
// 이걸 껍데기 서명으로 쓰면 상시 빨강이 된다. 판별 기준은 **자기 코드의 유무**다.
//
// CI에서 verify:ci(content-verify job)와 build:release(build job)는 별도 러너라 dist가
// 공유되지 않는다. **이 스크립트를 verify:ci에 넣으면 dist가 없어 섹션 1에서 곧바로 실패한다**
// — verify:dist-fonts·verify:dist-hygiene와 같이 **build job, 빌드 직후**에 둔다.
// (일반 build와 build:release의 청크 이름 집합은 동일함을 실측 확인했다 — 해시만 다르고
//  webp 플러그인은 이미지 태그만 건드린다.)
//
// **커버리지 한계(과신 금지).** 확실히 잡는 것은 지연 화면 **본체**가 부팅으로 옮겨간 경우다
// (① 청크 분리 ② 부팅 그래프 부재 ③ 껍데기 아님 ④ ArchiveScreen 한정 본문 문자열 위치).
// 7절의 청크 수·본문 하한은 **트립와이어이지 증명이 아니다** — 지연 화면의 *자식* 모듈이
// 부팅으로 새는 회귀를 그림자로만 본다. 작은 자식 하나가 엔트리 청크에 녹아들면
// 둘 다 안 움직일 수 있다. 자세한 근거는 MAX_BOOT_CHUNKS 선언부 주석에 적어 뒀다.
// **잡지 못하는 것**: 위 사각지대, 공유 청크를 만들어 modulepreload에 올리는 식의 부분 유출,
// 지연 화면이 실제로 열리는지(그건 컴포넌트 테스트 몫 — lazyScreenWiring.test.tsx가
// 클릭 왕복과 fallback 프레임을 본다).
//
// 실행: cd game && npm run build && npx tsx scripts/verify/verify-dist-chunks.ts

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { basename, join, relative, resolve } from 'path';

const DIST = resolve(import.meta.dirname, '../../dist');
const ASSETS = join(DIST, 'assets');
// **src 전체**를 훑는다. src/components로 한정했더니 App.tsx에서 GameScreen을 lazy로 빼도
// 미등록으로 안 잡혔다(검수 실측) — 다음 성능 작업이 정확히 그 길이라 사각지대가 컸다.
const SRC = resolve(import.meta.dirname, '../../src');

/** 지연 로딩이어야 하는 화면들. 청크 파일명은 rollup이 모듈 파일명에서 딴다. */
const LAZY_SCREENS: readonly string[] = [
  'ArchiveScreen',
  'EventScene',
  'EventResultScreen',
  'YearEndScreen',
  'EndingScreen',
];

// 껍데기 검사(5절)는 화면 5개를 균일하게 덮지만 "청크에 코드가 있다"까지만 본다.
// 아래 앵커는 **그게 정말 그 화면의 코드인지**를 보는 독립 신호다. 문자열 결합이라
// 문구가 바뀌면 같이 고쳐야 하므로, 잘 안 바뀌는 섹션 헤더 하나만 화면 하나에 쓴다.
const ANCHOR = { chunk: 'ArchiveScreen', text: '함께한 사람들' } as const;

// 검사기 자기 방어용 프로브 — **부팅 그래프에 반드시 있는** 문자열(타이틀 h1).
// 부팅 그래프를 잘못 찾았거나 파일을 못 읽었으면 이 카운트가 0이 되어 먼저 걸린다.
const BOOT_PROBE = '7년의 시간표';

// ── 7절 트립와이어 (증명이 아니다) ───────────────────────────────────────────
// 5·6절은 **지연 화면 본체**가 옮겨갔는지만 본다. 그 화면의 **전용 자식 모듈**이 부팅
// 경로에서 정적 import되면 청크는 살아 있고 코드도 남아 6개 절이 전부 통과한다(실측:
// TitleScreen에 NpcAlbumScreen을 정적 import → ArchiveScreen 청크 10,264B → 4,326B,
// 부팅 그래프 7파일 913,610B → 10파일 921,388B, 그런데 검사기는 EXIT=0).
// 원인이 "정적 참조 부활"이라 이 파일이 잡겠다고 선언한 바로 그 회귀인데, 서브모듈
// 단위로 일어났을 뿐이다.
//
// 아래 둘은 그 회귀를 **완전히 막지 못한다.** 구조 변화(청크 수)와 규모 급감(본문 크기)이라는
// 두 그림자만 본다. 잡히는 것과 안 잡히는 것을 실측해 뒀다:
//   ✓ 화면 **전용** 자식(NpcAlbumScreen→기록실, RunArchiveSummary→엔딩): 청크 수 7→10.
//   ✗ 여러 지연 화면이 **공유하는** 자식(memoryVisuals→학년말·엔딩): 그 자식의 전용 청크가
//     엔트리에 통째로 흡수되어 **청크 수는 7 그대로**, 부팅 바이트만 913,610→918,054(+0.5%).
//     소비하는 두 화면의 본문 크기도 그대로다(엔트리에서 import할 뿐이라). 두 그림자 다 안 움직인다.
// 바이트 예산으로도 못 잡는다 — 0.5%는 이벤트 몇 개 추가와 구분되지 않는다.
// 정밀하게 닫으려면 rollup의 `chunk.modules`로 **모듈 단위 귀속**을 baseline과 대조해야 하고
// (빌드 플러그인 + 커밋된 맵 파일), 그건 이 검사기의 범위를 넘는 별도 작업이다.
// 그래도 아래 둘을 두는 이유는, 실측된 회귀 중 전용 자식 유출은 반드시 건드리기 때문이다.

// 부팅에 받는 JS 청크 수. **바이트가 아니라 개수**인 이유: 부팅 청크에는 GAME_EVENTS가
// 들어 있어 이벤트를 추가할 때마다 바이트가 늘어난다 — 바이트 예산은 콘텐츠 작업마다
// 깨져서 무관한 PR을 빨갛게 만든다. 개수는 모듈 그래프 **구조**가 바뀔 때만 움직이고,
// 그때는 사람이 봐야 하는 순간이 맞다.
const MAX_BOOT_CHUNKS = 7;          // 실측 7 (엔트리 1 + modulepreload 6)

// 지연 청크 본문의 하한. **줄어들 때만** 걸린다(늘어나는 건 자유).
// 값은 실측치의 약 65%다 — 정상적인 리팩터링 여유를 두면서 위 −58% 사례는 잡는 선.
// 화면을 정말 가볍게 만들었다면 새 실측치를 확인하고 이 수를 내려라. 그 전에
// **부팅 경로에 그 화면의 자식을 정적 import한 곳이 없는지부터** 볼 것.
const MIN_BODY_BYTES: Readonly<Record<string, number>> = {
  ArchiveScreen: 6200,              // 실측 9553
  EventScene: 7900,                 // 실측 12173
  EventResultScreen: 2200,          // 실측 3403
  YearEndScreen: 4500,              // 실측 6940
  EndingScreen: 6000,               // 실측 9231
};

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

/** 정적 import/export 문을 걷어낸 나머지 — 이 청크가 **자기 코드**를 갖고 있는가.
 *
 *  현 번들러(rolldown)는 껍데기를 `export{e as X}` 형태로만 낸다 — default 전용 export로
 *  리팩터링해도 `export{e as default}`가 나온다(실측). 그래도 `export default e;`와
 *  `export*from"..."`을 같이 처리하는 이유는, 그러지 않으면 이 검사가 **번들러 출력 형태에
 *  기대는 상태**가 되어 output.format을 바꾸는 순간 조용히 뚫리기 때문이다. */
function bodyWithoutModuleSyntax(code: string): string {
  return code
    .replace(/import\s*\{[^}]*\}\s*from\s*["'][^"']+["']\s*;?/g, '')
    .replace(/import\s*\*\s*as\s+[\w$]+\s*from\s*["'][^"']+["']\s*;?/g, '')
    .replace(/import\s+[\w$]+\s*from\s*["'][^"']+["']\s*;?/g, '')
    .replace(/import\s*["'][^"']+["']\s*;?/g, '')
    // `export{a}from"..."` / `export*from"..."` / `export*as ns from"..."` — 재수출 형태.
    .replace(/export\s*\{[^}]*\}\s*from\s*["'][^"']+["']\s*;?/g, '')
    .replace(/export\s*\*\s*(?:as\s+[\w$]+\s*)?from\s*["'][^"']+["']\s*;?/g, '')
    .replace(/export\s*\{[^}]*\}\s*;?/g, '')
    // `export default e;` — 식별자 하나만. `export default function(){…}`은 안 걸린다(자기 코드다).
    .replace(/export\s+default\s+[\w$]+\s*;?/g, '')
    .trim();
}

/** 재수출만 하는 껍데기인가 — 정적 import 복원의 산물. */
function isReExportShell(code: string): boolean {
  return bodyWithoutModuleSyntax(code).length === 0;
}

function walkSource(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__') continue;          // 테스트의 정적 import는 번들과 무관하다
      out.push(...walkSource(full));
    } else if (name.endsWith('.tsx') || name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** 소스에서 `lazy(() => import('...'))` 로 선언된 화면 이름들. LAZY_SCREENS 완전성 대조용. */
function lazyScreensInSource(): string[] {
  // 따옴표 양쪽 허용 — 한쪽만 받으면 쌍따옴표로 쓴 새 lazy가 조용히 누락된다.
  const re = /lazy\(\s*\(\)\s*=>\s*\n?\s*import\(\s*["']([^"']+)["']/g;
  const found = new Set<string>();
  for (const file of walkSource(SRC)) {
    for (const m of readFileSync(file, 'utf-8').matchAll(re)) found.add(basename(m[1]));
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
const codeOf = new Map(jsFiles.map(f => [f, readFileSync(join(ASSETS, f), 'utf-8')]));

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
  '경로 파싱이 어긋났다. 내용을 못 읽으면 6절이 무조건 0회로 통과한다');

// **목록 대조는 양방향이어야 한다.** 한쪽만 보면 둘 다 조용히 뚫린다(실측):
//   - LAZY_SCREENS에서 한 줄 지움 → 그 화면이 무검사가 되는데 `length > 0`은 통과
//   - 소스에서 lazy()를 지움(=정적 import 복원) → srcLazy가 줄었는데 아무도 안 봄
const srcLazy = lazyScreensInSource();
assert(`소스의 lazy 화면을 찾았다 (${srcLazy.join(', ') || '없음'})`, srcLazy.length > 0,
  '정규식이 죽었다 — 0개면 아래 대조가 무조건 통과한다');
// 스캔 **범위**가 줄어드는 것도 조용한 커버리지 축소다 — src/components로 되돌리면
// App.tsx에서 화면을 lazy로 빼도 미등록으로 안 잡힌다(실측). 엔트리 파일을 앵커로 잡아둔다.
assert('소스 스캔이 엔트리(App.tsx)까지 덮는다',
  walkSource(SRC).some(f => relative(SRC, f).replaceAll('\\', '/') === 'App.tsx'),
  'SRC를 하위 디렉터리로 좁히면 그 밖의 lazy 선언이 통째로 사각지대가 된다');
const unregistered = srcLazy.filter(n => !LAZY_SCREENS.includes(n));
assert(
  unregistered.length === 0
    ? 'LAZY_SCREENS가 소스의 lazy 화면을 전부 덮는다'
    : `LAZY_SCREENS에 없는 지연 화면: ${unregistered.join(', ')}`,
  unregistered.length === 0,
  '목록에 없으면 그 화면은 부팅 번들에 실려도 아무도 안 본다. LAZY_SCREENS에 추가해라',
);
const vanished = LAZY_SCREENS.filter(n => !srcLazy.includes(n));
assert(
  vanished.length === 0
    ? '소스가 LAZY_SCREENS의 화면을 전부 lazy로 선언한다'
    : `소스에서 lazy() 선언이 사라진 화면: ${vanished.join(', ')}`,
  vanished.length === 0,
  '정적 import로 되돌아갔다. 의도한 것이면 LAZY_SCREENS에서도 지워라(그러면 무검사가 된다)',
);
assert(`앵커 화면(${ANCHOR.chunk})이 LAZY_SCREENS에 있다`, LAZY_SCREENS.includes(ANCHOR.chunk),
  '6절의 앵커 검사와 3~5절이 서로 다른 화면을 보게 된다');

// 판정 함수들의 상수 프로브 — 합성 샘플로 양성·음성을 먼저 확인한다. 이게 없으면
// countOccurrences를 `includes ? 1 : 0`으로 약화시켜도, 껍데기 판정을 상시 false로
// 바꿔도 전부 조용히 통과한다(둘 다 실측된 MISS였다).
assert('countOccurrences가 횟수를 센다',
  countOccurrences('abab', 'ab') === 2 && countOccurrences('abab', 'zz') === 0,
  '"1회 이상"으로 내려앉으면 중복 검출이 죽는다');
// 재수출 형태는 **한 가지가 아니다.** 현 번들러가 내는 형태만 샘플로 두면, 번들러가
// 다른 형태를 내기 시작할 때 이 판정이 조용히 뚫린다(cursor 검수 지적).
for (const [shape, sample] of [
  ['export{X}', 'import{t as e}from"./index-abc.js";export{e as EventScene};'],
  ['export{X as default}', 'import{t as e}from"./index-abc.js";export{e as default};'],
  ['export{X}from', 'export{EventScene}from"./index-abc.js";'],
  ['export*from', 'export*from"./index-abc.js";'],
  ['export default X', 'import{t as e}from"./index-abc.js";export default e;'],
] as const) {
  assert(`껍데기 판정이 재수출을 문다 — ${shape}`, isReExportShell(sample),
    '실제 되돌림 산물(0.06 kB 재수출)을 못 물면 5절이 공허해진다');
}
assert('껍데기 판정이 정상 청크를 물지 않는다',
  !isReExportShell('import{a}from"./x.js";const y=()=>a(1);export{y};')
  && !isReExportShell('export default function(){return 1}'),
  '오탐이면 CI가 상시 빨강이 된다');

const bootText = bootNames
  .filter(n => jsFiles.includes(n))
  .map(n => codeOf.get(n)!)
  .join('\n');
// 카운터와 부팅 그래프 식별이 둘 다 살아 있는지 — 상수 프로브.
assert(`부팅 그래프에서 프로브('${BOOT_PROBE}')를 찾는다`,
  countOccurrences(bootText, BOOT_PROBE) > 0,
  '타이틀 화면은 eager라 부팅 그래프에 반드시 있다. 0회면 파일을 안 읽었거나 카운터가 죽은 것 ' +
  '(문구가 바뀌었다면 BOOT_PROBE를 고쳐라)');

console.log('\n=== 3. 지연 화면은 자기 청크로 갈라진다 ===');
const chunkOf = new Map<string, string>();
for (const name of LAZY_SCREENS) {
  const hits = jsFiles.filter(f => f.startsWith(`${name}-`));
  if (hits.length === 1) chunkOf.set(name, hits[0]);
  assert(
    hits.length === 1
      ? `${name} → ${hits[0]}`
      : `${name} 청크가 ${hits.length}개다 (${hits.join(', ') || '없음'})`,
    hits.length === 1,
    hits.length === 0
      ? '청크가 통째로 합쳐졌다. 이 화면이 부팅 번들에 실려 첫 페인트를 늦춘다'
      : '같은 이름의 청크가 여러 개다 — 아래 판정이 어느 쪽인지 모호해진다',
  );
}

console.log('\n=== 4. 지연 청크는 부팅 그래프에 없다 ===');
// 청크로 갈렸어도 modulepreload가 걸리면 부팅에 같이 받는다 — 분할한 의미가 없어진다.
// **양성 대조 먼저**: 술어를 `n === name`으로 바꾸면 아래 5건이 전부 공허하게 통과한다(실측).
const inBootGraph = (name: string) => bootNames.filter(n => n.startsWith(`${name}-`));
assert('부팅 그래프 조회 술어가 실제로 문다 (양성 대조)',
  inBootGraph('index').length > 0,
  '엔트리 청크는 index-로 시작하고 반드시 부팅 그래프에 있다. 0건이면 술어가 죽은 것이다');
for (const name of LAZY_SCREENS) {
  const inBoot = inBootGraph(name);
  assert(
    inBoot.length === 0
      ? `${name}은 부팅에 받지 않는다`
      : `${name}이 부팅 그래프에 있다: ${inBoot.join(', ')}`,
    inBoot.length === 0,
    'modulepreload가 걸렸다. 청크는 갈렸지만 부팅에 같이 내려받으므로 전송량은 그대로다',
  );
}

console.log('\n=== 5. 지연 청크가 껍데기가 아니다 (본문이 부팅으로 옮겨가지 않았다) ===');
// 이 절이 5개 화면을 **균일하게** 덮는다. 3·4절만 있던 동안 ArchiveScreen 밖 네 화면은
// 정적 import 복원에 완전 무방비였다(실측: EventScene 되돌려도 5개 절 전부 ✓, 878 통과).
for (const name of LAZY_SCREENS) {
  const file = chunkOf.get(name);
  if (!file) continue;                              // 3절이 이미 실패로 보고했다
  const rest = bodyWithoutModuleSyntax(codeOf.get(file)!);
  assert(
    `${name} 청크가 자기 코드를 갖는다 (${rest.length}B)`,
    rest.length > 0,
    `${file}이 재수출 껍데기다 — 본문이 부팅 청크로 옮겨갔다. **정적 참조가 살아났다:** ` +
    'lazy() 선언이 남아 있어도 다른 파일에서 정적으로 import하면 이렇게 된다. ' +
    '청크 파일이 보이더라도 부팅 전송량은 줄지 않는다',
  );
}

console.log('\n=== 6. 앵커 화면의 본문이 부팅이 아니라 자기 청크에 있다 ===');
// 5절은 "코드가 있다"까지다. 그게 **정말 그 화면의 코드인지**는 문자열로만 확인된다.
const anchorChunk = chunkOf.get(ANCHOR.chunk);
const anchorTotal = jsFiles.reduce((n, f) => n + countOccurrences(codeOf.get(f)!, ANCHOR.text), 0);
const anchorPresent = anchorTotal > 0;
assert(
  `앵커('${ANCHOR.text}')가 산출물 어딘가에 있다 (총 ${anchorTotal}회)`,
  anchorPresent,
  `산출물 어디에도 없다 — 제품 결함이 아니라 **검사기 노후화**다. ${ANCHOR.chunk}의 문구가 ` +
  '바뀌었으니 ANCHOR.text를 현재 문구로 고쳐라. 아래 두 단언은 판정을 건너뛴다',
);
// **앵커가 없으면 아래 둘은 평가하지 않는다.** 평가하면 "문구만 바뀐 상황"에서
// "지연 청크가 껍데기다(번들링을 고쳐라)"라는 엉뚱한 진단이 함께 뜬다(검수 실측).
if (anchorPresent) {
  assert(
    '앵커가 부팅 그래프에 0회다',
    countOccurrences(bootText, ANCHOR.text) === 0,
    `${ANCHOR.chunk}의 본문이 부팅에 실렸다 — 정적 참조가 살아났다`,
  );
  assert(
    `앵커가 ${anchorChunk ?? ANCHOR.chunk} 청크에 있다`,
    // `=== 1`이 아니라 `>= 1`이다 — 계약은 "자기 청크에 있다"이지 "한 번만 있다"가 아니다.
    // aria-label을 같은 문구로 다는 무해한 a11y 개선만으로 CI가 빨강이 됐다(검수 실측).
    anchorChunk !== undefined && countOccurrences(codeOf.get(anchorChunk)!, ANCHOR.text) >= 1,
    '지연 청크에 그 화면의 본문 문자열이 없다 — 다른 청크로 옮겨갔다',
  );
}

console.log('\n=== 7. 규모 트립와이어 (증명이 아니라 그림자다 — 위 주석 참고) ===');
assert(
  `부팅에 받는 청크가 ${bootNames.length}개다 (상한 ${MAX_BOOT_CHUNKS})`,
  bootNames.length <= MAX_BOOT_CHUNKS,
  '부팅 그래프에 청크가 늘었다. 지연 화면의 자식 모듈을 부팅 경로에서 정적 import했을 때 ' +
  '나오는 증상이다. 의도한 구조 변경이면 MAX_BOOT_CHUNKS를 올려라',
);
// 하한 목록이 화면을 전부 덮는지 — 한 줄 빠지면 그 화면만 무검사가 된다.
const uncovered = LAZY_SCREENS.filter(n => MIN_BODY_BYTES[n] === undefined);
assert(
  uncovered.length === 0 ? 'MIN_BODY_BYTES가 지연 화면을 전부 덮는다' : `하한 없음: ${uncovered.join(', ')}`,
  uncovered.length === 0,
  '하한이 없으면 그 화면은 규모 급감을 아무도 안 본다',
);
for (const name of LAZY_SCREENS) {
  const file = chunkOf.get(name);
  const floor = MIN_BODY_BYTES[name];
  if (!file || floor === undefined) continue;       // 위 두 절이 이미 실패로 보고했다
  const size = bodyWithoutModuleSyntax(codeOf.get(file)!).length;
  assert(
    `${name} 본문 ${size}B ≥ ${floor}B`,
    size >= floor,
    '이 화면의 코드가 크게 줄었다. **먼저 부팅 경로에서 이 화면의 자식 모듈을 정적 import한 ' +
    '곳이 없는지 확인해라** — 그게 가장 흔한 원인이다. 정말 화면을 가볍게 만든 것이면 ' +
    'MIN_BODY_BYTES를 새 실측치에 맞춰 내려라',
  );
}

console.log(`\n=== 결과: ${failed === 0 ? '통과' : `${failed}건 실패`} ===\n`);
process.exit(failed === 0 ? 0 : 1);
