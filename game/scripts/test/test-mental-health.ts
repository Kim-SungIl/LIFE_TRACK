import { createInitialState, processWeek } from '../../src/engine/gameEngine';
import { getFollowupForWeek } from '../../src/engine/events';
import type { GameState } from '../../src/engine/types';

async function runMentalHealthTest(): Promise<void> {
  // 높은 mental이 효율에 미치는 영향 측정
  console.log('=== Mental/Health 상호작용 분석 ===\n');
  
  // 1. Mental이 높은 경우 (정신 상태 좋음)
  let s1 = createInitialState('male', ['emotional', 'wealth']);
  s1.stats.mental = 80;
  s1.stats.health = 80;
  s1.routineSlot2 = 'self-study';
  s1.routineSlot3 = 'light-exercise';
  
  let mentalHistory = [];
  let healthHistory = [];
  let academicHistory = [];
  
  for (let i = 0; i < 52; i++) {
    s1.weekendChoices = ['self-study'];
    s1.vacationChoices = ['self-study'];
    s1 = processWeek(s1);
    
    while (s1.currentEvent) {
      const ev = s1.currentEvent;
      const choices = s1.gender === 'female' && ev.femaleChoices ? ev.femaleChoices : ev.choices;
      const ch = choices[0];
      for (const [k, v] of Object.entries(ch.effects)) {
        const stat = k as keyof typeof s1.stats;
        s1.stats[stat] = Math.max(0, Math.min(100, s1.stats[stat] + (v as number)));
      }
      s1.currentEvent = null;
      const fu = getFollowupForWeek(s1, ev.location);
      if (fu) s1.currentEvent = fu;
    }
    
    if (s1.phase === 'year-end') {
      s1.week = 1;
      s1.year++;
      s1.phase = 'weekday';
    }
    
    mentalHistory.push(s1.stats.mental);
    healthHistory.push(s1.stats.health);
    academicHistory.push(s1.stats.academic);
  }
  
  console.log('Y1 (52주) 진행 곡선:');
  console.log(`  Week 1: Mental=${mentalHistory[0].toFixed(1)}, Health=${healthHistory[0].toFixed(1)}, Academic=${academicHistory[0].toFixed(1)}`);
  console.log(`  Week 13: Mental=${mentalHistory[12]?.toFixed(1)}, Health=${healthHistory[12]?.toFixed(1)}, Academic=${academicHistory[12]?.toFixed(1)}`);
  console.log(`  Week 26: Mental=${mentalHistory[25]?.toFixed(1)}, Health=${healthHistory[25]?.toFixed(1)}, Academic=${academicHistory[25]?.toFixed(1)}`);
  console.log(`  Week 52: Mental=${mentalHistory[51]?.toFixed(1)}, Health=${healthHistory[51]?.toFixed(1)}, Academic=${academicHistory[51]?.toFixed(1)}`);
  
  // 2. 시간경과에 따른 감쇠 측정
  console.log('\n=== Academic 감쇠 곡선 (스탯별) ===');
  const levels = [30, 50, 60, 70, 80, 90, 95];
  for (const level of levels) {
    let s = createInitialState('male', ['info', 'strict']);
    s.stats.academic = level;
    s.routineSlot2 = 'self-study';
    s.routineSlot3 = 'academy';
    
    let gained = 0;
    for (let i = 0; i < 1; i++) {
      s.weekendChoices = ['self-study'];
      s.vacationChoices = ['academy'];
      const before = s.stats.academic;
      s = processWeek(s);
      gained = s.stats.academic - before;
    }
    console.log(`  Academic ${level}: 주당 순증가 ${gained.toFixed(2)} (감쇠 적용후)`);
  }
}

runMentalHealthTest().catch(e => console.error(e));
