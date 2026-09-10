// verify-ci-gates.ts — CI 워크플로가 게이트를 실제로 부르는지 검증
//
// 왜 필요한가: 이 리포의 잠금은 전부 `package.json` 스크립트인데, **그 스크립트를 부르는 것은
// `.github/workflows/deploy.yml` 한 파일**이고 리포 어디에서도 그 파일을 읽지 않았다.
// 즉 dist 게이트 5종이든 `verify:ci` 체인 34종이든 **YAML에서 7줄을 지우면 아무도 모른다.**
// (반대로 package.json의 스크립트를 지우면 CI가 "missing script"로 죽어서 잡힌다.)
// 게이트를 아무리 촘촘히 만들어도 호출부가 안 잠기면 의미가 없다 — #397·#431과 같은 계열이다.
//
// **"스텝이 있는가"만 보면 부족하다** (3자 검수 실측, 거짓통과 8종):
//   · 스텝에 `continue-on-error: true` — 붉어도 job이 성공한다
//   · 스텝에 `if: <조건>` — 조건이 거짓이면 스킵인데 job은 성공이다
//   · **job 레벨** `if`/`continue-on-error` — 한 줄로 게이트 9개가 동시에 죽는다
//   · 게이트를 deploy가 안 기다리는 다른 job으로 이동
//   · `npm test`가 vitest를 안 부르거나(`"true"`), vite.config의 `include`가 좁아져 대부분이 안 돌기
// 그래서 배선뿐 아니라 **무력화 수단**과 **스크립트 본문**과 **실행된 테스트 파일 수**까지 본다.
//
// 요구 목록을 하드코딩하지 않는 이유: 목록을 박아두면 "새 게이트를 만들고 CI에 안 붙이는"
// **반대 방향**을 못 잡는다. `verify:dist-*` 스크립트 집합과 디스크의 `verify-*.ts` 파일 집합을
// 파생시켜, 스크립트가 늘면 요구도 저절로 늘게 한다.
//
// 실행: cd game && npx tsx scripts/verify/verify-ci-gates.ts

import { readFileSync, readdirSync } from 'fs';
import { resolve, basename } from 'path';
import { pathToFileURL } from 'url';
import { load as loadYaml } from 'js-yaml';

const ROOT = resolve(import.meta.dirname, '../..');
const WORKFLOW = resolve(ROOT, '../.github/workflows/deploy.yml');
const PKG = resolve(ROOT, 'package.json');
const VERIFY_DIR = resolve(ROOT, 'scripts/verify');
const TEST_FILE = resolve(ROOT, 'src/engine/__tests__/ciGateWiring.test.ts');

/** dist를 만드는 스텝. dist 게이트는 전부 이것보다 **뒤**에 와야 한다(앞이면 볼 dist가 없다). */
const BUILD_STEP = 'npm run build:release';
/** package.json에서 파생할 수 없는 필수 스텝 — 스크립트 이름만으로는 "CI가 불러야 한다"를 알 수 없다. */
const REQUIRED_BUILD_STEPS = ['npm run lint', 'npm test', 'npm run verify:test-floor', BUILD_STEP] as const;
const CONTENT_STEP = 'npm run verify:ci';
const BUILD_JOB = 'build';
const CONTENT_JOB = 'content-verify';
const DEPLOY_JOB = 'deploy';
/** `if`/`continue-on-error`를 금지할 job. deploy는 제외 — `if: push`가 정당하게 쓰이고 있고,
 *  배포가 안 도는 것은 게이트 우회가 아니다. */
const GATE_JOBS = [BUILD_JOB, CONTENT_JOB] as const;

/** 커버리지 하한. 파서가 조용히 0건을 내면 "요구가 없으니 전부 충족"으로 통과해 버린다(#437 계열).
 *  1차 잠금은 아래의 **집합 동등성**이고, 이 상수들은 corpus가 통째로 비는 퇴화만 막는다. */
const FLOOR_DIST_GATES = 5;
const FLOOR_JOBS = 3;
const FLOOR_VERIFY_FILES = 20;

/** 전개된 스크립트 본문에 반드시 남아 있어야 하는 토큰.
 *  "스텝이 있다"와 "그 스텝이 실제로 그 일을 한다"는 다르다 — `"lint": "eslint ."`는 스텝이
 *  멀쩡히 있는데도 `--max-warnings 0`이 사라져 warning 전체가 무시된다(deploy.yml이 그게
 *  게이트의 핵심이라고 명시하고 있다). `build:release`에서 `tsc`가 빠지면 타입체크가 통째로 없다. */
