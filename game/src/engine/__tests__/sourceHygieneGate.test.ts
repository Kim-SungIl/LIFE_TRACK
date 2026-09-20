// 소스 위생 게이트가 **자기가 무력화된 것을 아는가**. (#457 후속)
//
// 그 게이트는 "grep이 못 보는 바이트"를 막으려고 만들었는데, 정작 자기 자신이 조용히 죽었다.
// 3자 검수 실측 — `selfCheck`를 `return 0` 한 줄로 만들었을 때의 출력:
//
//   ✅ 소스 위생 — 317개 파일에 제어문자 0건 (자기검사 0종 통과)   rc=0
//
// **자기 입으로 0종이라고 말하면서 통과했다.** `scanBuffer`까지 같이 죽여도 똑같이 초록이었다.
// 그건 스크립트 안에 `FLOOR_SELF_CHECKS`를 넣어 닫았다.
//
// 그런데 그것만으로는 절반이다. **`SCAN_ROOTS`에서 항목을 통째로 지우면** 그 루트의 하한
// 검사 자체가 안 돌아서 여전히 초록이다(실측: `scripts` 항목 삭제 → 245개로 줄어도 ✅).
// 확장자도 같다 — `.mjs`를 빼면 6개 파일이 조용히 무검사가 된다.
//
// 루트별 하한은 "루트가 **줄어드는** 것"을 막고, 이 파일은 "루트가 **사라지는** 것"을 막는다.
// 스크립트 자신은 원리적으로 후자를 못 본다 — 없는 항목은 순회에 안 잡히기 때문이다.
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, writeFileSync, rmSync, mkdtempSync, mkdirSync,
  copyFileSync, realpathSync } from 'fs';
import { symlinkSync } from 'fs';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { resolve, relative, join } from 'path';
import { SCAN_ROOTS, TEXT_EXT, FLOOR_SELF_CHECKS, selfCheck, scanBuffer, listTextFiles }
  from '../../../scripts/verify/verify-source-hygiene';

const ROOT = resolve(import.meta.dirname, '../../..');

/**
 * **독립 수집기.** 스크립트의 `listTextFiles`를 쓰지 않는다.
 *
 * 처음엔 그걸 그대로 썼는데, 그러면 수집기에 선택적 블라인드를 심었을 때
 * **게이트와 스펙이 같이 눈이 먼다**(3자 검수 실측 — `listTextFiles` 첫 줄에
 * `if (dir.includes('/styles')) return out;`을 넣고 `game.css`에 NUL을 심었더니
 * 게이트 ✅ rc=0, 스펙 18개 전부 초록).
 *
 * `contrast.test.ts`의 `KNOWN_DESYNCED` 검사가 "길 잃는 그 파서로 검사해서 검사도 같이
 * 눈이 멀었던" 것과 **정확히 같은 실수**다. 검사하는 층과 검사받는 층은 달라야 한다.
 */
function independentScan(dir: string, recurse: boolean, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (recurse && e.name !== 'node_modules') independentScan(join(dir, e.name), true, out);
    } else if (/\.(ts|tsx|mts|cts|js|mjs|cjs|jsx|css|json|md|txt|html|svg)$/.test(e.name)) {
      out.push(join(dir, e.name));
    }
  }
  return out;
}

/**
 * 실제 스캔 대상의 **최대 바이트 · 최대 줄수**. 픽스처 임계를 여기서 파생시킨다.
 *
 * 리터럴로 박으면 두 가지가 같이 무너진다. 첫째, 임계 자체가 안 잠긴다 —
 * `182_000`을 `70_000`으로 낮추고 픽스처를 줄이면 읽기 절단 커버가 통째로 열렸다
 * (3자 검수 실측, 2편집). 둘째, 리포가 자라면 **조용히** 여유가 사라진다 — 실제로
 * 줄 축이 그랬다: 바이트는 +68,112 여유를 뒀는데 줄은 2,501 vs 5,313으로 **-2,812**였고,
 * `if (line > 3000) break;`를 넣어도 47개 전원 초록이었다(package-lock.json 4001번째 줄의
 * NUL이 통과). 여기서 파생시키면 리포가 자랄 때 픽스처를 키우라고 **큰 소리로** 말한다.
 */
let corpusCache: { bytes: number; lines: number } | undefined;
function corpusMax(): { bytes: number; lines: number } {
  if (corpusCache) return corpusCache;
  let bytes = 0, lines = 0;
  for (const r of SCAN_ROOTS) {
    for (const f of listTextFiles(r.dir, [], r.recurse)) {
      const b = readFileSync(f);
      bytes = Math.max(bytes, b.length);
      lines = Math.max(lines, b.toString('utf8').split('\n').length);
    }
  }
  corpusCache = { bytes, lines };
  return corpusCache;
}
/**
 * 텍스트로 봐야 하는 확장자. `.mjs`가 처음에 빠져 있었다 — scripts/에 6개가 살고 있어
 * 그 파일들은 무검사였다. 미니 리포를 채울 때도 쓴다 — 확장자 술어(`/[.](css|md|svg)$/`)를
 * 잡으려면 그런 파일이 실제로 있어야 한다.
 */
