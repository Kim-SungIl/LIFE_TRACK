// 브라우저 E2E 게이트가 **자기 종료 경로를 내는가**. (`verify-dist-e2e.ts` 후속)
//
// 그 스크립트에는 자기검사 4종이 있다 — 정상 패스 뒤 탐침(콘솔 에러·404·세이브 쓰기 차단·
// 새로고침 세이브 되돌림)을 심고 같은 판정이 그걸 말하는지 본다. 관측기·판정 갈래의 죽음은
// 그걸로 잡힌다. **그런데 자기검사는 정상 패스가 통과한 뒤에만 돈다** — 스크립트가 "정상"을
// 잘못 판정하는 쪽(단계 실패를 rc=0으로 흘리는 것)은 스스로 못 잠근다. 실제 dist는 멀쩡해서
// 음성 대조군이 없기 때문이다(`distBootGate.test.ts`와 같은 이유).
//
// 그래서 여기서는 스크립트를 **실제로 돌려** rc를 본다. 다만 E2E는 합성 dist로 "정상"을
// 만들 수 없다(제품 번들이 필요하다). 그래서 둘로 나눈다:
//   · 여기: dist가 없거나, 부팅은 되지만 게임이 아닌 페이지 → rc=1이고 **어느 단계가 왜**인지 말한다
//   · 실제 dist에 대한 통합 실행: CI build job이 `build:release` 뒤에 돌리는 `verify:dist-e2e` 스텝
//     자체가 담당한다(별도 러너의 vitest에는 dist가 없다). 그 스텝의 존재는 `verify-ci-gates.ts`가
//     `verify:dist-*` 집합에서 파생해 잠근다.
import { describe, it, expect } from 'vitest';
import { existsSync, writeFileSync, rmSync, mkdtempSync, mkdirSync, realpathSync } from 'fs';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { resolve, join } from 'path';

const ROOT = resolve(import.meta.dirname, '../../..');
const SCRIPT = resolve(ROOT, 'scripts/verify/verify-dist-e2e.ts');
const TSX = resolve(ROOT, 'node_modules/.bin/tsx');

/** 게이트가 요구하는 `<title>`. 제품과 같은 값이라 여기서도 같이 잠긴다. */
const TITLE = '7년의 시간표';

/**
 * 합성 dist 한 벌. `body`가 페이지의 외부 모듈 `<script>` 본문이 된다(실제 dist의 모양).
 * `mkdtemp` 이후를 try로 감싼다 — 예외가 나면 호출부 `finally` 전이라 임시 디렉터리가 남는다.
 */
function fakeDist(prefix: string, body: string): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  try {
    mkdirSync(join(dir, 'assets'), { recursive: true });
    writeFileSync(join(dir, 'assets/app.js'), body, 'utf8');
    writeFileSync(join(dir, 'index.html'),
      `<!doctype html><html lang="ko"><head><meta charset="utf-8">` +
      `<title>${TITLE}</title></head>` +
      `<body><div id="root"></div>` +
      `<script type="module" src="assets/app.js"></script></body></html>\n`,
      'utf8');
    return dir;
  } catch (e) {
    rmSync(dir, { recursive: true, force: true });
    throw e;
  }
}

/**
 * 스크립트 한 번의 상한. 크로미움 기동 + 엔진 import(픽스처) + 합성 페이지에서 첫 단계 실패.
 * "이어하기 없음" 케이스는 게이트의 UI 대기 상한(15초)을 그대로 먹는다 — 그게 이 케이스의 값이다
 * (실제 회귀 모양: 세이브 스키마가 어긋나 타이틀이 이어하기를 안 그리는 상태).
 * 180초는 "행이 걸렸다"를 판정하는 하드 킬이다.
 */
const SPAWN_TIMEOUT = 180_000;

function run(dist: string) {
  return spawnSync(TSX, [SCRIPT, dist], { cwd: ROOT, encoding: 'utf8', timeout: SPAWN_TIMEOUT });
}

// vitest 기본 5초는 이 파일에 맞지 않는다 — `spawnSync`는 동기라 끝난 뒤에 초과를 선고한다.
// 값은 실제 상한 SPAWN_TIMEOUT에서 파생시킨다(리터럴 둘이 따로 놀면 한쪽만 고쳐진다).
describe('브라우저 E2E 게이트가 실제로 rc를 낸다', { timeout: SPAWN_TIMEOUT + 20_000 }, () => {
  it('전제: 실행기와 스크립트가 제자리에 있다', () => {
    expect(existsSync(TSX), 'tsx가 없으면 아래 검사들이 전부 공허해진다').toBe(true);
    expect(existsSync(SCRIPT)).toBe(true);
  });

  it('dist가 없으면 rc=1 — 빈 산출물을 통과시키면 안 된다', () => {
    const absent = join(realpathSync(tmpdir()), `e2e-absent-${process.pid}-${Date.now()}`);
    expect(existsSync(absent)).toBe(false);
    const r = run(absent);
    expect(r.status, `없는 dist를 통과시켰다\n${r.stdout}${r.stderr}`).toBe(1);
    expect(r.stdout, '무엇이 없는지 말해야 한다').toContain('index.html이 없다');
  });

  it('부팅은 되지만 이어하기 라벨이 저장과 다르면 rc=1 — 첫 단계가 말한다', () => {
    // 첫 화면 게이트 기준으론 멀쩡한 페이지다(제목·글자·버튼 전부 통과). 이어하기 버튼은 있는데
    // 서브라벨이 주입한 세이브의 주와 다르다 — 타이틀이 세이브를 다른 곳에서 읽는 상태의 모양.
    const dir = fakeDist('e2e-label-',
      `document.getElementById('root').innerHTML = '<h1>7년의 시간표</h1>` +
      `<button>이어하기<span>0년차 0주차</span></button><button>새 게임</button>';`);
    try {
      const r = run(dir);
      expect(r.status, `라벨이 어긋난 이어하기를 통과시켰다\n${r.stdout}${r.stderr}`).toBe(1);
      expect(r.stdout, '어느 라벨이 어긋났는지 말해야 한다').toContain('이어하기 라벨이 저장된 주와 다르다');
      expect(r.stdout).toContain('0년차 0주차');
      // 단계표에 첫 단계 실패가 찍힌다 — 어디서 멈췄는지가 곧 진단이다.
      expect(r.stdout).toMatch(/✗ 1\. 부팅/);
      // 픽스처는 이미 만들어졌어야 한다 — 엔진 import·스토어 부팅 장면 해결이 여기서 같이 잠긴다.
      expect(r.stdout, '픽스처 생성(엔진 import → 스토어 부팅 장면 해결 → 세이브 바이트)이 죽었다').toMatch(/픽스처: 시드 \d+ · \d+B · /);
      // 자기검사는 정상 패스 뒤에만 돈다 — 빨간 판정에 탐침을 얹으면 "말했다"가 공허하다.
      expect(r.stdout).not.toContain('자기검사');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('부팅은 되지만 이어하기가 없으면 rc=1 — 세이브를 못 읽는 타이틀의 모양', () => {
    const dir = fakeDist('e2e-nocontinue-',
      `document.getElementById('root').innerHTML = '<h1>7년의 시간표 — 새 게임을 시작합니다</h1><button>새 게임</button>';`);
    try {
      const r = run(dir);
      expect(r.status, `이어하기 없는 화면을 통과시켰다\n${r.stdout}${r.stderr}`).toBe(1);
      expect(r.stdout, '세이브를 못 읽은 것을 말해야 한다').toContain('이어하기 버튼이 없다');
      expect(r.stdout).toMatch(/✗ 1\. 부팅/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
