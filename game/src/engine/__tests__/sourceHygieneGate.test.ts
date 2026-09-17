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
import { existsSync, readdirSync } from 'fs';
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

describe('스캔 범위가 줄어들지 않는다', () => {
  /** 반드시 훑어야 하는 곳. 지우려면 여기서 먼저 실패한다. */
  const REQUIRED_ROOTS = ['src', 'scripts', ''] as const;   // '' = 리포 루트(설정 파일들)

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

  it('잠금 스택이 지키는 루트 설정 파일들이 실제로 스캔에 잡힌다', () => {
    const scanned = new Set(
      SCAN_ROOTS.flatMap(r => listTextFiles(r.dir, [], r.recurse)).map(f => relative(ROOT, f)),
    );
    for (const f of ['vite.config.ts', 'package.json', 'eslint.config.js', 'index.html']) {
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
  // `.mjs`가 처음에 빠져 있었다 — scripts/에 6개가 살고 있어 그 파일들은 무검사였다.
  const REQUIRED_EXT = ['ts', 'tsx', 'mts', 'cts', 'js', 'mjs', 'cjs', 'jsx',
    'css', 'json', 'md', 'txt', 'html', 'svg'];

  it.each(REQUIRED_EXT)('.%s를 텍스트로 본다', (ext) => {
    expect(TEXT_EXT.test(`a.${ext}`),
      `.${ext} 파일은 사람이 읽는 소스다 — 빼면 그만큼이 조용히 무검사가 된다`).toBe(true);
  });

  it('에셋 확장자는 여전히 제외한다 (과검출 음성 짝)', () => {
    for (const ext of ['png', 'woff2', 'webp', 'mp3', 'jpg']) {
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

  it('스캐너가 살아 있다 (양성·음성 짝)', () => {
    expect(scanBuffer(Buffer.from('a\u0000b', 'utf8')).length, 'NUL을 못 잡으면 게이트가 죽은 것이다')
      .toBeGreaterThan(0);
    expect(scanBuffer(Buffer.from('안녕\t줄\n바꿈\r\n', 'utf8')),
      '탭·개행·CR을 거부하면 모든 파일이 걸린다').toEqual([]);
  });
});
