// 이벤트 CG 자산 커버리지 검증
// 모든 이벤트의 (선택지 × 성별 × 학년대) 조합에 대해 폴백 cascade 매칭 여부 검사.
// 실행: cd game && npx tsx scripts/verify-event-cg-coverage.ts

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_EVENTS } from '../src/engine/events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUB = path.join(__dirname, '..', 'public', 'images', 'events');

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

console.log(`\n=== CG 커버리지 ===`);
console.log(`총 조합: ${total} / 매칭: ${found} / 미매칭: ${missing.length}`);

if (missing.length > 0) {
  // 이벤트 ID별로 그룹핑하여 가독성 향상
  const byEvent = new Map<string, Row[]>();
  for (const r of missing) {
    const k = `${r.eventId}@${r.level}`;
    if (!byEvent.has(k)) byEvent.set(k, []);
    byEvent.get(k)!.push(r);
  }
  console.log(`\n=== 미매칭 이벤트 (${byEvent.size}건) ===`);
  for (const [k, rs] of [...byEvent.entries()].sort()) {
    const cis = rs.map(r => `c${r.ci}_${r.gender}`).join(', ');
    console.log(`  ${k} → ${cis}`);
  }
}

// 생일 이벤트 핵심 검증
console.log(`\n=== 생일 이벤트 (P0-B 추적) ===`);
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
process.exit(missing.length > 0 ? 1 : 0);
