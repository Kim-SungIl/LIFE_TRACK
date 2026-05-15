/**
 * Phase 2.2: 친밀도 50 단계 미니 이벤트 시드 6개 검증
 *
 * 검증 항목:
 *  1. 6개 시드가 NPC_MINI_EVENTS에 모두 존재
 *  2. 각 시드: intimacyMin === 50, intimacy effect === +3 (가이드라인)
 *  3. 친밀도 50 도달 시 getAvailableNpcEvents에 포함
 *  4. 친밀도 49 (미달) 시 후보 풀에서 제외
 *  5. talkEventsFired에 기록 후 후보 풀에서 제외 (1회 발동 보장)
 *  6. 30 단계 시드와 50 단계 시드 둘 다 만족 시 둘 다 가용 (intimacy 50 = 30/50 동시)
 *  7. gender 필터 없음 — 남/여 모두 발동 가능
 *
 * 실행: npx tsx scripts/verify-tier50-mini-events.ts
 */

import { NPC_MINI_EVENTS, getAvailableNpcEvents } from '../../src/engine/talkSystem';
import { createInitialState } from '../../src/engine/gameEngine';
import type { GameState } from '../../src/engine/types';

const TIER50_SEEDS: Array<{ id: string; npcId: string }> = [
  { id: 'talk_jihun_50_topping', npcId: 'jihun' },
  { id: 'talk_subin_50_sentence', npcId: 'subin' },
  { id: 'talk_minjae_50_wrong_answer_mark', npcId: 'minjae' },
  { id: 'talk_yuna_50_humming', npcId: 'yuna' },
  { id: 'talk_haeun_50_window', npcId: 'haeun' },
  { id: 'talk_junha_50_seabreeze', npcId: 'junha' },
];

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${label}`);
    passed += 1;
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

function withIntimacy(state: GameState, npcId: string, intimacy: number): GameState {
  const clone = JSON.parse(JSON.stringify(state)) as GameState;
  const npc = clone.npcs.find(n => n.id === npcId);
  if (npc) {
    npc.intimacy = intimacy;
    npc.met = true;
  }
  return clone;
}

function withFired(state: GameState, ids: string[]): GameState {
  return { ...state, talkEventsFired: [...state.talkEventsFired, ...ids] };
}

console.log('=== Phase 2.2 친밀도 50 단계 미니 이벤트 검증 ===\n');

// === 1. 6개 시드 존재 ===
console.log('=== 1. 시드 6개 존재 ===');
for (const spec of TIER50_SEEDS) {
  const seed = NPC_MINI_EVENTS.find(e => e.id === spec.id);
  check(`${spec.id} 존재`, !!seed);
}

// === 2. intimacyMin/intimacy 효과 가이드라인 ===
console.log('\n=== 2. 가이드라인: intimacyMin=50, intimacy=+3 ===');
for (const spec of TIER50_SEEDS) {
  const seed = NPC_MINI_EVENTS.find(e => e.id === spec.id);
  if (!seed) continue;
  check(`${spec.id}.intimacyMin === 50`, seed.intimacyMin === 50, `actual=${seed.intimacyMin}`);
  check(`${spec.id}.effects.intimacy === 3`, seed.effects.intimacy === 3, `actual=${seed.effects.intimacy}`);
  check(`${spec.id}.npcId === ${spec.npcId}`, seed.npcId === spec.npcId, `actual=${seed.npcId}`);
}

// === 3. 친밀도 50 도달 시 후보 풀에 포함 ===
console.log('\n=== 3. 친밀도 50 도달 — 후보 풀 진입 ===');
const baseM = createInitialState('male', ['emotional', 'strict']);
const baseF = createInitialState('female', ['emotional', 'strict']);
for (const spec of TIER50_SEEDS) {
  // 두 성별 모두에서 발동되어야 함 (gender 필터 없음)
  for (const [genderLabel, base] of [['남', baseM], ['여', baseF]] as const) {
    const s = withIntimacy(base, spec.npcId, 50);
    const available = getAvailableNpcEvents(s, spec.npcId);
    const found = available.find(e => e.id === spec.id);
    check(`${spec.id} (${genderLabel}) 친밀도 50에 가용`, !!found);
  }
}

// === 4. 친밀도 49 미달 시 후보 풀 제외 ===
console.log('\n=== 4. 친밀도 49 (미달) — 후보 풀 제외 ===');
for (const spec of TIER50_SEEDS) {
  const s = withIntimacy(baseM, spec.npcId, 49);
  const available = getAvailableNpcEvents(s, spec.npcId);
  const found = available.find(e => e.id === spec.id);
  check(`${spec.id} 친밀도 49엔 미가용`, !found);
}

// === 5. talkEventsFired 기록 후 풀 제외 ===
console.log('\n=== 5. fired 기록 후 — 후보 풀에서 영구 제외 ===');
for (const spec of TIER50_SEEDS) {
  const s = withFired(withIntimacy(baseM, spec.npcId, 50), [spec.id]);
  const available = getAvailableNpcEvents(s, spec.npcId);
  const found = available.find(e => e.id === spec.id);
  check(`${spec.id} fired 후 풀 제외`, !found);
}

// === 6. 30/50 동시 가용 (intimacy 50 도달 시 둘 다 후보) ===
console.log('\n=== 6. intimacy 50 도달 — 30/50 단계 모두 후보 ===');
const TIER30_BY_NPC: Record<string, string> = {
  jihun: 'talk_jihun_basket',       // gender=male이라 남주만
  subin: 'talk_subin_problem',
  minjae: 'talk_minjae_notes',
  yuna: 'talk_yuna_song',
  haeun: 'talk_haeun_quiet',
  junha: 'talk_junha_riceball',
};
for (const spec of TIER50_SEEDS) {
  const t30id = TIER30_BY_NPC[spec.npcId];
  const s = withIntimacy(baseM, spec.npcId, 50);
  const available = getAvailableNpcEvents(s, spec.npcId);
  const has30 = available.some(e => e.id === t30id);
  const has50 = available.some(e => e.id === spec.id);
  check(`${spec.npcId}: 30 시드(${t30id}) + 50 시드 둘 다 가용`, has30 && has50);
}

// === 7. 효과 형식 유효 (음수/양수, stats 키, fatigue/money 범위) ===
console.log('\n=== 7. 효과 형식 유효성 ===');
const VALID_STATS = new Set(['academic', 'social', 'talent', 'mental', 'health']);
for (const spec of TIER50_SEEDS) {
  const seed = NPC_MINI_EVENTS.find(e => e.id === spec.id);
  if (!seed) continue;
  if (seed.effects.stats) {
    for (const key of Object.keys(seed.effects.stats)) {
      check(`${spec.id} stats.${key} 유효`, VALID_STATS.has(key), `unknown stat: ${key}`);
    }
  }
  if (typeof seed.effects.fatigue === 'number') {
    check(`${spec.id} fatigue 범위 [-3,+3]`, Math.abs(seed.effects.fatigue) <= 3, `actual=${seed.effects.fatigue}`);
  }
  if (typeof seed.effects.money === 'number') {
    check(`${spec.id} money 범위 [-2,+2]`, Math.abs(seed.effects.money) <= 2, `actual=${seed.effects.money}`);
  }
}

// === 결과 ===
console.log(`\n=== 결과: ${passed} passed / ${failed} failed ===`);
process.exit(failed === 0 ? 0 : 1);
