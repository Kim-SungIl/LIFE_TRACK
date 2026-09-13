// verify-ci-gates.ts — CI 워크플로가 게이트를 실제로 부르고, 그 게이트가 무력화되지 않았는지 검증
//
// 왜 필요한가: 이 리포의 잠금은 전부 `package.json` 스크립트인데, **그 스크립트를 부르는 것은
// `.github/workflows/` 한 곳**이고 리포 어디에서도 그 파일을 읽지 않았다.
// 즉 게이트가 몇 종이든 **YAML에서 스텝을 지우면 아무도 모른다.**
//
// **세 번 뚫리고 세 번 고쳤다.** 그 과정에서 배운 것이 이 파일의 모양을 결정했다:
//   1차 "스텝이 있는가"만 봤다 → 스텝·job의 `if`/`continue-on-error`로 8종이 뚫렸다
//   2차 YAML 키만 막았다 → 셸(`|| true`·`;`·`set +e`)로 13종이 뚫렸다
//   3차 셸을 정규식으로 해석했다 → `echo` 접두·개행·대소문자·YAML 이스케이프로 11종이 뚫렸다
// **토큰을 하나씩 막는 방식은 끝이 없다.** 그래서 이번엔 층을 하나 없앴다:
//   · 체인을 package.json 문자열에서 **`run-chain.ts` 실행기로** 옮겼다. 체인이 더 이상
//     자유 형식 셸이 아니므로 `;`·`#`·개행·`echo` 계열이 **구조적으로 사라진다**
//   · 게이트 스크립트 본문은 **정확한 형태만 허용**한다(`tsx scripts/verify/X.ts`). 금지 목록이
//     아니라 허용 형태라, 새 변형이 나와도 자동으로 막힌다
//   · 손으로 쓸 수밖에 없는 `lint`/`test`/`build:release`만 **명령 단위**로 본다
//     (토큰이 "언급됐는가"가 아니라 "그 명령이 그 인자로 실행되는가")
//
// 요구 목록은 하드코딩하지 않는다 — 디스크의 `verify-*.ts`와 `package.json`에서 파생시켜,
// 게이트가 늘면 요구도 저절로 는다("만들고 CI에 안 붙이는" 반대 방향을 잡기 위해서다).
//
// 실행: cd game && npx tsx scripts/verify/verify-ci-gates.ts

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, basename, join } from 'path';
import { pathToFileURL } from 'url';
import { load as loadYaml } from 'js-yaml';
import { verifyFilesOnDisk, buildJobOnly } from './run-chain';

const ROOT = resolve(import.meta.dirname, '../..');
const WORKFLOW_DIR = resolve(ROOT, '../.github/workflows');
const WORKFLOW_NAME = 'deploy.yml';
const WORKFLOW = resolve(WORKFLOW_DIR, WORKFLOW_NAME);
const PKG = resolve(ROOT, 'package.json');
const TEST_FILE = resolve(ROOT, 'src/engine/__tests__/ciGateWiring.test.ts');
const REPORT_REL = 'node_modules/.tmp/vitest-report.json';

/** dist를 만드는 스텝. dist 게이트는 전부 이것보다 **뒤**에 와야 한다(앞이면 볼 dist가 없다). */
const BUILD_STEP = 'npm run build:release';
/** package.json에서 파생할 수 없는 필수 스텝 — 스크립트 이름만으로는 "CI가 불러야 한다"를 알 수 없다. */
const REQUIRED_BUILD_STEPS = ['npm run lint', 'npm test', 'npm run verify:test-floor', BUILD_STEP] as const;
const CONTENT_STEP = 'npm run verify:ci';
const BUILD_JOB = 'build';
const CONTENT_JOB = 'content-verify';
const DEPLOY_JOB = 'deploy';
/** `if`/`continue-on-error`/빈 `strategy`를 금지할 job. */
const GATE_JOBS = [BUILD_JOB, CONTENT_JOB] as const;
/** 워크플로가 돌아야 하는 트리거와, 반드시 덮여야 하는 브랜치. */
const REQUIRED_TRIGGERS = ['push', 'pull_request'] as const;
const REQUIRED_BRANCH = 'main';
/** Pages에 **게시**하는 액션. `upload-pages-artifact`는 포장·업로드일 뿐 배포가 아니라 제외한다. */
const DEPLOY_ACTION = 'actions/deploy-pages';

/** 게이트 스크립트에 허용되는 **정확한 형태**. 금지 목록이 아니라 허용 형태다 —
 *  `echo tsx ...` · `tsx ... || true` · `npm run X:impl` 같은 변형이 전부 한 번에 막힌다. */
const VERIFY_SCRIPT_FORM = /^tsx scripts\/verify\/(?:verify-[A-Za-z0-9-]+|run-chain)\.ts$/;
const CHAIN_SCRIPT = 'tsx scripts/verify/run-chain.ts';

/** 손으로 쓰는 세 스크립트만 명령 단위로 본다. "토큰이 들어 있나"가 아니라
 *  **그 명령이 그 인자로 실행되나**를 본다 — `"lint": "echo eslint . --max-warnings 0"`이
 *  포함 검사를 통과했다(3차 실측). */
interface CommandRule { readonly command: string; readonly args: readonly string[] }
const SCRIPT_RULES: Record<string, readonly CommandRule[]> = {
  // `rm -f`를 요구하는 이유: verify-test-floor가 "리포트가 있다 = 이번 실행이 만들었다"를
  // 신선도 근거로 쓴다. 실행 전 삭제가 사라지면 그 전제가 조용히 거짓이 된다.
  test: [{ command: 'rm', args: ['-f', REPORT_REL] }, { command: 'vitest', args: ['run', '--reporter=json', REPORT_REL] }],
  lint: [{ command: 'eslint', args: ['--max-warnings 0'] }],
  'build:release': [{ command: 'tsc', args: [] }, { command: 'vite', args: ['build'] }],
};
/** 명령이 아니라 환경변수로 들어가는 요구. */
const SCRIPT_ENV: Record<string, readonly string[]> = { 'build:release': ['GEN_WEBP=1'] };

