// verify-ci-gates.ts — CI 워크플로가 게이트를 실제로 부르고, 그 게이트가 무력화되지 않았는지 검증
//
// 왜 필요한가: 이 리포의 잠금은 전부 `package.json` 스크립트인데, **그 스크립트를 부르는 것은
// `.github/workflows/` 한 곳**이고 리포 어디에서도 그 파일을 읽지 않았다.
// 즉 dist 게이트 5종이든 `verify:ci` 체인 34종이든 **YAML에서 스텝을 지우면 아무도 모른다.**
// (반대로 package.json의 스크립트를 지우면 CI가 "missing script"로 죽어서 잡힌다.)
//
// **"스텝이 있는가"만 보면 부족하다.** 3자 검수(codex·cursor·sub-agent) 실측으로 확인된,
// 스텝을 그대로 둔 채 게이트를 죽이는 편집들:
//   · 스텝/job에 `continue-on-error: true` 또는 `if: <조건>` — 리터럴도 `${{ }}` 표현식도
//   · `run: npm run lint || true` — **셸 8자로 `continue-on-error`와 같은 효과**. GitHub Actions의
//     기본 셸은 `bash -e`이고, npm 스크립트는 `sh -c`(그나마 `-e`도 없다)라 `||`·`;`·`|`·`#`가 전부 샌다
//   · `deploy` job에 `if: always()` — `needs`가 붉어도 배포된다. **`if`를 전면 면제하면 생기는 구멍이다**
//   · `on:`에서 `pull_request` 제거 / `paths-ignore` 추가 — 워크플로가 아예 안 돈다
//   · 게이트 job에 `strategy.matrix` 0조합 — job이 스킵된다
//   · **게이트 없는 두 번째 워크플로 파일**로 Pages에 배포
//   · `"test": "true"` 또는 `vite.config.ts`의 `include` 좁히기 — 스위트 절반이 안 돈다(verify:test-floor 담당)
//
// 요구 목록을 하드코딩하지 않는 이유: 목록을 박아두면 "새 게이트를 만들고 CI에 안 붙이는"
// **반대 방향**을 못 잡는다. `verify:dist-*` 스크립트 집합과 디스크의 `verify-*.ts` 파일 집합을
// 파생시켜, 스크립트가 늘면 요구도 저절로 늘게 한다.
//
// 실행: cd game && npx tsx scripts/verify/verify-ci-gates.ts

import { readFileSync, readdirSync } from 'fs';
import { resolve, basename, join } from 'path';
import { pathToFileURL } from 'url';
import { load as loadYaml } from 'js-yaml';

const ROOT = resolve(import.meta.dirname, '../..');
const WORKFLOW_DIR = resolve(ROOT, '../.github/workflows');
const WORKFLOW_NAME = 'deploy.yml';
const WORKFLOW = resolve(WORKFLOW_DIR, WORKFLOW_NAME);
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
/** `if`/`continue-on-error`/`strategy`를 통째로 금지할 job. */
const GATE_JOBS = [BUILD_JOB, CONTENT_JOB] as const;
/** 워크플로가 돌아야 하는 트리거. 하나라도 빠지면 그 경로의 검증이 통째로 사라진다. */
const REQUIRED_TRIGGERS = ['push', 'pull_request'] as const;
/** Pages 배포 수단. deploy.yml 밖에서 이게 보이면 게이트를 우회하는 두 번째 배포로다. */
const PAGES_ACTIONS = ['actions/deploy-pages', 'actions/upload-pages-artifact'] as const;

/** 커버리지 하한. 파서가 조용히 0건을 내면 "요구가 없으니 전부 충족"으로 통과해 버린다(#437 계열).
 *  1차 잠금은 아래의 **집합 동등성**이고, 이 상수들은 corpus가 통째로 비는 퇴화만 막는다.
 *  (`FLOOR_JOBS`는 없다 — job이 3개 미만이면 이름으로 찾는 `job 소실`이 반드시 먼저 뜨므로
 *   단독으로 기여하는 입력이 존재하지 않는 죽은 상수였다.) */
const FLOOR_DIST_GATES = 5;
const FLOOR_VERIFY_FILES = 20;

/** 전개된 스크립트 본문에 반드시 남아 있어야 하는 토큰.
 *  "스텝이 있다"와 "그 스텝이 실제로 그 일을 한다"는 다르다 — `"lint": "eslint ."`는 스텝이
 *  멀쩡히 있는데도 `--max-warnings 0`이 사라져 warning 전체가 무시된다. */
const SCRIPT_TOKENS: Record<string, readonly string[]> = {
  lint: ['eslint', '--max-warnings 0'],
  // `rm -f`까지 요구하는 이유: verify-test-floor가 "리포트가 존재한다 = 이번 실행이 만들었다"를
  // 신선도 근거로 쓴다. 실행 전 삭제가 사라지면 그 전제가 조용히 거짓이 된다.
  test: ['vitest', '--reporter=json', 'rm -f', 'node_modules/.tmp/vitest-report.json'],
  'build:release': ['GEN_WEBP=1', 'tsc', 'vite build'],
};

