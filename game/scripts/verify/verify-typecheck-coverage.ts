// verify-typecheck-coverage.ts — **테스트 타입 검사가 의도인지** 검증
//
// 사실관계부터 (3자 검수에서 초판의 전제가 거짓로 드러나 다시 썼다):
// main에서도 테스트는 타입 검사를 받고 있었다. `tsconfig.scripts.json`이
// `include: ["scripts", "src"]`라 src 전체가 그 프로젝트의 검사 대상이었기 때문이다.
// 그런데 그 `src`는 **scripts가 src를 import하니까** 들어간 것이다 — 테스트 커버리지는
// 부수효과였고, 아무도 그걸 요구하지 않았다.
//
// 실측(같은 뮤테이션을 두 리비전에): scripts의 include를 `["scripts"]`로 좁히고
// — 있어 보이는 "정리" 커밋이면 충분하다 — 테스트에 타입 오류를 심으면
//   · 이전 → `tsc -b` rc=0, 오류 0건   (테스트 110개가 통째로 무음 이탈)
//   · 지금 → `tsc -b` rc=2, TS2322     (`tsconfig.test.json`이 잡는다)
//
// 그래서 전용 `tsconfig.test.json`으로 의도를 명시하고, 이 게이트가 그 의도를 잠근다.
// 커버리지는 여전히 조용히 사라질 수 있다 — references에서 한 줄 빼거나, include를 좁히거나,
// exclude를 붙이면 **검사할 게 줄 뿐 오류는 안 나서 `tsc -b`가 초록**이다(#437 계열의 corpus-0).
// 그래서 수치 하한이 아니라 **집합 동등성**을 본다: 디스크의 파일 == 프로젝트가 검사하는 파일.
//
// **그리고 플래그가 아니라 행동을 본다.** 초판은 `types`에 `"node"`라는 문자열이 있는지만
// 봤는데 3자 검수가 셋으로 뚫었다: `["node/globals"]` · d.ts의 `/// <reference types="node" />` ·
// `["./node_modules/@types/node"]`. test 쪽은 `"noCheck": true` 한 줄이면 **파일 목록은 그대로인 채
// 검사만** 사라졌다. 넷 다 문자열 검사로는 원리상 못 잡는다. 지금은 합성 파일을 실제 프로젝트
// 설정 위에 얹어 컴파일하고 **진단이 나오는지**를 본다(#434 계열 — "선언이 있나"만 보고
// "어디에 붙었나"를 안 보면 통과한다).
//
// 파싱은 정규식이 아니라 **TypeScript 자신의 설정 파서**로 한다 — tsconfig는 주석이 붙은
// JSONC라 손으로 짠 파서는 문자열 안의 `//`에서 깨진다. references도 basename이 아니라
// **경로를 정규화해서** 본다(`./empty/tsconfig.test.json`이 basename 정규식을 통과한다).
//
// 실행: cd game && npx tsx scripts/verify/verify-typecheck-coverage.ts

import ts from 'typescript';
import { readdirSync, existsSync } from 'fs';
import { resolve, join, relative } from 'path';
import { pathToFileURL } from 'url';
// 디스크의 테스트 파일을 세는 규칙은 `verify-test-floor`가 이미 export한다. 복붙하면
// 두 층이 각자 계산하다 조용히 갈린다(#441) — 한 함수에서 가져온다.
import { listTestFiles, FLOOR_TEST_FILES } from './verify-test-floor';

const ROOT = resolve(import.meta.dirname, '../..');
const SRC = resolve(ROOT, 'src');
const ROOT_TSCONFIG = resolve(ROOT, 'tsconfig.json');
const TEST_TSCONFIG = resolve(ROOT, 'tsconfig.test.json');
const APP_TSCONFIG = resolve(ROOT, 'tsconfig.app.json');