/** 셸에서 종료 코드를 삼키는 표현. 게이트를 부르는 자리에 오면 스텝은 남은 채 실패가 무시된다. */
const RC_SWALLOW: readonly (readonly [RegExp, string])[] = [
  [/\|\|/, '`||` (앞이 실패해도 뒤로 넘어간다)'],
  [/(?:^|\s|;)set\s+\+e/, '`set +e` (실패 시 중단이 꺼진다)'],
  [/;/, '`;` (npm은 `sh -c`로 돌려서 앞 명령의 실패가 무시된다)'],
  [/(?<!\|)\|(?!\|)/, '`|` (파이프의 rc는 마지막 명령의 것이다 — pipefail 없음)'],
] as const;

/** 실패한 `needs` 뒤에도 job을 돌리는 표현. **대소문자를 안 가린다** — GitHub Actions의
 *  함수명이 대소문자 구분을 안 해서 `Always()`가 그대로 샜다(3차 실측). */
const IF_OVERRIDES_NEEDS = /\b(?:always|failure|cancelled)\s*\(/i;

export interface Step { name?: string; run?: string; uses?: string; if?: string; continueOnError?: string }
export interface Job { name: string; steps: Step[]; runs: string[]; needs: string[]; if?: string; continueOnError?: string; emptyMatrix?: string }
export interface Trigger { name: string; pathFilter?: string; branches?: string[]; branchesIgnore?: string[] }
export interface Problem { kind: string; detail: string }

// ── 파싱 ──────────────────────────────────────────────────────────────────────

function asStringOrUndefined(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  return typeof v === 'string' ? v : String(v);
}

/** `continue-on-error`는 **`false`가 아닌 모든 값**이 무력화다. 리터럴 `true`만 보면
 *  `continue-on-error: ${{ ... }}`가 그대로 통과한다(2차 실측). */
function continueOnErrorOf(v: unknown): string | undefined {
  if (v === undefined || v === null || v === false || v === 'false') return undefined;
  return typeof v === 'string' ? v : String(v);
}

/** 조합이 0이 되거나(=job 스킵) 정적으로 알 수 없는 matrix만 문제로 본다.
 *  `strategy`가 있다는 이유만으로 막으면 정적 1조합 matrix가 오탐이었다(3차 실측). */
function emptyMatrixOf(strategy: unknown): string | undefined {
  if (strategy === undefined || strategy === null) return undefined;
  const m = (strategy as Record<string, unknown>).matrix;
  if (m === undefined || m === null) return undefined;
  if (typeof m === 'string') return `matrix가 표현식이라 조합 수를 알 수 없다: ${m}`;
  if (typeof m !== 'object') return undefined;
  for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
    if (typeof v === 'string') return `matrix.${k}가 표현식이라 조합 수를 알 수 없다: ${v}`;
    if (Array.isArray(v) && v.length === 0) return `matrix.${k}가 빈 배열이라 조합이 0이다`;
  }
  return undefined;
}

function normalizeSteps(raw: unknown): Step[] {
  return (Array.isArray(raw) ? raw : []).map(s => {
    const st = (s ?? {}) as Record<string, unknown>;
    return {
      name: asStringOrUndefined(st.name),
      run: asStringOrUndefined(st.run),
      uses: asStringOrUndefined(st.uses),
      if: asStringOrUndefined(st.if),
      continueOnError: continueOnErrorOf(st['continue-on-error']),
    };
  });
}

/** 워크플로를 job → steps[]로 정규화한다. 정규식 라인 파서는 표기 변형에서 오탐 6종,
 *  `matrix.include`의 `run:`과 점이 든 job 이름의 오귀속으로 거짓통과 2종을 냈다(1차 실측). */
export function parseWorkflow(src: string): Job[] {
  const doc = loadYaml(src) as { jobs?: Record<string, unknown> } | null;
  const rawJobs = doc && typeof doc === 'object' ? doc.jobs : undefined;
  if (!rawJobs || typeof rawJobs !== 'object') return [];
  return Object.entries(rawJobs).map(([name, rawJob]) => {
    const j = (rawJob ?? {}) as Record<string, unknown>;
    const steps = normalizeSteps(j.steps);
    const needsRaw = j.needs;
    return {
      name, steps,
      runs: steps.map(s => s.run).filter((r): r is string => r !== undefined).map(norm),
      needs: Array.isArray(needsRaw) ? needsRaw.map(n => String(n)) : typeof needsRaw === 'string' ? [needsRaw] : [],
      if: asStringOrUndefined(j.if),
      continueOnError: continueOnErrorOf(j['continue-on-error']),
      emptyMatrix: emptyMatrixOf(j.strategy),
    };
  });
}

/** 워크플로의 모든 `uses:` — job 레벨(reusable workflow)과 스텝 레벨 전부. **원문 문자열
 *  검색이 아니다**: YAML 이스케이프(`actions/deploy-pages`)로 은폐되고 주석으로 오탐이 났다(3차 실측). */
export function usesOf(src: string): string[] {
  let doc: { jobs?: Record<string, unknown> } | null;
  try { doc = loadYaml(src) as { jobs?: Record<string, unknown> } | null; } catch { return []; }
  const rawJobs = doc && typeof doc === 'object' ? doc.jobs : undefined;
  if (!rawJobs || typeof rawJobs !== 'object') return [];
  return Object.values(rawJobs).flatMap(rawJob => {
    const j = (rawJob ?? {}) as Record<string, unknown>;
    const own = asStringOrUndefined(j.uses);
    return [...(own ? [own] : []), ...normalizeSteps(j.steps).map(s => s.uses).filter((u): u is string => u !== undefined)];
  });
}

/** `on:` 트리거 — 이름만이 아니라 **브랜치까지** 본다. `branches: [main]`을 `[never]`로 바꾸면
 *  유효한 YAML인 채로 main 검증이 사라졌다(3차 실측). */
