// verify-dist-cg-thumbs.ts — 배포 산출물의 CG 축소본(.thumb.webp) 검증
//
// **빌드 뒤에만 돌 수 있다.** 축소본은 vite webp-gen이 GEN_WEBP=1에서만 내므로 소스에는 없다.
// verify:dist-fonts·dist-hygiene와 같은 이유로 build job의 build:release 직후에 둔다
// (content-verify job은 별도 러너라 dist가 없다).
//
// 왜 게이트가 필요한가: 앨범 격자(NpcAlbumScreen)의 <img>에는 onError 폴백이 없다.
// 축소본이 하나라도 빠지면 그 칸은 **깨진 이미지 아이콘**이 되고, 빌드는 성공한 채로 나간다.
// 원본 webp는 라이트박스가 계속 쓰므로 축소본이 원본을 대체하지 않는다 — 둘 다 있어야 한다.
//
// 실행: cd game && npm run build:release && npx tsx scripts/verify/verify-dist-cg-thumbs.ts

import { existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const DIST_EVENTS = resolve(import.meta.dirname, '../../dist/images/events');
const THUMB_SUFFIX = '.thumb.webp';
/** vite.config.ts의 CG_THUMB_WIDTH와 같아야 한다. 다르면 아래 폭 검사가 잡는다. */
const EXPECTED_WIDTH = 256;
// 커버리지 하한. 상한이 아니라 하한인 이유는 CG가 계속 늘어나기 때문이다.
// "검사 0건인데 PASS"가 실제로 재현된 실패 유형이라(#437) 줄어드는 쪽만 막는다.
const FLOOR_PAIRS = 400;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

interface Problem { kind: string; detail: string }

/** 순수 판정부 — 자기검사가 이 함수를 합성 입력으로 잠근다. */
function auditThumbs(files: readonly string[]): { problems: Problem[]; pairs: number; orphans: number } {
  const set = new Set(files);
  const problems: Problem[] = [];
  let pairs = 0, orphans = 0;

  for (const f of files) {
    if (!f.endsWith('.webp')) continue;
    if (f.endsWith(THUMB_SUFFIX)) {
      const full = f.slice(0, -THUMB_SUFFIX.length) + '.webp';
      if (!set.has(full)) { orphans++; problems.push({ kind: '고아 축소본', detail: `${f} — 짝이 되는 원본 ${full} 이 없다` }); }
      continue;
    }
    const thumb = f.slice(0, -'.webp'.length) + THUMB_SUFFIX;
    if (!set.has(thumb)) problems.push({ kind: '축소본 누락', detail: `${f} — 앨범 격자가 깨진다(폴백 없음)` });
    else pairs++;
  }
  return { problems, pairs, orphans };
}

/** problems → 종료 코드. 함수로 빼는 이유는 #437과 같다 — 실산출물이 상시 정합이라
 *  실패 경로가 한 번도 실행되지 않아서, 이 변환이 깨져도 아무도 모른다. */
function exitCodeFor(problems: readonly Problem[]): 0 | 1 {
  return problems.length === 0 ? 0 : 1;
}

// ── 자기검사 ──────────────────────────────────────────────────────────────────
// 실산출물은 상시 정합이라, 이게 없으면 판정부를 통째로 지워도 초록이다(#437과 같은 계열).
// 실패는 process.exit이 아니라 throw — 종료 줄을 지우는 뮤테이션에도 살아남는다.
const SELF_OK = ['a.webp', 'a' + THUMB_SUFFIX];
const SELF_MISSING = ['b.webp'];
const SELF_ORPHAN = ['c' + THUMB_SUFFIX];
{
  const ok = auditThumbs(SELF_OK);
  const missing = auditThumbs(SELF_MISSING);
  const orphan = auditThumbs(SELF_ORPHAN);
  const bad =
    ok.problems.length !== 0 || ok.pairs !== 1 ||
    missing.problems.length !== 1 || missing.problems[0].kind !== '축소본 누락' ||
    orphan.problems.length !== 1 || orphan.problems[0].kind !== '고아 축소본';
  if (bad) {
    throw new Error('게이트 자기검사 실패 — 합성 픽스처(정상 1 / 누락 1 / 고아 1)를 기대대로 판정하지 못했다: '
      + JSON.stringify({ ok: ok.problems.length, missing: missing.problems.map(p => p.kind), orphan: orphan.problems.map(p => p.kind) }));
  }
  if (exitCodeFor([]) !== 0 || exitCodeFor(missing.problems) !== 1) {
    throw new Error('게이트 자기검사 실패 — 문제를 찾고도 종료 코드가 0이다(실패가 CI에 전달되지 않는다).');
  }
}

// ── 실행 ──────────────────────────────────────────────────────────────────────
console.log('배포 CG 축소본 검증 — dist/images/events');
if (!existsSync(DIST_EVENTS)) {
  console.log(`\n❌ FAIL — ${DIST_EVENTS} 가 없다. build:release 를 먼저 돌릴 것.`);
  process.exit(1);
}

const files = walk(DIST_EVENTS);
const { problems, pairs, orphans } = auditThumbs(files);
const thumbs = files.filter(f => f.endsWith(THUMB_SUFFIX));

// 축소본이 실제로 작아졌는가 — 이름만 맞고 원본을 복사한 경우를 잡는다.
let thumbBytes = 0, fullBytes = 0;
for (const t of thumbs) {
  thumbBytes += statSync(t).size;
  const full = t.slice(0, -THUMB_SUFFIX.length) + '.webp';
  if (existsSync(full)) fullBytes += statSync(full).size;
}
const ratio = fullBytes > 0 ? thumbBytes / fullBytes : 1;

console.log(`  원본 webp ↔ 축소본 짝 ${pairs}쌍 / 고아 축소본 ${orphans}개`);
console.log(`  축소본 합계 ${(thumbBytes / 1048576).toFixed(2)}MB (원본 ${(fullBytes / 1048576).toFixed(1)}MB 대비 ${(ratio * 100).toFixed(1)}%)`
  + ` · 평균 ${(thumbBytes / Math.max(1, thumbs.length) / 1024).toFixed(1)}KB`);
console.log(`  자기검사 통과 — 합성 결함 2종(누락·고아)을 잡음`);

if (pairs < FLOOR_PAIRS) {
  throw new Error(`커버리지 하한 미달 — 짝 ${pairs}/${FLOOR_PAIRS}쌍. 축소본 생성이 줄었거나 검사 범위가 좁아졌다.`);
}
// 너비 256이면 1440 대비 면적이 3.2%다. 20%를 넘으면 리사이즈가 안 걸린 것으로 본다.
if (ratio > 0.20) {
  throw new Error(`축소본이 원본 대비 ${(ratio * 100).toFixed(1)}% — 리사이즈가 실제로 안 걸렸을 수 있다(기대 5% 안팎, 너비 ${EXPECTED_WIDTH}).`);
}

if (problems.length === 0) {
  console.log(`\n✅ PASS — 축소본 결손 0건`);
} else {
  console.log(`\n❌ FAIL — ${problems.length}건`);
  for (const p of problems.slice(0, 20)) console.log(`  [${p.kind}] ${p.detail}`);
  if (problems.length > 20) console.log(`  … 외 ${problems.length - 20}건`);
}
// 자기검사가 닿지 못하는 유일한 줄 — 여기를 process.exit(0)으로 하드코딩하면 막을 방법이 없다.
process.exit(exitCodeFor(problems));
