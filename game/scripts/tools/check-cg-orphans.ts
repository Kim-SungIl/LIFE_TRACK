// CG 자산 정합성 점검: 0-byte / 고아 파일 / choice 누락 / gender 짝 불일치
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_EVENTS } from '../../src/engine/events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUB = path.join(__dirname, '..', '..', 'public', 'images', 'events', 'elementary');

const onDisk = fs.readdirSync(PUB).filter(f => f.endsWith('.png'));

console.log('=== 0-byte / 비정상 크기 파일 ===');
let bad = 0;
for (const f of onDisk) {
  const st = fs.statSync(path.join(PUB, f));
  if (st.size < 1000) { console.log(`  ⚠ ${f}: ${st.size} bytes`); bad++; }
}
if (bad === 0) console.log('  없음');

const fileEventIds = new Set<string>();
for (const f of onDisk) {
  const m = f.match(/^(.+?)_c\d+/);
  if (m) fileEventIds.add(m[1]);
}

const validEventIds = new Set(GAME_EVENTS.map(e => e.id));

console.log('\n=== 고아 이미지 (events.ts에 ID 없음) ===');
const orphans = [...fileEventIds].filter(id => !validEventIds.has(id));
if (orphans.length === 0) console.log('  없음');
else orphans.forEach(id => {
  const files = onDisk.filter(f => f.startsWith(id + '_c'));
  console.log(`  ${id}: ${files.length}장`);
  files.forEach(f => console.log(`    - ${f}`));
});

console.log('\n=== 이벤트별 choice 매핑 ===');
const y1Events = GAME_EVENTS.filter(e =>
  e.choices && e.choices.length > 0 &&
  fileEventIds.has(e.id)
);
for (const ev of y1Events.sort((a, b) => a.id.localeCompare(b.id))) {
  const files = onDisk.filter(f => f.startsWith(ev.id + '_c'));
  const ciSeen = new Set<number>();
  for (const f of files) {
    const m = f.match(/_c(\d+)/);
    if (m) ciSeen.add(parseInt(m[1]));
  }
  const expected = ev.choices!.length;
  const seenList = [...ciSeen].sort((a, b) => a - b);
  const missingCi: number[] = [];
  for (let i = 0; i < expected; i++) if (!ciSeen.has(i)) missingCi.push(i);
  const mark = missingCi.length === 0 ? '✓' : '⚠';
  const detail = missingCi.length > 0 ? ` ※ 누락: c${missingCi.join(',c')}` : '';
  console.log(`  ${mark} ${ev.id}: code ${expected} / disk [c${seenList.join(',c')}]${detail}`);
}

console.log('\n=== gender 짝 불일치 ===');
const grouped = new Map<string, Set<string>>();
for (const f of onDisk) {
  const m = f.match(/^(.+?_c\d+)(?:_(f|m))?\.png$/);
  if (!m) continue;
  const key = m[1];
  const variant = m[2] ?? 'none';
  if (!grouped.has(key)) grouped.set(key, new Set());
  grouped.get(key)!.add(variant);
}
let issues = 0;
for (const [key, variants] of [...grouped.entries()].sort()) {
  const vs = [...variants].sort();
  if (vs.includes('none') && (vs.includes('f') || vs.includes('m'))) {
    console.log(`  ⚠ ${key}: ${vs.join(', ')} (gender-less + gendered 혼재)`);
    issues++;
  } else if ((vs.includes('f') && !vs.includes('m')) || (vs.includes('m') && !vs.includes('f'))) {
    if (!vs.includes('none')) {
      console.log(`  ⚠ ${key}: ${vs.join(', ')} (한쪽 성별만)`);
      issues++;
    }
  }
}
if (issues === 0) console.log('  없음');
