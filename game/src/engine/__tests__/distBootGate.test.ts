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
// 그래서 합성 dist 세 벌에 대고 스크립트를 **실제로 돌려** rc를 본다.
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

/**
 * 합성 dist 한 벌. `body`가 페이지의 `<script>` 본문이 된다.
 *
 * `mkdtemp` 이후를 try로 감싼다 — 안 그러면 여기서 예외가 날 때 호출부의 `finally`에
 * 진입하기 전이라 임시 디렉터리가 남는다.
 */
function fakeDist(prefix: string, body: string, opts: { head?: string; title?: string } = {}): string {
  // macOS의 `/tmp`는 링크라 realpath로 받는다. 스크립트가 경로를 resolve해 쓴다.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  try {
    mkdirSync(join(dir, 'assets'), { recursive: true });
    writeFileSync(join(dir, 'index.html'),
      `<!doctype html><html lang="ko"><head><meta charset="utf-8">` +
      `<title>${opts.title ?? TITLE}</title>${opts.head ?? ''}</head>` +
      `<body><div id="root"></div><script type="module">${body}</script></body></html>\n`,
      'utf8');
    return dir;
  } catch (e) {
    rmSync(dir, { recursive: true, force: true });
    throw e;
  }
}

/** 첫 화면이 그려진 것처럼 보이는 본문 — 글자 20자 이상 + 버튼 1개. */
const HEALTHY_BODY =
  `document.getElementById('root').innerHTML =` +
  ` '<h1>7년의 시간표 — 새 게임을 시작합니다</h1><button>새 게임</button>';`;

function run(dist: string) {
  return spawnSync(TSX, [SCRIPT, dist], { cwd: ROOT, encoding: 'utf8', timeout: 180_000 });
}

describe('브라우저 부팅 게이트가 실제로 rc를 낸다', () => {
  it('전제: 실행기와 스크립트가 제자리에 있다', () => {
    expect(existsSync(TSX), 'tsx가 없으면 아래 검사들이 전부 공허해진다').toBe(true);
    expect(existsSync(SCRIPT)).toBe(true);
  });

  it('멀쩡한 화면은 rc=0 (음성 대조군)', () => {
    const dir = fakeDist('boot-ok-', HEALTHY_BODY);
    try {
      const r = run(dir);
      expect(r.status, `멀쩡한 화면을 거부하면 오탐이다\n${r.stdout}${r.stderr}`).toBe(0);
      expect(r.stdout).toContain('자기검사 2종 통과');
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

  it('산출물에 없는 것을 요청하면 rc=1 (base 어긋남·webp 누락 계열)', () => {
    // 화면은 멀쩡히 그려지는데 자산 하나가 없는 상태 — 정적 검사가 가장 못 보는 모양이다.
    const dir = fakeDist('boot-404-', HEALTHY_BODY,
      { head: `<link rel="stylesheet" href="assets/__absent__.css">` });
    try {
      const r = run(dir);
      expect(r.status, `404를 통과시켰다 — 404 판정이 죽었다\n${r.stdout}`).toBe(1);
      expect(r.stdout, '어느 자산인지 말해야 한다').toContain('__absent__.css');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
