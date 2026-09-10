// verify-ci-gates.ts — CI 워크플로가 게이트를 실제로 부르는지 검증
//
// 왜 필요한가: 이 리포의 잠금은 전부 `package.json` 스크립트인데, **그 스크립트를 부르는 것은
// `.github/workflows/deploy.yml` 한 파일**이고 리포 어디에서도 그 파일을 읽지 않는다.
// 즉 dist 게이트 5종이든 `verify:ci` 체인 33종이든 **YAML에서 7줄을 지우면 아무도 모른다.**
// (반대로 package.json의 스크립트를 지우면 CI가 "missing script"로 죽어서 잡힌다.)
// 게이트를 아무리 촘촘히 만들어도 호출부가 안 잠기면 의미가 없다 — #397·#431과 같은 계열이다.
//
// 요구 목록을 하드코딩하지 않는 이유: 목록을 박아두면 "새 dist 게이트를 만들고 CI에 안 붙이는"
// **반대 방향**을 못 잡는다. `verify:dist-*` 스크립트 집합을 package.json에서 파생시켜,
// 스크립트가 늘면 요구도 저절로 늘게 한다.
//
// 이 검사가 도는 자리는 **두 곳**이고, 서로를 덮는다:
//   · `verify:ci` (content-verify job) — build job의 스텝이 사라지면 여기서 잡는다
//   · `src/engine/__tests__/ciGateWiring.test.ts` (build job의 `npm test`) — content-verify의
//     `verify:ci` 스텝이 사라져도 여기서 잡는다. 한쪽만 두면 그쪽 스텝을 지우는 편집이 통과한다.
// 남는 사각은 "두 스텝을 동시에 지우는" 편집뿐이고, 그건 단일 편집이 아니다.
//
// 실행: cd game && npx tsx scripts/verify/verify-ci-gates.ts

import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '../..');
const WORKFLOW = resolve(ROOT, '../.github/workflows/deploy.yml');
const PKG = resolve(ROOT, 'package.json');

/** dist를 만드는 스텝. dist 게이트는 전부 이것보다 **뒤**에 와야 한다(앞이면 볼 dist가 없다). */
const BUILD_STEP = 'npm run build:release';
/** package.json에서 파생할 수 없는 필수 스텝 — 스크립트 이름만으로는 "CI가 불러야 한다"를 알 수 없다. */
const REQUIRED_BUILD_STEPS = ['npm run lint', 'npm test', BUILD_STEP] as const;
const CONTENT_STEP = 'npm run verify:ci';
const BUILD_JOB = 'build';
const CONTENT_JOB = 'content-verify';
const DEPLOY_JOB = 'deploy';
/** 커버리지 하한. 파서가 조용히 0건을 내면 "요구가 없으니 전부 충족"으로 통과해 버린다(#437 계열). */
const FLOOR_DIST_GATES = 5;
const FLOOR_JOBS = 3;

export interface Job { name: string; runs: string[]; needs: string[] }
export interface Problem { kind: string; detail: string }

/**
 * deploy.yml에서 job별 `run:` 목록과 `needs:`를 **순서대로** 뽑는다.
 * 전용 YAML 파서를 안 쓰는 이유: js-yaml이 eslint의 전이 의존일 뿐 직접 의존이 아니라,
 * eslint가 그걸 떼는 날 이 게이트가 같이 죽는다. 필요한 표면이 좁으므로 직접 읽고,
 * **파서가 틀리면 아래 자기검사가 잡는다**(합성 워크플로 5종).
 */
export function parseWorkflow(yaml: string): Job[] {
  const jobs: Job[] = [];
  let inJobs = false;
  let cur: Job | null = null;
  for (const raw of yaml.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (line === '' || /^\s*#/.test(line)) continue;
    if (/^jobs:\s*$/.test(line)) { inJobs = true; continue; }
    if (!inJobs) continue;
    if (/^\S/.test(line)) { inJobs = false; cur = null; continue; }   // 최상위 키가 다시 나오면 jobs 끝
    const head = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (head) { cur = { name: head[1], runs: [], needs: [] }; jobs.push(cur); continue; }
    if (!cur) continue;
    // `run:`은 스텝의 첫 키일 수도 있다(`- run: npm ci`) — 하이픈을 허용하지 않으면 그 스텝을 통째로 놓친다.
    const run = line.match(/^\s+(?:- )?run:\s+(.+)$/);
    if (run) { cur.runs.push(run[1].trim()); continue; }
    const needsList = line.match(/^\s+needs:\s*\[(.*)\]\s*$/);
    if (needsList) { cur.needs = needsList[1].split(',').map(s => s.trim()).filter(Boolean); continue; }
    const needsOne = line.match(/^\s+needs:\s+([A-Za-z0-9_-]+)\s*$/);
    if (needsOne) { cur.needs = [needsOne[1]]; continue; }
  }
  return jobs;
}

/** `npm test`와 `npm run test`를 같은 것으로 본다. */
function same(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/^npm run /, 'npm ').trim();
  return norm(a) === norm(b);
}