const REQUIRED_EXT = ['ts', 'tsx', 'mts', 'cts', 'js', 'mjs', 'cjs', 'jsx',
  'css', 'json', 'md', 'txt', 'html', 'svg'];

/** 미니 리포가 흉내 내는 하위 구조. 경로 술어(`f.includes('/styles/')`)를 잡으려면 필요하다. */
const SUB_DIRS = ['', 'styles', 'components', 'engine'];


describe('스캔 범위가 줄어들지 않는다', () => {
  /** 반드시 훑어야 하는 곳. 지우려면 여기서 먼저 실패한다. */
  const REQUIRED_ROOTS = ['src', 'scripts', ''] as const;   // '' = 리포 루트(설정 파일들)

  // **목록 자체가 줄어드는 것을 막는다.** `it.each([])`는 실패하지 않고 **0개를 돈다** —
  // 3자 검수 실측: `REQUIRED_EXT = []`로 바꾸면 이 파일이 34개에서 **20개**로 줄면서 rc=0,
  // `REQUIRED_ROOTS = []`는 34개 전원 통과였다. 스펙을 비우는 것이 가장 싼 우회로다.
  it('스펙 목록이 비어 있지 않다 (빈 목록은 실패가 아니라 무검사다)', () => {
    expect(REQUIRED_ROOTS.length, '루트 목록을 비우면 아래 검사가 아무것도 안 본다')
      .toBeGreaterThanOrEqual(3);
    expect(Object.keys(MIN_FLOOR).length, '하한 표를 비우면 floor가 1까지 내려간다')
      .toBeGreaterThanOrEqual(3);
    expect(ROOT_CONFIGS.length, '루트 설정 파일 목록을 비우면 루트 스캔이 무의미해진다')
      .toBeGreaterThanOrEqual(4);
  });

  it('필수 루트가 전부 SCAN_ROOTS에 있다', () => {
    const dirs = SCAN_ROOTS.map(r => relative(ROOT, r.dir));
    for (const need of REQUIRED_ROOTS) {
      expect(dirs,
        `'${need || '(루트)'}'가 빠지면 그 아래 파일은 통째로 무검사가 된다 — ` +
        `스크립트 자신은 없는 항목을 순회 못 해서 이걸 영원히 못 본다`).toContain(need);
    }
  });

  // 루트 파일이 특히 아픈 이유: 이 리포의 잠금 스택이 지키려는 바로 그 파일들이다.
  // `vite.config.ts`의 include와 `package.json`의 test 스크립트에 NUL이 박히면,
  // 그걸 문자열로 검사하는 게이트들이 파일을 통째로 못 본다.
  it('리포 루트는 재귀하지 않고 얕게 훑는다 (node_modules를 파고들지 않도록)', () => {
    const root = SCAN_ROOTS.find(r => relative(ROOT, r.dir) === '');
    expect(root?.recurse, '루트를 재귀하면 node_modules까지 들어가 몇 분씩 걸린다').toBe(false);
  });

  /** 잠금 스택이 문자열로 읽는 루트 파일들. 비우면 아래 검사가 조용히 공허해진다. */
  const ROOT_CONFIGS = ['vite.config.ts', 'package.json', 'eslint.config.js', 'index.html'];

  it('잠금 스택이 지키는 루트 설정 파일들이 실제로 스캔에 잡힌다', () => {
    const scanned = new Set(
      SCAN_ROOTS.flatMap(r => listTextFiles(r.dir, [], r.recurse)).map(f => relative(ROOT, f)),
    );
    for (const f of ROOT_CONFIGS) {
      expect(existsSync(resolve(ROOT, f)), `전제: ${f}가 리포에 있어야 한다`).toBe(true);
      expect(scanned, `${f}는 게이트들이 문자열로 읽는 파일이다`).toContain(f);
    }
  });

  // **하한과 재귀를 여기서 못 박는다.** 스크립트 혼자서는 이걸 지킬 수 없다 —
  // `floor`를 1로 낮추고 `recurse`를 false로 바꾸면 각 디렉터리 최상위만 훑으면서
  // rc=0이다(실측: 334 → **16개**로 줄어도 ✅). 하한은 스크립트가 자기 자신에 대해
  // 선언한 값이라, 그 값 자체가 줄어드는 것은 바깥에서 봐야 한다.
  const MIN_FLOOR: Record<string, number> = { src: 100, scripts: 30, '': 5 };

  it.each(Object.entries(MIN_FLOOR))('%s 루트의 하한이 %d 아래로 못 내려간다', (name, min) => {
    const r = SCAN_ROOTS.find(x => relative(ROOT, x.dir) === name);
    expect(r, `'${name || '(루트)'}' 루트가 없다`).toBeDefined();
    expect(r!.floor,
      `하한을 낮추면 그 루트가 거의 비어도 통과한다 — floor 1 + recurse false로 334개가 16개가 됐다`)
      .toBeGreaterThanOrEqual(min);
  });

  it('src·scripts는 재귀한다 (최상위만 훑으면 대부분이 무검사다)', () => {
    for (const name of ['src', 'scripts']) {
      const r = SCAN_ROOTS.find(x => relative(ROOT, x.dir) === name)!;
      expect(r.recurse, `${name}을 얕게 훑으면 하위 디렉터리 전부가 빠진다`).toBe(true);
    }
  });

  // 스크립트의 수집기를 **독립 수집기와 대조**한다. 수집기 안에 선택적 블라인드를 심으면
  // 스크립트만으로는 영원히 못 본다 — 자기가 안 본 파일은 자기 목록에도 없기 때문이다.
  it('스크립트의 수집기가 독립 수집기와 같은 집합을 낸다', () => {
    for (const r of SCAN_ROOTS) {
      const mine = new Set(independentScan(r.dir, r.recurse).map(f => relative(ROOT, f)));
      const theirs = new Set(listTextFiles(r.dir, [], r.recurse).map(f => relative(ROOT, f)));
      const missed = [...mine].filter(f => !theirs.has(f)).sort();
      expect(missed.slice(0, 10),
        `${relative(ROOT, r.dir) || '(루트)'}에서 스크립트가 ${missed.length}개를 건너뛴다 — ` +
        `수집기에 선택적 블라인드가 생기면 게이트와 이 스펙이 같이 눈이 먼다`)
        .toEqual([]);
    }
  });

  it('독립 수집기가 실제로 뭔가를 찾는다 (대조 자체가 공허해지지 않도록)', () => {
    const n = SCAN_ROOTS.reduce((a, r) => a + independentScan(r.dir, r.recurse).length, 0);
    expect(n, '독립 수집기가 0개면 위 대조는 항상 참이다').toBeGreaterThan(200);
  });
});

