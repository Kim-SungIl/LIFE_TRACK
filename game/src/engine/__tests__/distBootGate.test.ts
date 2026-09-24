// 브라우저 부팅 게이트가 **자기 종료 경로를 내는가**. (`verify-dist-boot.ts` 후속)
//
// 그 스크립트에는 자기검사가 있다 — 탐침 콘솔 에러와 탐침 404를 심고 판정부가 그걸
// 말하는지 본다. 그걸로 관측기·임계·판정 블록의 죽음은 잡힌다(실측 5종 CAUGHT).
//
// **그런데 자기 자신이 rc를 내는 경로는 못 잠근다.** 실측으로 두 개가 살아남았다:
//
//   판정부 호출(`for (const p of judgeSignals(...)) fail(p)`)을 통째로 삭제 → ✅ rc=0
//   DOM 글자 하한 `shape.text < 20` → `< 0`                              → ✅ rc=0
//
// 둘 다 같은 이유다: 실제 dist는 멀쩡해서 **음성 대조군이 없다.** 부정형 단언만 있는
// 게이트는 판정이 죽은 것과 "문제가 없다"를 구별하지 못한다 — 이 리포가 여러 번 당했다.
//
// 그래서 합성 dist 여러 벌에 대고 스크립트를 **실제로 돌려** rc를 본다.
//
// **채널마다 픽스처가 따로 있어야 한다.** 한 픽스처가 여러 채널을 켜면 서로를 가려서
// 어느 쪽도 개별로 안 잠긴다 — 처음 쓴 `<link rel=stylesheet>` 404 픽스처가 그랬다.
// 콘솔·요청실패·서버404 셋을 전부 켜고 그중 **둘이 URL을 실어서**, 서버404 판정을 죽여도
// `toContain(URL)`이 요청실패 쪽으로 통과했다(실측). 아래 셋은 각자 한 채널만 켠다.
import { describe, it, expect } from 'vitest';
import { existsSync, writeFileSync, rmSync, mkdtempSync, mkdirSync, realpathSync } from 'fs';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { resolve, join } from 'path';

const ROOT = resolve(import.meta.dirname, '../../..');
const SCRIPT = resolve(ROOT, 'scripts/verify/verify-dist-boot.ts');
const TSX = resolve(ROOT, 'node_modules/.bin/tsx');

/** 게이트가 요구하는 `<title>`. 제품과 같은 값이라 여기서도 같이 잠긴다. */
const TITLE = '7년의 시간표';
/** `vite.config.ts`·게이트와 같은 production base. 여기서만 절대경로 요청에 쓴다. */
const BASE = '/LIFE_TRACK/';

/**
 * 합성 dist 한 벌. `body`가 페이지의 `<script>` 본문이 된다.
 *
 * `mkdtemp` 이후를 try로 감싼다 — 안 그러면 여기서 예외가 날 때 호출부의 `finally`에
 * 진입하기 전이라 임시 디렉터리가 남는다.
 */
function fakeDist(prefix: string, body: string, opts: { title?: string; bodyHtml?: string } = {}): string {
  // macOS의 `/tmp`는 링크라 realpath로 받는다. 스크립트가 경로를 resolve해 쓴다.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  try {
    mkdirSync(join(dir, 'assets'), { recursive: true });
    // **본문은 외부 모듈 파일로 내보낸다.** 인라인 `<script>`만 쓰면 서버가 JS를 한 번도
    // 안 내줘서 MIME 표가 안 잠긴다(실측: `.js`/`.mjs` 항목을 지워도 6/6 통과였다.
    // 외부 모듈이면 `Strict MIME type checking`으로 빈 화면 rc=1이 된다).
    // 실제 dist의 모양이기도 하다 — 제품은 인라인 스크립트로 부팅하지 않는다.
    writeFileSync(join(dir, 'assets/app.js'), body, 'utf8');
    writeFileSync(join(dir, 'index.html'),
      `<!doctype html><html lang="ko"><head><meta charset="utf-8">` +
      `<title>${opts.title ?? TITLE}</title></head>` +
      `<body><div id="root"></div>${opts.bodyHtml ?? ''}` +
      `<script type="module" src="assets/app.js"></script></body></html>\n`,
      'utf8');
    return dir;
  } catch (e) {
    rmSync(dir, { recursive: true, force: true });
    throw e;
  }
}

