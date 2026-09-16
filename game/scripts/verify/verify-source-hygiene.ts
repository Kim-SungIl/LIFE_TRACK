// verify-source-hygiene.ts — 소스에 **grep이 못 보는 바이트**가 들어오지 못하게 한다
//
// 왜 필요한가: `contrast.test.ts:438`에 NUL(U+0000) 한 바이트가 커밋된 채 머지 직전까지 갔다
// (3자 검수에서 발견). 기능은 멀쩡했고 vitest·tsc·eslint 전부 초록이었다. 문제는 다른 층이다 —
//
//   $ rg -n "reachablePairs" game/src/styles/__tests__/contrast.test.ts
//   binary file matches (found "\0" byte around offset 21433)
//
// **줄이 한 줄도 안 나온다.** 이 리포의 검증 절반은 소스를 텍스트로 훑는다(verify-*.ts 다수,
// 그리고 사람과 검수 에이전트의 grep). NUL이 박힌 파일은 그 전부에서 통째로 사라진다.
// 실제로 검수자 하나가 "이 파일이 없다 / 게이트가 안 돈다"고 잘못된 HIGH를 냈고, 다른 하나는
// 자기 검수 중에 같은 데 걸렸다. **탐지기를 무력화하는 데 한 바이트면 충분하다.**
//
// git도 못 잡는다: 이진 판정 휴리스틱은 앞 8000바이트만 보는데 이 NUL은 21433에 있어
// `git diff`가 평범한 텍스트 diff로 보여 줬다. 리뷰에서 눈에 띌 길이 없었다.
//
// 허용: 탭(0x09) · 개행(0x0A) · 캐리지리턴(0x0D). 나머지 C0 제어문자와 DEL(0x7F)은 거부한다.
//
// **이 파일의 픽스처는 이스케이프로만 쓴다.** 날 바이트를 넣으면 게이트가 자기 자신을 잡는다.
//
// 실행: cd game && npx tsx scripts/verify/verify-source-hygiene.ts

import { readdirSync, readFileSync } from 'fs';
import { resolve, join, relative } from 'path';

const ROOT = resolve(import.meta.dirname, '../..');
/**
 * 스캔 대상. **`scripts/`를 빼면 안 된다** — 이 리포의 텍스트 검증기가 전부 거기 살고,
 * 정작 이 파일을 처음 썼을 때 픽스처에 날 바이트가 들어갔는데 `src/`만 훑느라 못 봤다.
 * 자기를 안 보는 게이트는 자기가 무력화된 것도 못 본다.
 */
const SCAN_ROOTS = [resolve(ROOT, 'src'), resolve(ROOT, 'scripts')];

/** 텍스트로 취급하는 확장자. 에셋(png·woff2 등)은 당연히 제어문자를 갖는다. */
const TEXT_EXT = /\.(ts|tsx|js|jsx|css|json|md|html|svg)$/;
/** 소스 트리이지만 텍스트가 아닌 것이 사는 곳. */
const SKIP_DIRS = new Set(['assets', 'node_modules']);

const ALLOWED = new Set([0x09, 0x0a, 0x0d]);
const isBad = (b: number) => (b < 0x20 && !ALLOWED.has(b)) || b === 0x7f;

export interface Hit { file: string; offset: number; line: number; byte: string }

export function scanBuffer(buf: Buffer, file = '<mem>'): Hit[] {
  const hits: Hit[] = [];
  let line = 1;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b === 0x0a) { line++; continue; }
    if (isBad(b)) hits.push({ file, offset: i, line, byte: `0x${b.toString(16)}` });
  }
  return hits;
}

export function listTextFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) listTextFiles(join(dir, e.name), out);
    } else if (TEXT_EXT.test(e.name)) {
      out.push(join(dir, e.name));
    }
  }
  return out;
}

/**
 * 합성 픽스처 자기검사.
 *
 * **이 게이트가 자기 자신이 죽은 것을 알아채는 유일한 장치다.** 코퍼스에 위반이 0건이라
 * 정상 통과와 "탐지기가 아무것도 안 보는 상태"가 출력으로 구분되지 않는다 — 스캐너를
 * 통째로 지워도 ✅가 나온다. 그래서 **찾아야 하는 것**과 **찾으면 안 되는 것**을 둘 다 태운다.
 */
export function selfCheck(): number {
  let checks = 0;
  const mustFind: [string, string][] = [
    ['NUL', 'const sig = `a\u0000b`;'],
    ['수직탭', 'a\u000bb'],
    ['폼피드', 'a\u000cb'],
    ['DEL', 'a\u007fb'],
  ];
  for (const [label, src] of mustFind) {
    checks++;
    if (scanBuffer(Buffer.from(src, 'utf8')).length === 0) {
      throw new Error(`자기검사 실패: ${label}을 못 잡는다 — 스캐너가 죽었다`);
    }
  }
  const mustPass: [string, string][] = [
    ['탭·개행·CR', 'a\tb\nc\r\nd'],
    ['한글·이모지', '안녕 🎒 — “인용”'],
  ];
  for (const [label, src] of mustPass) {
    checks++;
    const h = scanBuffer(Buffer.from(src, 'utf8'));
    if (h.length > 0) throw new Error(`자기검사 실패: ${label}을 거부한다(오탐) — ${JSON.stringify(h)}`);
  }
  // 줄 번호가 실제로 세어지는지 — 전부 1이면 진단이 무의미해진다.
  checks++;
  const multi = scanBuffer(Buffer.from('a\nb\nc\u0000', 'utf8'));
  if (multi[0]?.line !== 3) throw new Error(`자기검사 실패: 줄 번호가 ${multi[0]?.line} (3이어야 한다)`);
  return checks;
}

/** 코퍼스 하한 — 스캔 대상이 비면 집합이 공허하게 참이 된다. */
const FLOOR_FILES = 100;

if (process.argv[1] && import.meta.url === (await import('url')).pathToFileURL(process.argv[1]).href) {
  const checks = selfCheck();

  const files = SCAN_ROOTS.flatMap(d => listTextFiles(d));
  if (files.length < FLOOR_FILES) {
    console.log(`❌ 스캔 대상이 ${files.length}/${FLOOR_FILES}개 — 코퍼스가 비면 이 게이트는 아무것도 안 지킨다`);
    process.exit(1);
  }

  const hits: Hit[] = [];
  for (const f of files) hits.push(...scanBuffer(readFileSync(f), relative(ROOT, f)));

  if (hits.length > 0) {
    console.log(`❌ 소스에 제어문자 ${hits.length}건 — grep·ripgrep이 이 파일을 통째로 건너뛴다\n`);
    for (const h of hits) console.log(`  ${h.file}:${h.line} (offset ${h.offset}) ${h.byte}`);
    console.log('\n  허용: 탭(0x09) · 개행(0x0A) · CR(0x0D). 그 외 C0 제어문자와 DEL은 소스에 있을 이유가 없다.');
    process.exit(1);
  }

  console.log(`✅ 소스 위생 — ${files.length}개 파일에 제어문자 0건 (자기검사 ${checks}종 통과)`);
  process.exit(0);
}
