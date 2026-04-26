{
  const mem = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v); },
    removeItem: (k: string) => { mem.delete(k); },
    clear: () => { mem.clear(); },
    key: () => null,
    length: 0,
  } as Storage;
}

import { createInitialState, processWeek } from '../src/engine/gameEngine';

// 번아웃 도달 → 회복 시나리오
let state = createInitialState('male', ['strict', 'resilience']);
state.routineSlot2 = 'self-study';
state.routineSlot3 = 'academy';

console.log('=== 번아웃 효율 분석 (0.2x 패널티 체감) ===\n');

let burnoutFirstWeek = -1;
let burnoutRecoveredWeek = -1;

for (let week = 1; week <= 48; week++) {
  state = processWeek(state);
  
  if (state.mentalState === 'burnout' && burnoutFirstWeek === -1) {
    burnoutFirstWeek = week;
    console.log(`\n█ 번아웃 진입: W${week}`);
    console.log(`  mental: ${state.stats.mental.toFixed(1)}`);
    console.log(`  fatigue: ${state.fatigue.toFixed(1)}`);
    console.log(`  활동 효율: 0.2배 → 거의 성장 불가`);
  } else if (state.mentalState !== 'burnout' && burnoutFirstWeek !== -1 && burnoutRecoveredWeek === -1) {
    burnoutRecoveredWeek = week;
    console.log(`\n✓ 번아웃 탈출: W${week} (${week - burnoutFirstWeek}주)`);
    console.log(`  mental: ${state.stats.mental.toFixed(1)}`);
    console.log(`  피로 자동 회복 적용 (매주 -12)`);
  }
}

console.log(`\n=== 평가 ===`);
if (burnoutFirstWeek !== -1) {
  console.log(`✓ Y1에서 번아웃 발생 가능 (W${burnoutFirstWeek})`);
  if (burnoutRecoveredWeek !== -1) {
    console.log(`✓ 번아웃 회복 메커니즘 작동 (${burnoutRecoveredWeek - burnoutFirstWeek}주 소요)`);
  }
}