export function auditGates(jobs: readonly Job[], distGates: readonly string[]): Problem[] {
  const problems: Problem[] = [];
  const find = (n: string) => jobs.find(j => j.name === n);
  const build = find(BUILD_JOB);
  const content = find(CONTENT_JOB);
  const deploy = find(DEPLOY_JOB);

  if (!build) problems.push({ kind: 'job 소실', detail: `${BUILD_JOB} job이 없다` });
  if (!content) problems.push({ kind: 'job 소실', detail: `${CONTENT_JOB} job이 없다` });
  if (!deploy) problems.push({ kind: 'job 소실', detail: `${DEPLOY_JOB} job이 없다` });

  if (build) {
    for (const step of REQUIRED_BUILD_STEPS) {
      if (!build.runs.some(r => same(r, step))) {
        problems.push({ kind: '필수 스텝 누락', detail: `${BUILD_JOB} job이 \`${step}\`을 부르지 않는다` });
      }
    }
    const buildAt = build.runs.findIndex(r => same(r, BUILD_STEP));
    for (const gate of distGates) {
      const at = build.runs.findIndex(r => same(r, `npm run ${gate}`));
      if (at < 0) {
        problems.push({ kind: '게이트 미배선', detail: `package.json에 \`${gate}\`가 있는데 ${BUILD_JOB} job이 안 부른다 — 만들고 CI에 안 붙인 것이다` });
      } else if (buildAt >= 0 && at < buildAt) {
        problems.push({ kind: '게이트 순서 오류', detail: `\`${gate}\`가 \`${BUILD_STEP}\`보다 먼저 온다 — 볼 dist가 없다` });
      }
    }
  }
  if (content && !content.runs.some(r => same(r, CONTENT_STEP))) {
    problems.push({ kind: '게이트 미배선', detail: `${CONTENT_JOB} job이 \`${CONTENT_STEP}\`을 부르지 않는다 — 콘텐츠 검증 전체가 죽는다` });
  }
  if (deploy) {
    for (const dep of [BUILD_JOB, CONTENT_JOB]) {
      if (!deploy.needs.includes(dep)) {
        problems.push({ kind: '배포 의존 누락', detail: `${DEPLOY_JOB}.needs에 ${dep}이 없다 — 게이트가 붉어도 배포된다` });
      }
    }
  }
  return problems;
}

export function exitCodeFor(problems: readonly Problem[]): 0 | 1 {
  return problems.length === 0 ? 0 : 1;
}

// ── 자기검사 ──────────────────────────────────────────────────────────────────
// 실워크플로가 상시 정합이라, 이게 없으면 판정부도 파서도 통째로 지운 채 초록이 된다(#437 계열).
// **모듈 최상위에서 돈다** — 테스트가 이 모듈을 import 하기만 해도 같이 검증된다.
const SELF_OK = `
name: x
jobs:
  build:
    steps:
      - name: Lint
        run: npm run lint
      - name: Test
        run: npm test
      - name: Build
        run: npm run build:release
      - name: G
        run: npm run verify:dist-alpha
  content-verify:
    steps:
      - run: npm run verify:ci
  deploy:
    needs: [build, content-verify]
    steps:
      - uses: actions/deploy-pages@v4
`;
const SELF_GATES = ['verify:dist-alpha'];
{
  const kinds = (yaml: string, gates = SELF_GATES) => auditGates(parseWorkflow(yaml), gates).map(p => p.kind);
  const cases: [string, string, string[]][] = [
    ['정합', SELF_OK, []],
    ['dist 게이트 스텝 삭제', SELF_OK.replace('      - name: G\n        run: npm run verify:dist-alpha\n', ''), ['게이트 미배선']],
    ['게이트를 build 앞으로', SELF_OK.replace('        run: npm run build:release', '        run: npm run verify:dist-alpha').replace('      - name: G\n        run: npm run verify:dist-alpha\n', '      - name: G\n        run: npm run build:release\n'), ['게이트 순서 오류']],
    ['verify:ci 스텝 삭제', SELF_OK.replace('      - run: npm run verify:ci\n', ''), ['게이트 미배선']],
    ['npm test 스텝 삭제', SELF_OK.replace('      - name: Test\n        run: npm test\n', ''), ['필수 스텝 누락']],
    ['deploy.needs에서 content-verify 제거', SELF_OK.replace('needs: [build, content-verify]', 'needs: [build]'), ['배포 의존 누락']],
    ['새 게이트를 CI에 안 붙임', SELF_OK, ['게이트 미배선']],
  ];
  for (const [label, yaml, expected] of cases) {
    const gates = label === '새 게이트를 CI에 안 붙임' ? [...SELF_GATES, 'verify:dist-beta'] : SELF_GATES;
    const got = kinds(yaml, gates);
    if (got.length !== expected.length || got.some((k, i) => k !== expected[i])) {
      throw new Error(`CI 게이트 자기검사 실패 — "${label}"이 ${JSON.stringify(expected)}를 기대했으나 ${JSON.stringify(got)}였다. 파서나 판정부가 깨졌다.`);
    }
  }
  // auditRepo의 합류·하한·반환 경로를 잠근다 — 판정부가 옳아도 반환을 비우면 전부 초록이다.
  // 합성 게이트가 2종뿐이라 하한(5)도 함께 걸린다 — 기대는 2종이다.
  const broken = auditRepo({ jobs: parseWorkflow(SELF_OK), distGates: [...SELF_GATES, 'verify:dist-ghost'] });
  if (broken.problems.map(p => p.kind).join('/') !== '게이트 미배선/커버리지 하한 미달') {
    throw new Error(`CI 게이트 자기검사 실패 — auditRepo가 판정 결과를 흘리지 않는다: ${JSON.stringify(broken.problems.map(p => p.kind))}`);
  }
  const starved = auditRepo({ jobs: parseWorkflow(SELF_OK), distGates: [] });
  if (!starved.problems.some(p => p.kind === '커버리지 하한 미달')) {
    throw new Error(`CI 게이트 자기검사 실패 — dist 게이트 0개인데 하한이 안 걸린다(요구 0 = 전부 충족으로 통과): ${JSON.stringify(starved.problems)}`);
  }
  // 파서 자체도 잠근다 — job 이름을 못 읽으면 위 케이스가 전부 'job 소실'로 뭉개져 통과처럼 보일 수 있다.
  const parsed = parseWorkflow(SELF_OK);
  if (parsed.map(j => j.name).join(',') !== 'build,content-verify,deploy' || parsed[0].runs.length !== 4 || parsed[2].needs.length !== 2) {
    throw new Error(`CI 게이트 자기검사 실패 — 파서가 합성 워크플로를 못 읽는다: ${JSON.stringify(parsed)}`);
  }
}