/**
 * 정상 픽스처가 서버에서 받아 가는 파일 수 — `index.html` + `assets/app.js`.
 * 탐침은 빠진 수다(게이트가 자기 요청을 빼고 센다). `fakeDist`가 파일을 늘리면 여기가 깨진다.
 */
const HEALTHY_REQUESTS = 2;

/** 첫 화면이 그려진 것처럼 보이는 본문 — 글자 20자 이상 + 버튼 1개. */
const HEALTHY_BODY =
  `document.getElementById('root').innerHTML =` +
  ` '<h1>7년의 시간표 — 새 게임을 시작합니다</h1><button>새 게임</button>';`;

/**
 * 스크립트 한 번의 상한. 크로미움 기동 + 합성 dist 부팅 + 탐침 대기(500ms)라 평시 1~2초,
 * CI 실측 2.1초/건이다. 180초는 "행이 걸렸다"를 판정하는 하드 킬이다.
 */
const SPAWN_TIMEOUT = 180_000;

function run(dist: string) {
  return spawnSync(TSX, [SCRIPT, dist], { cwd: ROOT, encoding: 'utf8', timeout: SPAWN_TIMEOUT });
}

// **vitest 기본 5초는 이 파일에 맞지 않는다.** 각 케이스가 크로미움을 새로 띄우는데, 워크트리
// 10개가 같은 머신에서 스위트를 동시에 돌리자 기동이 5초를 넘겨 **전원에게서 플레이크가
// 재현됐다**(실패 목록이 회차마다 달라지고, 단독 실행은 27/27 통과). `spawnSync`는 동기라
// vitest 타이머가 중간에 끊지 못하고 **끝난 뒤에** 5초 초과를 선고한다 — 그래서 여기 값은
// 실제 상한인 SPAWN_TIMEOUT에서 파생시킨다. 리터럴 둘이 따로 놀면 한쪽만 고쳐진다.
describe('브라우저 부팅 게이트가 실제로 rc를 낸다', { timeout: SPAWN_TIMEOUT + 20_000 }, () => {
  it('전제: 실행기와 스크립트가 제자리에 있다', () => {
    expect(existsSync(TSX), 'tsx가 없으면 아래 검사들이 전부 공허해진다').toBe(true);
    expect(existsSync(SCRIPT)).toBe(true);
  });

  it('멀쩡한 화면은 rc=0 (음성 대조군)', () => {
    const dir = fakeDist('boot-ok-', HEALTHY_BODY);
    try {
      const r = run(dir);
      expect(r.status, `멀쩡한 화면을 거부하면 오탐이다\n${r.stdout}${r.stderr}`).toBe(0);
      // **통과 수까지 본다.** 자기검사 블록을 통째로 지우면 `0/2`가 된다 — 문자열이
      // 무조건 찍히던 때는 그 삭제가 6/6으로 살아남았다(실측).
      expect(r.stdout, '자기검사가 죽었다 — 아래 채널 검사들이 전부 공허해진다').toContain('자기검사 2/2종 통과');
      // 요청 수도 본다. `realServed` 필터가 탐침 말고 다른 것까지 걷어내면 여기가 줄어든다
      // (그 필터는 진짜 판정이 보는 집합이라, 조용히 좁아지면 404를 통째로 못 본다).
      expect(r.stdout, '판정이 보는 요청 집합이 달라졌다').toContain(`요청 ${HEALTHY_REQUESTS}건`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('#root가 빈 채로 뜨면 rc=1 — DOM 판정 세 갈래가 전부 말한다', () => {
    // 번들은 다 받았는데 첫 프레임이 안 그려진 상태. 파일·문자열 검사는 전부 초록이다.
    //
    // **세 진단을 다 요구한다.** rc만 보면 갈래 하나가 죽어도 나머지가 rc=1을 내서
    // 통과한다(실측 — 글자 하한 `< 20`을 `< 0`으로, 버튼 검사를 `< 0`으로 바꿔도
    // 5개 전원 초록이었다). 각 갈래에 음성 대조군을 따로 두는 대신 메시지로 잠근다.
    const dir = fakeDist('boot-blank-', '/* 아무것도 안 그린다 */');
    try {
      const r = run(dir);
      expect(r.status, `빈 화면을 통과시켰다 — DOM 판정이 죽었다\n${r.stdout}`).toBe(1);
      for (const [갈래, 조각] of [
        ['자식 수', '#root가 비어 있다'],
        ['글자 길이', '보이는 글자가'],
        ['조작 가능성', '버튼이 하나도 없다'],
      ] as const) {
        expect(r.stdout, `${갈래} 갈래가 말이 없다 — 그 검사가 죽었다\n${r.stdout}`).toContain(조각);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('<title>이 다르면 rc=1', () => {
    // index.html이 안 실렸거나 빌드가 덮은 상태. 화면 자체는 멀쩡히 그려지므로
    // 위 빈 화면 케이스로는 원리상 못 잡는다.
    const dir = fakeDist('boot-title-', HEALTHY_BODY, { title: '__다른 제목__' });
    try {
      const r = run(dir);
      expect(r.status, `제목이 바뀐 것을 통과시켰다\n${r.stdout}`).toBe(1);
      expect(r.stdout, '무엇이 달랐는지 말해야 한다').toContain('__다른 제목__');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('부팅 중 예외가 나면 rc=1', () => {
    const dir = fakeDist('boot-throw-', `throw new Error('__synthetic_boot_failure__');`);
    try {
      const r = run(dir);
      expect(r.status, `예외를 통과시켰다\n${r.stdout}`).toBe(1);
      expect(r.stdout, '어떤 예외인지 말해야 한다').toContain('__synthetic_boot_failure__');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('산출물에 없는 것을 요청하면 rc=1 — 서버 404 채널 단독 (base 어긋남·webp 누락 계열)', () => {
    // 화면은 멀쩡히 그려지는데 자산 하나가 없는 상태 — 정적 검사가 가장 못 보는 모양이다.
    //
    // **`<img>`를 쓰는 이유가 있다.** `<link rel=stylesheet>`로 하면 요청 실패 채널에도
    // 같은 URL이 실려(`net::ERR_ABORTED`) 두 채널이 서로를 가린다. img 404는 요청 실패를
    // 안 내고, 딸려 나오는 콘솔 메시지엔 URL이 없다(`Failed to load resource: …404`).
    // 그래서 이 검사는 **서버 404 판정 하나만** 잠근다.
    const dir = fakeDist('boot-404-', HEALTHY_BODY,
      { bodyHtml: `<img src="assets/__absent__.webp">` });
    try {
      const r = run(dir);
      expect(r.status, `404를 통과시켰다 — 404 판정이 죽었다\n${r.stdout}`).toBe(1);
      expect(r.stdout, '서버 404 판정이 말해야 한다').toContain('산출물에 없는 것을 런타임이 요청한다');
      expect(r.stdout, '어느 자산인지 말해야 한다').toContain('__absent__.webp');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('콘솔 에러만 나도 rc=1 — 콘솔 채널 단독', () => {
    // 화면도 멀쩡하고 404도 없다. 콘솔 판정이 죽으면 이것만 통째로 사라진다.
    const dir = fakeDist('boot-console-', `${HEALTHY_BODY} console.error('__console_only__');`);
    try {
      const r = run(dir);
      expect(r.status, `콘솔 에러를 통과시켰다 — 콘솔 판정이 죽었다\n${r.stdout}`).toBe(1);
      expect(r.stdout, '무슨 에러인지 말해야 한다').toContain('__console_only__');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('요청이 아예 실패해도 rc=1 — 요청 실패 채널 단독', () => {
    // 우리 정적 서버에 **안 닿는** 요청이라 서버 404 채널이 원리상 안 켜진다.
    // 포트 1은 크로미움이 목록으로 막는 포트(`net::ERR_UNSAFE_PORT`)라 리스너도 DNS도
    // 필요 없고 결과가 결정적이다 — 빈 포트를 고르면 CI에서 누가 점유할 때 흔들린다.
    // 딸려 나오는 콘솔 메시지엔 URL이 없어서 이 검사는 요청 실패 판정만 잠근다.
    const dir = fakeDist('boot-reqfail-',
      `${HEALTHY_BODY} fetch('http://127.0.0.1:1/__refused__').catch(() => {});`);
    try {
      const r = run(dir);
      expect(r.status, `요청 실패를 통과시켰다 — 요청 실패 판정이 죽었다\n${r.stdout}`).toBe(1);
      expect(r.stdout, '어느 요청인지 말해야 한다').toContain('__refused__');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('base가 어긋난 경로도 rc=1 — 서버의 base 밖 가지', () => {
    // 파일은 dist에 있는데 브라우저가 **다른 URL로** 찾는 상태. 이 게이트가 잡겠다고
    // 헤더에 선언한 1급 케이스인데, 위 픽스처들은 전부 base 안쪽이라 서버의
    // `!url.startsWith(BASE)` 가지를 하나도 안 지나갔다.
    //
    // 실측: 그 가지의 `record(404)`를 `record(200)`으로 바꾸면 **rc는 1로 남고**
    // (딸려 나오는 콘솔 에러가 잡는다) stdout에서 URL만 사라진다 — rc만 보는 검사로는
    // 못 잡는다. 그래서 URL을 단언한다.
    const dir = fakeDist('boot-base-', HEALTHY_BODY,
      { bodyHtml: `<img src="/__WRONG_BASE__/images/bg.webp">` });
    try {
      const r = run(dir);
      expect(r.status, `base 밖 요청을 통과시켰다\n${r.stdout}`).toBe(1);
      expect(r.stdout, '어느 URL로 찾았는지 말해야 한다').toContain('__WRONG_BASE__');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('제품이 console.error를 삼키면 rc=1 — 자기검사의 음성 대조군', () => {
    // **자기검사가 유일하게 잠그는 실제 성질이다.** 위 콘솔 픽스처는 `console.error`를
    // *호출*할 뿐 *가로채지* 않는다 — 로거나 에러 수집기가 제품에 들어와 콘솔을 삼키면
    // 콘솔 채널 전체가 조용히 죽고 게이트는 "콘솔 에러 0건"을 계속 주장한다.
    //
    // 이 검사가 없으면 자기검사 블록을 지우고 카운터를 상수로 위조하는 2편집이
    // 살아남는다(실측: 그 상태에서 이 dist가 `✅ … 콘솔 에러·404 0건` rc=0이었다).
    const dir = fakeDist('boot-mute-', `console.error = function () {}; ${HEALTHY_BODY}`);
    try {
      const r = run(dir);
      expect(r.status, `콘솔이 삼켜진 것을 통과시켰다 — 자기검사가 죽었다\n${r.stdout}`).toBe(1);
      expect(r.stdout, '자기검사가 말해야 한다').toContain('일부러 낸 콘솔 에러를 판정이 안 담았다');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('판정보다 늦게 오는 404도 잡는다 — 관측창이 판정보다 먼저 닫히면 안 된다', () => {
    // 첫 화면이 그려진 **뒤**에 오는 자산. 게이트가 `networkidle` 직후에 판정하면 이 요청은
    // `served`엔 들어가고 problems엔 안 들어간다 — 실측으로 그랬다:
    //   `✅ … 콘솔 에러·404 0건 (요청 3건 …)` rc=0, 그런데 서버는 그중 2건에 404를 냈다.
    //
    // **대기 전략도 같이 잠근다.** `networkidle`을 `domcontentloaded`/`commit`으로 낮추면
    // 이 요청이 관측창 밖으로 나가 rc=0이 된다(합성 픽스처에 늦게 오는 자산이 하나도 없어서
    // 그 변이가 그냥 살아남았다).
    const dir = fakeDist('boot-late404-',
      `${HEALTHY_BODY} setTimeout(() => { fetch('${BASE}assets/__LATE_MISSING__.webp').catch(() => {}); }, 700);`);
    try {
      const r = run(dir);
      expect(r.status, `늦게 온 404를 통과시켰다 — 판정이 관측창보다 먼저 닫혔다\n${r.stdout}`).toBe(1);
      expect(r.stdout, '어느 자산인지 말해야 한다').toContain('__LATE_MISSING__');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
