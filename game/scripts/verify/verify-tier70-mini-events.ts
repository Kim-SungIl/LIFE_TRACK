/**
 * Phase 2.3: 친밀도 70 단계 미니 이벤트 시드 6개 검증
 *
 * 검증 항목:
 *  1. 6개 시드가 NPC_MINI_EVENTS에 모두 존재
 *  2. 각 시드: intimacyMin === 70, intimacy effect === +4 (가이드라인)
 *  3. 친밀도 70 도달 시 getAvailableNpcEvents에 포함
 *  4. 친밀도 69 (미달) 시 후보 풀에서 제외
 *  5. talkEventsFired에 기록 후 후보 풀에서 제외 (1회 발동 보장)
 *  6. 친밀도 70 도달 시 30+50+70 단계 모두 후보 (옵션 B 점진 해제)
 *  7. gender 필터 없음 — 남/여 모두 발동 가능
 *  8. memorySlotDraft 정책 — importance 3 + 2~3개 시드만 (선택적)
 *
 * 실행: npx tsx scripts/verify-tier70-mini-events.ts
 */

import { NPC_MINI_EVENTS } from '../../src/engine/talkData';
import { getAvailableNpcEvents } from '../../src/engine/talkSystem';
import { applyMemorySlotFromMiniTalk } from '../../src/engine/memorySystem';
import { createInitialState } from '../../src/engine/gameEngine';
import type { GameState } from '../../src/engine/types';