describe('텍스트로 취급하는 확장자가 줄어들지 않는다', () => {
  /** 과검출 음성 짝. 이것도 비우면 "에셋을 제외한다"는 조건이 사라진다. */
  const ASSET_EXT = ['png', 'woff2', 'webp', 'mp3', 'jpg'];

  it('확장자 목록이 비어 있지 않다 (it.each([])는 0개를 돈다)', () => {
    expect(REQUIRED_EXT.length, '비우면 이 describe가 통째로 사라지면서 rc=0이다')
      .toBeGreaterThanOrEqual(14);
    expect(ASSET_EXT.length, '음성 짝이 없으면 TEXT_EXT를 `/./`로 만들어도 통과한다')
      .toBeGreaterThanOrEqual(5);
  });

  it.each(REQUIRED_EXT)('.%s를 텍스트로 본다', (ext) => {
    expect(TEXT_EXT.test(`a.${ext}`),
      `.${ext} 파일은 사람이 읽는 소스다 — 빼면 그만큼이 조용히 무검사가 된다`).toBe(true);
  });

  it('에셋 확장자는 여전히 제외한다 (과검출 음성 짝)', () => {
    for (const ext of ASSET_EXT) {
      expect(TEXT_EXT.test(`a.${ext}`), `.${ext}는 당연히 제어문자를 갖는다`).toBe(false);
    }
  });

  it('실제로 .mjs 파일이 스캔에 잡힌다', () => {
    const mjs = SCAN_ROOTS
      .flatMap(r => listTextFiles(r.dir, [], r.recurse))
      .filter(f => f.endsWith('.mjs'));
    expect(mjs.length, '리포에 .mjs가 있는데 0건이면 확장자 목록이 뒤처진 것이다').toBeGreaterThan(0);
  });
});

