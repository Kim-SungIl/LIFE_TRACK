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
for (const r of rows) {
  const k = `${r.eventId}@${r.level}`;
  const e = byLevel.get(k) ?? { hit: 0, miss: 0 };
  if (r.hit) e.hit++; else e.miss++;
  byLevel.set(k, e);
}
const partial = [...byLevel.entries()].filter(([, v]) => v.hit > 0 && v.miss > 0).sort();
if (partial.length > 0) {
  console.warn(`\n⚠️  부분 커버 경고 (${partial.length}건 — 변형 누락 의심, 검토 권장):`);
  for (const [k, v] of partial) console.warn(`   ${k} → ${v.hit}/${v.hit + v.miss} 커버`);
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
