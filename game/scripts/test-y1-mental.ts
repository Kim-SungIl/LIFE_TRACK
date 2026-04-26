// localStorage 폴리필
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
import type { GameState } from '../src/engine/types';

// Y1 극단적 고압 시나리오: 학업형 + 엄격 부모
let state = createInitialState('male', ['strict', 'resilience']);
state.routineSlot2 = 'self-study';  // 자습 (학업 +4, 피로 +8)
state.routineSlot3 = 'academy';      // 학원 (학업 +5, 피로 +10)

console.log('=== Y1 멘탈 전이 분석 ===\n');
console.log(`초기: mental=${state.stats.mental}, fatigue=${state.fatigue}, mentalState=${state.mentalState}`);

const timeline = [];
for (let week = 1; week <= 48; week++) {
  state = processWeek(state);
  
  if (state.mentalState !== 'normal' || state.fatigue >= 80 || state.week === 48) {
    timeline.push({
      week,
      year: state.year,
      mental: Math.round(state.stats.mental * 10) / 10,
      fatigue: Math.round(state.fatigue * 10) / 10,
      mentalState: state.mentalState,
      consecutiveTired: state.consecutiveTiredWeeks || 0,
      idleWeeks: state.idleWeeks || 0,
      burnoutCount: state.burnoutCount,
    });
  }
}

console.log('\n=== 주요 전이점 (normal 이외 + 피로 80+) ===');
timeline.forEach(t => {
  console.log(`Y1 W${t.week}: mental=${t.mental}, fatigue=${t.fatigue}, state=${t.mentalState}, ctw=${t.consecutiveTired}`);
});

console.log(`\n=== Y1 말 통계 ===`);
console.log(`최종 mental: ${state.stats.mental.toFixed(1)}`);
console.log(`최종 fatigue: ${state.fatigue.toFixed(1)}`);
console.log(`번아웃 횟수: ${state.burnoutCount}`);
console.log(`idleWeeks: ${state.idleWeeks || 0}`);