export function parseTriggers(src: string): Trigger[] {
  const doc = loadYaml(src) as Record<string, unknown> | null;
  if (!doc || typeof doc !== 'object') return [];
  const on = doc.on ?? doc['true'];
  if (typeof on === 'string') return [{ name: on }];
  if (Array.isArray(on)) return on.map(n => ({ name: String(n) }));
  if (!on || typeof on !== 'object') return [];
  return Object.entries(on as Record<string, unknown>).map(([name, cfg]) => {
    const c = (cfg ?? {}) as Record<string, unknown>;
    const list = (k: string) => (Array.isArray(c[k]) ? (c[k] as unknown[]).map(String) : undefined);
    return {
      name,
      pathFilter: ['paths', 'paths-ignore'].find(k => c[k] !== undefined),
      branches: list('branches'),
      branchesIgnore: list('branches-ignore'),
    };
  });
}

/** 공백과 줄 이어쓰기를 접되 **개행은 남긴다** — 블록 스칼라의 여러 명령은 개행이 구분자다. */
function norm(s: string): string {
  return s.replace(/\\\r?\n/g, ' ')
    .split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

function oneLine(s: string): string { return norm(s).replace(/\n/g, ' ; '); }

/** 인용된 문자열과 주석을 지운 뒤에 셸 표현을 본다 — 안 그러면 `echo 'a; b'`의 세미콜론이나
 *  `# 설명`의 `#`이 오탐이 된다(3차 실측). 완전한 셸 파서는 아니지만, 여기 들어오는 것은
 *  위에서 형태를 좁혀 둔 짧은 명령뿐이다. */
function stripQuotesAndComments(s: string): string {
  return s.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""')
    .split('\n').map(l => l.replace(/(^|\s)#.*$/, '$1')).join('\n');
}

/** `npm test`와 `npm run test`를 같은 것으로 본다. */
function canon(s: string): string {
  return s.replace(/\s+/g, ' ').trim().replace(/^npm run /, 'npm ');
}

/** 명령 구분자는 **`&&`와 개행뿐**이다. `||`·`;`를 구분자로 쓰면 `npm run lint || true`가
 *  "lint를 부른다"로 읽혀 통과한다 — 무력화 토큰이 매처를 통과시켜 주는 셈이었다(2차 실측). */
function segmentsOf(run: string): string[] {
  return norm(run).split(/\s*&&\s*|\n/).map(s => s.replace(/[()]/g, ' ').trim()).filter(Boolean);
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
  const clean = stripQuotesAndComments(norm(text));
  return RC_SWALLOW.filter(([re]) => re.test(clean))
    .map(([, why]) => ({ kind, detail: `${where}에 ${why} — 스텝은 남아 있는데 실패가 무시된다` }));
}

/** `--flag=value`와 `--flag value`를 같은 것으로 본다. `--max-warnings=0`이 오탐이었다(3차 실측). */
function normFlags(s: string): string { return s.replace(/(--[A-Za-z0-9-]+)=/g, '$1 '); }

/** 이 세그먼트가 실제로 부르는 명령. 앞의 `VAR=val`·`npx`는 건너뛴다.
 *  `echo eslint ...`는 명령이 `echo`라 규칙에 안 맞는다 — 포함 검사를 통과하던 구멍이다. */
function commandOf(seg: string): string {
  const words = seg.trim().split(/\s+/).filter(w => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w));
  let i = 0;
  while (words[i] === 'npx' || words[i] === 'npm' || words[i] === 'exec') i++;
  return (words[i] ?? '').replace(/^.*\//, '');
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

  // 무력화 — 스텝 레벨.
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
  // 무력화 — job 레벨. 한 줄로 그 job의 게이트가 전부 죽는다.
  for (const name of GATE_JOBS) {
    const job = find(name);
    if (!job) continue;
    if (job.if !== undefined) {
      problems.push({ kind: 'job 무력화', detail: `${name} job에 \`if: ${job.if}\`가 붙었다 — 게이트 전체가 한 줄로 스킵된다` });
    }
    if (job.continueOnError !== undefined) {
      problems.push({ kind: 'job 무력화', detail: `${name} job에 \`continue-on-error: ${job.continueOnError}\`가 붙었다 — 게이트 전체가 붉어도 성공이다` });
    }
    if (job.emptyMatrix !== undefined) {
      problems.push({ kind: 'job 무력화', detail: `${name} job의 ${job.emptyMatrix} — job이 통째로 스킵될 수 있다` });
    }
  }

  if (deploy) {
    for (const dep of [BUILD_JOB, CONTENT_JOB]) {
      if (!deploy.needs.includes(dep)) {
        problems.push({ kind: '배포 의존 누락', detail: `${DEPLOY_JOB}.needs에 ${dep}이 없다 — 게이트가 붉어도 배포된다` });
      }
    }
    // `deploy`의 `if`는 정당하다(`push`에서만 배포). 전면 면제하지 않는 이유: `if: always()`
    // 한 줄이면 needs가 붉어도 배포된다 — 예외를 두면 그 예외가 곧 구멍이다(2차 실측).
    if (deploy.if !== undefined && IF_OVERRIDES_NEEDS.test(deploy.if)) {
      problems.push({ kind: '배포 의존 무효화', detail: `${DEPLOY_JOB} job의 \`if: ${deploy.if}\`가 실패한 needs를 무시한다` });
    }
    if (deploy.continueOnError !== undefined) {
      problems.push({ kind: '배포 의존 무효화', detail: `${DEPLOY_JOB} job에 \`continue-on-error: ${deploy.continueOnError}\`가 붙었다` });
    }
  }
  return problems;
}

/** 워크플로가 애초에 도는가. 이름뿐 아니라 **브랜치**까지 본다. */
export function auditTriggers(triggers: readonly Trigger[]): Problem[] {
  const problems: Problem[] = [];
  for (const need of REQUIRED_TRIGGERS) {
    const t = triggers.find(x => x.name === need);
    if (!t) {
      problems.push({ kind: '트리거 소실', detail: `\`on:\`에 \`${need}\`가 없다 — 그 경로에서 게이트가 한 번도 안 돈다` });
      continue;
    }
    if (t.pathFilter) {
      problems.push({ kind: '트리거 무력화', detail: `\`on.${need}\`에 \`${t.pathFilter}\`가 붙었다 — 조건에 따라 워크플로가 통째로 스킵된다` });
    }
    if (t.branches !== undefined && !t.branches.includes(REQUIRED_BRANCH)) {
      problems.push({ kind: '트리거 무력화', detail: `\`on.${need}.branches\`(${t.branches.join(', ')})에 ${REQUIRED_BRANCH}이 없다 — main 경로가 검증되지 않는다` });
    }
    if (t.branchesIgnore?.includes(REQUIRED_BRANCH)) {
      problems.push({ kind: '트리거 무력화', detail: `\`on.${need}.branches-ignore\`가 ${REQUIRED_BRANCH}을 제외한다` });
    }
  }
  return problems;
}

/** deploy.yml 밖에서 Pages에 **게시**하면 위의 게이트를 전부 우회한다. */
export function auditOtherWorkflows(files: readonly { name: string; src: string }[]): Problem[] {
  return files.filter(f => f.name !== WORKFLOW_NAME)
    .flatMap(f => usesOf(f.src).filter(u => u.split('@')[0] === DEPLOY_ACTION)
      .map(u => ({ kind: '우회 배포 경로', detail: `${f.name}이 \`${u}\`를 쓴다 — ${WORKFLOW_NAME}의 게이트를 거치지 않고 배포된다` })));
}

// ── 스크립트 본문 판정 ────────────────────────────────────────────────────────

/** `npm run X`를 재귀 전개한다(pre/post 훅 포함). 스텝이 부르는 이름만 보면
 *  `"build:release": "npm run build"`처럼 한 겹 줄이는 편집으로 `tsc`가 사라진다. */
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

  // 손으로 쓰는 세 스크립트 — **명령 단위**로 본다.
  for (const [name, rules] of Object.entries(SCRIPT_RULES)) {
    if (scripts[name] === undefined) {
      problems.push({ kind: '스크립트 소실', detail: `package.json에 \`${name}\` 스크립트가 없다` });
      continue;
    }
    const expanded = expandScript(name, scripts);
    const segs = segmentsOf(stripQuotesAndComments(expanded)).map(normFlags);
    for (const rule of rules) {
      const seg = segs.find(s => commandOf(s) === rule.command);
      if (!seg) {
        problems.push({ kind: '스크립트 내용 결손', detail: `\`${name}\`을 전개해도 \`${rule.command}\`를 실제로 부르지 않는다 — 이름만 남고 하는 일이 바뀌었다` });
        continue;
      }
      for (const arg of rule.args) {
        if (!seg.includes(normFlags(arg))) {
          problems.push({ kind: '스크립트 내용 결손', detail: `\`${name}\`의 \`${rule.command}\`에 \`${arg}\`가 없다` });
        }
      }
    }
    for (const env of SCRIPT_ENV[name] ?? []) {
      if (!expanded.includes(env)) {
        problems.push({ kind: '스크립트 내용 결손', detail: `\`${name}\`을 전개해도 \`${env}\`가 없다` });
      }
    }
    problems.push(...swallowProblems('스크립트 무력화', `\`${name}\``, expanded));
  }

  // 게이트 스크립트 — **정확한 형태**만 허용한다.
  for (const [name, body] of Object.entries(scripts)) {
    if (!name.startsWith('verify:') || typeof body !== 'string') continue;
    const terminal = resolveVerifyScript(name, scripts);
    if (terminal === null) {
      problems.push({ kind: '게이트 형태 위반', detail: `\`${name}\`은 \`tsx scripts/verify/<파일>.ts\` 또는 그것으로 이어지는 \`npm run <게이트>\` 정확한 형태여야 한다 — 현재 \`${oneLine(body)}\`` });
      continue;
    }
    if (name === 'verify:ci' && terminal !== CHAIN_SCRIPT) {
      problems.push({ kind: '체인 형태 위반', detail: `\`${name}\`은 \`${CHAIN_SCRIPT}\`로 이어져야 한다 — 현재 \`${terminal}\`. 체인을 문자열로 두면 \`;\`·\`#\`·개행·\`echo\`로 조용히 무력화된다` });
    }
  }
  return problems;
}

/**
 * 게이트 스크립트가 **정확한 tsx 호출로 끝나는지** 따라간다. 허용 형태는 딱 둘이다:
 *   · `tsx scripts/verify/<파일>.ts`
 *   · `npm run <다른 게이트>` — 별칭 한 겹(`verify:content` → `verify:ci`)은 정당한 편집이다
 * 어느 쪽도 **여분의 토큰을 못 싣는다**. 그래서 `echo` 접두·`|| true`·`;`가 원천적으로 막힌다 —
 * 금지 목록이 아니라 허용 형태라, 새 변형이 나와도 자동으로 걸린다.
 */
export function resolveVerifyScript(name: string, scripts: Record<string, string>, seen: readonly string[] = []): string | null {
  if (seen.includes(name)) return null;               // 순환 별칭
  const body = scripts[name];
  if (typeof body !== 'string') return null;
  const one = norm(body);
  if (VERIFY_SCRIPT_FORM.test(one)) return one;
  const alias = one.match(/^npm run ([A-Za-z0-9:_-]+)$/);
  return alias ? resolveVerifyScript(alias[1], scripts, [...seen, name]) : null;
}

// ── 체인 커버리지 판정 ────────────────────────────────────────────────────────

/**
 * 체인은 이제 `run-chain.ts`가 디스크에서 파생하므로 "체인에 안 붙였다"는 원천적으로 불가능하다.
 * 남는 것은 **build job 전용 집합이 실제 배선과 맞는가** — `run-chain`이 빼는 것과 build job이
 * 부르는 것이 어긋나면 그 게이트는 **아무 데서도 안 돈다**.
 */
export function auditChain(scripts: Record<string, string>, diskFiles: readonly string[], buildJobRuns: readonly string[]): Problem[] {
  const problems: Problem[] = [];
  if (diskFiles.length === 0) {
    return [{ kind: '커버리지 붕괴', detail: 'scripts/verify에서 verify-*.ts를 하나도 못 찾았다 — 집합 동등성이 공허하게 참이 된다' }];
  }
  const wantBuildOnly = buildJobOnly(diskFiles);
  const calledFiles = new Set(buildJobRuns.flatMap(run =>
    [...norm(run).matchAll(/\bnpm run ([A-Za-z0-9:_-]+)/g)]
      .flatMap(m => [...expandScript(m[1], scripts).matchAll(/scripts\/verify\/(verify-[A-Za-z0-9-]+)\.ts/g)].map(x => x[1]))));
  for (const f of wantBuildOnly) {
    if (!calledFiles.has(f)) {
      problems.push({ kind: '게이트 미배선', detail: `${f}.ts는 체인에서 제외되는데(build job 전용) build job이 안 부른다 — 아무 데서도 안 돈다` });
    }
  }
  for (const f of calledFiles) {
    if (!diskFiles.includes(f)) {
      problems.push({ kind: '고아 참조', detail: `build job이 scripts/verify/${f}.ts를 부르는데 파일이 없다` });
    } else if (!wantBuildOnly.includes(f)) {
      problems.push({ kind: '이중 실행', detail: `${f}.ts를 build job이 부르는데 체인에서도 돈다 — run-chain의 제외 규칙과 어긋난다` });
    }
  }
  return problems;
}

// ── 등록 잠금 ─────────────────────────────────────────────────────────────────

/** 이 게이트를 부르는 두 자리 중 **테스트 쪽 파일이 사라지는 것**은 아무도 안 봤다.
 *  **파일 존재만** 본다 — 안의 토큰을 grep 해봐야 주석 한 줄로 만족된다(2차 실측). */
export function auditRegistration(exists: boolean): Problem[] {
  return exists ? [] : [{
    kind: '등록 소실',
    detail: `${basename(TEST_FILE)}가 없다 — verify:ci 스텝이 지워지면 이 검사는 아무 데서도 안 돈다`,
  }];
}

// ── 합류 ──────────────────────────────────────────────────────────────────────

export interface RepoInputs {
  jobs: Job[]; triggers: Trigger[]; scripts: Record<string, string>;
  diskFiles: string[]; workflows: { name: string; src: string }[]; testFileExists: boolean;
}

export function distGatesOf(scripts: Record<string, string>): string[] {
  return Object.keys(scripts).filter(n => n.startsWith('verify:dist-')).sort();
}

export function readRepoInputs(): RepoInputs {
  const workflows = readdirSync(WORKFLOW_DIR).filter(f => /\.ya?ml$/.test(f))
    .map(name => ({ name, src: readFileSync(join(WORKFLOW_DIR, name), 'utf8') }));
  const main = workflows.find(w => w.name === WORKFLOW_NAME)?.src ?? '';
  return {
    jobs: parseWorkflow(main),
    triggers: parseTriggers(main),
    scripts: JSON.parse(readFileSync(PKG, 'utf8')).scripts as Record<string, string>,
    diskFiles: verifyFilesOnDisk(),
    workflows,
    testFileExists: existsSync(TEST_FILE),
  };
}

/** 실파일을 읽어 판정한다. 테스트도 이 함수를 부른다 — 검사 대상이 갈리면 의미가 없다.
 *  입력을 주입할 수 있게 둔 것은 장식이 아니다: 실워크플로가 상시 정합이라 이 함수의 **반환**을
 *  통째로 비워도 스크립트와 테스트가 둘 다 초록이었다(검수 실측). */
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
  if (distGates.length === 0) {
    problems.push({ kind: '커버리지 붕괴', detail: 'verify:dist-* 스크립트가 0개 — 요구가 0이면 전부 충족으로 통과한다' });
  }
  return { problems, jobs, distGates };
}

export function exitCodeFor(problems: readonly Problem[]): 0 | 1 {
  return problems.length === 0 ? 0 : 1;
}

// ── 자기검사 ──────────────────────────────────────────────────────────────────
// 실워크플로가 상시 정합이라, 이게 없으면 판정부도 파서도 통째로 지운 채 초록이 된다(#437 계열).
// **모듈 최상위에서 돈다** — 테스트가 이 모듈을 import 하기만 해도 같이 검증된다.
//
// **열거형 규칙은 원소별 대조군을 돌린다.** 3차 검수에서, `always|failure|cancelled` 중
// `failure|cancelled` 감시만 지워도 자기검사가 `always`만 보느라 통과했다. 그래서 아래 케이스는
// 상수 배열을 **순회해서** 만든다 — 원소를 더하거나 빼면 대조군이 저절로 따라온다.
//
// **이 블록 자체는 잠기지 않는다.** 통째로 지우면 여기도 테스트도 초록이다(2차 검수 실측).
// 판정 로직의 실질 잠금은 `ciGateWiring.test.ts`의 양성 대조군이고, 이 블록은 더 촘촘한 회귀망이다.

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
  test: `rm -f ${REPORT_REL} && vitest run --reporter=default --reporter=json --outputFile.json=${REPORT_REL}`,
  build: 'tsc -b && vite build',
  'build:release': 'GEN_WEBP=1 npm run build',
  'verify:ci': CHAIN_SCRIPT,
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
  check('새 게이트를 CI에 안 붙임', wf(SELF_OK, [...SELF_GATES, 'verify:dist-beta']), ['게이트 미배선']);
  check('게이트를 다른 job으로 이동(점 있는 이름)', wf(sub(GATE_RUN, '').replace('  content-verify:', '  extra.checks:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm run verify:dist-alpha\n\n  content-verify:')), ['게이트 미배선']);
  // 필수 스텝은 **원소마다** 지워 본다 — 한 원소만 보면 나머지 감시를 지워도 통과한다.
  for (const step of REQUIRED_BUILD_STEPS) {
    const line = new RegExp(`^ +- name: .+\\n(?: +[a-z-]+: .+\\n)* +run: ${step.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n`, 'm');
    const m = SELF_OK.match(line);
    if (!m) throw new Error(`CI 게이트 자기검사 실패 — 픽스처에 \`${step}\` 스텝이 없다`);
    check(`필수 스텝 삭제: ${step}`, wf(SELF_OK.replace(m[0], '')), ['필수 스텝 누락']);
  }
  // deploy.needs도 **원소마다**.
  for (const dep of [BUILD_JOB, CONTENT_JOB]) {
    const left = [BUILD_JOB, CONTENT_JOB].filter(d => d !== dep).join(', ');
    check(`deploy.needs에서 ${dep} 제거`, wf(sub('needs: [build, content-verify]', `needs: [${left}]`)), ['배포 의존 누락']);
  }

  // ── 무력화: YAML 키 ──
  check('게이트 스텝에 continue-on-error', wf(sub(GATE_RUN, GATE_RUN + '        continue-on-error: true\n')), ['스텝 무력화']);
  check('게이트 스텝에 continue-on-error 표현식', wf(sub(GATE_RUN, GATE_RUN + "        continue-on-error: ${{ github.event_name == 'pull_request' }}\n")), ['스텝 무력화']);
  check('게이트 스텝에 if', wf(sub(GATE_RUN, '      - name: G\n        if: false\n        run: npm run verify:dist-alpha\n')), ['스텝 무력화']);
  check('npm test 스텝에 if', wf(sub(TEST_RUN, "      - name: Test\n        if: github.event_name == 'push'\n        run: npm test\n")), ['스텝 무력화']);
  check('continue-on-error: false는 정당', wf(sub(GATE_RUN, GATE_RUN + '        continue-on-error: false\n')), []);
  // 게이트 job도 **원소마다**.
  for (const jobName of GATE_JOBS) {
    check(`${jobName} job-level if`, wf(sub(`  ${jobName}:\n    runs-on: ubuntu-latest\n`, `  ${jobName}:\n    if: false\n    runs-on: ubuntu-latest\n`)), ['job 무력화']);
    check(`${jobName} job-level continue-on-error 표현식`, wf(sub(`  ${jobName}:\n    runs-on: ubuntu-latest\n`, `  ${jobName}:\n    continue-on-error: \${{ true }}\n    runs-on: ubuntu-latest\n`)), ['job 무력화']);
    check(`${jobName} job의 빈 matrix`, wf(sub(`  ${jobName}:\n    runs-on: ubuntu-latest\n`, `  ${jobName}:\n    runs-on: ubuntu-latest\n    strategy:\n      matrix:\n        node: []\n`)), ['job 무력화']);
    check(`${jobName} job의 표현식 matrix`, wf(sub(`  ${jobName}:\n    runs-on: ubuntu-latest\n`, `  ${jobName}:\n    runs-on: ubuntu-latest\n    strategy:\n      matrix:\n        node: \${{ fromJSON('[]') }}\n`)), ['job 무력화']);
  }
  check('정적 1조합 matrix는 정당', wf(sub('  build:\n    runs-on: ubuntu-latest\n', '  build:\n    runs-on: ubuntu-latest\n    strategy:\n      matrix:\n        node: [22]\n')), []);
  // deploy의 needs 무효화도 **함수마다**, 그리고 대소문자 변형까지.
  for (const fn of ['always', 'failure', 'cancelled', 'Always', 'CANCELLED']) {
    check(`deploy.if: ${fn}()`, wf(sub("  deploy:\n    if: github.event_name == 'push'\n", `  deploy:\n    if: ${fn}()\n`)), ['배포 의존 무효화']);
  }
  check('deploy job의 if: push는 정당', wf(SELF_OK), []);
  check('deploy job에 continue-on-error', wf(sub('  deploy:\n', '  deploy:\n    continue-on-error: true\n')), ['배포 의존 무효화']);

  // ── 무력화: 셸 ── RC_SWALLOW **원소마다**.
  const swallowSamples: readonly [string, string][] = [
    ['|| true', 'npm run verify:dist-alpha || true'],
    ['set +e', 'set +e; npm run verify:dist-alpha'],
    ['; true', 'npm run verify:dist-alpha; true'],
    ['| cat', 'npm run verify:dist-alpha | cat'],
  ];
  if (swallowSamples.length !== RC_SWALLOW.length) {
    throw new Error(`CI 게이트 자기검사 실패 — RC_SWALLOW ${RC_SWALLOW.length}종인데 대조군은 ${swallowSamples.length}종이다. 원소를 추가했으면 대조군도 추가할 것.`);
  }
  for (const [label, body] of swallowSamples) {
    const kinds = wf(sub(GATE_RUN, `      - name: G\n        run: ${body}\n`));
    ran++;
    if (!kinds.includes('종료 코드 무력화')) {
      throw new Error(`CI 게이트 자기검사 실패 — 게이트 스텝의 "${label}"을 안 잡는다: ${JSON.stringify(kinds)}`);
    }
  }
  check('인용된 세미콜론은 정당', wf(sub(GATE_RUN, "      - name: G\n        run: npm run verify:dist-alpha && echo 'done; ok'\n")), []);
  check('블록 스칼라 안의 주석은 정당', wf(sub('        run: npm run lint\n', '        run: |\n          # warning도 실패로 둔다\n          npm run lint\n')), []);

  // ── 정당한 표기 변형 (오탐 금지) ──
  check('블록 스칼라 여러 줄', wf(sub('        run: npm run lint\n', '        run: |\n          echo linting\n          npm run lint\n')), []);
  check('폴디드 >', wf(sub(TEST_RUN, '      - name: Test\n        run: >\n          npm test\n')), []);
  check('따옴표 값', wf(sub('        run: npm run lint\n', '        run: "npm run lint"\n')), []);
  check('&& 로 이어 붙이기', wf(sub('        run: npm run lint\n', '        run: npm ci && npm run lint\n')), []);
  check('needs 블록 리스트', wf(sub('    needs: [build, content-verify]\n', '    needs:\n      - build\n      - content-verify\n')), []);
  check('비게이트 스텝의 if·파이프는 정당', wf(sub('      - uses: actions/upload-pages-artifact@v3\n', '      - name: Note\n        run: echo hi | cat\n      - uses: actions/upload-pages-artifact@v3\n')), []);

  // ── 트리거 ── **원소마다**.
  const tg = (yaml: string) => auditTriggers(parseTriggers(yaml)).map(p => p.kind);
  check('트리거 정합', tg(SELF_OK), []);
  for (const name of REQUIRED_TRIGGERS) {
    check(`${name} 트리거 삭제`, tg(sub(`  ${name}:\n    branches: [main]\n`, '')), ['트리거 소실']);
    check(`${name}.branches에서 main 제거`, tg(sub(`  ${name}:\n    branches: [main]\n`, `  ${name}:\n    branches: [never]\n`)), ['트리거 무력화']);
    check(`${name}.branches-ignore에 main`, tg(sub(`  ${name}:\n    branches: [main]\n`, `  ${name}:\n    branches: [main]\n    branches-ignore: [main]\n`)), ['트리거 무력화']);
    for (const filter of ['paths', 'paths-ignore']) {
      check(`${name}에 ${filter}`, tg(sub(`  ${name}:\n    branches: [main]\n`, `  ${name}:\n    branches: [main]\n    ${filter}: ['**']\n`)), ['트리거 무력화']);
    }
  }

  // ── 우회 배포 ──
  const ow = (files: { name: string; src: string }[]) => auditOtherWorkflows(files).map(p => p.kind);
  const other = (uses: string) => ({ name: 'zz.yml', src: `jobs:\n  s:\n    steps:\n      - uses: ${uses}\n` });
  check('워크플로가 deploy.yml 하나', ow(SELF_WORKFLOWS), []);
  check('두 번째 워크플로의 Pages 배포', ow([...SELF_WORKFLOWS, other('actions/deploy-pages@v4')]), ['우회 배포 경로']);
  check('YAML 이스케이프로 은폐해도 잡는다', ow([...SELF_WORKFLOWS, other('"actions/deploy\\u002dpages@v4"')]), ['우회 배포 경로']);
  check('job 레벨 uses로 숨겨도 잡는다', ow([...SELF_WORKFLOWS, { name: 'zz.yml', src: 'jobs:\n  s:\n    uses: actions/deploy-pages@v4\n' }]), ['우회 배포 경로']);
  check('주석의 문자열은 오탐 아님', ow([...SELF_WORKFLOWS, { name: 'zz.yml', src: '# actions/deploy-pages@v4 는 여기서 안 쓴다\njobs:\n  s:\n    steps:\n      - run: echo hi\n' }]), []);
  check('upload-pages-artifact만 쓰면 배포가 아니다', ow([...SELF_WORKFLOWS, other('actions/upload-pages-artifact@v3')]), []);

  // ── 스크립트 본문 ── SCRIPT_RULES **원소마다**.
  const sc = (over: Record<string, string | undefined>) => {
    const s = { ...SELF_SCRIPTS };
    for (const [k, v] of Object.entries(over)) { if (v === undefined) delete s[k]; else s[k] = v; }
    return auditScripts(s).map(p => p.kind);
  };
  check('스크립트 정합', sc({}), []);
  for (const [name, rules] of Object.entries(SCRIPT_RULES)) {
    check(`${name} 스크립트 소실`, sc({ [name]: undefined }), ['스크립트 소실']);
    // 각 명령을 **하나씩** echo로 바꿔 본다 — 한 명령만 보면 나머지 규칙을 지워도 통과한다.
    // 명령이 다른 스크립트(`build:release` → `build`)에 있을 수 있으니 전개처를 찾아서 바꾼다.
    for (const rule of rules) {
      const host = Object.keys(SELF_SCRIPTS).find(k =>
        SELF_SCRIPTS[k].split(/\s*&&\s*/).some(seg => commandOf(seg) === rule.command));
      if (host === undefined) throw new Error(`CI 게이트 자기검사 실패 — 픽스처에 \`${rule.command}\`를 부르는 스크립트가 없다`);
      const body = SELF_SCRIPTS[host].split(/\s*&&\s*/)
        .map(seg => commandOf(seg) === rule.command ? `echo ${seg}` : seg).join(' && ');
      const kinds = sc({ [host]: body });
      ran++;
      if (!kinds.includes('스크립트 내용 결손')) {
        throw new Error(`CI 게이트 자기검사 실패 — \`${name}\`의 \`${rule.command}\`(${host})를 echo로 바꿨는데 안 잡는다: ${JSON.stringify(kinds)}`);
      }
    }
    // 인자도 **하나씩** 지워 본다 — 인자를 한 개만 보면 나머지 요구를 지워도 통과한다.
    for (const rule of rules) {
      for (const arg of rule.args) {
        const host = Object.keys(SELF_SCRIPTS).find(k => SELF_SCRIPTS[k].includes(arg));
        if (host === undefined) throw new Error(`CI 게이트 자기검사 실패 — 픽스처에 \`${arg}\`를 쓰는 스크립트가 없다`);
        const kinds = sc({ [host]: SELF_SCRIPTS[host].replace(arg, '') });
        ran++;
        if (!kinds.includes('스크립트 내용 결손')) {
          throw new Error(`CI 게이트 자기검사 실패 — \`${name}\`/\`${rule.command}\`에서 \`${arg}\`를 지웠는데 안 잡는다: ${JSON.stringify(kinds)}`);
        }
      }
    }
  }
  for (const [name, envs] of Object.entries(SCRIPT_ENV)) {
    for (const env of envs) {
      check(`${name}에서 ${env} 제거`, sc({ [name]: SELF_SCRIPTS[name].replace(`${env} `, '') }), ['스크립트 내용 결손']);
    }
  }
  check('--max-warnings=0 등호형은 정당', sc({ lint: 'eslint . --max-warnings=0' }), []);
  check('build:release 한 겹 줄이기(tsc 유실)', sc({ 'build:release': 'GEN_WEBP=1 vite build' }), ['스크립트 내용 결손']);
  check('lint 본문에 || true', sc({ lint: 'eslint . --max-warnings 0 || true' }), ['스크립트 무력화']);
  check('build:release 본문에 ; true', sc({ 'build:release': 'GEN_WEBP=1 npm run build; true' }), ['스크립트 무력화']);
  check('게이트 스크립트를 echo로', sc({ 'verify:dist-alpha': 'echo tsx scripts/verify/verify-dist-alpha.ts' }), ['게이트 형태 위반']);
  check('게이트 스크립트에 || true', sc({ 'verify:dist-alpha': 'tsx scripts/verify/verify-dist-alpha.ts || true' }), ['게이트 형태 위반']);
  check('게이트 한 겹 감싸기는 형태상 정당(배선은 auditGates가 따로 본다)', sc({ 'verify:dist-alpha': 'npm run verify:alpha-impl', 'verify:alpha-impl': 'tsx scripts/verify/verify-dist-alpha.ts' }), []);
  check('체인을 문자열로 되돌리기', sc({ 'verify:ci': 'tsx scripts/verify/verify-a.ts && tsx scripts/verify/verify-b.ts' }), ['게이트 형태 위반']);
  check('체인에 ; 붙이기', sc({ 'verify:ci': `${CHAIN_SCRIPT}; true` }), ['게이트 형태 위반']);
  check('별칭 한 겹은 정당', sc({ 'verify:content': 'npm run verify:ci' }), []);
  check('별칭이 엉뚱한 데로 이어지면 잡는다', sc({ 'verify:content': 'npm run verify:dist-alpha', 'verify:ci': 'npm run verify:content' }), ['체인 형태 위반']);
  check('순환 별칭은 잡는다', sc({ 'verify:ci': 'npm run verify:content', 'verify:content': 'npm run verify:ci' }), ['게이트 형태 위반', '게이트 형태 위반']);

  // ── 체인 커버리지 ──
  const ch = (disk: readonly string[] = SELF_DISK, runs: readonly string[] = SELF_BUILD_RUNS, scripts = SELF_SCRIPTS) =>
    auditChain(scripts, disk, runs).map(p => p.kind);
  check('체인 정합', ch(), []);
  check('build 전용 게이트를 안 부름', ch(SELF_DISK, ['npm run build:release', 'npm run verify:test-floor']), ['게이트 미배선']);
  check('새 dist 게이트를 만들고 안 붙임', ch([...SELF_DISK, 'verify-dist-beta']), ['게이트 미배선']);
  check('체인에서 도는 걸 build도 부름(이중 실행)', ch(SELF_DISK, [...SELF_BUILD_RUNS, 'npm run verify:a'], { ...SELF_SCRIPTS, 'verify:a': 'tsx scripts/verify/verify-a.ts' }), ['이중 실행']);
  check('corpus 0이면 붕괴', ch([]), ['커버리지 붕괴']);

  // ── 등록 ──
  check('테스트 파일 존재', auditRegistration(true).map(p => p.kind), []);
  check('테스트 파일 삭제', auditRegistration(false).map(p => p.kind), ['등록 소실']);

  // ── 합류 ── 각 판정부의 결과가 실제로 흘러나오는지.
  const repoKinds = (over: Partial<RepoInputs>) => auditRepo({
    jobs: parseWorkflow(SELF_OK), triggers: parseTriggers(SELF_OK), scripts: SELF_SCRIPTS,
    diskFiles: SELF_DISK, workflows: SELF_WORKFLOWS, testFileExists: true, ...over,
  }).problems.map(p => p.kind);
  check('합류: 정합', repoKinds({}), []);
  check('합류: 배선', repoKinds({ jobs: parseWorkflow(SELF_OK.replace('      - run: npm run verify:ci\n', '')) }), ['게이트 미배선']);
  check('합류: 트리거', repoKinds({ triggers: [] }), ['트리거 소실', '트리거 소실']);
  check('합류: 스크립트', repoKinds({ scripts: { ...SELF_SCRIPTS, lint: 'eslint .' } }), ['스크립트 내용 결손']);
  check('합류: 우회 배포', repoKinds({ workflows: [...SELF_WORKFLOWS, other('actions/deploy-pages@v4')] }), ['우회 배포 경로']);
  check('합류: 체인', repoKinds({ diskFiles: [...SELF_DISK, 'verify-dist-beta'] }), ['게이트 미배선']);
  check('합류: 등록', repoKinds({ testFileExists: false }), ['등록 소실']);
  const noDist = { ...SELF_SCRIPTS };
  delete noDist['verify:dist-alpha'];
  check('합류: dist 게이트 0종', repoKinds({ scripts: noDist }).filter(k => k === '커버리지 붕괴'), ['커버리지 붕괴']);

  // ── 파서 ──
  const parsed = parseWorkflow(SELF_OK);
  check('파서: job·스텝·needs', [parsed.map(j => j.name).join(','), String(parsed[0].runs.length), String(parsed[2].needs.length)], ['build,content-verify,deploy', '5', '2']);
  check('파서: 트리거 이름·브랜치', [parseTriggers(SELF_OK).map(t => t.name).join(','), (parseTriggers(SELF_OK)[0].branches ?? []).join(',')], ['push,pull_request', 'main']);

  // 합성 픽스처가 실파일을 안 닮게 되면 위 케이스가 전부 무의미해진다(#437: corpus 0이면 초록).
  let realNames: string[];
  try { realNames = parseWorkflow(readFileSync(WORKFLOW, 'utf8')).map(j => j.name); }
  catch (e) { throw new Error(`CI 게이트 자기검사 실패 — 실워크플로를 읽을 수 없다: ${String(e)}`); }
  check('합성 픽스처의 job이 실파일에 전부 있다', parsed.map(j => j.name).filter(n => !realNames.includes(n)), []);
  return ran;
})();

// ── 실행 ──────────────────────────────────────────────────────────────────────
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