describe('자기검사 자체가 살아 있다', () => {
  // 하한을 **여기서 독립적으로 못 박는다.** `FLOOR_SELF_CHECKS`만 보면
  // 그 상수를 0으로 낮추는 순간 스크립트도 스펙도 같이 통과한다(3자 검수 지적).
  it('FLOOR_SELF_CHECKS가 7 아래로 못 내려간다', () => {
    expect(FLOOR_SELF_CHECKS, '하한을 낮추면 selfCheck를 비워도 게이트가 초록이 된다')
      .toBeGreaterThanOrEqual(7);
  });

  it('selfCheck가 실제로 그만큼 돈다', () => {
    expect(selfCheck(), 'selfCheck를 상수 반환으로 바꾸면 아래 픽스처 검사들이 안 돈다')
      .toBeGreaterThanOrEqual(7);
  });

  // `selfCheck = () => 7`처럼 **수만 맞추고 검사를 안 하는** 변형은 위 두 개로 못 잡는다.
  // 그래서 selfCheck가 지키기로 한 불변식을 여기서 직접 태운다 — 같은 실패 모드를
  // 두 층에서 보므로, 한쪽을 상수로 바꿔도 다른 쪽이 남는다.
  it.each([
    ['NUL', 'a\u0000b'],
    ['수직탭', 'a\u000bb'],
    ['폼피드', 'a\u000cb'],
    ['DEL', 'a\u007fb'],
  ])('%s를 잡는다', (_label, src) => {
    expect(scanBuffer(Buffer.from(src, 'utf8')).length).toBeGreaterThan(0);
  });

  it.each([
    ['탭·개행·CR', 'a\tb\nc\r\nd'],
    ['한글·이모지', '안녕 🎒 — “인용”'],
  ])('%s는 거부하지 않는다', (_label, src) => {
    expect(scanBuffer(Buffer.from(src, 'utf8'))).toEqual([]);
  });

  // **탐침 하나로는 상수 절단을 다 못 막는다.** e2e 탐침은 "적어도 거기까지는 훑는다"만
  // 증명하므로, 그보다 큰 상한(64KB 등)은 그대로 빠져나간다(실측 — `Math.min(buf.length, 65536)`
  // 절단이 45개 전원 통과). 파일 입출력 없이 큰 버퍼를 직접 먹여 **상한 자체를 없앤다.**
  it('큰 버퍼의 끝까지 훑는다 (바이트·줄 상한 방지)', () => {
    // **개행을 섞고, 임계는 코퍼스에서 파생한다.** 한 줄짜리로 만들면 바이트 상한만 보고
    // 줄 축 상한은 원리상 못 본다(실측 — `if (line > 500) break;`에 전원 초록이었다).
    const body = ('a'.repeat(39) + '\n').repeat(6_000);   // 240,000바이트 · 6,001줄
    const size = Buffer.byteLength(body, 'utf8');
    const lines = body.split('\n').length;
    const max = corpusMax();

    expect(size, `픽스처가 코퍼스 최대 ${max.bytes}바이트보다 작다 — 리포가 자랐으니 키울 것`)
      .toBeGreaterThan(max.bytes);
    expect(lines, `픽스처가 코퍼스 최대 ${max.lines}줄보다 짧다 — 리포가 자랐으니 키울 것`)
      .toBeGreaterThan(max.lines);

    const hits = scanBuffer(Buffer.concat([Buffer.from(body, 'utf8'), Buffer.from([0])]));
    expect(hits.length,
      `버퍼 끝(offset ${size} · ${lines}번째 줄)의 NUL을 놓쳤다 — 순회에 상수 상한이 걸린 것이다`)
      .toBe(1);
    expect(hits[0].offset, '보고된 위치도 실제와 같아야 한다').toBe(size);
    expect(hits[0].line, '줄 번호도 끝까지 세어져야 한다').toBe(lines);
  });

  it('스캐너가 살아 있다 (양성·음성 짝)', () => {
    expect(scanBuffer(Buffer.from('a\u0000b', 'utf8')).length, 'NUL을 못 잡으면 게이트가 죽은 것이다')
      .toBeGreaterThan(0);
    expect(scanBuffer(Buffer.from('안녕\t줄\n바꿈\r\n', 'utf8')),
      '탭·개행·CR을 거부하면 모든 파일이 걸린다').toEqual([]);
  });
});

// **여기까지는 전부 `scanBuffer`라는 순수함수와 `SCAN_ROOTS`라는 데이터만 본다.**
// 그 사이의 배선 — "수집한 파일을 실제로 훑어서 rc를 낸다" — 은 아무도 안 봤다.
// 3자 검수 실측, 셋 다 rc=0에 이 파일 34개 전원 초록이었다:
//
//   files.push(...found) 삭제   → ✅ 소스 위생 — **0개 파일**에 제어문자 0건
//   hits.length > 0 → < 0       → ✅ 331개 … 0건   (심어 둔 NUL을 못 봄)
//   루트별 floor 강제 블록 삭제 → ✅ 331개 … 0건   (루트가 통째로 비어도 통과)
//
// #381(순수함수만 잠그면 기능이 아예 안 도는 상태도 그린)·#397(훅을 잠가도 App이 부르는지는
// 별개)과 같은 계열이다. 하필 이 파일이 존재하는 이유가 "조용히 무력화되는 것을 잡는다"인데.
/**
 * #457의 NUL이 실제로 있던 위치. `contrast.test.ts`의 offset 21433이었고, git의 이진
 * 휴리스틱(앞 8000바이트)이 못 봐서 평범한 텍스트 diff로 통과했다.
 *
 * **탐침은 이 지점보다 뒤에 심는다.** 8KB만 넘기면 "8000 절단"은 닫히지만
 * `Math.min(buf.length, 20000)` 절단은 그대로 통과한다(머지 후 실측 — 그 상태에서
 * 21433에 NUL을 심어도 `✅ 340개 파일에 제어문자 0건` rc=0, 스펙 44개 전원 초록).
 * 증명 범위가 **이 게이트를 만들게 한 그 사건**에 못 미치면 안 된다.
 */
