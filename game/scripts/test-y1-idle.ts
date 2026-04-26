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

// Y1 방치 시나리오: 루틴 없이 쉬기만 선택
let state = createInitialState('male', ['emotional', 'freedom']);
state.routineSlot2 = null;
state.routineSlot3 = null;

console.log('=== Y1 방치(idle) 분석 ===\n');

let idleFlips = 0;
for (let week = 1; week <= 48; week++) {
  state.weekendChoices = ['rest'];  // 주말/방학은 항상 쉬기
  state.vacationChoices = ['rest'];
  
  const prevIdle = state.idleWeeks || 0;
  state = processWeek(state);
  const newIdle = state.idleWeeks || 0;
  
  if (newIdle >= 3 && prevIdle < 3) {
    console.log(`W${week}: idleWeeks 3 도달 → 멘탈 -2, 소셜 -1`);
    idleFlips++;
  }
}

console.log(`\n=== 통계 ===`);
console.log(`최종 mental: ${state.stats.mental.toFixed(1)}`);
console.log(`최종 social: ${state.stats.social.toFixed(1)}`);
console.log(`idleWeeks 페널티 발동: ${idleFlips}회`);
console.log(`번아웃: ${state.burnoutCount}회`);