/** 루트 references에 **반드시** 있어야 하는 프로젝트. 하나라도 빠지면 `tsc -b`가 그걸 안 돈다. */
const REQUIRED_REFS = ['tsconfig.app.json', 'tsconfig.test.json'] as const;

export interface Problem { kind: string; detail: string }

/** 디스크의 제품 소스 — `__tests__` 밖의 `.ts(x)`. app 프로젝트가 이걸 전부 봐야 한다. */
export function listProductFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) listProductFiles(p, out);
    else if (/\.tsx?$/.test(e.name) && !/__tests__/.test(p)) out.push(p);
  }
  return out;
}

/** tsconfig(JSONC)를 TypeScript 자신의 파서로 읽는다. */
export function readConfig(path: string): Record<string, unknown> {
  const text = ts.sys.readFile(path);
  if (text === undefined) throw new Error(`설정 파일을 못 읽었다: ${path}`);
  const { config, error } = ts.parseConfigFileTextToJson(path, text);
  if (error) throw new Error(`설정 파싱 실패: ${path} — ${ts.flattenDiagnosticMessageText(error.messageText, ' ')}`);
  return (config ?? {}) as Record<string, unknown>;
}

/** 한 프로젝트의 해석된 명령행(파일 목록 + 유효 옵션). */
export function parseProject(configPath: string): ts.ParsedCommandLine {
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: d => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, ' '));
    },
  });
  if (!parsed) throw new Error(`설정을 해석하지 못했다: ${configPath}`);
  return parsed;
}

export function referencePaths(rootConfig: Record<string, unknown>): string[] {
  const refs = rootConfig.references;
  if (!Array.isArray(refs)) return [];
  return refs.map(r => String((r as { path?: unknown }).path ?? ''));
}

// ── 행동 탐침 ────────────────────────────────────────────────────────────────
// 합성 파일을 **실제 프로젝트의 파일 목록과 옵션 위에** 얹어 컴파일한다. 파일 목록을 같이
// 넣는 게 핵심이다 — `/// <reference types="node" />`는 프로젝트 안의 d.ts에 숨을 수 있고,
// 합성 파일만 단독 컴파일하면 그게 안 보인다.

export interface ProbeCase { name: string; file: string; text: string }

/** 프로젝트 설정 위에서 합성 파일들을 컴파일하고 사례별 진단 코드를 돌려준다. */
export function probe(
  options: ts.CompilerOptions,
  fileNames: readonly string[],
  cases: readonly ProbeCase[],
): Map<string, string[]> {
  const paths = new Map(cases.map(c => [resolve(ROOT, c.file), c]));
  for (const p of paths.keys()) {
    if (existsSync(p)) throw new Error(`탐침 파일명이 실제 파일과 충돌한다: ${p}`);
  }
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  host.readFile = f => paths.get(resolve(f))?.text ?? readFile(f);
  host.fileExists = f => paths.has(resolve(f)) || fileExists(f);
  host.getSourceFile = (f, lv, oe, sh) => {
    const c = paths.get(resolve(f));
    return c ? ts.createSourceFile(f, c.text, lv, true) : getSourceFile(f, lv, oe, sh);
  };
  const program = ts.createProgram({
    rootNames: [...fileNames, ...paths.keys()],
    options,
    host,
  });
  const out = new Map<string, string[]>();
  for (const [path, c] of paths) {
    const sf = program.getSourceFile(path);
    if (!sf) throw new Error(`탐침 파일이 프로그램에 안 들어갔다: ${c.name}`);
    const ds = [...program.getSyntacticDiagnostics(sf), ...program.getSemanticDiagnostics(sf)];
    out.set(c.name, ds.map(d => `TS${d.code}`));
  }
  return out;
}