const SCRIPT_TOKENS: Record<string, readonly string[]> = {
  lint: ['eslint', '--max-warnings 0'],
  test: ['vitest', '--reporter=json'],
  'build:release': ['GEN_WEBP=1', 'tsc', 'vite build'],
};

export interface Step { name?: string; run?: string; uses?: string; if?: string; continueOnError: boolean }
export interface Job { name: string; steps: Step[]; runs: string[]; needs: string[]; if?: string; continueOnError: boolean }
export interface Problem { kind: string; detail: string }

// ── 파싱 ──────────────────────────────────────────────────────────────────────

function asStringOrUndefined(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  return typeof v === 'string' ? v : String(v);
}

/**
 * deploy.yml을 job → steps[]로 정규화한다.
 * **정규식 대신 js-yaml을 쓴다**: 직접 짠 라인 파서는 블록 스칼라·폴디드·따옴표·주석·들여쓰기
 * 변형에서 오탐 6종을 냈고, `matrix.include`의 `run:`을 진짜 스텝으로 세거나 점이 들어간 job
 * 이름 아래 스텝을 **직전 job에 오귀속**시켜 거짓통과 2종을 냈다(3자 검수 실측).
 * js-yaml은 이제 직접 devDependency다 — 전이 의존(eslint→eslintrc)에 얹혀 있으면
 * eslint가 그걸 떼는 날 이 게이트가 같이 죽는다.
 */
export function parseWorkflow(src: string): Job[] {
  const doc = loadYaml(src) as { jobs?: Record<string, unknown> } | null;
  const rawJobs = doc && typeof doc === 'object' ? doc.jobs : undefined;
  if (!rawJobs || typeof rawJobs !== 'object') return [];
  const jobs: Job[] = [];
  for (const [name, rawJob] of Object.entries(rawJobs)) {
    const j = (rawJob ?? {}) as Record<string, unknown>;
    const rawSteps = Array.isArray(j.steps) ? j.steps : [];
    const steps: Step[] = rawSteps.map(s => {
      const st = (s ?? {}) as Record<string, unknown>;
      return {
        name: asStringOrUndefined(st.name),
        run: asStringOrUndefined(st.run),
        uses: asStringOrUndefined(st.uses),
        if: asStringOrUndefined(st.if),
        continueOnError: st['continue-on-error'] === true || st['continue-on-error'] === 'true',
      };
    });
    const needsRaw = j.needs;
    const needs = Array.isArray(needsRaw)
      ? needsRaw.map(n => String(n))
      : typeof needsRaw === 'string' ? [needsRaw] : [];
    jobs.push({
      name,
      steps,
      runs: steps.map(s => s.run).filter((r): r is string => r !== undefined).map(norm),
      needs,
      if: asStringOrUndefined(j.if),
      continueOnError: j['continue-on-error'] === true || j['continue-on-error'] === 'true',
    });
  }
  return jobs;
}

/** 공백·줄바꿈·줄이어쓰기를 접는다. 블록 스칼라(`run: |`)는 값에 `\n`이 남고,
 *  줄 이어쓰기는 `\` + 개행이 남는다 — 완전일치 매처는 그걸 전부 불일치로 읽었다. */
