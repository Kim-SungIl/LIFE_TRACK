/**
 * Phase 2.4: 친밀도 90 단계(코어) 미니 이벤트 시드 6개 검증
 *
 * 검증 항목:
 *  1. 6개 시드가 NPC_MINI_EVENTS에 모두 존재
 *  2. 각 시드: intimacyMin === 90, intimacy effect === +5 (가이드라인)
 *  3. 친밀도 90 도달 시 getAvailableNpcEvents에 포함 (haeun은 yearMin 6 충족 필요)
 *  4. 친밀도 89 (미달) 시 후보 풀에서 제외
 *  5. talkEventsFired 기록 후 풀 제외 (1회 발동 보장)
 *  6. 친밀도 90 도달 시 30+50+70+90 모두 후보 (점진 해제)
 *  7. 효과 형식 유효성 (stats 키, fatigue 범위)
 *  8. memorySlotDraft 정책 — 6개 전부 필수, importance 5, 유효 category/toneTag
 *  9. applyMemorySlotFromMiniTalk 실제 슬롯 생성 + 중복 방지
 * 10. haeun yearMin 게이팅 — Y5 미가용 / Y6 가용
 *
 * 실행: npx tsx scripts/verify/verify-tier90-mini-events.ts
 */

import { NPC_MINI_EVENTS } from '../../src/engine/talkData';
import { getAvailableNpcEvents } from '../../src/engine/talkSystem';
import { applyMemorySlotFromMiniTalk } from '../../src/engine/memorySystem';
import { createInitialState } from '../../src/engine/gameEngine';
import type { GameState } from '../../src/engine/types';

const TIER90_SEEDS: Array<{ id: string; npcId: string; yearMin?: number }> = [
  { id: 'talk_jihun_90_bench', npcId: 'jihun' },
  { id: 'talk_subin_90_two_names', npcId: 'subin' },
  { id: 'talk_minjae_90_unmasked', npcId: 'minjae' },
  { id: 'talk_yuna_90_wrong_note', npcId: 'yuna' },
  { id: 'talk_haeun_90_empty_line', npcId: 'haeun', yearMin: 6 },
  { id: 'talk_junha_90_umbrella', npcId: 'junha' },
];

const VALID_CATEGORY = new Set(['courage', 'betrayal', 'reconciliation', 'failure', 'discovery', 'growth', 'bypass', 'unspoken_debt']);
const VALID_TONE = new Set(['warm', 'regret', 'resolve', 'breakthrough', 'melancholy', 'burden']);
const VALID_STATS = new Set(['academic', 'social', 'talent', 'mental', 'health']);

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