// 기본 게이트는 가이드라인(70). haeun/junha는 등장 윈도가 좁아 #267에서 게이트를
// 가이드라인보다 낮게 압축(사장 해소) → gate로 실제 문턱을 명시한다.
const GUIDELINE = 70;
const TIER70_SEEDS: Array<{ id: string; npcId: string; expectMemorySlot: boolean; gate?: number }> = [
  { id: 'talk_jihun_70_locker', npcId: 'jihun', expectMemorySlot: false },
  { id: 'talk_subin_70_night_light', npcId: 'subin', expectMemorySlot: true },
  { id: 'talk_minjae_70_phone_call', npcId: 'minjae', expectMemorySlot: true },
  { id: 'talk_yuna_70_chalk_dust', npcId: 'yuna', expectMemorySlot: false },
  { id: 'talk_haeun_70_direction', npcId: 'haeun', expectMemorySlot: false, gate: 56 },
  { id: 'talk_junha_70_speech', npcId: 'junha', expectMemorySlot: false, gate: 44 },
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

console.log('=== Phase 2.3 친밀도 70 단계 미니 이벤트 검증 ===\n');

// === 1. 6개 시드 존재 ===
console.log('=== 1. 시드 6개 존재 ===');
for (const spec of TIER70_SEEDS) {
  const seed = NPC_MINI_EVENTS.find(e => e.id === spec.id);
  check(`${spec.id} 존재`, !!seed);
}

// === 2. intimacyMin/intimacy 효과 가이드라인 ===
console.log('\n=== 2. 가이드라인: intimacyMin=70(haeun/junha 압축 게이트 예외), intimacy=+4 ===');
for (const spec of TIER70_SEEDS) {
  const seed = NPC_MINI_EVENTS.find(e => e.id === spec.id);
  if (!seed) continue;
  const gate = spec.gate ?? GUIDELINE;
  check(`${spec.id}.intimacyMin === ${gate}`, seed.intimacyMin === gate, `actual=${seed.intimacyMin}`);
  check(`${spec.id}.effects.intimacy === 4`, seed.effects.intimacy === 4, `actual=${seed.effects.intimacy}`);
  check(`${spec.id}.npcId === ${spec.npcId}`, seed.npcId === spec.npcId, `actual=${seed.npcId}`);
}

// === 3. 친밀도 70 도달 시 후보 풀에 포함 ===
console.log('\n=== 3. 친밀도 70 도달 — 후보 풀 진입 ===');
const baseM = createInitialState('male', ['emotional', 'strict']);
const baseF = createInitialState('female', ['emotional', 'strict']);
for (const spec of TIER70_SEEDS) {
  for (const [genderLabel, base] of [['남', baseM], ['여', baseF]] as const) {
    const s = withIntimacy(base, spec.npcId, 70);
    const available = getAvailableNpcEvents(s, spec.npcId);
    const found = available.find(e => e.id === spec.id);
    check(`${spec.id} (${genderLabel}) 친밀도 70에 가용`, !!found);
  }
}

// === 4. 친밀도 69 미달 시 후보 풀 제외 ===
console.log('\n=== 4. 게이트 미달(gate-1) — 후보 풀 제외 ===');
for (const spec of TIER70_SEEDS) {
  const gate = spec.gate ?? GUIDELINE;
  const s = withIntimacy(baseM, spec.npcId, gate - 1);
  const available = getAvailableNpcEvents(s, spec.npcId);
  const found = available.find(e => e.id === spec.id);
  check(`${spec.id} 친밀도 ${gate - 1}엔 미가용`, !found);
}

// === 5. talkEventsFired 기록 후 풀 제외 ===
console.log('\n=== 5. fired 기록 후 — 후보 풀에서 영구 제외 ===');
for (const spec of TIER70_SEEDS) {
  const s = withFired(withIntimacy(baseM, spec.npcId, 70), [spec.id]);
  const available = getAvailableNpcEvents(s, spec.npcId);
  const found = available.find(e => e.id === spec.id);
  check(`${spec.id} fired 후 풀 제외`, !found);
}

// === 6. 친밀도 70 도달 시 30+50+70 모두 후보 (점진 해제) ===
console.log('\n=== 6. intimacy 70 도달 — 30+50+70 단계 모두 후보 ===');
const TIER_BY_NPC: Record<string, { t30: string; t50: string }> = {
  jihun: { t30: 'talk_jihun_basket', t50: 'talk_jihun_50_topping' },
  subin: { t30: 'talk_subin_problem', t50: 'talk_subin_50_sentence' },
  minjae: { t30: 'talk_minjae_notes', t50: 'talk_minjae_50_wrong_answer_mark' },
  yuna: { t30: 'talk_yuna_song', t50: 'talk_yuna_50_humming' },
  haeun: { t30: 'talk_haeun_quiet', t50: 'talk_haeun_50_window' },
  junha: { t30: 'talk_junha_riceball', t50: 'talk_junha_50_seabreeze' },
};
for (const spec of TIER70_SEEDS) {
  const tiers = TIER_BY_NPC[spec.npcId];
  const s = withIntimacy(baseM, spec.npcId, 70);
  const available = getAvailableNpcEvents(s, spec.npcId);
  const has30 = available.some(e => e.id === tiers.t30);
  const has50 = available.some(e => e.id === tiers.t50);
  const has70 = available.some(e => e.id === spec.id);
  check(`${spec.npcId}: 30(${tiers.t30}) + 50 + 70 모두 가용`, has30 && has50 && has70);
}

// === 7. 효과 형식 유효성 ===
console.log('\n=== 7. 효과 형식 유효성 ===');
const VALID_STATS = new Set(['academic', 'social', 'talent', 'mental', 'health']);
for (const spec of TIER70_SEEDS) {
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

// === 8. memorySlotDraft 정책 ===
console.log('\n=== 8. memorySlotDraft 정책 ===');
const seedsWithMemory = TIER70_SEEDS.filter(s => {
  const seed = NPC_MINI_EVENTS.find(e => e.id === s.id);
  return seed?.memorySlotDraft !== undefined;
});
check(
  `memorySlot 수 2~3개 (가이드라인): 실제 ${seedsWithMemory.length}개`,
  seedsWithMemory.length >= 2 && seedsWithMemory.length <= 3,
);
for (const spec of TIER70_SEEDS) {
  const seed = NPC_MINI_EVENTS.find(e => e.id === spec.id);
  if (!seed) continue;
  const has = seed.memorySlotDraft !== undefined;
  check(`${spec.id} memorySlotDraft = ${spec.expectMemorySlot ? 'YES' : 'no'}`, has === spec.expectMemorySlot);
  if (seed.memorySlotDraft) {
    check(`${spec.id} importance === 3`, seed.memorySlotDraft.importance === 3, `actual=${seed.memorySlotDraft.importance}`);
    check(`${spec.id} npcIds 포함`, seed.memorySlotDraft.npcIds.includes(spec.npcId));
  }
}

// === 9. applyMemorySlotFromMiniTalk 실제 슬롯 생성 동작 ===
console.log('\n=== 9. applyMemorySlotFromMiniTalk — 실제 슬롯 생성 ===');
for (const spec of TIER70_SEEDS) {
  const seed = NPC_MINI_EVENTS.find(e => e.id === spec.id);
  if (!seed) continue;
  const s = withIntimacy(baseM, spec.npcId, 70);
  const slotsBefore = s.memorySlots.length;
  applyMemorySlotFromMiniTalk(s, spec.id, seed.memorySlotDraft);
  const slotsAfter = s.memorySlots.length;
  if (spec.expectMemorySlot) {
    check(`${spec.id} 슬롯 1개 추가됨`, slotsAfter === slotsBefore + 1);
    const newSlot = s.memorySlots[s.memorySlots.length - 1];
    check(`${spec.id} sourceEventId === ${spec.id}`, newSlot?.sourceEventId === spec.id);
    check(`${spec.id} choiceIndex === 0`, newSlot?.choiceIndex === 0);
  } else {
    check(`${spec.id} 슬롯 추가 안 됨 (memorySlotDraft 없음)`, slotsAfter === slotsBefore);
  }
}

// === 10. 중복 발동 방지 (같은 sourceEventId) ===
console.log('\n=== 10. 같은 sourceEventId 두 번 호출 — 한 번만 추가 ===');
for (const spec of TIER70_SEEDS) {
  if (!spec.expectMemorySlot) continue;
  const seed = NPC_MINI_EVENTS.find(e => e.id === spec.id);
  if (!seed) continue;
  const s = withIntimacy(baseM, spec.npcId, 70);
  applyMemorySlotFromMiniTalk(s, spec.id, seed.memorySlotDraft);
  applyMemorySlotFromMiniTalk(s, spec.id, seed.memorySlotDraft);  // 두 번째 호출
  const count = s.memorySlots.filter(slot => slot.sourceEventId === spec.id).length;
  check(`${spec.id} sourceEventId 중복 방지 (1개만 존재)`, count === 1, `count=${count}`);
}

// === 결과 ===
console.log(`\n=== 결과: ${passed} passed / ${failed} failed ===`);
process.exit(failed === 0 ? 0 : 1);