/** app 프로젝트가 거부해야 하는 node 전역들. 하나라도 통과하면 브라우저 소스에 node가 열린 것이다. */
export const NODE_PROBES: readonly ProbeCase[] = [
  { name: 'process.env', file: 'src/__typecheck_probe_process.ts', text: `export const p = process.env.PROBE ?? '';\n` },
  { name: 'Buffer', file: 'src/__typecheck_probe_buffer.ts', text: `export const b = Buffer.from('');\n` },
  { name: '__dirname', file: 'src/__typecheck_probe_dirname.ts', text: `export const d = __dirname;\n` },
  { name: `import 'fs'`, file: 'src/__typecheck_probe_fs.ts', text: `import { readFileSync } from 'fs';\nexport const f = readFileSync;\n` },
];

/** test 프로젝트가 잡아야 하는 평범한 타입 오류들. 안 잡히면 파일 목록만 맞고 검사는 없는 것이다. */
export const TYPE_ERROR_PROBES: readonly ProbeCase[] = [
  { name: '타입 불일치', file: 'src/components/__tests__/__typecheck_probe_mismatch.test.ts', text: `export const z: number = 'not a number';\n` },
  { name: '없는 프로퍼티', file: 'src/components/__tests__/__typecheck_probe_noprop.test.ts', text: `export const q = ({ a: 1 } as { a: number }).nope;\n` },
];

// ── 판정 ─────────────────────────────────────────────────────────────────────

export function audit(
  rootConfig: Record<string, unknown>,
  diskTests: readonly string[],
  checkedTestFiles: readonly string[],
  diskProduct: readonly string[],
  checkedProductFiles: readonly string[],
  nodeProbe: ReadonlyMap<string, string[]>,
  typeErrorProbe: ReadonlyMap<string, string[]>,
  root: string = ROOT,
): Problem[] {
  const problems: Problem[] = [];

  // ① 두 프로젝트가 `tsc -b`의 사정권에 있는가 — 경로로 본다(basename은 위장 가능)
  const refs = referencePaths(rootConfig).map(p => resolve(root, p));
  for (const want of REQUIRED_REFS) {
    if (!refs.includes(resolve(root, want))) {
      problems.push({
        kind: 'references 누락',
        detail: `루트 tsconfig.json의 references에 ./${want}이 없다 — tsc -b가 그 프로젝트를 아예 안 돈다. 현재: [${refs.map(p => relative(root, p)).join(', ')}]`,
      });
    }
  }

  // ② 테스트: 검사 집합 == 디스크 집합
  const checkedTests = new Set(checkedTestFiles);
  const missingTests = diskTests.filter(f => !checkedTests.has(f));
  if (missingTests.length > 0) {
    problems.push({
      kind: '무검사 테스트',
      detail: `${missingTests.length}개가 타입 검사 밖이다 (include가 좁혀졌거나 exclude가 붙었다):\n    ` +
        missingTests.slice(0, 8).map(f => relative(root, f)).join('\n    ') +
        (missingTests.length > 8 ? `\n    … 외 ${missingTests.length - 8}개` : ''),
    });
  }

  // ②' 제품 소스: app이 전부 보는가 — app include를 좁히면 node 타입을 가진
  //     scripts/test 프로젝트가 대신 검사해서 `tsc -b`는 초록인 채 ④가 공허해진다
  const checkedProduct = new Set(checkedProductFiles);
  const missingProduct = diskProduct.filter(f => !checkedProduct.has(f));
  if (missingProduct.length > 0) {
    problems.push({
      kind: '무검사 제품 소스',
      detail: `${missingProduct.length}개가 app 프로젝트 밖이다 — node 타입을 가진 프로젝트가 대신 검사하면 브라우저 금지가 무의미해진다:\n    ` +
        missingProduct.slice(0, 8).map(f => relative(root, f)).join('\n    ') +
        (missingProduct.length > 8 ? `\n    … 외 ${missingProduct.length - 8}개` : ''),
    });
  }

  // ③ corpus 퇴화 — 양쪽이 같이 0이면 ②는 통과한다
  if (diskTests.length < FLOOR_TEST_FILES) {
    problems.push({
      kind: 'corpus 퇴화',
      detail: `디스크의 테스트 파일이 ${diskTests.length}개다(바닥 ${FLOOR_TEST_FILES}). 집합 동등성만으로는 "둘 다 0"을 못 막는다`,
    });
  }

  // ④ 행동: app이 node 전역을 **전부** 거부하는가
  for (const c of NODE_PROBES) {
    const got = nodeProbe.get(c.name);
    if (got === undefined) {
      problems.push({ kind: '탐침 유실', detail: `app node 탐침 "${c.name}"의 결과가 없다 — 탐침 목록과 실행이 갈렸다` });
    } else if (got.length === 0) {
      problems.push({
        kind: 'app에 node 전역',
        detail: `app 프로젝트가 \`${c.name}\`를 통과시킨다. 앱 소스는 브라우저에서 돈다 — ` +
          `types의 "node", d.ts의 \`/// <reference types="node" />\`, @types 절대경로 셋 다 이걸 연다. 테스트에 node가 필요하면 tsconfig.test.json에 넣을 것`,
      });
    }
  }

  // ⑤ 행동: test 프로젝트가 실제로 타입을 검사하는가 (`noCheck: true` 한 줄이면 사라진다)
  for (const c of TYPE_ERROR_PROBES) {
    const got = typeErrorProbe.get(c.name);
    if (got === undefined) {
      problems.push({ kind: '탐침 유실', detail: `test 오류 탐침 "${c.name}"의 결과가 없다 — 탐침 목록과 실행이 갈렸다` });
    } else if (got.length === 0) {
      problems.push({
        kind: '무력한 test 프로젝트',
        detail: `test 프로젝트가 \`${c.name}\`를 안 잡는다 — 파일 목록은 맞는데 검사가 없다(\`noCheck\`·\`skipDefaultLibCheck\` 등)`,
      });
    }
  }

  return problems;
}

