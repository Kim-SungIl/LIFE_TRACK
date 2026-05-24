// P0-2 events.ts 분리 후 카탈로그 정합성 검증
// 검증 대상:
//   - GAME_EVENTS (메인 카탈로그, 123 events)
//   - SCHOOL_LIFE_EVENTS (학교 랜덤 풀, 17 events) — selection 로직에서만 쓰는
//     별개 풀이지만 state.events 히스토리에 들어가므로 GAME_EVENTS 와 ID 충돌
//     검증이 필요 (P0-2-fix-B, 코덱스/커서 리뷰 지적)
//
// 목적:
//   1. 두 카탈로그의 자체 중복 ID 없음 + 상호 ID 충돌 없음
//   2. FOLLOWUP / DIRECT_SEQUEL / HARD_CRISIS / SOFT_CRISIS ID 셋의
//      모든 ID 가 GAME_EVENTS 에 존재 (orphan 없음)
//   3. ID order baseline 비교 — 최초 실행 시 baseline 생성, 이후 회귀 감지
//
// 실행:
//   cd game && npx tsx scripts/verify/verify-events-split.ts
//   또는 npm run verify:events
//
// 이벤트를 새로 추가/제거하거나 의도적으로 순서를 바꾼 경우 baseline 파일
// (scripts/verify/events-id-order.baseline.json) 을 삭제 후 재실행해 갱신.

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
import { SCHOOL_LIFE_EVENTS } from '../../src/engine/events/school-life';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let failed = false;

// 1. 카탈로그 sanity — 비어있지 않은지
const gameIds = GAME_EVENTS.map(e => e.id);
const schoolLifeIds = SCHOOL_LIFE_EVENTS.map(e => e.id);
console.log(`GAME_EVENTS: ${gameIds.length}개`);
console.log(`SCHOOL_LIFE_EVENTS: ${schoolLifeIds.length}개`);
console.log(`총 GameEvent 정의: ${gameIds.length + schoolLifeIds.length}개`);
if (gameIds.length === 0 || schoolLifeIds.length === 0) {
  console.error('✗ 카탈로그 중 하나가 비어있음');
  failed = true;
}

// 2. 자체 중복 ID 없음 (각 카탈로그 내부)
function findDuplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dups: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) dups.push(id);
    seen.add(id);
  }
  return dups;
}
const gameDups = findDuplicates(gameIds);
const schoolLifeDups = findDuplicates(schoolLifeIds);
if (gameDups.length > 0) {
  console.error(`✗ GAME_EVENTS 중복 ID: ${gameDups.join(', ')}`);
  failed = true;
} else {
  console.log('✓ GAME_EVENTS 자체 중복 없음');
}
if (schoolLifeDups.length > 0) {
  console.error(`✗ SCHOOL_LIFE_EVENTS 중복 ID: ${schoolLifeDups.join(', ')}`);
  failed = true;
} else {
  console.log('✓ SCHOOL_LIFE_EVENTS 자체 중복 없음');
}

// 3. 상호 ID 충돌 없음 (GAME_EVENTS ∩ SCHOOL_LIFE_EVENTS = ∅)
// 둘 다 state.events 히스토리에 들어가므로 같은 ID 면 추적 불가능해짐.
const gameIdSet = new Set(gameIds);
const crossOverlaps = schoolLifeIds.filter(id => gameIdSet.has(id));
if (crossOverlaps.length > 0) {
  console.error(`✗ GAME_EVENTS ↔ SCHOOL_LIFE_EVENTS ID 충돌 (${crossOverlaps.length}): ${crossOverlaps.join(', ')}`);
  failed = true;
} else {
  console.log('✓ GAME_EVENTS ↔ SCHOOL_LIFE_EVENTS ID 충돌 없음');
}

// 4. ID 셋 orphan — 모든 ID 가 GAME_EVENTS 에 존재
const idSets: Record<string, Set<string>> = {
  FOLLOWUP_EVENT_IDS: FOLLOWUP_EVENT_IDS as Set<string>,
  DIRECT_SEQUEL_IDS,
  HARD_CRISIS_IDS,
  SOFT_CRISIS_IDS,
};
for (const [name, set] of Object.entries(idSets)) {
  const orphans: string[] = [];
  for (const id of set) {
    if (!gameIdSet.has(id)) orphans.push(id);
  }
  if (orphans.length > 0) {
    console.error(`✗ ${name} orphan (${orphans.length}): ${orphans.join(', ')}`);
    failed = true;
  } else {
    console.log(`✓ ${name} (${set.size}개) 모두 GAME_EVENTS에 존재`);
  }
}

// 5. ID order baseline 비교 — 최초 실행 시 baseline 생성, 이후 회귀 감지
// baseline 은 GAME_EVENTS + SCHOOL_LIFE_EVENTS 의 ID 순서를 모두 포함.
const baselinePath = path.join(__dirname, 'events-id-order.baseline.json');
const currentBaseline = {
  GAME_EVENTS: gameIds,
  SCHOOL_LIFE_EVENTS: schoolLifeIds,
};
if (fs.existsSync(baselinePath)) {
  const raw = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
  // 구버전 baseline(배열) 호환 — GAME_EVENTS 만 비교, SCHOOL_LIFE_EVENTS 는 갱신 권장
  const baseline = Array.isArray(raw) ? { GAME_EVENTS: raw, SCHOOL_LIFE_EVENTS: null } : raw;
  let baseFailed = false;
  for (const key of ['GAME_EVENTS', 'SCHOOL_LIFE_EVENTS'] as const) {
    const cur = currentBaseline[key];
    const base = (baseline as Record<string, string[] | null>)[key];
    if (base === null) {
      console.log(`(${key} baseline 누락 — 갱신 위해 baseline 삭제 후 재실행 권장)`);
      continue;
    }
    if (base.length === cur.length && base.every((id, i) => cur[i] === id)) {
      console.log(`✓ ${key} ID order baseline 일치 (${base.length}개)`);
    } else {
      const firstDiffIdx = cur.findIndex((id, i) => base[i] !== id);
      console.error(`✗ ${key} ID order baseline 불일치 (첫 차이: idx ${firstDiffIdx})`);
      if (firstDiffIdx >= 0) {
        console.error(`  baseline: ${base[firstDiffIdx]}`);
        console.error(`  현재:     ${cur[firstDiffIdx]}`);
      }
      baseFailed = true;
    }
  }
  if (baseFailed) failed = true;
} else {
  fs.writeFileSync(baselinePath, JSON.stringify(currentBaseline, null, 2) + '\n');
  console.log(`(baseline 신규 생성: scripts/verify/events-id-order.baseline.json)`);
}

if (failed) {
  process.exit(1);
}
console.log('\n모든 검증 통과.');
