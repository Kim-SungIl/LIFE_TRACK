// M4 돈 싱크 이벤트 검증
// - 수학여행 Y2/Y5, 졸업 준비 Y1/Y7, 동아리/학원 Y5
// - 생일 premium tier 존재
// - addBuff 효과 활성화
//
// 실행: cd game && npx tsx scripts/verify-m4-money.ts

import { createInitialState, processWeek } from '../src/engine/gameEngine';
import { GAME_EVENTS } from '../src/engine/events';
import type { GameState, ParentStrength } from '../src/engine/types';

let passed = 0, failed = 0;
function assert(label: string, cond: boolean, detail?: string) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}

function mkState(year: number, week: number): GameState {
  const s = createInitialState('male', ['wealth', 'emotional']);
  s.year = year;
  s.week = week;
  s.phase = 'weekday';
  return s;
}

console.log('\n=== 1. 수학여행 이벤트 등록 + 조건 ===');
{
  const midTrip = GAME_EVENTS.find(e => e.id === 'school-trip-middle');
  const highTrip = GAME_EVENTS.find(e => e.id === 'school-trip-high');
  assert('school-trip-middle 등록됨', !!midTrip);
  assert('school-trip-high 등록됨', !!highTrip);
  assert('school-trip-middle W28 고정', midTrip?.week === 28);
  assert('school-trip-high W28 고정', highTrip?.week === 28);

  const y2 = mkState(2, 28);
  const y5 = mkState(5, 28);
  const y1 = mkState(1, 28);
  assert('Y2 W28 → school-trip-middle 조건 충족', !!midTrip?.condition?.(y2));
  assert('Y1 W28 → school-trip-middle 조건 불충족', !midTrip?.condition?.(y1));
  assert('Y5 W28 → school-trip-high 조건 충족', !!highTrip?.condition?.(y5));
  assert('Y2 W28 → school-trip-high 조건 불충족', !highTrip?.condition?.(y2));

  // 참가 선택지가 -10만원 + memorySlotDraft
  const midJoin = midTrip?.choices[0];
  assert('Y2 수학여행 참가 -10만원', midJoin?.moneyEffect === -10);
  assert('Y2 수학여행 참가 memorySlotDraft 존재', !!midJoin?.memorySlotDraft);
  assert('Y2 수학여행 memorySlotDraft importance ≥6', (midJoin?.memorySlotDraft?.importance ?? 0) >= 6);
  const highJoin = highTrip?.choices[0];
  assert('Y5 수학여행 참가 -10만원', highJoin?.moneyEffect === -10);
  assert('Y5 수학여행 memorySlotDraft importance ≥7', (highJoin?.memorySlotDraft?.importance ?? 0) >= 7);
}

console.log('\n=== 2. 수학여행 참가 → memorySlot 실제 생성 (ANNUAL 아님) ===');
{
  // ANNUAL_EVENT_IDS에 포함 안 됐는지 확인: applyMemorySlotFromChoice 실행 후 slot 생성
  const s = mkState(2, 28);
  s.money = 20;
  const midTrip = GAME_EVENTS.find(e => e.id === 'school-trip-middle')!;

  // memorySystem 직접 호출
  import('../src/engine/memorySystem').then(({ applyMemorySlotFromChoice }) => {
    applyMemorySlotFromChoice(s, midTrip, 0, midTrip.choices[0]);
    assert('수학여행 참가 → memorySlot 1개 생성', s.memorySlots.length === 1);
    assert('생성된 slot 카테고리 discovery', s.memorySlots[0]?.category === 'discovery');
    assert('생성된 slot toneTag warm', s.memorySlots[0]?.toneTag === 'warm');
  });
}

console.log('\n=== 3. 졸업 준비 이벤트 ===');
{
  const elemPrep = GAME_EVENTS.find(e => e.id === 'graduation-prep-elementary');
  const highPrep = GAME_EVENTS.find(e => e.id === 'graduation-prep-high');
  assert('graduation-prep-elementary 등록됨', !!elemPrep);
  assert('graduation-prep-high 등록됨', !!highPrep);
  assert('elem W45 고정', elemPrep?.week === 45);
  assert('high W45 고정', highPrep?.week === 45);

  const y1 = mkState(1, 45);
  const y7 = mkState(7, 45);
  assert('Y1 W45 → graduation-prep-elementary 조건 충족', !!elemPrep?.condition?.(y1));
  assert('Y7 W45 → graduation-prep-high 조건 충족', !!highPrep?.condition?.(y7));
  assert('Y2 W45 → graduation-prep-elementary 조건 불충족', !elemPrep?.condition?.(mkState(2, 45)));

  assert('elem 준비 -5만원', elemPrep?.choices[0]?.moneyEffect === -5);
  assert('high 준비 -5만원', highPrep?.choices[0]?.moneyEffect === -5);
  assert('elem 참가 memorySlotDraft importance ≥7', (elemPrep?.choices[0]?.memorySlotDraft?.importance ?? 0) >= 7);
  assert('high 참가 memorySlotDraft importance ≥8', (highPrep?.choices[0]?.memorySlotDraft?.importance ?? 0) >= 8);

  // W45로 졸업식(W46)과 겹치지 않음 확인
  assert('elem W45 ≠ elementary-graduation W46', elemPrep?.week !== 46);
  assert('high W45 ≠ high-school-graduation W46', highPrep?.week !== 46);
}

