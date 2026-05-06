import { createInitialState, processWeek } from '../src/engine/gameEngine';
import { getFollowupForWeek } from '../src/engine/events';
import type { GameState } from '../src/engine/types';

async function run7YearAcademic(): Promise<GameState> {
  let s = createInitialState('male', ['info', 'strict']);
  s.routineSlot2 = 'self-study';
  s.routineSlot3 = 'academy';
  
  for (let week = 0; week < 336; week++) {
    s.weekendChoices = ['self-study', 'self-study'];
    s.vacationChoices = ['self-study', 'academy'];
    
    s = processWeek(s);
    
    while (s.currentEvent) {
      const ev = s.currentEvent;
      const choices = s.gender === 'female' && ev.femaleChoices ? ev.femaleChoices : ev.choices;
      const ch = choices[0];
      
      for (const [k, v] of Object.entries(ch.effects)) {
        const stat = k as keyof typeof s.stats;
        s.stats[stat] = Math.max(0, Math.min(100, s.stats[stat] + (v as number)));
      }
      if (ch.fatigueEffect) s.fatigue = Math.max(0, Math.min(100, s.fatigue + ch.fatigueEffect));
      if (ch.moneyEffect) s.money += ch.moneyEffect;
      
      s.events.push({ ...ev, resolvedChoice: 0, week: s.week, year: s.year });
      s.currentEvent = null;
      const fu = getFollowupForWeek(s, ev.location);
      if (fu) s.currentEvent = fu;
    }
    
    if (s.phase === 'year-end') {
      s.week = 1;
      s.year++;
      s.phase = 'weekday';
    }
    if (s.phase === 'ending') break;
  }
  
  return s;
}

async function main() {
  const final = await run7YearAcademic();
  console.log('=== 7년 학업형 플레이: 자습+학원 풀지속 ===');
  console.log(`Academic: ${final.stats.academic.toFixed(1)}/100`);
  console.log(`Social: ${final.stats.social.toFixed(1)}/100`);
  console.log(`Talent: ${final.stats.talent.toFixed(1)}/100`);
  console.log(`Mental: ${final.stats.mental.toFixed(1)}/100`);
  console.log(`Health: ${final.stats.health.toFixed(1)}/100`);
  console.log(`Burnout: ${final.burnoutCount}회`);
}

main().catch(e => console.error(e));