const INCIDENT_OFFSET = 21433;

describe('게이트가 실제로 파일을 훑고 rc를 낸다 (배선)', () => {
  const SCRIPT = resolve(ROOT, 'scripts/verify/verify-source-hygiene.ts');
  const TSX = resolve(ROOT, 'node_modules/.bin/tsx');
  const run = (script: string) =>
    spawnSync(TSX, [script], { cwd: ROOT, encoding: 'utf8', timeout: 120_000 });

  it('전제: 실행기와 스크립트가 제자리에 있다', () => {
    expect(existsSync(TSX), 'tsx가 없으면 아래 검사들이 전부 공허해진다').toBe(true);
    expect(existsSync(SCRIPT)).toBe(true);
  });

  it('깨끗한 리포에서는 rc=0 (음성 대조군)', () => {
    const r = run(SCRIPT);
    expect(r.status, `게이트가 깨끗한 리포를 거부하면 오탐이다\n${r.stdout}`).toBe(0);
    expect(r.stdout).toContain('제어문자 0건');
  });

  // **출력이 스스로 모순돼도 아무도 안 봤다.** `files.push`를 `src`에서만 건너뛰게 하면
  // 같은 줄이 `총 92개`와 `src 239`를 동시에 말하면서 rc=0이다(실측 — 41개 전원 통과,
  // src에 NUL을 심은 양성 대조군까지 초록이었다). 총계만 보면 "0개 파일"만 걸리고
  // "한 루트만 빠진" 상태는 통과한다. 두 근거가 갈리면 라벨이 거짓말한다 — 합을 맞춘다.
  it('총계가 루트별 내역의 합과 같다', () => {
    const r = run(SCRIPT);
    const total = Number(/— (\d+)개 파일/.exec(r.stdout)?.[1]);

    // **라벨을 이름으로 박는다.** "라벨처럼 생긴 것 N개"를 세면 출력 형식이 바뀔 때
    // 엉뚱한 토큰이 자리를 메운다(3자 검수 지적 — `자기검사 9 /`가 세 번째 내역으로
    // 잡히면 합까지 맞아 조용히 통과한다). 세 루트가 **이 순서로 이름째** 찍혀야 한다.
    const seg = /\(([^)]*?) \/ 자기검사/.exec(r.stdout)?.[1];
    expect(seg, `루트별 내역 구간을 못 읽었다 — 출력 형식이 바뀌었다\n${r.stdout}`).toBeTruthy();
    const per = seg!.split(' · ').map(t => /^(\S+) (\d+)$/.exec(t));

    expect(Number.isFinite(total), `총계를 못 읽었다 — 출력 형식이 바뀌었다\n${r.stdout}`).toBe(true);
    // 라벨은 `SCAN_ROOTS`에서 **파생한다.** 상수로 박으면 루트를 정당하게 늘릴 때
    // 스캐너가 멀쩡한데 거짓 실패한다(3자 검수 지적 — `tools/` 추가 실측).
    expect(per.map(m => m?.[1]),
      `루트 라벨이 어긋났다 — 어느 루트가 내역에서 빠진 것이다\n${r.stdout}`)
      .toEqual(SCAN_ROOTS.map(x => relative(ROOT, x.dir) || '루트'));
    expect(per.reduce((a, m) => a + Number(m?.[2]), 0),
      `총계 ${total}과 루트별 합이 다르다 — 어느 루트가 수집에서 빠진 것이다\n${r.stdout}`)
      .toBe(total);
    for (const m of per) {
      expect(Number(m?.[2]), `${m?.[1]}이 비었다`).toBeGreaterThan(0);
    }
  });

  it('제어문자를 심으면 rc=1이고 그 파일을 지목한다', () => {
    // `.txt`로 심는다 — tsc·eslint가 안 보는 확장자라 다른 게이트를 흔들지 않는다.
    // 날 바이트를 쓰지 않는다: 이 파일 자체가 게이트의 스캔 범위 안이라 소스에 박으면
    // 게이트가 자기를 잡는다(#457에서 실제로 그랬다).
    const probe = resolve(ROOT, 'scripts/__hygiene-probe.tmp.txt');
    // **8KB 너머에 심는다.** 짧은 픽스처만 쓰면 `buf.length`를 `Math.min(buf.length, 8000)`으로
    // 잘라도 전부 초록이다(실측 — 41개 통과, 그 상태로 offset 21433의 NUL을 못 봤다).
    // 하필 #457의 NUL이 있던 자리가 21433이고, 이 파일 주석이 "git은 앞 8000바이트만 봐서
    // 못 잡는다"고 적어 둔 그 실패 양상이다. 게이트가 같은 모양으로 눈이 멀면 안 된다.
    const filler = '// 채움 줄 — 앞부분만 훑는 절단을 잡으려고 길이를 벌어 둔다.\n'.repeat(300);
    try {
      writeFileSync(probe, `${filler}둘째${String.fromCharCode(0)}끝\n`, 'utf8');
      const planted = Buffer.byteLength(filler, 'utf8') + Buffer.byteLength('둘째', 'utf8');
      // **상수 자체를 못 박는다.** 채움은 이 상수가 잠그는데(줄이면 전제가 터진다)
      // 정작 상수는 아무것도 안 잠갔다 — 21433을 100으로 낮춰도 46개 전원 초록이었다.
      // 둘을 같이 내리면 커버가 통째로 열린다(임계값은 양방향으로 잠글 것).
      expect(INCIDENT_OFFSET, '#457의 NUL은 offset 21433에 있었다 — 이 값을 낮추면 가드가 약해진다')
        .toBeGreaterThanOrEqual(21433);
      expect(planted,
        `전제: 탐침이 #457의 ${INCIDENT_OFFSET} 너머에 있어야 한다 — 8KB만 넘기면 ` +
        `Math.min(buf.length, 20000) 절단이 그대로 통과한다(실측: 그 상태로 ${INCIDENT_OFFSET}에 ` +
        `NUL을 심어도 게이트가 초록이었다)`)
        .toBeGreaterThan(INCIDENT_OFFSET);

      const r = run(SCRIPT);
      expect(r.status, `심어 둔 NUL을 못 봤다 — 배선이 끊겼거나 앞부분만 훑는다\n${r.stdout}`).toBe(1);
      expect(r.stdout, '어느 파일인지 말하지 않으면 진단이 무의미하다')
        .toContain('__hygiene-probe.tmp.txt');
      // 줄 번호는 **채움에서 계산한다.** 상수로 박으면 채움을 한 줄만 손봐도
      // 스캐너가 멀쩡한데 거짓 실패한다(3자 검수 지적).
      const line = filler.split('\n').length;
      expect(r.stdout, '줄 번호가 실제 위치여야 한다').toContain(`:${line}`);
      expect(Number(/offset (\d+)/.exec(r.stdout)?.[1]),
        'offset이 실제 위치여야 한다 — 8KB 안쪽으로 나오면 절단된 것이다').toBe(planted);
    } finally {
      rmSync(probe, { force: true });
    }
  });

  // 루트별 하한은 **스크립트가 강제해야** 의미가 있다. 위쪽 검사들은 `SCAN_ROOTS`의
  // 숫자만 보므로, 강제 블록을 통째로 지워도 아무 일이 없다(실측 rc=0).
  // 스크립트의 `ROOT`는 자기 파일 위치에서 파생되니, 미니 리포에 복사해 돌리면
  // 거기선 `src`가 텅 비어 하한에 걸려야 한다.
  /**
   * 스크립트만 복사한 미니 리포. 구조를 **`SCAN_ROOTS`에서 파생**하므로 루트를 늘려도
   * 따라온다. `starve`에 준 루트 하나만 하한 아래로 굶고 나머지는 `floor + 5`로 채운다.
   *
   * 예전엔 3루트·`{105,35,6}`을 하드코딩했다. 그러면 `SCAN_ROOTS`에 루트를 정당하게 더하는
   * 순간 미니 리포에 그 디렉터리가 없어 스크립트가 ENOENT로 죽고 **stdout 0바이트에 rc=1**이
   * 된다(3자 검수 실측 — 3건 거짓 실패). rc만 보는 단언은 통과하고 stdout 단언만 실패하는,
   * `package.json` 전제가 막으려던 바로 그 "엉뚱한 이유로 rc=1"이다.
   *
   * `mkdtemp` 이후를 try로 감싼다 — 감싸지 않으면 여기서 예외가 날 때 호출부의 `finally`에
   * 진입하기 전이라 임시 디렉터리가 남는다.
   */
  function miniRepo(prefix: string, starve?: string): string {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
    try {
      mkdirSync(join(dir, 'scripts/verify'), { recursive: true });
      // **`.mts`로 복사한다.** `.ts`로 두면 ESM임을 알리려고 루트에 `package.json`이
      // 필요한데, 거기엔 NUL을 심을 수 없다(tsx가 `Invalid package config`로 죽어
      // stdout 0바이트에 rc=1 — "엉뚱한 이유로 통과"가 된다). 그런데 그 파일이 하필
      // 목록 꼬리에 앉으면 **꼬리가 증명 밖이 된다**(실측 — `files.slice(0, -1)`이
      // 47개 전원 통과했다). `.mts`는 그 자체로 ESM이라 package.json이 아예 필요 없다.
      copyFileSync(SCRIPT, join(dir, 'scripts/verify/verify-source-hygiene.mts'));

      for (const r of SCAN_ROOTS) {
        const rel = relative(ROOT, r.dir);
        const at = join(dir, rel);
        mkdirSync(at, { recursive: true });
        // **실제 리포를 닮게 채운다.** `.ts`만 만들면 확장자 술어를, 평평하게 만들면
        // 경로 술어를 못 잡는다(실측 — `if (f.includes('/styles/')) continue;`와
        // `/[.](css|md|svg)$/` 둘 다 47개 전원 초록이었다. 미니 리포에 그런 모양이
        // 없으니 전수 심기도 그 가지를 안 지나간 것이다).
        if (r.recurse) for (const sub of SUB_DIRS) if (sub) mkdirSync(join(at, sub), { recursive: true });

        const have = listTextFiles(at, [], r.recurse).length;   // 위 두 파일이 여기 잡힌다
        const want = rel === starve ? 0 : r.floor + 5;
        for (let i = have; i < want; i++) {
          const ext = REQUIRED_EXT[i % REQUIRED_EXT.length];
          const sub = r.recurse ? SUB_DIRS[i % SUB_DIRS.length] : '';
          writeFileSync(join(at, sub, `f${i}.${ext}`), '내용\n', 'utf8');
        }
      }
      return dir;
    } catch (e) {
      rmSync(dir, { recursive: true, force: true });
      throw e;
    }
  }

  /** 스크립트와 **같은 순서 · 같은 recurse**로 미니 리포를 훑는다. */
  const collectLike = (dir: string) =>
    SCAN_ROOTS.flatMap(r => listTextFiles(join(dir, relative(ROOT, r.dir)), [], r.recurse));

  // 루트별 하한은 **스크립트가 강제해야** 의미가 있다. 위쪽 검사들은 `SCAN_ROOTS`의
  // 숫자만 보므로, 강제 블록을 통째로 지워도 아무 일이 없다(실측 rc=0).
  //
  // **모든 루트를 각각 굶긴다.** 하나만 굶기면 강제를 `relative(ROOT, dir) === 'src'`로
  // 좁혀도 전원 초록이다(실측 — scripts나 루트 설정 파일이 거의 비어도 조용해진다).
  it.each(SCAN_ROOTS.map(r => relative(ROOT, r.dir)))(
    '%s 루트가 하한 아래로 비면 rc=1 (floor 강제)', (rel) => {
      const label = rel || '(루트)';
      const dir = miniRepo('hygiene-floor-', rel);
      try {
        const r = run(join(dir, 'scripts/verify/verify-source-hygiene.mts'));
        expect(r.status, `${label}을 굶겼는데 통과했다 — 그 루트의 하한 강제가 없다\n${r.stdout}`).toBe(1);
        expect(r.stdout, '어느 루트가 비었는지 말해야 한다').toContain(`${label}의 스캔 대상이`);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

  // **소비 루프에 술어를 하나 끼우면 전부 조용히 빠져나갔다.** 양끝만 보던 판에서
  // `if (f.includes('/styles/')) continue;`는 47개 전원 통과였고 — 334개 중 95개가
  // 무검사가 되면서 `src/styles/game.css`의 NUL도 초록이었다 — 확장자 술어
  // (`/[.](css|md|svg)$/`)도 같았다. 하필 이 파일이 주석으로 지목한 과거 실패 모양인데
  // 방어가 **수집기 층에만** 걸려 있고 소비 루프엔 없었다.
  //
  // 그래서 양끝이 아니라 **전부**에 심고, 보고된 집합이 수집 집합과 같은지 본다.
  // 이러면 경로 술어·확장자 술어·연속 구간·off-by-one이 한꺼번에 닫힌다.
  it('수집한 파일을 하나도 빠짐없이 훑는다', () => {
    const dir = miniRepo('hygiene-all-');
    try {
      const collected = collectLike(dir);
      // 스크립트 자신만 뺀다 — NUL이 박히면 tsx가 파싱을 못 한다. 그 파일은 `scripts/`
      // 중간에 앉으므로 양끝을 가리지 않는다.
      const SKIP = ['scripts/verify/verify-source-hygiene.mts'];
      const targets = collected.filter(f => !SKIP.includes(relative(dir, f)));

      expect(collected.length, '전제: 미니 리포가 비면 이 검사가 공허하다').toBeGreaterThan(100);
      expect(collected.length - targets.length, '전제: 제외는 스크립트 자신 하나뿐이어야 한다').toBe(1);
      // **양끝이 제외 대상이면 off-by-one이 증명 밖이 된다.** 실제로 그랬다.
      expect(targets, '전제: 목록 처음이 빠지면 머리 off-by-one을 못 본다')
        .toContain(collected[0]);
      expect(targets, '전제: 목록 마지막이 빠지면 꼬리 off-by-one을 못 본다')
        .toContain(collected[collected.length - 1]);

      // **모양이 없으면 그 가지를 안 지나간다.** 전수 심기가 경로·확장자 술어를 잡으려면
      // 미니 리포에 그런 파일이 실제로 있어야 한다(실측 — `.ts`만 있던 판에선 둘 다 통과).
      const rels = targets.map(f => relative(dir, f));
      for (const ext of REQUIRED_EXT) {
        expect(rels.some(f => f.endsWith(`.${ext}`)), `전제: .${ext} 파일이 있어야 확장자 술어를 잡는다`)
          .toBe(true);
      }
      for (const sub of SUB_DIRS.filter(Boolean)) {
        expect(rels.some(f => f.includes(`/${sub}/`)), `전제: ${sub}/ 경로가 있어야 경로 술어를 잡는다`)
          .toBe(true);
      }

      for (const f of targets) writeFileSync(f, `x${String.fromCharCode(0)}\n`, 'utf8');
      const r = run(join(dir, 'scripts/verify/verify-source-hygiene.mts'));
      expect(r.status, `심어 둔 NUL을 못 봤다\n${r.stdout.slice(0, 400)}`).toBe(1);

      const reported = new Set([...r.stdout.matchAll(/^ {2}(\S+):\d+ \(offset/gm)].map(m => m[1]));
      const missed = targets.map(f => relative(dir, f)).filter(f => !reported.has(f)).sort();
      expect(missed.slice(0, 10),
        `${missed.length}개를 건너뛴다 — 소비 루프에 경로·확장자·구간 술어가 끼었다`)
        .toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // **읽기 경로의 절단은 단위 검사가 못 본다.** 200KB 버퍼 검사는 `scanBuffer` **내부**
  // 상한만 없앤다 — 호출부를 `readFileSync(f).subarray(0, 65536)`으로 바꾸면 전체 스위트가
  // 초록이다(실측). 실제 파일을 읽는 경로로 한 번 더 태운다. 임계는 코퍼스에서 파생한다.
  it('큰 파일도 끝까지 읽는다 (읽기 경로 절단)', () => {
    const dir = miniRepo('hygiene-big-');
    try {
      const body = ('a'.repeat(39) + '\n').repeat(6_000);   // 240,000바이트 · 6,001줄
      const big = join(dir, 'src', 'big.ts');
      writeFileSync(big, `${body}끝${String.fromCharCode(0)}\n`, 'utf8');

      const planted = Buffer.byteLength(body, 'utf8') + Buffer.byteLength('끝', 'utf8');
      const max = corpusMax();
      expect(planted, `탐침이 코퍼스 최대 ${max.bytes}바이트보다 앞이다 — 리포가 자랐으니 키울 것`)
        .toBeGreaterThan(max.bytes);
      expect(body.split('\n').length, `코퍼스 최대 ${max.lines}줄보다 짧다 — 키울 것`)
        .toBeGreaterThan(max.lines);

      const r = run(join(dir, 'scripts/verify/verify-source-hygiene.mts'));
      expect(r.status, `큰 파일 끝의 NUL을 못 봤다 — 읽기 경로가 잘린 것이다\n${r.stdout}`).toBe(1);
      expect(r.stdout, '어느 파일인지 말해야 한다').toContain('src/big.ts');
      expect(Number(/offset (\d+)/.exec(r.stdout)?.[1]), '보고된 위치가 실제와 같아야 한다')
        .toBe(planted);
      expect(r.stdout, '줄 번호도 끝까지 세어져야 한다')
        .toContain(`:${body.split('\n').length}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // **조용한 no-op이 통과로 읽힌다.** `import.meta.url`은 노드가 링크를 푼 경로인데
  // `process.argv[1]`은 안 푼 경로다. 링크를 거쳐 부르면 진입점 가드가 안 맞아
  // **블록 전체가 안 돌고 출력 0바이트에 rc=0**이다(실측 — 이 검사를 쓰다가 걸렸다).
  // rc만 보는 호출자는 "제어문자 0건"과 "아예 시작을 안 함"을 구별할 수 없다.
  it('심볼릭 링크 경로로 불러도 실제로 돈다', () => {
    const dir = miniRepo('hygiene-link-', 'src');
    const link = `${dir}-link`;
    try {
      symlinkSync(dir, link, 'dir');
      const r = run(join(link, 'scripts/verify/verify-source-hygiene.mts'));
      expect(r.stdout.trim().length,
        '출력이 0바이트다 — 통과한 게 아니라 시작을 안 했다').toBeGreaterThan(0);
      expect(r.status, `링크 경로에서 하한을 못 봤다\n${r.stdout}`).toBe(1);
    } finally {
      rmSync(link, { force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