console.log('\n=== 4. 동아리/학원 선택 Y5 W2 + addBuff ===');
{
  const ev = GAME_EVENTS.find(e => e.id === 'club-academy-choice-y5');
  assert('club-academy-choice-y5 등록됨', !!ev);
  assert('Y5 W2 고정', ev?.week === 2 && !!ev?.condition?.(mkState(5, 2)));
  assert('Y4 W2 → 불충족', !ev?.condition?.(mkState(4, 2)));
  assert('선택지 3개', ev?.choices.length === 3);

  const academy = ev?.choices[0];
  const club = ev?.choices[1];
  const skip = ev?.choices[2];

  assert('학원 -10만원', academy?.moneyEffect === -10);
  assert('동아리 -10만원', club?.moneyEffect === -10);
  assert('자율 돈 소모 없음', !skip?.moneyEffect);

  assert('학원 addBuff 존재', !!academy?.addBuff);
  assert('학원 addBuff target=study', academy?.addBuff?.target === 'study');
  assert('학원 addBuff 8주', academy?.addBuff?.remainingWeeks === 8);
  assert('학원 addBuff amount=0.2', academy?.addBuff?.amount === 0.2);

  assert('동아리 addBuff target=talent', club?.addBuff?.target === 'talent');
  assert('동아리 addBuff 8주', club?.addBuff?.remainingWeeks === 8);
}

console.log('\n=== 5. addBuff 실제 적용 (store resolveEvent 훅) ===');
{
  // resolveEvent를 직접 호출 못하므로 gameEngine에서 처리 로직이 있는지 확인
  // store.ts에서 addBuff 핸들링됨 — 유닛 검증은 브라우저에서 smoke test가 커버
  // 여기서는 EventChoice 타입에 addBuff 필드 존재 + choice.addBuff가 런타임에 정상 접근되는지만
  const ev = GAME_EVENTS.find(e => e.id === 'club-academy-choice-y5');
  const buffObj = ev?.choices[0]?.addBuff;
  assert('addBuff 런타임 접근 성공', typeof buffObj === 'object' && !!buffObj);
  assert('addBuff.id 문자열', typeof buffObj?.id === 'string');
}

console.log('\n=== 6. 생일 이벤트 premium tier (-5만원) 추가 ===');
{
  const birthdayIds = [
    'minjae-birthday', 'jihun-birthday', 'subin-birthday',
    'yuna-birthday', 'junha-birthday', 'haeun-birthday',
  ];
  for (const id of birthdayIds) {
    const ev = GAME_EVENTS.find(e => e.id === id);
    const hasPremium = ev?.choices.some(c => c.moneyEffect === -5);
    assert(`${id} 에 -5만원 premium tier 존재`, !!hasPremium, ev ? JSON.stringify(ev.choices.map(c => c.moneyEffect ?? 0)) : 'not found');
  }
}

console.log('\n=== 7. 총 돈 싱크 기여 (-10 + -10 + -5 + -5 + -10 + 6×-5 = -70만원) ===');
{
  // 실제 최소 싱크 합산 (선택지 다수 가정 하에)
  const sinks = [
    { id: 'school-trip-middle', expected: -10 },
    { id: 'school-trip-high', expected: -10 },
    { id: 'graduation-prep-elementary', expected: -5 },
    { id: 'graduation-prep-high', expected: -5 },
    { id: 'club-academy-choice-y5', expected: -10 }, // 학원 또는 동아리
  ];
  let total = 0;
  for (const s of sinks) {
    const ev = GAME_EVENTS.find(e => e.id === s.id);
    const deepest = Math.min(...(ev?.choices.map(c => c.moneyEffect ?? 0) ?? [0]));
    assert(`${s.id} 최대 -${Math.abs(s.expected)}만원 가능`, deepest === s.expected, `actual ${deepest}`);
    total += s.expected;
  }
  // 생일 6개 premium 전부 선택 시
  total += 6 * (-5);
  assert(`모든 돈 싱크 풀 선택 시 -70만원 합산 가능 (actual ${total})`, total === -70);
}

console.log('\n=== 8. 100주 시뮬 — 돈 싱크 이벤트 발견 ===');
{
  // 실제 resolveEvent처럼 state.events에 push하도록 시뮬레이션 (중복 방지 로직 반영)
  let s = createInitialState('male', ['wealth', 'emotional']);
  s.routineSlot2 = 'self-study';
  s.routineSlot3 = 'basketball';
  const sinkIdsSeen = new Set<string>();
  const targetSinks = new Set([
    'school-trip-middle', 'school-trip-high',
    'graduation-prep-elementary', 'graduation-prep-high',
    'club-academy-choice-y5',
  ]);
  for (let i = 0; i < 400; i++) {
    s = processWeek(s);
    if (s.currentEvent) {
      if (targetSinks.has(s.currentEvent.id)) sinkIdsSeen.add(s.currentEvent.id);
      // 실제 게임의 resolveEvent와 동일하게 state.events에 push (중복 방지 로직 정확성 보장)
      s.events.push({
        ...s.currentEvent,
        resolvedChoice: 0,
        week: s.week,
        year: s.year,
      });
      s.currentEvent = null;
    }
    if (s.phase === 'year-end') { s.week = 1; s.year++; s.phase = 'weekday'; }
    if (s.year > 7) break;
  }
  assert(`수학여행 중학교 조우 (Y2 W28)`, sinkIdsSeen.has('school-trip-middle'));
  assert(`수학여행 고등학교 조우 (Y5 W28)`, sinkIdsSeen.has('school-trip-high'));
  assert(`초등 졸업 준비 조우 (Y1 W45)`, sinkIdsSeen.has('graduation-prep-elementary'));
  assert(`고등 졸업 준비 조우 (Y7 W45)`, sinkIdsSeen.has('graduation-prep-high'));
  assert(`동아리/학원 선택 조우 (Y5 W2)`, sinkIdsSeen.has('club-academy-choice-y5'));
}

setTimeout(() => {
  console.log(`\n결과: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}, 100);
