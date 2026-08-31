// 이벤트 CG 자산 커버리지 검증
// 모든 이벤트의 (선택지 × 성별 × 학년대) 조합에 대해 폴백 cascade 매칭 여부 검사.
// 실행: cd game && npx tsx scripts/verify-event-cg-coverage.ts
//
// CI 게이트 정책: CG는 일부 이벤트에만 붙는 게 정상이라 "전체 미매칭"으로 실패시키면 상시 red다.
// 따라서 전량 커버리지는 정보 리포트로만 출력하고, 실패(exit 1)는 아래 두 축으로 좁힌다.
//  · 필수 CG 세트(생일 P0-B) 누락 → HARD FAIL (지정 세트라 회귀만 잡힘)
//  · 부분 커버(같은 학년대 일부 조합만 CG) → ⚠️ WARN (변형 누락 의심, 검토 권장하나 비치명)

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_EVENTS } from '../../src/engine/events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUB = path.join(__dirname, '..', '..', 'public', 'images', 'events');

type SchoolLevel = 'elementary' | 'middle' | 'high' | 'common';
const LEVELS: SchoolLevel[] = ['elementary', 'middle', 'high'];

function fileExists(p: string): boolean {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

// GameScreen.tsx의 buildCandidates와 동일한 cascade
function cascade(eventId: string, ci: number, gender: 'm' | 'f', sl: SchoolLevel): string[] {
  const dirs: SchoolLevel[] = [sl, 'common'];
  const paths: string[] = [];
  for (const dir of dirs) {
    paths.push(`${dir}/${eventId}_c${ci}_${gender}.png`);
    paths.push(`${dir}/${eventId}_${gender}.png`);
    paths.push(`${dir}/${eventId}_c${ci}.png`);
    paths.push(`${dir}/${eventId}.png`);
  }
  return paths;
}

function findFirstHit(rels: string[]): string | null {
  for (const rel of rels) {
    if (fileExists(path.join(PUB, rel))) return rel;
  }
  return null;
}

// 이벤트 → 학년대 매핑 (조건에서 추론하기 어려우니 휴리스틱)
function inferLevels(eventId: string): SchoolLevel[] {
  if (eventId.startsWith('elementary-') || eventId === 'first-week') return ['elementary'];
  if (eventId.startsWith('middle-') || eventId.startsWith('high-')) {
    return [eventId.startsWith('middle-') ? 'middle' : 'high'];
  }
  // NPC/공용 이벤트는 모든 학년대에서 발동 가능
  return LEVELS;
}

interface Row {
  eventId: string;
  ci: number;
  gender: 'm' | 'f';
  level: SchoolLevel;
  hit: string | null;
}

const rows: Row[] = [];
for (const ev of GAME_EVENTS) {
  if (!ev.choices || ev.choices.length === 0) continue;
  const levels = inferLevels(ev.id);
  for (let ci = 0; ci < ev.choices.length; ci++) {
    for (const g of ['m', 'f'] as const) {
      for (const lv of levels) {
        const hit = findFirstHit(cascade(ev.id, ci, g, lv));
        rows.push({ eventId: ev.id, ci, gender: g, level: lv, hit });
      }
    }
  }
}

const missing = rows.filter(r => r.hit === null);
const total = rows.length;
const found = total - missing.length;

console.log(`\n=== CG 커버리지 (정보 리포트) ===`);
console.log(`총 조합: ${total} / 매칭: ${found} / 미매칭: ${missing.length}`);
console.log(`(대부분의 미매칭은 CG 미지정 이벤트로 정상 — 전량 나열은 생략)`);

// === 부분 커버 경고 (비치명 WARN) ===
// 같은 학년대에서 일부 (선택지×성별) 조합만 CG가 있는 이벤트 = 변형 누락 의심.
// 의도된 부분 CG일 수 있어 빌드는 막지 않되, 작성자 검토용으로 노출한다.
const byLevel = new Map<string, { hit: number; miss: number }>();
const missByLevel = new Map<string, string[]>(); // `${eventId}@${level}` → 미커버 조합(`c{ci}_{g}`) 목록
for (const r of rows) {
  const k = `${r.eventId}@${r.level}`;
  const e = byLevel.get(k) ?? { hit: 0, miss: 0 };
  if (r.hit) { e.hit++; } else {
    e.miss++;
    const m = missByLevel.get(k) ?? [];
    m.push(`c${r.ci}_${r.gender}`);
    missByLevel.set(k, m);
  }
  byLevel.set(k, e);
}
// 의도된 부분 커버 allowlist — `${eventId}@${level}` → 예상 미커버 조합(`c{ci}_{g}`).
// 감사(2026-08) 결과 "옵트아웃/중간 분기엔 CG 미부여"라는 일관된 CG 예산 설계로 확인된 케이스.
// 키만이 아니라 *예상 미커버 조합까지 정확히 일치*할 때만 정상 처리 → allowlist 이벤트가
// 다른 형태로 회귀(에셋 유실·조합 스왑)하거나 신규 갭이 생기면 경고로 잡힌다(codex P2).
//   • 옵트아웃 분기 생략(안 함/미룸/스킵/사양엔 그릴 장면 없음)
//   • c0+c2만 그리고 중간(c1) 생략하는 2-CG 예산
//   • doyun-meet는 남/녀 라우트가 별도 id(…/…-f)라 반대 성별 조합은 상대 이벤트가 커버
const INTENDED_PARTIAL = new Map<string, string[]>([
  // 옵트아웃 분기(마지막 선택지) CG 생략
  ['school-trip-middle@middle', ['c2_f', 'c2_m']],            // c2 "좀 더 생각해볼게"(미룸)
  ['club-academy-choice-y5@high', ['c2_f', 'c2_m']],         // c2 "알아서 할게"(옵트아웃)
  ['doyun-meet-elementary@elementary', ['c0_f', 'c1_f', 'c2_f', 'c2_m']],   // 남 라우트: c2 사양 + 女는 -f가 커버
  ['doyun-meet-elementary-f@elementary', ['c0_m', 'c1_m', 'c2_f', 'c2_m']], // 女 라우트: c2 사양 + 男은 본편이 커버
  ['graduation-prep-elementary@elementary', ['c1_f', 'c1_m']], // c1 "나중에 보면 되지"(스킵)
  ['graduation-prep-high@high', ['c1_f', 'c1_m']],           // c1 "그냥 평소 옷"(간소·스킵)
  // c0+c2만, 중간(c1) 생략하는 2-CG 예산
  ['minjae-honest@middle', ['c1_f', 'c1_m']],               // c1 "집에 안 가?"(가볍게)
  ['minjae-dream@high', ['c1_f', 'c1_m']],                  // c1 "일단 가서 생각해도"(현실적 유보)
  ['junha-cook@high', ['c1_f', 'c1_m']],                    // c1 "대학은 어떻게 할 거야?"(현실적 질문)
  // c1 "말없이 방에 들어간다"(삼킴). 결과화면 c1도 의도적으로 CG 없음(이웃 3건과 같은 2-CG 예산) +
  // memorySlotDraft가 없어 회상엔 애초에 못 뜬다. 두 축 모두 의도.
  ['adolescence-clash@middle', ['c1_f', 'c1_m']],
]);

// 실제 미커버 조합이 예상과 정확히 같은가(회귀/스왑/신규 갭 감지).
function matchesIntended(k: string): boolean {
  const expected = INTENDED_PARTIAL.get(k);
  if (!expected) return false;
  const actual = [...(missByLevel.get(k) ?? [])].sort();
  const exp = [...expected].sort();
  return actual.length === exp.length && actual.every((v, i) => v === exp[i]);
}

const partialAll = [...byLevel.entries()].filter(([, v]) => v.hit > 0 && v.miss > 0).sort();
const intended = partialAll.filter(([k]) => matchesIntended(k));
const partial = partialAll.filter(([k]) => !matchesIntended(k));
if (intended.length > 0) {
  console.log(`\nℹ️  의도된 부분 커버 (${intended.length}건 — allowlist 일치, 정상): ${intended.map(([k]) => k).join(', ')}`);
}
if (partial.length > 0) {
  console.warn(`\n⚠️  부분 커버 경고 (${partial.length}건 — 신규 변형 누락/회귀 의심, 검토 권장):`);
  for (const [k, v] of partial) {
    const tag = INTENDED_PARTIAL.has(k) ? ' [allowlist와 조합 불일치 — 회귀 의심]' : '';
    console.warn(`   ${k} → ${v.hit}/${v.hit + v.miss} 커버 (미커버: ${[...(missByLevel.get(k) ?? [])].sort().join(',')})${tag}`);
  }
}

// === 필수 CG 세트 검증 (HARD FAIL 대상) ===
// 생일 이벤트(P0-B): CG가 반드시 존재해야 하는 지정 세트. 이 세트 누락 시에만 CI 실패시킨다.
// (커버리지 전량은 위 리포트로 관측 — 구조적 부분 커버로 인한 상시 red 방지)
console.log(`\n=== 필수 CG: 생일 이벤트 (P0-B) ===`);
const birthdayIds = ['minjae-birthday', 'jihun-birthday', 'subin-birthday', 'yuna-birthday'];
let bdayMissing = 0;
for (const eid of birthdayIds) {
  const ev = GAME_EVENTS.find(e => e.id === eid);
  if (!ev || !ev.choices) continue;
  for (let ci = 0; ci < ev.choices.length; ci++) {
    const text = ev.choices[ci].text;
    const hit = findFirstHit(cascade(eid, ci, 'm', 'elementary'));
    const status = hit ? `✓ ${hit}` : '✗ 미매칭';
    if (!hit) bdayMissing++;
    console.log(`  [${eid} c${ci}] "${text.slice(0, 30)}…" → ${status}`);
  }
}

console.log(`\n생일 미매칭 분기: ${bdayMissing}`);
if (bdayMissing > 0) console.error(`\n❌ 필수 CG(생일 P0-B) 누락 ${bdayMissing}건 — CI 실패 처리`);
process.exit(bdayMissing > 0 ? 1 : 0);
