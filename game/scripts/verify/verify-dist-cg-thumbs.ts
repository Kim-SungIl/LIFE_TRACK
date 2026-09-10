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
// 짝만 세면 안 되는 이유(3자 검수 실측): 폭을 128·32로 바꿔 빌드해도 짝은 그대로 448이고
// 바이트 비율은 오히려 **좋아져서** 게이트가 화질 회귀에 보상했다. 0바이트 축소본도 통과했다.
// 그래서 이 게이트는 짝·비율에 더해 **모든 축소본의 실제 픽셀 폭을 디코드해서** 대조한다.
//
// 검사의 위계(뮤테이션 실측 기준):
//   1차 잠금 = **실제 폭 대조**. 0바이트·48px·전량 128px/32px·원본 복사를 전부 이걸로 잡는다.
//   백스톱   = 짝 하한(FLOOR_PAIRS)·바이트 비율 밴드(RATIO_MIN/MAX)·디렉터리 커버리지.
// 백스톱 상수를 약화하는 편집(예: RATIO_MIN을 0으로)은 자기검사를 통과한다 — 값 자체는 못 잠근다.
// 다만 그 경우에도 1차 잠금이 남으므로 실제 구멍은 열리지 않는다. 반대로 **분기를 지우는**
// 편집은 임계 자기검사가 전부 잡는다(11종 실측). 남은 사각은 마지막 종료 줄 하나뿐이다.
//
// 실행: cd game && npm run build:release && npx tsx scripts/verify/verify-dist-cg-thumbs.ts

import { existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import sharp from 'sharp';

const DIST_EVENTS = resolve(import.meta.dirname, '../../dist/images/events');
const THUMB_SUFFIX = '.thumb.webp';
/** vite.config.ts의 CG_THUMB_WIDTH와 같아야 한다. 축소본 전수의 실제 폭을 이 값과 대조한다. */
const EXPECTED_WIDTH = 256;
// 커버리지 하한. 상한이 아니라 하한인 이유는 CG가 계속 늘어나기 때문이다.
// "검사 0건인데 PASS"가 실제로 재현된 실패 유형이라(#437) 줄어드는 쪽만 막는다.
const FLOOR_PAIRS = 400;
// 바이트 비율의 **양쪽** 밴드. 실측은 7.7%다.
//   상한: 이름만 맞고 원본을 복사한 경우(리사이즈 미적용).
//   하한: 폭이 의도보다 작게 잡힌 경우. 상한만 두면 과축소가 지표를 "개선"시켜 게이트가
//         결함에 보상한다 — 검수에서 32w가 0.4%로 통과한 실제 사례가 있다.
const RATIO_MAX = 0.20;
const RATIO_MIN = 0.03;

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

/** 게이트가 fs에서 관측한 것 전부. Metrics(임계 판정 입력)와 달리 파일 목록을 포함한다. */
interface Observed {
  files: readonly string[];
  ratio: number;
  widths: readonly (number | null)[];
  uncoveredDirs: readonly string[];
}

interface Metrics {
  pairs: number;
  ratio: number;
  /** 축소본 전수의 실제 픽셀 폭. 디코드에 실패한 파일은 null(0바이트·손상). */
  widths: readonly (number | null)[];
  /** dist에 실재하는데 검사 corpus에는 축소본이 한 장도 없는 최상위 디렉터리. */
  uncoveredDirs: readonly string[];
}

/** 임계 판정부 — auditThumbs와 같은 이유로 순수 함수다. 실산출물이 상시 정합이라
 *  이 분기들은 한 번도 실행되지 않고, **단일 편집으로 통째로 지워도 초록이었다**(검수 실측 3건).
 *  자기검사가 임계값을 양방향으로 잠근다. */
function thresholdProblems(m: Metrics): Problem[] {
  const problems: Problem[] = [];
  const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

  if (m.pairs < FLOOR_PAIRS) {
    problems.push({ kind: '커버리지 하한 미달', detail: `짝 ${m.pairs}/${FLOOR_PAIRS}쌍 — 축소본 생성이 줄었거나 검사 범위가 좁아졌다` });
  }
  if (m.ratio > RATIO_MAX) {
    problems.push({ kind: '축소 미적용 의심', detail: `축소본이 원본 대비 ${pct(m.ratio)} (상한 ${pct(RATIO_MAX)}) — 리사이즈가 안 걸렸을 수 있다` });
  }
  if (m.ratio < RATIO_MIN) {
    problems.push({ kind: '과축소 의심', detail: `축소본이 원본 대비 ${pct(m.ratio)} (하한 ${pct(RATIO_MIN)}) — 폭이 ${EXPECTED_WIDTH}보다 작게 잡혔을 수 있다` });
  }

  const broken = m.widths.filter(w => w === null).length;
  if (broken > 0) {
    problems.push({ kind: '축소본 디코드 실패', detail: `${broken}장이 열리지 않는다(0바이트·손상) — 격자가 깨진 아이콘이 된다` });
  }
  if (m.uncoveredDirs.length > 0) {
    // 짝 수 하한만으로는 부족하다. FLOOR가 400인데 실제가 448이라 **여유 48장 안에 드는**
    // 디렉터리(_archive 4·common 14)는 walk에 필터 한 줄을 넣어 통째로 빼도 통과했다(검수 실측).
    // 그래서 디렉터리를 fs에서 독립적으로 한 번 더 세고, 0쌍인 디렉터리를 잡는다 —
    // 이름을 하드코딩하지 않으므로 CG 디렉터리가 늘어도 저절로 따라간다.
    problems.push({ kind: '검사 범위 누락', detail: `${m.uncoveredDirs.join(', ')} 에 축소본이 0장이다 — walk 필터로 제외됐거나 생성이 통째로 빠졌다` });
  }
  const wrong = m.widths.filter((w): w is number => w !== null && w !== EXPECTED_WIDTH);
  if (wrong.length > 0) {
    const seen = [...new Set(wrong)].sort((a, b) => a - b).slice(0, 5).join(', ');
    problems.push({ kind: '축소본 폭 불일치', detail: `${wrong.length}장이 ${EXPECTED_WIDTH}px가 아니다(관측 ${seen}px) — vite.config.ts의 CG_THUMB_WIDTH와 어긋났다` });
  }
  return problems;
}

/** 게이트의 **단일** 판정 입구. 짝 판정과 임계 판정을 여기서 합친다.
 *  둘을 main에서 각각 부르면 `const all = problems`처럼 한쪽만 종료 코드에 넘기는 단일 편집이
 *  통과한다(검수 실측: 폭128 양성 대조군 위에서 초록으로 샜다). 합류를 함수 안에 넣으면
 *  그 편집 지점이 아예 없어지고, 아래 자기검사가 합류 자체를 잠근다.
 *  #431·#397과 같은 "순수함수는 맞는데 배선이 없다" 계열을 구조로 막는 것이다. */
function verdict(o: Observed): { problems: Problem[]; pairs: number; orphans: number } {
  const { problems: pairProblems, pairs, orphans } = auditThumbs(o.files);
  const thresholds = thresholdProblems({ pairs, ratio: o.ratio, widths: o.widths, uncoveredDirs: o.uncoveredDirs });
  return { problems: [...pairProblems, ...thresholds], pairs, orphans };
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
{
  // 임계값 자기검사 — **양방향**이다. 경계 바로 안쪽은 통과하고 바로 바깥쪽은 잡혀야 한다.
  // 부등호를 뒤집거나 분기를 지우면 여기서 throw한다(검수에서 샌 단일 편집 3건이 이 블록의 대상).
  const OK: Metrics = { pairs: FLOOR_PAIRS, ratio: (RATIO_MIN + RATIO_MAX) / 2, widths: [EXPECTED_WIDTH, EXPECTED_WIDTH], uncoveredDirs: [] };
  const kinds = (m: Partial<Metrics>) => thresholdProblems({ ...OK, ...m }).map(p => p.kind);
  const cases: [string, Partial<Metrics>, string[]][] = [
    ['경계 안쪽(정상)', {}, []],
    ['짝 하한 미달', { pairs: FLOOR_PAIRS - 1 }, ['커버리지 하한 미달']],
    ['비율 상한 초과', { ratio: RATIO_MAX + 0.001 }, ['축소 미적용 의심']],
    ['비율 상한 경계', { ratio: RATIO_MAX }, []],
    ['비율 하한 미달', { ratio: RATIO_MIN - 0.001 }, ['과축소 의심']],
    ['비율 하한 경계', { ratio: RATIO_MIN }, []],
    ['폭 불일치', { widths: [EXPECTED_WIDTH, EXPECTED_WIDTH / 2] }, ['축소본 폭 불일치']],
    ['디코드 실패', { widths: [EXPECTED_WIDTH, null] }, ['축소본 디코드 실패']],
    ['검사 범위 누락', { uncoveredDirs: ['common'] }, ['검사 범위 누락']],
  ];
  for (const [label, patch, expected] of cases) {
    const got = kinds(patch);
    if (got.length !== expected.length || got.some((k, i) => k !== expected[i])) {
      throw new Error(`게이트 자기검사 실패 — 임계 판정 "${label}"이 ${JSON.stringify(expected)}를 기대했으나 ${JSON.stringify(got)}였다.`);
    }
  }
  // 합류 배선 — 짝 결함과 임계 결함이 **한 판정 안에서** 합쳐지는가.
  // 픽스처가 1장짜리라 짝 하한도 함께 걸린다(pairs 0 < FLOOR) — 그래서 기대는 3종이다.
  const v = verdict({ files: SELF_MISSING, ratio: OK.ratio, widths: [1], uncoveredDirs: [] });
  const mergedKinds = v.problems.map(p => p.kind).join('/');
  if (mergedKinds !== '축소본 누락/커버리지 하한 미달/축소본 폭 불일치' || exitCodeFor(v.problems) !== 1) {
    throw new Error(`게이트 자기검사 실패 — 짝 결함과 임계 결함이 합쳐지지 않았다(${mergedKinds}). 임계 판정이 종료 코드에 닿지 않는다.`);
  }
}

// ── 실행 ──────────────────────────────────────────────────────────────────────
console.log('배포 CG 축소본 검증 — dist/images/events');
if (!existsSync(DIST_EVENTS)) {
  console.log(`\n❌ FAIL — ${DIST_EVENTS} 가 없다. build:release 를 먼저 돌릴 것.`);
  process.exit(1);
}

const files = walk(DIST_EVENTS);
const thumbs = files.filter(f => f.endsWith(THUMB_SUFFIX));

// 바이트 — 이름만 맞고 원본을 복사한 경우를 잡는다.
let thumbBytes = 0, fullBytes = 0;
for (const t of thumbs) {
  thumbBytes += statSync(t).size;
  const full = t.slice(0, -THUMB_SUFFIX.length) + '.webp';
  if (existsSync(full)) fullBytes += statSync(full).size;
}
const ratio = fullBytes > 0 ? thumbBytes / fullBytes : 1;

// 실제 픽셀 폭 — 헤더만 읽으므로 448장에 150ms다. 바이트 비율로는 폭 회귀가 안 잡힌다.
const widths = await Promise.all(thumbs.map(async t => {
  try { return (await sharp(t).metadata()).width ?? null; } catch { return null; }
}));

// 디렉터리 커버리지는 walk 결과가 아니라 **fs에서 다시** 센다. 같은 corpus를 재사용하면
// corpus를 좁히는 뮤테이션이 이 검사까지 같이 좁혀서 무의미해진다.
const topDirs = readdirSync(DIST_EVENTS, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
const uncoveredDirs = topDirs.filter(d => !thumbs.some(t => t.startsWith(join(DIST_EVENTS, d) + '/')));

const { problems, pairs, orphans } = verdict({ files, ratio, widths, uncoveredDirs });
const widthHistogram = [...new Set(widths)].sort((a, b) => (a ?? -1) - (b ?? -1)).map(w => w ?? '열림실패').join(', ');

console.log(`  원본 webp ↔ 축소본 짝 ${pairs}쌍 / 고아 축소본 ${orphans}개`);
console.log(`  축소본 합계 ${(thumbBytes / 1048576).toFixed(2)}MB (원본 ${(fullBytes / 1048576).toFixed(1)}MB 대비 ${(ratio * 100).toFixed(1)}%)`
  + ` · 평균 ${(thumbBytes / Math.max(1, thumbs.length) / 1024).toFixed(1)}KB`);
console.log(`  실제 폭 ${thumbs.length}장 디코드 — 관측 폭 {${widthHistogram}} · 기대 ${EXPECTED_WIDTH}`);
console.log(`  검사 범위 — 최상위 ${topDirs.length}개 디렉터리 {${topDirs.join(', ')}} 전부 축소본 보유`);
console.log(`  자기검사 통과 — 판정부 3종(누락·고아·종료코드) + 임계 9종(짝·비율 양방향·폭·디코드·범위)`);

if (problems.length === 0) {
  console.log(`\n✅ PASS — 축소본 결손 0건`);
} else {
  console.log(`\n❌ FAIL — ${problems.length}건`);
  for (const p of problems.slice(0, 20)) console.log(`  [${p.kind}] ${p.detail}`);
  if (problems.length > 20) console.log(`  … 외 ${problems.length - 20}건`);
}
// 자기검사가 닿지 못하는 유일한 줄 — 여기를 process.exit(0)으로 하드코딩하면 막을 방법이 없다.
process.exit(exitCodeFor(problems));
