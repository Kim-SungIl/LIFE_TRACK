// verify-typecheck-coverage.ts — **테스트 코드가 타입 검사를 받는지** 검증
//
// 왜 필요한가: `tsconfig.app.json`이 오랫동안 `src/**/__tests__/**`를 제외하고 있었다.
// 이 리포의 잠금 절반이 vitest인데 **그 층만 타입 무검사**였다. 실사고: 0인자 함수에
// `resultState(5, 4)`를 넘긴 호출이 tsc를 그대로 통과했다 — vitest는 esbuild로 타입을
// 벗겨 실행하므로 런타임에도 안 걸린다. 테스트가 컴파일조차 안 되는 상태를 아무도 못 본다.
//
// 지금은 `tsconfig.test.json`이 node 타입과 함께 테스트를 검사한다. 그런데 그 커버리지는
// **조용히 사라질 수 있다**:
//   · 루트 `tsconfig.json`의 references에서 한 줄 빼기 — `tsc -b`가 그 프로젝트를 아예 안 돈다
//   · `tsconfig.test.json`의 include를 좁히기 — 절반이 무음으로 빠진다
//   · `exclude`를 추가하기 — 같은 결과
// 셋 다 `tsc -b`가 초록이다(검사할 게 줄었을 뿐 오류는 없으므로). #437과 같은 corpus-0 구멍이다.
//
// 그래서 **수치 하한이 아니라 집합 동등성**을 본다: 디스크의 테스트 파일 == test 프로젝트가
// 검사하는 테스트 파일. 하드코딩이 없고, include를 좁히면 정확히 걸리고, 파일을 지우면
// 양쪽이 같이 준다. (양쪽이 0인 퇴화만 FLOOR가 막는다.)
//
// **app이 node 전역을 얻지 않는 것도 함께 잠근다.** 테스트에 node 타입이 필요하다고
// `tsconfig.app.json`에 `"node"`를 넣으면, 브라우저에서 도는 앱 소스가 `process.env`를
// 쓰고도 tsc를 통과한다. 그게 이 파일 분리의 존재 이유이므로 여기서 지킨다.
//
// 파싱은 정규식이 아니라 **TypeScript 자신의 설정 파서**로 한다 — tsconfig는 주석이 붙은
// JSONC라 손으로 짠 파서는 문자열 안의 `//`에서 깨진다.
//
// 실행: cd game && npx tsx scripts/verify/verify-typecheck-coverage.ts

import ts from 'typescript';
import { readdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(import.meta.dirname, '../..');
const SRC = resolve(ROOT, 'src');
const ROOT_TSCONFIG = resolve(ROOT, 'tsconfig.json');
const TEST_TSCONFIG = resolve(ROOT, 'tsconfig.test.json');
const APP_TSCONFIG = resolve(ROOT, 'tsconfig.app.json');

/** corpus 퇴화 방지용 바닥. 1차 잠금은 집합 동등성이고 이건 "양쪽 다 0"만 막는다. */
const FLOOR_TEST_FILES = 50;

export interface Problem { kind: string; detail: string }

/** 디스크의 테스트 파일. verify-test-floor.listTestFiles와 같은 모양이어야 한다. */
export function listTestFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) listTestFiles(p, out);
    else if (/__tests__/.test(p) && /\.test\.tsx?$/.test(e.name)) out.push(p);
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

/** 한 프로젝트가 실제로 검사하게 될 파일 목록(include/exclude 해석 후). */
export function projectFileNames(configPath: string): string[] {
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: d => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, ' '));
    },
  });
  if (!parsed) throw new Error(`설정을 해석하지 못했다: ${configPath}`);
  return parsed.fileNames.map(f => resolve(f));
}

export function referencePaths(rootConfig: Record<string, unknown>): string[] {
  const refs = rootConfig.references;
  if (!Array.isArray(refs)) return [];
  return refs.map(r => String((r as { path?: unknown }).path ?? ''));
}

export function typesOf(config: Record<string, unknown>): string[] {
  const co = config.compilerOptions as Record<string, unknown> | undefined;
  const t = co?.types;
  return Array.isArray(t) ? t.map(String) : [];
}