export interface RepoInputs { jobs: Job[]; distGates: string[] }

/** 실파일에서 입력을 읽는다. 판정과 분리한 이유는 auditRepo를 합성 입력으로 자기검사하기 위해서다. */
export function readRepoInputs(): RepoInputs {
  const jobs = parseWorkflow(readFileSync(WORKFLOW, 'utf8'));
  const scripts = JSON.parse(readFileSync(PKG, 'utf8')).scripts as Record<string, string>;
  return { jobs, distGates: Object.keys(scripts).filter(n => n.startsWith('verify:dist-')).sort() };
}

/** 실파일을 읽어 판정한다. 테스트도 이 함수를 부른다 — 검사 대상이 갈리면 의미가 없다.
 *  입력을 주입할 수 있게 둔 것은 장식이 아니다: 실워크플로가 상시 정합이라 이 함수의 **반환**을
 *  통째로 비워도(`problems: []`) 스크립트와 테스트가 둘 다 초록이었다(검수 실측). 아래 자기검사가
 *  합성 입력으로 그 경로를 잠근다. */
export function auditRepo(inputs: RepoInputs = readRepoInputs()): { problems: Problem[]; jobs: Job[]; distGates: string[] } {
  const { jobs, distGates } = inputs;
  const problems = auditGates(jobs, distGates);
  if (distGates.length < FLOOR_DIST_GATES) {
    problems.push({ kind: '커버리지 하한 미달', detail: `verify:dist-* 스크립트가 ${distGates.length}/${FLOOR_DIST_GATES}개 — 요구가 0이면 전부 충족으로 통과한다` });
  }
  if (jobs.length < FLOOR_JOBS) {
    problems.push({ kind: '커버리지 하한 미달', detail: `파싱된 job이 ${jobs.length}/${FLOOR_JOBS}개 — 파서가 워크플로를 못 읽고 있다` });
  }
  return { problems, jobs, distGates };
}

// ── 실행 ──────────────────────────────────────────────────────────────────────
// 테스트가 import 할 때는 아래를 돌리지 않는다(위 자기검사는 import 시에도 돈다).
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop() ?? '')) {
  const { problems, jobs, distGates } = auditRepo();
  console.log('CI 게이트 배선 검증 — .github/workflows/deploy.yml');
  console.log(`  job ${jobs.length}개 {${jobs.map(j => `${j.name}:${j.runs.length}스텝`).join(', ')}}`);
  console.log(`  dist 게이트 ${distGates.length}종 (package.json에서 파생) — ${distGates.join(', ')}`);
  console.log(`  자기검사 통과 — 합성 워크플로 7종(스텝 삭제·순서·의존·미배선) + 파서 1종 + auditRepo 반환·하한 2종`);
  if (problems.length === 0) {
    console.log(`\n✅ PASS — 배선 결손 0건`);
  } else {
    console.log(`\n❌ FAIL — ${problems.length}건`);
    for (const p of problems) console.log(`  [${p.kind}] ${p.detail}`);
  }
  // 자기검사가 닿지 못하는 유일한 줄 — 여기를 process.exit(0)으로 하드코딩하면 막을 방법이 없다.
  process.exit(exitCodeFor(problems));
}