// ── 자기검사 ─────────────────────────────────────────────────────────────────
// 실데이터가 늘 건강하면 audit의 분기를 지워도 초록이다(#437). 각 분기를 합성 입력으로 태운다.
// **행동 탐침은 합성 입력만으로는 안 잠긴다** — 아래 `liveProbeControls()`가 실제 설정을
// 망가뜨린 채 탐침을 돌려 "탐침이 정말 구분하는가"를 양성 대조로 확인한다.
/** 고정 케이스 10종 + 탐침별 케이스. 이 수식이 아래 `cases` 구성과 어긋나면 main이 거부한다. */
export const EXPECTED_SELF_CHECKS = 10 + NODE_PROBES.length + 1 + TYPE_ERROR_PROBES.length + 1;

function selfCheck(): number {
  const R = '/x';
  const ROOT_OK = { references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.test.json' }] };
  // 픽스처 길이를 FLOOR에 묶으면 FLOOR를 낮출 때 아래 slice가 뒤집혀 무관한 케이스가 깨진다.
  const tests = Array.from({ length: Math.max(FLOOR_TEST_FILES, 1) + 5 }, (_, i) => `/x/src/a/__tests__/t${i}.test.ts`);
  const half = Math.floor(tests.length / 2);
  const prod = Array.from({ length: 12 }, (_, i) => `/x/src/p${i}.ts`);
  const nodeOK = new Map(NODE_PROBES.map(c => [c.name, ['TS2591']]));
  const errOK = new Map(TYPE_ERROR_PROBES.map(c => [c.name, ['TS2322']]));
  const run = (o: Partial<{
    root: Record<string, unknown>; disk: string[]; checked: string[];
    dProd: string[]; cProd: string[];
    node: Map<string, string[]>; err: Map<string, string[]>;
  }> = {}) => audit(
    o.root ?? ROOT_OK, o.disk ?? tests, o.checked ?? tests,
    o.dProd ?? prod, o.cProd ?? prod,
    o.node ?? nodeOK, o.err ?? errOK, R,
  ).map(p => p.kind);

  const cases: { label: string; kinds: string[]; want: string | null }[] = [
    { label: '정상', kinds: run(), want: null },
    { label: 'references에서 test 제거', want: 'references 누락',
      kinds: run({ root: { references: [{ path: './tsconfig.app.json' }] } }) },
    { label: 'references에서 app 제거', want: 'references 누락',
      kinds: run({ root: { references: [{ path: './tsconfig.test.json' }] } }) },
    { label: 'references 자체가 없음', want: 'references 누락', kinds: run({ root: {} }) },
    { label: 'references를 다른 디렉터리로 위장', want: 'references 누락',
      kinds: run({ root: { references: [{ path: './tsconfig.app.json' }, { path: './empty/tsconfig.test.json' }] } }) },
    { label: '테스트 검사 집합이 좁아짐', want: '무검사 테스트', kinds: run({ checked: tests.slice(0, half) }) },
    { label: '테스트 검사 집합이 빔', want: '무검사 테스트', kinds: run({ checked: [] }) },
    { label: '제품 검사 집합이 좁아짐', want: '무검사 제품 소스', kinds: run({ cProd: prod.slice(0, 3) }) },
    { label: '제품 검사 집합이 빔', want: '무검사 제품 소스', kinds: run({ cProd: [] }) },
    { label: '양쪽 다 0 (퇴화)', want: 'corpus 퇴화', kinds: run({ disk: [], checked: [] }) },
  ];
  for (const c of NODE_PROBES) {
    cases.push({ label: `app이 ${c.name}를 통과시킴`, want: 'app에 node 전역',
      kinds: run({ node: new Map([...nodeOK, [c.name, []]]) }) });
  }
  cases.push({ label: 'app node 탐침 결과 유실', want: '탐침 유실', kinds: run({ node: new Map() }) });
  for (const c of TYPE_ERROR_PROBES) {
    cases.push({ label: `test가 ${c.name}를 안 잡음`, want: '무력한 test 프로젝트',
      kinds: run({ err: new Map([...errOK, [c.name, []]]) }) });
  }
  cases.push({ label: 'test 오류 탐침 결과 유실', want: '탐침 유실', kinds: run({ err: new Map() }) });

  for (const c of cases) {
    if (c.want === null) {
      if (c.kinds.length !== 0) throw new Error(`자기검사 실패 — "${c.label}"이 문제를 냈다: ${c.kinds.join(', ')}`);
    } else if (!c.kinds.includes(c.want)) {
      throw new Error(`자기검사 실패 — "${c.label}"에서 "${c.want}"를 못 잡았다 (나온 것: ${c.kinds.join(', ') || '없음'})`);
    }
  }
  return cases.length;
}

/**
 * **모듈 최상위에서 돈다** — `verify-test-floor.ts`와 같은 형태다. 호출문을 지우는 뮤테이션이
 * 통과했었기 때문에(3자 검수 실측), 지울 "호출 자리"를 아예 없앴다. 테스트가 이 모듈을
 * import하기만 해도 같이 검증된다.
 */
export const SELF_CHECK_COUNT: number = selfCheck();

/**
 * 탐침 자체의 양성 대조군. 합성 Map으로는 audit의 분기만 잠기고 **탐침이 실제로 구분하는지**는
 * 안 잠긴다 — `probe()`가 늘 빈 배열을 돌려주게 만들어도 실데이터가 건강하면 아무도 모른다.
 * 그래서 실제 설정을 **일부러 망가뜨린 채** 돌려 탐침이 침묵하는지 본다.
 */
function liveProbeControls(app: ts.ParsedCommandLine, test: ts.ParsedCommandLine): number {
  // app에 node 타입을 열면 node 탐침은 전부 조용해져야 한다
  const opened = probe({ ...app.options, types: ['node', 'vite/client'] }, app.fileNames, NODE_PROBES);
  for (const c of NODE_PROBES) {
    const got = opened.get(c.name) ?? [];
    if (got.length !== 0) {
      throw new Error(`탐침 대조군 실패 — app에 node를 열었는데 "${c.name}"가 여전히 ${got.join(',')}를 냈다. 탐침이 node 여부를 안 보고 있다`);
    }
  }
  // test에서 검사를 끄면 오류 탐침은 전부 조용해져야 한다
  const off = probe({ ...test.options, noCheck: true }, test.fileNames, TYPE_ERROR_PROBES);
  for (const c of TYPE_ERROR_PROBES) {
    const got = off.get(c.name) ?? [];
    if (got.length !== 0) {
      throw new Error(`탐침 대조군 실패 — test에 noCheck를 켰는데 "${c.name}"가 여전히 ${got.join(',')}를 냈다. 탐침이 검사 여부를 안 보고 있다`);
    }
  }
  return NODE_PROBES.length + TYPE_ERROR_PROBES.length;
}

// ── 실행 ─────────────────────────────────────────────────────────────────────
// 가드가 필요하다: 이 리포는 테스트가 verify 스크립트를 import한다(`ciGateWiring.test.ts`).
// 가드 없이 최상위에서 `process.exit(1)`을 부르면 게이트가 붉어질 때 **vitest가 통째로 죽는다**.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const p of [ROOT_TSCONFIG, TEST_TSCONFIG, APP_TSCONFIG]) {
    if (!existsSync(p)) {
      console.log(`❌ ${relative(ROOT, p)}가 없다`);
      process.exit(1);
    }
  }

  if (SELF_CHECK_COUNT !== EXPECTED_SELF_CHECKS) {
    console.log(`❌ 자기검사가 ${SELF_CHECK_COUNT}종만 돌았다(기대 ${EXPECTED_SELF_CHECKS}) — 케이스가 지워졌다`);
    process.exit(1);
  }
  console.log(`  자기검사 ${SELF_CHECK_COUNT}종 통과`);

  const app = parseProject(APP_TSCONFIG);
  const test = parseProject(TEST_TSCONFIG);

  const m = liveProbeControls(app, test);
  if (m !== NODE_PROBES.length + TYPE_ERROR_PROBES.length) {
    console.log(`❌ 탐침 양성 대조가 ${m}종만 돌았다(기대 ${NODE_PROBES.length + TYPE_ERROR_PROBES.length}) — 대조군이 지워졌다`);
    process.exit(1);
  }
  console.log(`  탐침 양성 대조 ${m}종 통과`);

  const isTest = (f: string) => /__tests__/.test(f) && /\.test\.tsx?$/.test(f);
  const diskTests = listTestFiles(SRC).map(f => resolve(f)).sort();
  const diskProduct = listProductFiles(SRC).map(f => resolve(f)).sort();
  const checkedTests = test.fileNames.map(f => resolve(f)).filter(isTest);
  const checkedProduct = app.fileNames.map(f => resolve(f)).filter(f => !isTest(f));

  const problems = audit(
    readConfig(ROOT_TSCONFIG),
    diskTests, checkedTests,
    diskProduct, checkedProduct,
    probe(app.options, app.fileNames, NODE_PROBES),
    probe(test.options, test.fileNames, TYPE_ERROR_PROBES),
  );

  console.log(`  테스트 ${diskTests.length}개(검사 ${checkedTests.length}) / 제품 소스 ${diskProduct.length}개(검사 ${checkedProduct.length})`);

  if (problems.length > 0) {
    for (const p of problems) console.log(`❌ ${p.kind} — ${p.detail}`);
    process.exit(1);
  }
  console.log('✅ PASS — 무검사 0건, app은 node 전역을 거부, test는 타입 오류를 잡는다');
}