export function audit(
  rootConfig: Record<string, unknown>,
  appConfig: Record<string, unknown>,
  diskTests: readonly string[],
  checkedFiles: readonly string[],
): Problem[] {
  const problems: Problem[] = [];

  // ① test 프로젝트가 tsc -b의 사정권에 있는가
  const refs = referencePaths(rootConfig);
  if (!refs.some(p => /tsconfig\.test\.json$/.test(p))) {
    problems.push({
      kind: 'references 누락',
      detail: `루트 tsconfig.json의 references에 ./tsconfig.test.json이 없다 — tsc -b가 테스트를 아예 안 돈다. 현재: [${refs.join(', ')}]`,
    });
  }

  // ② 검사 집합 == 디스크 집합
  const checkedTests = new Set(checkedFiles.filter(f => /__tests__/.test(f) && /\.test\.tsx?$/.test(f)));
  const missing = diskTests.filter(f => !checkedTests.has(f));
  if (missing.length > 0) {
    problems.push({
      kind: '무검사 테스트',
      detail: `${missing.length}개가 타입 검사 밖이다 (include가 좁혀졌거나 exclude가 붙었다):\n    ` +
        missing.slice(0, 8).map(f => f.replace(`${ROOT}/`, '')).join('\n    ') +
        (missing.length > 8 ? `\n    … 외 ${missing.length - 8}개` : ''),
    });
  }

  // ③ corpus 퇴화 — 양쪽이 같이 0이면 ②는 통과한다
  if (diskTests.length < FLOOR_TEST_FILES) {
    problems.push({
      kind: 'corpus 퇴화',
      detail: `디스크의 테스트 파일이 ${diskTests.length}개다(바닥 ${FLOOR_TEST_FILES}). 집합 동등성만으로는 "둘 다 0"을 못 막는다`,
    });
  }

  // ④ app은 node 전역을 얻으면 안 된다 — 이 분리의 존재 이유다
  const appTypes = typesOf(appConfig);
  if (appTypes.includes('node')) {
    problems.push({
      kind: 'app에 node 타입',
      detail: `tsconfig.app.json의 types에 "node"가 있다. 앱 소스는 브라우저에서 돈다 — ` +
        `process.env를 쓰고도 tsc가 통과하게 된다. 테스트에 node가 필요하면 tsconfig.test.json에 넣을 것. 현재: [${appTypes.join(', ')}]`,
    });
  }

  return problems;
}

// ── 자기검사 — 합성 입력으로 감사기 자체가 살아 있는지 본다 ──────────────────
// 실데이터가 늘 건강하면 audit의 분기를 지워도 초록이다(#437). 각 분기를 직접 태운다.
function selfCheck(): number {
  const ROOT_OK = { references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.test.json' }] };
  const APP_OK = { compilerOptions: { types: ['vite/client'] } };
  const tests = Array.from({ length: FLOOR_TEST_FILES + 5 }, (_, i) => `/x/src/a/__tests__/t${i}.test.ts`);

  const cases: { label: string; run: () => Problem[]; want: string | null }[] = [
    { label: '정상', run: () => audit(ROOT_OK, APP_OK, tests, tests), want: null },
    { label: 'references에서 test 제거', want: 'references 누락',
      run: () => audit({ references: [{ path: './tsconfig.app.json' }] }, APP_OK, tests, tests) },
    { label: 'references 자체가 없음', want: 'references 누락',
      run: () => audit({}, APP_OK, tests, tests) },
    { label: '검사 집합이 좁아짐', want: '무검사 테스트',
      run: () => audit(ROOT_OK, APP_OK, tests, tests.slice(0, 10)) },
    { label: '검사 집합이 빔', want: '무검사 테스트',
      run: () => audit(ROOT_OK, APP_OK, tests, []) },
    { label: '양쪽 다 0 (퇴화)', want: 'corpus 퇴화',
      run: () => audit(ROOT_OK, APP_OK, [], []) },
    { label: 'app에 node 타입', want: 'app에 node 타입',
      run: () => audit(ROOT_OK, { compilerOptions: { types: ['node', 'vite/client'] } }, tests, tests) },
  ];

  let n = 0;
  for (const c of cases) {
    const got = c.run();
    const kinds = got.map(p => p.kind);
    if (c.want === null) {
      if (got.length !== 0) throw new Error(`자기검사 실패 — "${c.label}"이 문제를 냈다: ${kinds.join(', ')}`);
    } else if (!kinds.includes(c.want)) {
      throw new Error(`자기검사 실패 — "${c.label}"에서 "${c.want}"를 못 잡았다 (나온 것: ${kinds.join(', ') || '없음'})`);
    }
    n++;
  }
  return n;
}

const n = selfCheck();
console.log(`  자기검사 ${n}종 통과`);

for (const p of [ROOT_TSCONFIG, TEST_TSCONFIG, APP_TSCONFIG]) {
  if (!existsSync(p)) {
    console.log(`❌ ${p.replace(`${ROOT}/`, '')}가 없다`);
    process.exit(1);
  }
}

const diskTests = listTestFiles(SRC).map(f => resolve(f)).sort();
const checkedFiles = projectFileNames(TEST_TSCONFIG);
const problems = audit(readConfig(ROOT_TSCONFIG), readConfig(APP_TSCONFIG), diskTests, checkedFiles);

console.log(`  디스크 테스트 ${diskTests.length}개 / tsconfig.test.json 검사 대상 ${checkedFiles.length}개(src 포함)`);

if (problems.length > 0) {
  for (const p of problems) console.log(`❌ ${p.kind} — ${p.detail}`);
  process.exit(1);
}
console.log('✅ PASS — 무검사 테스트 0건');