/** 셸에서 종료 코드를 삼키는 표현. 게이트를 부르는 자리(YAML `run:`·npm 스크립트 본문)에 오면
 *  스텝은 멀쩡히 남은 채 실패가 무시된다 — `continue-on-error: true`와 효과가 같다. */
const RC_SWALLOW: readonly (readonly [RegExp, string])[] = [
  [/\|\|/, '`||` (앞이 실패해도 뒤로 넘어간다)'],
  [/(?:^|\s|;)set\s+\+e/, '`set +e` (실패 시 중단이 꺼진다)'],
  [/;/, '`;` (npm은 `sh -c`로 돌려서 앞 명령의 실패가 무시된다)'],
  [/(?<!\|)\|(?!\|)/, '`|` (파이프의 rc는 마지막 명령의 것이다 — pipefail 없음)'],
  [/#/, '`#` (뒤가 주석으로 죽는다)'],
] as const;

/** 실패한 `needs` 뒤에도 job을 돌리는 표현. `deploy`의 `if`를 전면 면제하면 이 한 줄로 끝난다. */
const IF_OVERRIDES_NEEDS = /\b(?:always|failure|cancelled)\s*\(/;

export interface Step { name?: string; run?: string; uses?: string; if?: string; continueOnError?: string }
export interface Job { name: string; steps: Step[]; runs: string[]; needs: string[]; if?: string; continueOnError?: string; hasStrategy: boolean }
export interface Trigger { name: string; pathFilter?: string }
export interface Problem { kind: string; detail: string }

// ── 파싱 ──────────────────────────────────────────────────────────────────────

function asStringOrUndefined(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  return typeof v === 'string' ? v : String(v);
}

/** `continue-on-error`는 **`false`가 아닌 모든 값**이 무력화다. 리터럴 `true`만 보면
 *  `continue-on-error: ${{ github.event_name == 'pull_request' }}`가 그대로 통과한다(실측). */
function continueOnErrorOf(v: unknown): string | undefined {
  if (v === undefined || v === null || v === false || v === 'false') return undefined;
  return typeof v === 'string' ? v : String(v);
}

/**
 * 워크플로를 job → steps[]로 정규화한다.
 * **정규식 대신 js-yaml을 쓴다**: 직접 짠 라인 파서는 블록 스칼라·폴디드·따옴표·주석·들여쓰기
 * 변형에서 오탐 6종을 냈고, `matrix.include`의 `run:`을 진짜 스텝으로 세거나 점이 들어간 job
 * 이름 아래 스텝을 **직전 job에 오귀속**시켜 거짓통과 2종을 냈다(3자 검수 실측).
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
        continueOnError: continueOnErrorOf(st['continue-on-error']),
      };
    });
    const needsRaw = j.needs;
    const needs = Array.isArray(needsRaw) ? needsRaw.map(n => String(n))
      : typeof needsRaw === 'string' ? [needsRaw] : [];
    jobs.push({
      name, steps, needs,
      runs: steps.map(s => s.run).filter((r): r is string => r !== undefined).map(norm),
      if: asStringOrUndefined(j.if),
      continueOnError: continueOnErrorOf(j['continue-on-error']),
      hasStrategy: j.strategy !== undefined && j.strategy !== null,
    });
  }
  return jobs;
}

/** `on:` 트리거와 경로 필터. YAML 1.1의 boolean 함정 때문에 `on`이 `true` 키로 들어올 수 있다. */
export function parseTriggers(src: string): Trigger[] {
  const doc = loadYaml(src) as Record<string, unknown> | null;
  if (!doc || typeof doc !== 'object') return [];
  const on = doc.on ?? (doc as Record<string, unknown>)['true'];
  if (typeof on === 'string') return [{ name: on }];
  if (Array.isArray(on)) return on.map(n => ({ name: String(n) }));
  if (!on || typeof on !== 'object') return [];
  return Object.entries(on as Record<string, unknown>).map(([name, cfg]) => {
    const c = (cfg ?? {}) as Record<string, unknown>;
    const filter = ['paths', 'paths-ignore'].find(k => c[k] !== undefined);
    return { name, pathFilter: filter };
  });
}

/** 공백과 줄 이어쓰기를 접되 **개행은 남긴다** — 블록 스칼라의 여러 명령은 개행이 구분자다.
 *  개행을 공백으로 접으면 `run: |` 안의 두 명령이 한 덩어리가 되어 정당한 편집을 오탐한다(실측). */
function norm(s: string): string {
  return s.replace(/\\\r?\n/g, ' ')
    .split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

function oneLine(s: string): string {
  return norm(s).replace(/\n/g, ' ; ');
}

/** `npm test`와 `npm run test`를 같은 것으로 본다. */
function canon(s: string): string {
  return s.replace(/\s+/g, ' ').trim().replace(/^npm run /, 'npm ');
}

/** 명령 구분자는 **`&&`와 개행뿐**이다. `||`·`;`를 구분자로 쓰면 `npm run lint || true`가
 *  "lint를 부른다"로 읽혀 통과한다 — 무력화 토큰이 매처를 통과시켜 주는 셈이었다(실측 거짓통과). */
function segmentsOf(run: string): string[] {
  return norm(run).split(/\s*&&\s*|\n/).map(s => s.trim()).filter(Boolean);
}

function runsCommand(run: string, cmd: string): boolean {
  return segmentsOf(run).some(seg => canon(seg) === canon(cmd));
}

/** 이 텍스트가 그 명령을 **언급**하는가. 무력화 검사용 — 세그먼트 일치가 깨진 뒤에도 잡으려면 필요하다. */
function mentions(text: string, cmd: string): boolean {
  const n = norm(text);
  return n.includes(cmd) || n.includes(canon(cmd));
}

function swallowProblems(kind: string, where: string, text: string): Problem[] {
  return RC_SWALLOW.filter(([re]) => re.test(norm(text)))
    .map(([, why]) => ({ kind, detail: `${where}에 ${why} — 스텝은 남아 있는데 실패가 무시된다` }));
}

// ── 배선·무력화 판정 ──────────────────────────────────────────────────────────

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

  // 무력화 — 스텝 레벨. 스텝은 남아 있는데 안 돌거나, 돌아도 실패가 무시된다.
  for (const job of jobs) {
    for (const step of job.steps) {
      if (!step.run || !guarded.some(cmd => mentions(step.run!, cmd))) continue;
      const where = `${job.name}/\`${oneLine(step.run)}\``;
      if (step.if !== undefined) {
        problems.push({ kind: '스텝 무력화', detail: `${where}에 \`if: ${step.if}\`가 붙었다 — 조건이 거짓이면 스킵인데 job은 성공이다` });
      }
      if (step.continueOnError !== undefined) {
        problems.push({ kind: '스텝 무력화', detail: `${where}에 \`continue-on-error: ${step.continueOnError}\`가 붙었다 — 붉어도 job이 성공한다` });
      }
      problems.push(...swallowProblems('종료 코드 무력화', where, step.run));
    }
  }
  // 무력화 — job 레벨. 한 줄로 그 job의 게이트가 전부 죽는다(스텝 레벨보다 큰 구멍이다).
  for (const name of GATE_JOBS) {
    const job = find(name);
    if (!job) continue;
    if (job.if !== undefined) {
      problems.push({ kind: 'job 무력화', detail: `${name} job에 \`if: ${job.if}\`가 붙었다 — 게이트 전체가 한 줄로 스킵된다` });
    }
    if (job.continueOnError !== undefined) {
      problems.push({ kind: 'job 무력화', detail: `${name} job에 \`continue-on-error: ${job.continueOnError}\`가 붙었다 — 게이트 전체가 붉어도 성공이다` });
    }
    if (job.hasStrategy) {
      problems.push({ kind: 'job 무력화', detail: `${name} job에 \`strategy\`가 붙었다 — 0조합이면 job이 통째로 스킵된다` });
    }
  }

  if (deploy) {
    for (const dep of [BUILD_JOB, CONTENT_JOB]) {
      if (!deploy.needs.includes(dep)) {
        problems.push({ kind: '배포 의존 누락', detail: `${DEPLOY_JOB}.needs에 ${dep}이 없다 — 게이트가 붉어도 배포된다` });
      }
    }
    // `deploy`의 `if`는 정당하다(`push`에서만 배포). 전면 면제하지 않는 이유: `if: always()`
    // 한 줄이면 needs가 붉어도 배포된다 — 예외를 두면 그 예외가 곧 구멍이다(실측 거짓통과).
    if (deploy.if !== undefined && IF_OVERRIDES_NEEDS.test(deploy.if)) {
      problems.push({ kind: '배포 의존 무효화', detail: `${DEPLOY_JOB} job의 \`if: ${deploy.if}\`가 실패한 needs를 무시한다 — needs가 있어도 배포된다` });
    }
    if (deploy.continueOnError !== undefined) {
      problems.push({ kind: '배포 의존 무효화', detail: `${DEPLOY_JOB} job에 \`continue-on-error: ${deploy.continueOnError}\`가 붙었다` });
    }
  }
  return problems;
}

/** 워크플로가 애초에 도는가. "게이트가 붉어도 배포된다"는 막았는데 "게이트가 안 돈다"는 안 봤었다. */
export function auditTriggers(triggers: readonly Trigger[]): Problem[] {
  const problems: Problem[] = [];
  for (const need of REQUIRED_TRIGGERS) {
    const t = triggers.find(x => x.name === need);
    if (!t) {
      problems.push({ kind: '트리거 소실', detail: `\`on:\`에 \`${need}\`가 없다 — 그 경로에서 게이트가 한 번도 안 돈다` });
    } else if (t.pathFilter) {
      problems.push({ kind: '트리거 무력화', detail: `\`on.${need}\`에 \`${t.pathFilter}\`가 붙었다 — 조건에 따라 워크플로가 통째로 스킵된다` });
    }
  }
  return problems;
}

/** deploy.yml 밖에서 Pages로 배포하면 위의 게이트를 전부 우회한다. */
export function auditOtherWorkflows(files: readonly { name: string; src: string }[]): Problem[] {
  return files.filter(f => f.name !== WORKFLOW_NAME)
    .flatMap(f => PAGES_ACTIONS.filter(a => f.src.includes(a))
      .map(a => ({ kind: '우회 배포 경로', detail: `${f.name}이 \`${a}\`를 쓴다 — ${WORKFLOW_NAME}의 게이트를 거치지 않고 배포된다` })));
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
  // 게이트 체인 자체가 실패를 삼키면 안 된다. npm은 `sh -c`로 돌려서 `-e`조차 없다 —
  // `&&`를 `;`로 바꾸면 앞 게이트가 rc=1로 죽어도 체인 전체가 rc=0이다(양성 대조군으로 실증).
  if (scripts['verify:ci'] !== undefined) {
    problems.push(...swallowProblems('체인 무력화', '`verify:ci` 체인', scripts['verify:ci']));
  }
  // dist 게이트는 이름만으로 요구가 파생되므로, 본문이 실제로 검증 스크립트를 부르는지 봐야 한다.
  for (const name of distGatesOf(scripts)) {
    if (!/tsx\s+scripts\/verify\/verify-[A-Za-z0-9-]+\.ts/.test(expandScript(name, scripts))) {
      problems.push({ kind: '게이트 본문 없음', detail: `\`${name}\`이 scripts/verify의 검증 스크립트를 부르지 않는다 — 이름만 dist 게이트다` });
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
  // **전개해서** 찾는다 — 정규식 1단만 보면 한 겹 감싼 스크립트를 놓쳐 auditScripts와 비대칭이 된다.
  const viaBuild = buildJobRuns.flatMap(run =>
    [...norm(run).matchAll(/\bnpm run ([A-Za-z0-9:_-]+)/g)].flatMap(m => filesReferencedBy(expandScript(m[1], scripts))));
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
 *  **파일 존재만** 본다 — 안의 토큰을 grep 해봐야 주석 한 줄로 만족되어 방어가 되지 않는다(실측). */
export function auditRegistration(exists: boolean): Problem[] {
  return exists ? [] : [{
    kind: '등록 소실',
    detail: `${basename(TEST_FILE)}가 없다 — verify:ci 스텝이 지워지면 이 검사는 아무 데서도 안 돈다`,
  }];
}

// ── 합류 ──────────────────────────────────────────────────────────────────────

export interface RepoInputs {
  jobs: Job[];
  triggers: Trigger[];
  scripts: Record<string, string>;
  diskFiles: string[];
  workflows: { name: string; src: string }[];
  testFileExists: boolean;
}

export function distGatesOf(scripts: Record<string, string>): string[] {
  const all = Object.keys(scripts).filter(n => n.startsWith('verify:dist-'));
  // 다른 dist 게이트의 **구현**으로만 불리는 것은 그 자체로 build job에 배선될 필요가 없다.
  // (`"verify:dist-fonts": "npm run verify:dist-fonts:impl"` 같은 한 겹 감싸기가 정당한 편집인데
  //  안쪽 이름이 접두사에 걸려 "새 게이트를 안 붙였다"로 오탐했다.) 참조자를 dist 게이트로 한정한 이유:
  // 아무 스크립트나 참조하면 면제되게 두면 `"zzz": "npm run verify:dist-fonts"` 한 줄로 요구가 사라진다.
  const inner = new Set(all.filter(n => all.some(other => other !== n &&
    new RegExp(`\\bnpm run ${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9:_-])`).test(scripts[other] ?? ''))));
  return all.filter(n => !inner.has(n)).sort();
}

/** 실파일에서 입력을 읽는다. 판정과 분리한 이유는 auditRepo를 합성 입력으로 자기검사하기 위해서다. */
export function readRepoInputs(): RepoInputs {
  const workflows = readdirSync(WORKFLOW_DIR).filter(f => /\.ya?ml$/.test(f))
    .map(name => ({ name, src: readFileSync(join(WORKFLOW_DIR, name), 'utf8') }));
  const main = workflows.find(w => w.name === WORKFLOW_NAME)?.src ?? '';
  let testFileExists = true;
  try { readFileSync(TEST_FILE, 'utf8'); } catch { testFileExists = false; }
  return {
    jobs: parseWorkflow(main),
    triggers: parseTriggers(main),
    scripts: JSON.parse(readFileSync(PKG, 'utf8')).scripts as Record<string, string>,
    diskFiles: readdirSync(VERIFY_DIR).filter(f => /^verify-.*\.ts$/.test(f)).map(f => f.replace(/\.ts$/, '')).sort(),
    workflows,
    testFileExists,
  };
}

/** 실파일을 읽어 판정한다. 테스트도 이 함수를 부른다 — 검사 대상이 갈리면 의미가 없다.
 *  입력을 주입할 수 있게 둔 것은 장식이 아니다: 실워크플로가 상시 정합이라 이 함수의 **반환**을
 *  통째로 비워도(`problems: []`) 스크립트와 테스트가 둘 다 초록이었다(검수 실측). */
export function auditRepo(inputs: RepoInputs = readRepoInputs()): { problems: Problem[]; jobs: Job[]; distGates: string[] } {
  const { jobs, triggers, scripts, diskFiles, workflows, testFileExists } = inputs;
  const distGates = distGatesOf(scripts);
  const buildRuns = jobs.find(j => j.name === BUILD_JOB)?.runs ?? [];
  const problems = [
    ...auditGates(jobs, distGates),
    ...auditTriggers(triggers),
    ...auditOtherWorkflows(workflows),
    ...auditScripts(scripts),
    ...auditChain(scripts, diskFiles, buildRuns),
    ...auditRegistration(testFileExists),
  ];
  if (distGates.length < FLOOR_DIST_GATES) {
    problems.push({ kind: '커버리지 하한 미달', detail: `verify:dist-* 스크립트가 ${distGates.length}/${FLOOR_DIST_GATES}개 — 요구가 0이면 전부 충족으로 통과한다` });
  }
  return { problems, jobs, distGates };
}

export function exitCodeFor(problems: readonly Problem[]): 0 | 1 {
  return problems.length === 0 ? 0 : 1;
}

// ── 자기검사 ──────────────────────────────────────────────────────────────────
// 실워크플로가 상시 정합이라, 이게 없으면 판정부도 파서도 통째로 지운 채 초록이 된다(#437 계열).
// **모듈 최상위에서 돈다** — 테스트가 이 모듈을 import 하기만 해도 같이 검증된다.
// 케이스를 표 하나로 묶은 이유: `replace` 체인을 늘어놓으면 6번째부터 읽을 수 없고, 실파일 구조가
// 바뀌었을 때 합성 픽스처가 실파일을 안 닮게 된 것을 아무도 눈치채지 못한다. 아래에서
// **합성 픽스처의 job이 실파일에 전부 있는지**도 함께 단언한다(부분집합 — 완전일치로 두면
// 새 job 하나 추가가 자기검사를 터뜨린다).
//
// **이 블록 자체는 잠기지 않는다.** 통째로 지우거나 카운터를 상수로 바꾸면 여기도 테스트도
// 초록이다(검수 실측). 판정 로직의 실질 잠금은 `ciGateWiring.test.ts`의 양성 대조군이고,
// 이 블록은 그보다 촘촘한 회귀망일 뿐이다 — 그렇게 읽어야 한다.

const SELF_OK = `
name: x
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
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
  test: 'rm -f node_modules/.tmp/vitest-report.json && vitest run --reporter=default --reporter=json --outputFile.json=node_modules/.tmp/vitest-report.json',
  build: 'tsc -b && vite build',
  'build:release': 'GEN_WEBP=1 npm run build',
  'verify:ci': 'tsx scripts/verify/verify-a.ts && tsx scripts/verify/verify-b.ts',
  'verify:dist-alpha': 'tsx scripts/verify/verify-dist-alpha.ts',
  'verify:test-floor': 'tsx scripts/verify/verify-test-floor.ts',
};
const SELF_DISK = ['verify-a', 'verify-b', 'verify-dist-alpha', 'verify-test-floor'];
const SELF_BUILD_RUNS = ['npm run build:release', 'npm run verify:dist-alpha', 'npm run verify:test-floor'];
const SELF_WORKFLOWS = [{ name: WORKFLOW_NAME, src: SELF_OK }];

const SELF_CHECK_COUNT: number = (() => {
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
  const GATE_RUN = '      - name: G\n        run: npm run verify:dist-alpha\n';
  const TEST_RUN = '      - name: Test\n        run: npm test\n';

  // ── 배선·순서·의존 ──
  check('정합', wf(SELF_OK), []);
  check('dist 게이트 스텝 삭제', wf(sub(GATE_RUN, '')), ['게이트 미배선']);
  check('게이트를 build 앞으로', wf(sub('        run: npm run build:release\n' + GATE_RUN, '        run: npm run verify:dist-alpha\n      - name: G\n        run: npm run build:release\n')), ['게이트 순서 오류']);
  check('verify:ci 스텝 삭제', wf(sub('      - run: npm run verify:ci\n', '')), ['게이트 미배선']);
  check('npm test 스텝 삭제', wf(sub(TEST_RUN, '')), ['필수 스텝 누락']);
  check('테스트 하한 스텝 삭제', wf(sub('      - name: Floor\n        run: npm run verify:test-floor\n', '')), ['필수 스텝 누락']);
  check('deploy.needs에서 content-verify 제거', wf(sub('needs: [build, content-verify]', 'needs: [build]')), ['배포 의존 누락']);
  check('새 게이트를 CI에 안 붙임', wf(SELF_OK, [...SELF_GATES, 'verify:dist-beta']), ['게이트 미배선']);
  check('게이트를 다른 job으로 이동(점 있는 이름)', wf(sub(GATE_RUN, '').replace('  content-verify:', '  extra.checks:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm run verify:dist-alpha\n\n  content-verify:')), ['게이트 미배선']);

  // ── 무력화: YAML 키 (스텝) ──
  check('게이트 스텝에 continue-on-error', wf(sub(GATE_RUN, GATE_RUN + '        continue-on-error: true\n')), ['스텝 무력화']);
  check('게이트 스텝에 continue-on-error 표현식', wf(sub(GATE_RUN, GATE_RUN + "        continue-on-error: ${{ github.event_name == 'pull_request' }}\n")), ['스텝 무력화']);
  check('게이트 스텝에 if', wf(sub(GATE_RUN, '      - name: G\n        if: false\n        run: npm run verify:dist-alpha\n')), ['스텝 무력화']);
  check('npm test 스텝에 if', wf(sub(TEST_RUN, "      - name: Test\n        if: github.event_name == 'push'\n        run: npm test\n")), ['스텝 무력화']);
  check('verify:ci 스텝에 continue-on-error', wf(sub('      - run: npm run verify:ci\n', '      - run: npm run verify:ci\n        continue-on-error: true\n')), ['스텝 무력화']);
  check('continue-on-error: false는 정당', wf(sub(GATE_RUN, GATE_RUN + '        continue-on-error: false\n')), []);

  // ── 무력화: YAML 키 (job) ──
  check('build job-level if', wf(sub('  build:\n    runs-on: ubuntu-latest\n', '  build:\n    if: false\n    runs-on: ubuntu-latest\n')), ['job 무력화']);
  check('build job-level continue-on-error 표현식', wf(sub('  build:\n    runs-on: ubuntu-latest\n', '  build:\n    continue-on-error: ${{ true }}\n    runs-on: ubuntu-latest\n')), ['job 무력화']);
  check('content-verify job-level if', wf(sub('  content-verify:\n    runs-on: ubuntu-latest\n', '  content-verify:\n    if: false\n    runs-on: ubuntu-latest\n')), ['job 무력화']);
  check('게이트 job에 strategy(0조합이면 스킵)', wf(sub('  build:\n    runs-on: ubuntu-latest\n', '  build:\n    runs-on: ubuntu-latest\n    strategy:\n      matrix:\n        node: []\n')), ['job 무력화']);
  check('deploy job의 if: push는 정당', wf(SELF_OK), []);
  check('deploy job의 if: always()는 needs를 무효화', wf(sub("  deploy:\n    if: github.event_name == 'push'\n", '  deploy:\n    if: always()\n')), ['배포 의존 무효화']);
  check('deploy job에 continue-on-error', wf(sub('  deploy:\n', '  deploy:\n    continue-on-error: true\n')), ['배포 의존 무효화']);

  // ── 무력화: 셸 (YAML 키 없이 rc를 삼킨다) ──
  check('게이트 스텝에 || true', wf(sub(GATE_RUN, '      - name: G\n        run: npm run verify:dist-alpha || true\n')), ['게이트 미배선', '종료 코드 무력화']);
  check('npm test에 || true', wf(sub(TEST_RUN, '      - name: Test\n        run: npm test || true\n')), ['필수 스텝 누락', '종료 코드 무력화']);
  check('verify:ci에 ; true', wf(sub('      - run: npm run verify:ci\n', '      - run: npm run verify:ci; true\n')), ['게이트 미배선', '종료 코드 무력화']);
  check('lint에 set +e', wf(sub('        run: npm run lint\n', '        run: set +e; npm run lint\n')), ['필수 스텝 누락', '종료 코드 무력화', '종료 코드 무력화']);
  check('npm test에 파이프', wf(sub(TEST_RUN, '      - name: Test\n        run: npm test | cat\n')), ['필수 스텝 누락', '종료 코드 무력화']);

  // ── 정당한 표기 변형 (오탐 금지) ──
  check('블록 스칼라 run: | (명령 1개)', wf(sub(TEST_RUN, '      - name: Test\n        run: |\n          npm test\n')), []);
  check('블록 스칼라 run: | (명령 여러 줄)', wf(sub('        run: npm run lint\n', '        run: |\n          echo linting\n          npm run lint\n')), []);
  check('폴디드 run: >', wf(sub(TEST_RUN, '      - name: Test\n        run: >\n          npm test\n')), []);
  check('따옴표 값', wf(sub('        run: npm run lint\n', '        run: "npm run lint"\n')), []);
  check('앞에 명령을 && 로 이어 붙인 스텝', wf(sub('        run: npm run lint\n', '        run: npm ci && npm run lint\n')), []);
  check('needs 블록 리스트', wf(sub('    needs: [build, content-verify]\n', '    needs:\n      - build\n      - content-verify\n')), []);
  check('비게이트 스텝의 if·파이프는 정당', wf(sub('      - uses: actions/upload-pages-artifact@v3\n', '      - name: Note\n        run: echo hi | cat\n      - uses: actions/upload-pages-artifact@v3\n')), []);

  // ── 트리거 ──
  const tg = (yaml: string) => auditTriggers(parseTriggers(yaml)).map(p => p.kind);
  check('트리거 정합', tg(SELF_OK), []);
  check('pull_request 제거', tg(sub('  pull_request:\n    branches: [main]\n', '')), ['트리거 소실']);
  check('push에 paths-ignore', tg(sub('  push:\n    branches: [main]\n', "  push:\n    branches: [main]\n    paths-ignore: ['**']\n")), ['트리거 무력화']);

  // ── 다른 워크플로의 우회 배포 ──
  const ow = (files: { name: string; src: string }[]) => auditOtherWorkflows(files).map(p => p.kind);
  check('워크플로가 deploy.yml 하나', ow(SELF_WORKFLOWS), []);
  check('게이트 없는 두 번째 배포 워크플로', ow([...SELF_WORKFLOWS, { name: 'zz.yml', src: 'jobs:\n  s:\n    steps:\n      - uses: actions/deploy-pages@v4\n' }]), ['우회 배포 경로']);
  check('배포와 무관한 두 번째 워크플로는 정당', ow([...SELF_WORKFLOWS, { name: 'zz.yml', src: 'jobs:\n  s:\n    steps:\n      - run: echo hi\n' }]), []);

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
  check('test가 리포트를 안 낸다', sc({ test: 'rm -f node_modules/.tmp/vitest-report.json && vitest run' }), ['스크립트 내용 결손']);
  check('test에서 rm -f만 제거(신선도 전제 붕괴)', sc({ test: 'vitest run --reporter=json --outputFile.json=node_modules/.tmp/vitest-report.json' }), ['스크립트 내용 결손']);
  check('test 스크립트 소실', sc({ test: undefined }), ['스크립트 소실']);
  check('verify:ci 체인의 && 를 ; 로', sc({ 'verify:ci': 'tsx scripts/verify/verify-a.ts ; tsx scripts/verify/verify-b.ts' }), ['체인 무력화']);
  check('verify:ci 체인 뒤를 # 로 자름', sc({ 'verify:ci': 'tsx scripts/verify/verify-a.ts # && tsx scripts/verify/verify-b.ts' }), ['체인 무력화']);
  check('이름만 dist 게이트(본문 no-op)', sc({ 'verify:dist-fake': 'echo ok' }), ['게이트 본문 없음']);
  check('dist 게이트 한 겹 감싸기는 정당(안쪽은 요구 아님)', distGatesOf({ ...SELF_SCRIPTS, 'verify:dist-alpha': 'npm run verify:dist-alpha:impl', 'verify:dist-alpha:impl': 'tsx scripts/verify/verify-dist-alpha.ts' }), ['verify:dist-alpha']);
  check('무관한 스크립트의 참조로는 면제되지 않는다', distGatesOf({ ...SELF_SCRIPTS, zzz: 'npm run verify:dist-alpha' }), ['verify:dist-alpha']);

  // ── 체인 커버리지 ──
  const ch = (scripts: Record<string, string>, disk: readonly string[] = SELF_DISK, runs: readonly string[] = SELF_BUILD_RUNS) =>
    auditChain(scripts, disk, runs).map(p => p.kind).filter(k => k !== '커버리지 하한 미달');
  check('체인 정합', ch(SELF_SCRIPTS), []);
  check('새 verify 스크립트를 안 붙임', ch(SELF_SCRIPTS, [...SELF_DISK, 'verify-c']), ['검증 스크립트 미배선']);
  check('체인이 없는 파일을 부른다', ch({ ...SELF_SCRIPTS, 'verify:ci': `${SELF_SCRIPTS['verify:ci']} && tsx scripts/verify/verify-ghost.ts` }), ['체인 고아 참조']);
  check('체인 중복', ch({ ...SELF_SCRIPTS, 'verify:ci': `${SELF_SCRIPTS['verify:ci']} && tsx scripts/verify/verify-a.ts` }), ['체인 중복']);
  check('dist 게이트를 한 겹 감싸도 배선으로 인정(비대칭 금지)', ch({ ...SELF_SCRIPTS, 'verify:dist-alpha': 'npm run verify:dist-alpha:impl', 'verify:dist-alpha:impl': 'tsx scripts/verify/verify-dist-alpha.ts' }), []);
  check('corpus 0이면 하한이 걸린다', auditChain(SELF_SCRIPTS, [], SELF_BUILD_RUNS).map(p => p.kind), ['체인 고아 참조', '체인 고아 참조', '커버리지 하한 미달']);

  // ── 등록 ──
  check('테스트 파일 존재', auditRegistration(true).map(p => p.kind), []);
  check('테스트 파일 삭제', auditRegistration(false).map(p => p.kind), ['등록 소실']);

  // ── 합류 (auditRepo의 반환을 비우면 전부 초록이 된다) ──
  const repoKinds = (over: Partial<RepoInputs>) => auditRepo({
    jobs: parseWorkflow(SELF_OK), triggers: parseTriggers(SELF_OK), scripts: SELF_SCRIPTS,
    diskFiles: SELF_DISK, workflows: SELF_WORKFLOWS, testFileExists: true, ...over,
  }).problems.map(p => p.kind);
  check('합류: 합성 corpus가 작아 하한 2종이 걸린다(체인·dist)', repoKinds({}), ['커버리지 하한 미달', '커버리지 하한 미달']);
  check('합류: 배선 결손이 흘러나온다', repoKinds({ jobs: parseWorkflow(SELF_OK.replace('      - run: npm run verify:ci\n', '')) }).slice(0, 1), ['게이트 미배선']);
  check('합류: 트리거 결손이 흘러나온다', repoKinds({ triggers: [] }).slice(0, 2), ['트리거 소실', '트리거 소실']);
  check('합류: 스크립트 결손이 흘러나온다', repoKinds({ scripts: { ...SELF_SCRIPTS, lint: 'eslint .' } }).slice(0, 1), ['스크립트 내용 결손']);
  check('합류: 우회 배포가 흘러나온다', repoKinds({ workflows: [...SELF_WORKFLOWS, { name: 'zz.yml', src: 'uses: actions/deploy-pages@v4' }] }).slice(0, 1), ['우회 배포 경로']);
  check('합류: 등록 소실이 흘러나온다', repoKinds({ testFileExists: false }).filter(k => k === '등록 소실'), ['등록 소실']);

  // ── 파서 ──
  const parsed = parseWorkflow(SELF_OK);
  check('파서: job 이름·스텝 수·needs', [parsed.map(j => j.name).join(','), String(parsed[0].runs.length), String(parsed[2].needs.length)], ['build,content-verify,deploy', '5', '2']);
  check('파서: 트리거 이름', parseTriggers(SELF_OK).map(t => t.name), ['push', 'pull_request']);

  // 합성 픽스처가 실파일을 안 닮게 되면 위 케이스가 전부 무의미해진다(#437: corpus 0이면 초록).
  let realNames: string[];
  try { realNames = parseWorkflow(readFileSync(WORKFLOW, 'utf8')).map(j => j.name); }
  catch (e) { throw new Error(`CI 게이트 자기검사 실패 — 실워크플로를 읽을 수 없다: ${String(e)}`); }
  check('합성 픽스처의 job이 실파일에 전부 있다', parsed.map(j => j.name).filter(n => !realNames.includes(n)), []);
  return ran;
})();

// ── 실행 ──────────────────────────────────────────────────────────────────────
// 테스트가 import 할 때는 아래를 돌리지 않는다(위 자기검사는 import 시에도 돈다).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { problems, jobs, distGates } = auditRepo();
  console.log('CI 게이트 배선 검증 — .github/workflows/');
  console.log(`  job ${jobs.length}개 {${jobs.map(j => `${j.name}:${j.runs.length}스텝`).join(', ')}}`);
  console.log(`  dist 게이트 ${distGates.length}종 (package.json에서 파생) — ${distGates.join(', ')}`);
  console.log(`  자기검사 ${SELF_CHECK_COUNT}종 통과 (배선·무력화(키/셸)·표기변형·트리거·우회배포·스크립트본문·체인·합류·파서)`);
  if (problems.length === 0) {
    console.log(`\n✅ PASS — 배선 결손 0건`);
  } else {
    console.log(`\n❌ FAIL — ${problems.length}건`);
    for (const p of problems) console.log(`  [${p.kind}] ${p.detail}`);
  }
  process.exit(exitCodeFor(problems));
}
