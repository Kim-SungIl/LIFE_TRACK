// verify-test-floor.ts — `npm test`가 **실제로 전체 스위트를 돌렸는지** 검증
//
// 왜 필요한가: 이 리포의 잠금 절반은 vitest이고, deploy.yml은 `npm test` 스텝이 있는지만 본다.
// 그런데 스텝을 그대로 둔 채 스위트를 죽이는 **한 줄 편집**이 여럿 있다(3자 검수 실측):
//   · `"test": "true"` — 1059개가 통째로 안 돈다. 모든 게이트가 rc=0
//   · `vite.config.ts`의 `include`를 한 줄 좁히기 — 93파일 1059개가 50파일 613개로 준다.
//     `verify:ci-gates`도 `ciGateWiring.test`도 전부 초록이었다
//   · `vitest run src/engine` / `--passWithNoTests` 같은 범위 축소
// 스텝의 존재도, 스크립트 본문의 문자열도 이걸 못 잡는다. **실제로 실행된 파일 목록**을 봐야 한다.
//
// 하한을 상수로 박지 않는 이유: "1000개 이상"은 59개가 조용히 사라져도 통과하고, 테스트를
// 정당하게 통폐합할 때마다 오탐이 난다. 대신 **디스크의 테스트 파일 집합 == 실행된 파일 집합**을
// 단언한다 — 하드코딩이 없고, include를 좁히면 정확히 걸리고, 파일을 지우면 양쪽이 같이 준다.
// (양쪽이 0인 퇴화만 FLOOR_TEST_FILES가 막는다.)
//
// 리포트 신선도: `npm test`가 vitest 실행 **전에** 리포트를 지운다. 그러니 파일이 존재한다는
// 것 자체가 "이번 실행이 만들었다"의 증거다. `"test": "true"`면 파일이 없어 여기서 실패한다.
//
// 이 스크립트가 도는 자리: build job의 `npm test` **직후 스텝**. verify:ci 체인에 넣으면
// 다른 러너라 리포트가 없다. 스텝이 사라지는 것은 `verify:ci-gates`가 잡는다(REQUIRED_BUILD_STEPS).
//
// 실행: cd game && npm test && npx tsx scripts/verify/verify-test-floor.ts

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, relative, join } from 'path';

const ROOT = resolve(import.meta.dirname, '../..');
const SRC = resolve(ROOT, 'src');
export const REPORT = resolve(ROOT, 'node_modules/.tmp/vitest-report.json');
/** corpus 퇴화 방지용 바닥. 1차 잠금은 집합 동등성이고 이건 "양쪽 다 0" 만 막는다. */
const FLOOR_TEST_FILES = 50;

export interface Report { numTotalTests?: number; numFailedTests?: number; testResults?: { name?: string }[] }
export interface Problem { kind: string; detail: string }