// 친밀도 + 학년을 함께 설정 (90단계는 일부 시드가 yearMin 게이팅)
function withState(state: GameState, npcId: string, intimacy: number, year = 6): GameState {
  const clone = JSON.parse(JSON.stringify(state)) as GameState;
  clone.year = year;
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

console.log('=== Phase 2.4 친밀도 90 단계(코어) 미니 이벤트 검증 ===\n');

// === 1. 6개 시드 존재 ===
console.log('=== 1. 시드 6개 존재 ===');
for (const spec of TIER90_SEEDS) {
  check(`${spec.id} 존재`, !!NPC_MINI_EVENTS.find(e => e.id === spec.id));
}

// === 2. intimacyMin/intimacy 가이드라인 ===
console.log('\n=== 2. 가이드라인: intimacyMin=90, intimacy=+5 ===');
for (const spec of TIER90_SEEDS) {
  const seed = NPC_MINI_EVENTS.find(e => e.id === spec.id);
  if (!seed) continue;
  check(`${spec.id}.intimacyMin === 90`, seed.intimacyMin === 90, `actual=${seed.intimacyMin}`);
  check(`${spec.id}.effects.intimacy === 5`, seed.effects.intimacy === 5, `actual=${seed.effects.intimacy}`);
  check(`${spec.id}.npcId === ${spec.npcId}`, seed.npcId === spec.npcId, `actual=${seed.npcId}`);
}

// === 3. 친밀도 90 도달 시 후보 풀 진입 (year 6 기준) ===
console.log('\n=== 3. 친밀도 90 도달 — 후보 풀 진입 (남/여) ===');
const baseM = createInitialState('male', ['emotional', 'strict']);
const baseF = createInitialState('female', ['emotional', 'strict']);
for (const spec of TIER90_SEEDS) {
  for (const [genderLabel, base] of [['남', baseM], ['여', baseF]] as const) {
    const s = withState(base, spec.npcId, 90, 6);
    const found = getAvailableNpcEvents(s, spec.npcId).find(e => e.id === spec.id);
    check(`${spec.id} (${genderLabel}) 친밀도 90·Y6에 가용`, !!found);
  }
}

// === 4. 친밀도 89 미달 시 제외 ===
console.log('\n=== 4. 친밀도 89 (미달) — 후보 풀 제외 ===');
for (const spec of TIER90_SEEDS) {
  const s = withState(baseM, spec.npcId, 89, 6);
  const found = getAvailableNpcEvents(s, spec.npcId).find(e => e.id === spec.id);
  check(`${spec.id} 친밀도 89엔 미가용`, !found);
}

// === 5. fired 후 제외 ===
console.log('\n=== 5. fired 기록 후 — 영구 제외 ===');
for (const spec of TIER90_SEEDS) {
  const s = withFired(withState(baseM, spec.npcId, 90, 6), [spec.id]);
  const found = getAvailableNpcEvents(s, spec.npcId).find(e => e.id === spec.id);
  check(`${spec.id} fired 후 풀 제외`, !found);
}

// === 6. 30+50+70+90 모두 후보 (점진 해제, Y6 기준) ===
console.log('\n=== 6. intimacy 90·Y6 — 30+50+70+90 모두 후보 ===');
const TIER_BY_NPC: Record<string, { t30: string; t50: string; t70: string }> = {
  jihun: { t30: 'talk_jihun_basket', t50: 'talk_jihun_50_topping', t70: 'talk_jihun_70_locker' },
  subin: { t30: 'talk_subin_problem', t50: 'talk_subin_50_sentence', t70: 'talk_subin_70_night_light' },
  minjae: { t30: 'talk_minjae_notes', t50: 'talk_minjae_50_wrong_answer_mark', t70: 'talk_minjae_70_phone_call' },
  yuna: { t30: 'talk_yuna_song', t50: 'talk_yuna_50_humming', t70: 'talk_yuna_70_chalk_dust' },
  haeun: { t30: 'talk_haeun_quiet', t50: 'talk_haeun_50_window', t70: 'talk_haeun_70_direction' },
  junha: { t30: 'talk_junha_riceball', t50: 'talk_junha_50_seabreeze', t70: 'talk_junha_70_speech' },
};
for (const spec of TIER90_SEEDS) {
  const t = TIER_BY_NPC[spec.npcId];
  // jihun 30단계는 gender 분기라 남주 기준 basket(남) 사용
  const s = withState(baseM, spec.npcId, 90, 6);
  const ids = getAvailableNpcEvents(s, spec.npcId).map(e => e.id);
  check(`${spec.npcId}: 30+50+70+90 모두 가용`,
    ids.includes(t.t30) && ids.includes(t.t50) && ids.includes(t.t70) && ids.includes(spec.id),
    `pool=${ids.join(',')}`);
}

// === 7. 효과 형식 유효성 ===
console.log('\n=== 7. 효과 형식 유효성 ===');
for (const spec of TIER90_SEEDS) {
  const seed = NPC_MINI_EVENTS.find(e => e.id === spec.id);
  if (!seed) continue;
  if (seed.effects.stats) {
    for (const key of Object.keys(seed.effects.stats)) {
      check(`${spec.id} stats.${key} 유효`, VALID_STATS.has(key), `unknown stat: ${key}`);
    }
  }
  if (typeof seed.effects.fatigue === 'number') {
    check(`${spec.id} fatigue 범위 [-2,+2]`, Math.abs(seed.effects.fatigue) <= 2, `actual=${seed.effects.fatigue}`);
  }
}

// === 8. memorySlotDraft 정책 (6개 전부 필수, importance 5) ===
console.log('\n=== 8. memorySlotDraft — 6개 전부 importance 5 ===');
for (const spec of TIER90_SEEDS) {
  const seed = NPC_MINI_EVENTS.find(e => e.id === spec.id);
  if (!seed) continue;
  const d = seed.memorySlotDraft;
  check(`${spec.id} memorySlotDraft 존재 (필수)`, !!d);
  if (!d) continue;
  check(`${spec.id} importance === 5`, d.importance === 5, `actual=${d.importance}`);
  check(`${spec.id} category 유효 (${d.category})`, VALID_CATEGORY.has(d.category));
  check(`${spec.id} toneTag 유효 (${d.toneTag})`, d.toneTag === undefined || VALID_TONE.has(d.toneTag));
  check(`${spec.id} recallText 20~35자`, !!d.recallText && d.recallText.length >= 12 && d.recallText.length <= 40, `len=${d.recallText?.length}`);
  check(`${spec.id} npcIds 포함`, !!d.npcIds && d.npcIds.includes(spec.npcId));
}

// === 9. 실제 슬롯 생성 + 중복 방지 ===
console.log('\n=== 9. applyMemorySlotFromMiniTalk — 슬롯 생성 + 중복 방지 ===');
for (const spec of TIER90_SEEDS) {
  const seed = NPC_MINI_EVENTS.find(e => e.id === spec.id);
  if (!seed) continue;
  const s = withState(baseM, spec.npcId, 90, 6);
  const before = s.memorySlots.length;
  applyMemorySlotFromMiniTalk(s, spec.id, seed.memorySlotDraft);
  applyMemorySlotFromMiniTalk(s, spec.id, seed.memorySlotDraft);  // 중복 호출
  const count = s.memorySlots.filter(slot => slot.sourceEventId === spec.id).length;
  check(`${spec.id} 슬롯 1개만 생성 (중복 방지)`, count === 1 && s.memorySlots.length === before + 1, `count=${count}`);
}

// === 10. haeun yearMin 게이팅 ===
console.log('\n=== 10. haeun_90 yearMin 6 게이팅 ===');
const haeunY5 = withState(baseM, 'haeun', 90, 5);
const haeunY6 = withState(baseM, 'haeun', 90, 6);
check('haeun_90 Y5엔 미가용 (졸업 전)', !getAvailableNpcEvents(haeunY5, 'haeun').find(e => e.id === 'talk_haeun_90_empty_line'));
check('haeun_90 Y6에 가용 (졸업)', !!getAvailableNpcEvents(haeunY6, 'haeun').find(e => e.id === 'talk_haeun_90_empty_line'));

// === 결과 ===
console.log(`\n=== 결과: ${passed} passed / ${failed} failed ===`);
process.exit(failed === 0 ? 0 : 1);
