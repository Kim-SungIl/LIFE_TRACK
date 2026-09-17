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
import { existsSync } from 'fs';
import { resolve, relative } from 'path';
import { SCAN_ROOTS, TEXT_EXT, FLOOR_SELF_CHECKS, selfCheck, scanBuffer, listTextFiles }
  from '../../../scripts/verify/verify-source-hygiene';

const ROOT = resolve(import.meta.dirname, '../../..');

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

  it('루트마다 하한이 있다 (전역 합계 하나로는 한 루트의 소멸이 안 보인다)', () => {
    // src가 235개라 전역 하한 100짜리 하나만 두면 scripts가 통째로 빠져도 통과한다(실측).
    for (const r of SCAN_ROOTS) {
      expect(r.floor, `${relative(ROOT, r.dir) || '(루트)'}에 하한이 없다`).toBeGreaterThan(0);
      const n = listTextFiles(r.dir, [], r.recurse).length;
      expect(n, `${relative(ROOT, r.dir) || '(루트)'}가 하한 아래다`).toBeGreaterThanOrEqual(r.floor);
    }
  });
});

describe('텍스트로 취급하는 확장자가 줄어들지 않는다', () => {
  // `.mjs`가 처음에 빠져 있었다 — scripts/에 6개가 살고 있어 그 파일들은 무검사였다.
  const REQUIRED_EXT = ['ts', 'tsx', 'js', 'mjs', 'cjs', 'jsx', 'css', 'json', 'md', 'html'];

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
  it(`selfCheck가 ${FLOOR_SELF_CHECKS}종 이상을 실제로 돈다`, () => {
    expect(selfCheck(),
      '이 수가 하한 아래로 내려가면 스크립트가 rc=1로 죽는다 — 여기서 먼저 알려 준다')
      .toBeGreaterThanOrEqual(FLOOR_SELF_CHECKS);
  });

  it('스캐너가 살아 있다 (양성·음성 짝)', () => {
    expect(scanBuffer(Buffer.from('a\u0000b', 'utf8')).length, 'NUL을 못 잡으면 게이트가 죽은 것이다')
      .toBeGreaterThan(0);
    expect(scanBuffer(Buffer.from('안녕\t줄\n바꿈\r\n', 'utf8')),
      '탭·개행·CR을 거부하면 모든 파일이 걸린다').toEqual([]);
  });
});