/** 디스크의 테스트 파일 — vite.config.ts의 include와 같은 모양이어야 한다. */
export function listTestFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) listTestFiles(p, out);
    else if (/__tests__/.test(p) && /\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

export function auditFloor(report: Report | null, diskFiles: readonly string[]): Problem[] {
  const problems: Problem[] = [];
  if (report === null) {
    return [{ kind: '리포트 없음', detail: `${relative(ROOT, REPORT)}가 없다 — \`npm test\`가 vitest를 실제로 돌리지 않았거나 리포터를 잃었다` }];
  }
  const ran = (report.testResults ?? []).map(r => relative(ROOT, r.name ?? '')).sort();
  const disk = diskFiles.map(f => relative(ROOT, f)).sort();

  if (disk.length < FLOOR_TEST_FILES) {
    problems.push({ kind: '커버리지 하한 미달', detail: `디스크의 테스트 파일이 ${disk.length}/${FLOOR_TEST_FILES}개 — corpus가 비면 집합 동등성이 공허하게 참이 된다` });
  }
  for (const f of disk) {
    if (!ran.includes(f)) problems.push({ kind: '미실행 테스트', detail: `${f}가 디스크에 있는데 이번 실행에 없다 — vite.config의 include가 좁아졌거나 범위가 잘렸다` });
  }
  for (const f of ran) {
    if (!disk.includes(f)) problems.push({ kind: '유령 실행', detail: `리포트에 ${f}가 있는데 디스크에 없다 — 리포트가 이번 실행의 것이 아니다` });
  }
  if ((report.numTotalTests ?? 0) <= 0) {
    problems.push({ kind: '테스트 0건', detail: `실행된 테스트가 0건이다 — 파일은 잡혔는데 안이 비었다` });
  }
  if ((report.numFailedTests ?? 0) > 0) {
    problems.push({ kind: '실패 잔존', detail: `실패 ${report.numFailedTests}건인데 npm test가 통과로 넘어왔다` });
  }
  return problems;
}

export function exitCodeFor(problems: readonly Problem[]): 0 | 1 {
  return problems.length === 0 ? 0 : 1;
}

// ── 자기검사 ──────────────────────────────────────────────────────────────────
// 실행이 상시 정합이라, 이게 없으면 판정부를 통째로 지운 채 초록이 된다(#437 계열).
export const SELF_CHECK_COUNT: number = (() => {
  let ran = 0;
  const check = (label: string, got: readonly string[], want: readonly string[]) => {
    ran++;
    if (got.length !== want.length || got.some((k, i) => k !== want[i])) {
      throw new Error(`테스트 하한 자기검사 실패 — "${label}"이 ${JSON.stringify(want)}를 기대했으나 ${JSON.stringify(got)}였다.`);
    }
  };
  const files = Array.from({ length: 60 }, (_, i) => resolve(ROOT, `src/x/__tests__/f${i}.test.ts`));
  const ok: Report = { numTotalTests: 600, numFailedTests: 0, testResults: files.map(name => ({ name })) };
  const kinds = (r: Report | null, disk: readonly string[] = files) => auditFloor(r, disk).map(p => p.kind);

  check('정합', kinds(ok), []);
  check('리포트 없음(test가 vitest를 안 돌렸다)', kinds(null), ['리포트 없음']);
  check('include 좁힘 — 실행 파일이 준다', kinds({ ...ok, testResults: files.slice(0, 40).map(name => ({ name })) }), Array(20).fill('미실행 테스트'));
  check('리포트가 stale — 디스크에 없는 파일', kinds({ ...ok, testResults: [...files.map(name => ({ name })), { name: resolve(ROOT, 'src/x/__tests__/gone.test.ts') }] }), ['유령 실행']);
  check('파일은 다 잡혔는데 테스트 0건', kinds({ ...ok, numTotalTests: 0 }), ['테스트 0건']);
  check('실패가 남았는데 통과로 넘어옴', kinds({ ...ok, numFailedTests: 3 }), ['실패 잔존']);
  check('corpus 퇴화(양쪽 0)', kinds({ numTotalTests: 0, numFailedTests: 0, testResults: [] }, []), ['커버리지 하한 미달', '테스트 0건']);
  return ran;
})();

// ── 실행 ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === (await import('url')).pathToFileURL(process.argv[1]).href) {
  let report: Report | null = null;
  if (existsSync(REPORT)) {
    try { report = JSON.parse(readFileSync(REPORT, 'utf8')) as Report; }
    catch (e) { console.log(`리포트를 읽을 수 없다: ${String(e)}`); }
  }
  const disk = listTestFiles(SRC);
  const problems = auditFloor(report, disk);
  console.log('테스트 실행 범위 검증 — npm test가 전체 스위트를 돌렸는가');
  console.log(`  디스크 테스트 파일 ${disk.length}개 / 실행 ${report?.testResults?.length ?? 0}개 / 테스트 ${report?.numTotalTests ?? 0}건`);
  console.log(`  자기검사 ${SELF_CHECK_COUNT}종 통과`);
  if (problems.length === 0) {
    console.log(`\n✅ PASS — 미실행 0건`);
  } else {
    console.log(`\n❌ FAIL — ${problems.length}건`);
    for (const p of problems.slice(0, 15)) console.log(`  [${p.kind}] ${p.detail}`);
    if (problems.length > 15) console.log(`  … 외 ${problems.length - 15}건`);
  }
  process.exit(exitCodeFor(problems));
}