function norm(s: string): string {
  return s.replace(/\\\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
}

/** `npm test`와 `npm run test`를 같은 것으로 본다. */
function canon(s: string): string {
  return norm(s).replace(/^npm run /, 'npm ');
}

/** 한 스텝이 그 명령을 부르는가. `npm ci && npm run lint`처럼 이어 붙인 스텝도 인정한다. */
function runsCommand(run: string, cmd: string): boolean {
  return norm(run).split(/\s*(?:&&|\|\||;)\s*/).some(seg => canon(seg) === canon(cmd));
}

// ── 배선 판정 ─────────────────────────────────────────────────────────────────

export function auditGates(jobs: readonly Job[], distGates: readonly string[]): Problem[] {
  const problems: Problem[] = [];
  const find = (n: string) => jobs.find(j => j.name === n);
  const build = find(BUILD_JOB);
  const content = find(CONTENT_JOB);
  const deploy = find(DEPLOY_JOB);

  if (!build) problems.push({ kind: 'job 소실', detail: `${BUILD_JOB} job이 없다` });
  if (!content) problems.push({ kind: 'job 소실', detail: `${CONTENT_JOB} job이 없다` });
  if (!deploy) problems.push({ kind: 'job 소실', detail: `${DEPLOY_JOB} job이 없다` });

  /** 무력화 수단이 붙으면 안 되는 명령. 여기 없는 스텝(아티팩트 업로드 등)의 `if`는 정당하다. */
  const guarded = [...REQUIRED_BUILD_STEPS, ...distGates.map(g => `npm run ${g}`), CONTENT_STEP];

  if (build) {
    for (const step of REQUIRED_BUILD_STEPS) {
      if (!build.runs.some(r => runsCommand(r, step))) {
        problems.push({ kind: '필수 스텝 누락', detail: `${BUILD_JOB} job이 \`${step}\`을 부르지 않는다` });
      }
    }
    const buildAt = build.runs.findIndex(r => runsCommand(r, BUILD_STEP));
    for (const gate of distGates) {
      const at = build.runs.findIndex(r => runsCommand(r, `npm run ${gate}`));
      if (at < 0) {
        problems.push({ kind: '게이트 미배선', detail: `package.json에 \`${gate}\`가 있는데 ${BUILD_JOB} job이 안 부른다 — 만들고 CI에 안 붙였거나 다른 job으로 옮긴 것이다` });
      } else if (buildAt >= 0 && at < buildAt) {
        problems.push({ kind: '게이트 순서 오류', detail: `\`${gate}\`가 \`${BUILD_STEP}\`보다 먼저 온다 — 볼 dist가 없다` });
      }
    }
  }
  if (content && !content.runs.some(r => runsCommand(r, CONTENT_STEP))) {
    problems.push({ kind: '게이트 미배선', detail: `${CONTENT_JOB} job이 \`${CONTENT_STEP}\`을 부르지 않는다 — 콘텐츠 검증 전체가 죽는다` });
  }

  // 무력화 수단 — 스텝 레벨. 스텝은 남아 있는데 안 돌거나, 돌아도 실패가 무시된다.
  for (const job of jobs) {
    for (const step of job.steps) {
      if (!step.run || !guarded.some(cmd => runsCommand(step.run!, cmd))) continue;
      if (step.if !== undefined) {
        problems.push({ kind: '스텝 무력화', detail: `${job.name}/\`${norm(step.run)}\`에 \`if: ${step.if}\`가 붙었다 — 조건이 거짓이면 스킵인데 job은 성공이다` });
      }
      if (step.continueOnError) {
        problems.push({ kind: '스텝 무력화', detail: `${job.name}/\`${norm(step.run)}\`에 \`continue-on-error: true\`가 붙었다 — 붉어도 job이 성공한다` });
      }
    }
  }
  // 무력화 수단 — job 레벨. 한 줄로 그 job의 게이트가 전부 죽는다(스텝 레벨보다 큰 구멍이다).
  for (const name of GATE_JOBS) {
    const job = find(name);
    if (!job) continue;
    if (job.if !== undefined) {
      problems.push({ kind: 'job 무력화', detail: `${name} job에 \`if: ${job.if}\`가 붙었다 — 게이트 전체가 한 줄로 스킵된다` });
    }
    if (job.continueOnError) {
      problems.push({ kind: 'job 무력화', detail: `${name} job에 \`continue-on-error: true\`가 붙었다 — 게이트 전체가 붉어도 성공이다` });
    }
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

// ── 스크립트 본문 판정 ────────────────────────────────────────────────────────

/** `npm run X`를 재귀 전개한다(pre/post 훅 포함). 스텝이 부르는 이름만 보면
 *  `"build:release": "npm run build"`처럼 한 겹 줄이는 평범한 정리 편집으로 `tsc`가 사라진다. */
export function expandScript(name: string, scripts: Record<string, string>, seen: readonly string[] = []): string {
  if (seen.includes(name)) return '';
  const body = scripts[name];
  if (body === undefined) return '';
  const next = [...seen, name];
  const inner = body.replace(/\bnpm run ([A-Za-z0-9:_-]+)/g, (m, ref: string) =>
    scripts[ref] === undefined ? m : ` ( ${expandScript(ref, scripts, next)} ) `);
  return [scripts[`pre${name}`] ? expandScript(`pre${name}`, scripts, next) : '', inner,
    scripts[`post${name}`] ? expandScript(`post${name}`, scripts, next) : ''].filter(Boolean).join(' && ');
}

export function auditScripts(scripts: Record<string, string>): Problem[] {
  const problems: Problem[] = [];
  for (const [name, tokens] of Object.entries(SCRIPT_TOKENS)) {
    if (scripts[name] === undefined) {
      problems.push({ kind: '스크립트 소실', detail: `package.json에 \`${name}\` 스크립트가 없다` });
      continue;
    }
    const expanded = expandScript(name, scripts);
    for (const tok of tokens) {
      if (!expanded.includes(tok)) {
        problems.push({ kind: '스크립트 내용 결손', detail: `\`${name}\`을 전개해도 \`${tok}\`가 없다 — 스텝은 남아 있는데 하는 일이 바뀌었다` });
      }
    }
  }
  return problems;
}

// ── 체인 커버리지 판정 ────────────────────────────────────────────────────────

const VERIFY_FILE_RE = /scripts\/verify\/(verify-[A-Za-z0-9-]+)\.ts/g;

function filesReferencedBy(cmd: string): string[] {
  return [...cmd.matchAll(VERIFY_FILE_RE)].map(m => m[1]);
}

/**
 * 디스크의 `verify-*.ts`가 전부 어딘가에서 실제로 돌아야 한다 — `verify:ci` 체인이든 build job이든.
 * **하한 상수 대신 집합 동등성**을 쓴다: "체인이 30종 이상"은 34종에서 4개가 조용히 사라져도
 * 통과하고, 통폐합을 오탐한다. 양쪽을 파생시키면 정확히 맞고 스스로 유지된다.
 */
export function auditChain(scripts: Record<string, string>, diskFiles: readonly string[], buildJobRuns: readonly string[]): Problem[] {
  const problems: Problem[] = [];
  const chain = filesReferencedBy(scripts['verify:ci'] ?? '');
  const dup = chain.filter((f, i) => chain.indexOf(f) !== i);
  // build job이 직접 부르는 verify 스크립트(dist 게이트·테스트 하한)는 체인 밖이 정상이다.
  const viaBuild = buildJobRuns.flatMap(run =>
    [...norm(run).matchAll(/\bnpm run ([A-Za-z0-9:_-]+)/g)].flatMap(m => filesReferencedBy(scripts[m[1]] ?? '')));
  const wired = new Set([...chain, ...viaBuild]);

  for (const f of diskFiles) {
    if (!wired.has(f)) {
      problems.push({ kind: '검증 스크립트 미배선', detail: `scripts/verify/${f}.ts가 디스크에 있는데 verify:ci 체인에도 build job에도 없다 — 만들고 안 붙였다` });
    }
  }
  for (const f of chain) {
    if (!diskFiles.includes(f)) {
      problems.push({ kind: '체인 고아 참조', detail: `verify:ci가 scripts/verify/${f}.ts를 부르는데 파일이 없다` });
    }
  }
  for (const f of new Set(dup)) {
    problems.push({ kind: '체인 중복', detail: `verify:ci가 ${f}를 두 번 이상 부른다` });
  }
  if (diskFiles.length < FLOOR_VERIFY_FILES) {
    problems.push({ kind: '커버리지 하한 미달', detail: `디스크의 verify-*.ts가 ${diskFiles.length}/${FLOOR_VERIFY_FILES}개 — corpus가 비면 집합 동등성이 공허하게 참이 된다` });
  }
  return problems;
}

// ── 등록 잠금 ─────────────────────────────────────────────────────────────────

/** 이 게이트를 부르는 두 자리 중 **테스트 쪽 파일이 사라지는 것**은 아무도 안 봤다(참조처 실측 0곳).
 *  파일 존재와 진입점 참조를 여기서 단언하고, 반대로 이 파일의 자기검사 삭제는 그 테스트가 단언한다. */
export function auditRegistration(): Problem[] {
  const problems: Problem[] = [];
  let src = '';
  try { src = readFileSync(TEST_FILE, 'utf8'); }
  catch { return [{ kind: '등록 소실', detail: `${basename(TEST_FILE)}가 없다 — verify:ci 스텝이 지워지면 이 검사는 아무 데서도 안 돈다` }]; }
  for (const tok of ['auditRepo', 'SELF_CHECK_COUNT']) {
    if (!src.includes(tok)) {
      problems.push({ kind: '등록 결손', detail: `${basename(TEST_FILE)}가 \`${tok}\`를 더 이상 부르지 않는다` });
    }
  }
  return problems;
}

// ── 합류 ──────────────────────────────────────────────────────────────────────

export interface RepoInputs { jobs: Job[]; scripts: Record<string, string>; diskFiles: string[] }

/** 실파일에서 입력을 읽는다. 판정과 분리한 이유는 auditRepo를 합성 입력으로 자기검사하기 위해서다. */
export function readRepoInputs(): RepoInputs {
  const jobs = parseWorkflow(readFileSync(WORKFLOW, 'utf8'));
  const scripts = JSON.parse(readFileSync(PKG, 'utf8')).scripts as Record<string, string>;
  const diskFiles = readdirSync(VERIFY_DIR).filter(f => /^verify-.*\.ts$/.test(f)).map(f => f.replace(/\.ts$/, '')).sort();
  return { jobs, scripts, diskFiles };
}

export function distGatesOf(scripts: Record<string, string>): string[] {
  return Object.keys(scripts).filter(n => n.startsWith('verify:dist-')).sort();
}

/** 실파일을 읽어 판정한다. 테스트도 이 함수를 부른다 — 검사 대상이 갈리면 의미가 없다.
 *  입력을 주입할 수 있게 둔 것은 장식이 아니다: 실워크플로가 상시 정합이라 이 함수의 **반환**을
 *  통째로 비워도(`problems: []`) 스크립트와 테스트가 둘 다 초록이었다(검수 실측). 아래 자기검사가
 *  합성 입력으로 그 경로를 잠근다. */
export function auditRepo(inputs: RepoInputs = readRepoInputs()): { problems: Problem[]; jobs: Job[]; distGates: string[] } {
  const { jobs, scripts, diskFiles } = inputs;
  const distGates = distGatesOf(scripts);
  const buildRuns = jobs.find(j => j.name === BUILD_JOB)?.runs ?? [];
  const problems = [
    ...auditGates(jobs, distGates),
    ...auditScripts(scripts),
    ...auditChain(scripts, diskFiles, buildRuns),
  ];
  if (distGates.length < FLOOR_DIST_GATES) {
    problems.push({ kind: '커버리지 하한 미달', detail: `verify:dist-* 스크립트가 ${distGates.length}/${FLOOR_DIST_GATES}개 — 요구가 0이면 전부 충족으로 통과한다` });
  }
  if (jobs.length < FLOOR_JOBS) {
    problems.push({ kind: '커버리지 하한 미달', detail: `파싱된 job이 ${jobs.length}/${FLOOR_JOBS}개 — 파서가 워크플로를 못 읽고 있다` });
  }
  return { problems, jobs, distGates };
}

export function exitCodeFor(problems: readonly Problem[]): 0 | 1 {
  return problems.length === 0 ? 0 : 1;
}

// ── 자기검사 ──────────────────────────────────────────────────────────────────
// 실워크플로가 상시 정합이라, 이게 없으면 판정부도 파서도 통째로 지운 채 초록이 된다(#437 계열).
// **모듈 최상위에서 돈다** — 테스트가 이 모듈을 import 하기만 해도 같이 검증된다.
// 케이스를 표 하나로 묶은 이유: `replace` 체인을 늘어놓으면 6번째부터 읽을 수 없고,
// 실파일 구조가 바뀌었을 때 합성 픽스처가 실파일을 안 닮게 된 것을 아무도 눈치채지 못한다.
// 그래서 아래에서 **실파일과 합성 픽스처의 job 이름 집합이 같은지**도 함께 단언한다.

const SELF_OK = `
name: x
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Lint
        run: npm run lint
      - name: Test
        run: npm test
      - name: Floor
        run: npm run verify:test-floor
      - name: Build
        run: npm run build:release
      - name: G
        run: npm run verify:dist-alpha
      - uses: actions/upload-pages-artifact@v3
        if: github.event_name == 'push'
  content-verify:
    runs-on: ubuntu-latest
    steps:
      - run: npm run verify:ci
  deploy:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    needs: [build, content-verify]
    steps:
      - uses: actions/deploy-pages@v4
`;
const SELF_GATES = ['verify:dist-alpha'];
const SELF_SCRIPTS: Record<string, string> = {
  lint: 'eslint . --max-warnings 0',
  test: 'rm -f r.json && vitest run --reporter=default --reporter=json --outputFile.json=r.json',
  build: 'tsc -b && vite build',
  'build:release': 'GEN_WEBP=1 npm run build',
  'verify:ci': 'tsx scripts/verify/verify-a.ts && tsx scripts/verify/verify-b.ts',
  'verify:dist-alpha': 'tsx scripts/verify/verify-dist-alpha.ts',
  'verify:test-floor': 'tsx scripts/verify/verify-test-floor.ts',
};
const SELF_DISK = ['verify-a', 'verify-b', 'verify-dist-alpha', 'verify-test-floor'];
const SELF_BUILD_RUNS = ['npm run build:release', 'npm run verify:dist-alpha', 'npm run verify:test-floor'];

/** 자기검사가 실제로 돈 케이스 수. 테스트가 이 값을 단언한다 — 이 블록을 통째로 지우면
 *  게이트는 여전히 초록이지만(실파일이 정합이라) `npm test`가 붉어진다. 두 자리가 서로를 잠근다. */
export const SELF_CHECK_COUNT: number = (() => {
  let ran = 0;
  const check = (label: string, got: readonly string[], want: readonly string[]) => {
    ran++;
    if (got.length !== want.length || got.some((k, i) => k !== want[i])) {
      throw new Error(`CI 게이트 자기검사 실패 — "${label}"이 ${JSON.stringify(want)}를 기대했으나 ${JSON.stringify(got)}였다. 파서나 판정부가 깨졌다.`);
    }
  };
  const wf = (yaml: string, gates: readonly string[] = SELF_GATES) => auditGates(parseWorkflow(yaml), gates).map(p => p.kind);
  const sub = (a: string, b: string) => {
    if (!SELF_OK.includes(a)) throw new Error(`CI 게이트 자기검사 실패 — 합성 픽스처에 "${a}"가 없다(픽스처가 판정부와 어긋났다)`);
    return SELF_OK.replace(a, b);
  };

  // ── 배선·순서·의존 ──
  check('정합', wf(SELF_OK), []);
  check('dist 게이트 스텝 삭제', wf(sub('      - name: G\n        run: npm run verify:dist-alpha\n', '')), ['게이트 미배선']);
  check('게이트를 build 앞으로', wf(sub('        run: npm run build:release\n      - name: G\n        run: npm run verify:dist-alpha\n', '        run: npm run verify:dist-alpha\n      - name: G\n        run: npm run build:release\n')), ['게이트 순서 오류']);
  check('verify:ci 스텝 삭제', wf(sub('      - run: npm run verify:ci\n', '')), ['게이트 미배선']);
  check('npm test 스텝 삭제', wf(sub('      - name: Test\n        run: npm test\n', '')), ['필수 스텝 누락']);
  check('테스트 하한 스텝 삭제', wf(sub('      - name: Floor\n        run: npm run verify:test-floor\n', '')), ['필수 스텝 누락']);
  check('deploy.needs에서 content-verify 제거', wf(sub('needs: [build, content-verify]', 'needs: [build]')), ['배포 의존 누락']);
  check('새 게이트를 CI에 안 붙임', wf(SELF_OK, [...SELF_GATES, 'verify:dist-beta']), ['게이트 미배선']);
  check('게이트를 다른 job으로 이동(점 있는 이름)', wf(sub('      - name: G\n        run: npm run verify:dist-alpha\n', '').replace('  content-verify:', '  extra.checks:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm run verify:dist-alpha\n\n  content-verify:')), ['게이트 미배선']);

  // ── 무력화 수단 (스텝) ──
  check('게이트 스텝에 continue-on-error', wf(sub('      - name: G\n        run: npm run verify:dist-alpha\n', '      - name: G\n        run: npm run verify:dist-alpha\n        continue-on-error: true\n')), ['스텝 무력화']);
  check('게이트 스텝에 if', wf(sub('      - name: G\n        run: npm run verify:dist-alpha\n', '      - name: G\n        if: false\n        run: npm run verify:dist-alpha\n')), ['스텝 무력화']);
  check('npm test 스텝에 if', wf(sub('      - name: Test\n        run: npm test\n', "      - name: Test\n        if: github.event_name == 'push'\n        run: npm test\n")), ['스텝 무력화']);
  check('verify:ci 스텝에 continue-on-error', wf(sub('      - run: npm run verify:ci\n', '      - run: npm run verify:ci\n        continue-on-error: true\n')), ['스텝 무력화']);
  check('continue-on-error: false는 정당', wf(sub('      - name: G\n        run: npm run verify:dist-alpha\n', '      - name: G\n        run: npm run verify:dist-alpha\n        continue-on-error: false\n')), []);

  // ── 무력화 수단 (job) ──
  check('build job-level if', wf(sub('  build:\n    runs-on: ubuntu-latest\n', '  build:\n    if: false\n    runs-on: ubuntu-latest\n')), ['job 무력화']);
  check('build job-level continue-on-error', wf(sub('  build:\n    runs-on: ubuntu-latest\n', '  build:\n    continue-on-error: true\n    runs-on: ubuntu-latest\n')), ['job 무력화']);
  check('content-verify job-level if', wf(sub('  content-verify:\n    runs-on: ubuntu-latest\n', '  content-verify:\n    if: false\n    runs-on: ubuntu-latest\n')), ['job 무력화']);
  check('deploy job의 if는 정당(실파일이 쓴다)', wf(SELF_OK), []);

  // ── 정당한 표기 변형 (오탐 금지) — 라인 파서가 전부 오탐하던 것들이다 ──
  check('블록 스칼라 run: |', wf(sub('      - name: Test\n        run: npm test\n', '      - name: Test\n        run: |\n          npm test\n')), []);
  check('폴디드 run: >', wf(sub('      - name: Test\n        run: npm test\n', '      - name: Test\n        run: >\n          npm test\n')), []);
  check('따옴표 값', wf(sub('        run: npm run lint\n', '        run: "npm run lint"\n')), []);
  check('줄 이어쓰기', wf(sub('        run: npm run lint\n', '        run: npm run lint \\\n          --silent\n')), ['필수 스텝 누락']);
  check('앞에 명령을 이어 붙인 스텝', wf(sub('        run: npm run lint\n', '        run: npm ci && npm run lint\n')), []);
  check('needs 블록 리스트', wf(sub('    needs: [build, content-verify]\n', '    needs:\n      - build\n      - content-verify\n')), []);

  // ── 스크립트 본문 ──
  const sc = (over: Record<string, string | undefined>) => {
    const s = { ...SELF_SCRIPTS };
    for (const [k, v] of Object.entries(over)) { if (v === undefined) delete s[k]; else s[k] = v; }
    return auditScripts(s).map(p => p.kind);
  };
  check('스크립트 정합', sc({}), []);
  check('lint에서 --max-warnings 0 제거', sc({ lint: 'eslint .' }), ['스크립트 내용 결손']);
  check('build:release에서 tsc 유실(한 겹 줄이기)', sc({ 'build:release': 'GEN_WEBP=1 vite build' }), ['스크립트 내용 결손']);
  check('build:release에서 GEN_WEBP 유실', sc({ 'build:release': 'npm run build' }), ['스크립트 내용 결손']);
  check('test가 리포트를 안 낸다', sc({ test: 'vitest run' }), ['스크립트 내용 결손']);
  check('test 스크립트 소실', sc({ test: undefined }), ['스크립트 소실']);

  // ── 체인 커버리지 ──
  const ch = (scripts: Record<string, string>, disk: readonly string[] = SELF_DISK, runs: readonly string[] = SELF_BUILD_RUNS) =>
    auditChain(scripts, disk, runs).map(p => p.kind);
  check('체인 정합', ch(SELF_SCRIPTS, SELF_DISK, SELF_BUILD_RUNS).filter(k => k !== '커버리지 하한 미달'), []);
  check('새 verify 스크립트를 안 붙임', ch(SELF_SCRIPTS, [...SELF_DISK, 'verify-c']).filter(k => k !== '커버리지 하한 미달'), ['검증 스크립트 미배선']);
  check('체인이 없는 파일을 부른다', ch({ ...SELF_SCRIPTS, 'verify:ci': `${SELF_SCRIPTS['verify:ci']} && tsx scripts/verify/verify-ghost.ts` }).filter(k => k !== '커버리지 하한 미달'), ['체인 고아 참조']);
  check('체인 중복', ch({ ...SELF_SCRIPTS, 'verify:ci': `${SELF_SCRIPTS['verify:ci']} && tsx scripts/verify/verify-a.ts` }).filter(k => k !== '커버리지 하한 미달'), ['체인 중복']);
  check('dist 게이트를 build에서 떼면 미배선으로 보인다', ch(SELF_SCRIPTS, SELF_DISK, ['npm run build:release']).filter(k => k !== '커버리지 하한 미달'), ['검증 스크립트 미배선', '검증 스크립트 미배선']);
  check('corpus 0이면 하한이 걸린다', ch(SELF_SCRIPTS, []), ['체인 고아 참조', '체인 고아 참조', '커버리지 하한 미달']);

  // ── 합류·하한 (auditRepo의 반환을 비우면 전부 초록이 된다) ──
  const repoKinds = (over: Partial<RepoInputs>) =>
    auditRepo({ jobs: parseWorkflow(SELF_OK), scripts: SELF_SCRIPTS, diskFiles: SELF_DISK, ...over }).problems.map(p => p.kind);
  check('합류: 정합 입력이어도 합성 게이트는 2종뿐이라 하한이 걸린다', repoKinds({}), ['커버리지 하한 미달', '커버리지 하한 미달']);
  check('합류: 배선 결손이 흘러나온다', repoKinds({ jobs: parseWorkflow(SELF_OK.replace('      - run: npm run verify:ci\n', '')) }).slice(0, 1), ['게이트 미배선']);
  check('합류: 스크립트 결손이 흘러나온다', repoKinds({ scripts: { ...SELF_SCRIPTS, lint: 'eslint .' } }).slice(0, 1), ['스크립트 내용 결손']);
  check('합류: job 0개면 하한이 걸린다', repoKinds({ jobs: [] }).filter(k => k === '커버리지 하한 미달').length >= 2 ? ['커버리지 하한 미달'] : [], ['커버리지 하한 미달']);

  // ── 파서 ──
  const parsed = parseWorkflow(SELF_OK);
  check('파서: job 이름·스텝 수·needs', [parsed.map(j => j.name).join(','), String(parsed[0].runs.length), String(parsed[2].needs.length)], ['build,content-verify,deploy', '5', '2']);

  // 합성 픽스처가 실파일을 안 닮게 되면 위 케이스가 전부 무의미해진다(#437: corpus 0이면 초록).
  // **부분집합**으로 본다 — 픽스처가 모델링한 job이 실파일에 남아 있기만 하면 된다.
  // 완전일치로 두면 새 job을 하나 추가하는 정당한 편집이 자기검사를 터뜨린다(실측 오탐).
  let realNames: string[];
  try { realNames = parseWorkflow(readFileSync(WORKFLOW, 'utf8')).map(j => j.name); }
  catch (e) { throw new Error(`CI 게이트 자기검사 실패 — 실워크플로를 읽을 수 없다: ${String(e)}`); }
  check('합성 픽스처의 job이 실파일에 전부 있다', parsed.map(j => j.name).filter(n => !realNames.includes(n)), []);
  return ran;
})();

// ── 실행 ──────────────────────────────────────────────────────────────────────
// 테스트가 import 할 때는 아래를 돌리지 않는다(위 자기검사는 import 시에도 돈다).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { problems: wiring, jobs, distGates } = auditRepo();
  const problems = [...wiring, ...auditRegistration()];
  console.log('CI 게이트 배선 검증 — .github/workflows/deploy.yml');
  console.log(`  job ${jobs.length}개 {${jobs.map(j => `${j.name}:${j.runs.length}스텝`).join(', ')}}`);
  console.log(`  dist 게이트 ${distGates.length}종 (package.json에서 파생) — ${distGates.join(', ')}`);
  console.log(`  자기검사 ${SELF_CHECK_COUNT}종 통과 (배선·무력화·표기변형·스크립트본문·체인·합류·파서)`);
  if (problems.length === 0) {
    console.log(`\n✅ PASS — 배선 결손 0건`);
  } else {
    console.log(`\n❌ FAIL — ${problems.length}건`);
    for (const p of problems) console.log(`  [${p.kind}] ${p.detail}`);
  }
  process.exit(exitCodeFor(problems));
}
