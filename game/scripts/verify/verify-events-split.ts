// P0-2 events.ts 분리 후 GAME_EVENTS 정합성 검증
// 목적:
// 1. 이벤트 수 보존 (142개 — 분리 전 baseline)
// 2. 중복 ID 없음
// 3. FOLLOWUP / DIRECT_SEQUEL / HARD_CRISIS / SOFT_CRISIS ID 셋의
//    모든 ID가 GAME_EVENTS에 존재 (orphan 없음)
// 4. ID order baseline 비교 — 최초 실행 시 baseline 생성, 이후 비교
//
// 실행: cd game && npx tsx scripts/verify/verify-events-split.ts
//
// 이벤트를 새로 추가/제거하거나 의도적으로 순서를 바꾼 경우 baseline 파일
// (scripts/verify/events-id-order.baseline.json)을 삭제 후 재실행해 갱신.

import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { GAME_EVENTS } from '../../src/engine/events';
import {
  FOLLOWUP_EVENT_IDS,
  DIRECT_SEQUEL_IDS,
  HARD_CRISIS_IDS,
  SOFT_CRISIS_IDS,
} from '../../src/engine/events/constants';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let failed = false;

// 1. 이벤트 수 (sanity)
// 분리 전후 GAME_EVENTS.length 동일 여부는 baseline 비교(섹션 4)로 확인.
// grep "id: '" 카운트는 EventChoice.addBuff.id 같은 nested id 까지 잡으므로 부정확 (false positive).
const ids = GAME_EVENTS.map(e => e.id);
console.log(`GAME_EVENTS 이벤트 수: ${ids.length}`);
if (ids.length === 0) {
  console.error('✗ GAME_EVENTS 비어있음');
  failed = true;
}

// 2. 중복 ID
const seen = new Set<string>();
const dups: string[] = [];
for (const id of ids) {
  if (seen.has(id)) dups.push(id);
  seen.add(id);
}
if (dups.length > 0) {
  console.error(`✗ 중복 ID: ${dups.join(', ')}`);
  failed = true;
} else {
  console.log('✓ 중복 ID 없음');
}

// 3. ID 셋 orphan
const allIds = new Set(ids);
const idSets: Record<string, Set<string>> = {
  FOLLOWUP_EVENT_IDS: FOLLOWUP_EVENT_IDS as Set<string>,
  DIRECT_SEQUEL_IDS,
  HARD_CRISIS_IDS,
  SOFT_CRISIS_IDS,
};
for (const [name, set] of Object.entries(idSets)) {
  const orphans: string[] = [];
  for (const id of set) {
    if (!allIds.has(id)) orphans.push(id);
  }
  if (orphans.length > 0) {
    console.error(`✗ ${name} orphan (${orphans.length}): ${orphans.join(', ')}`);
    failed = true;
  } else {
    console.log(`✓ ${name} (${set.size}개) 모두 GAME_EVENTS에 존재`);
  }
}

// 4. ID order baseline 비교 — 최초 실행 시 baseline 생성, 이후 비교
const baselinePath = path.join(__dirname, 'events-id-order.baseline.json');
if (fs.existsSync(baselinePath)) {
  const baseline: string[] = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
  if (baseline.length === ids.length && baseline.every((id, i) => ids[i] === id)) {
    console.log(`✓ ID order baseline 일치 (${baseline.length}개)`);
  } else {
    const firstDiffIdx = ids.findIndex((id, i) => baseline[i] !== id);
    console.error(`✗ ID order baseline 불일치 (첫 차이: idx ${firstDiffIdx})`);
    if (firstDiffIdx >= 0) {
      console.error(`  baseline: ${baseline[firstDiffIdx]}`);
      console.error(`  현재:     ${ids[firstDiffIdx]}`);
    }
    failed = true;
  }
} else {
  fs.writeFileSync(baselinePath, JSON.stringify(ids, null, 2) + '\n');
  console.log(`(baseline 신규 생성: scripts/verify/events-id-order.baseline.json)`);
}

if (failed) {
  process.exit(1);
}
console.log('\n모든 검증 통과.');
