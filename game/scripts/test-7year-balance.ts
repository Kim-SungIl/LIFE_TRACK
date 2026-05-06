import { createInitialState, processWeek } from '../src/engine/gameEngine';
import { getFollowupForWeek } from '../src/engine/events';
import type { GameState } from '../src/engine/types';

async function runBalanced(): Promise<GameState> {
  let s = createInitialState('male', ['emotional', 'wealth']);
  s.routineSlot2 = 'self-study';
  s.routineSlot3 = 'light-exercise';
  
  for (let week = 0; week < 336; week++) {
    s.weekendChoices = ['self-study', 'club'];
    s.vacationChoices = ['self-study', 'creative', 'rest'];
    
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

async function runTalentFocus(): Promise<GameState> {
  let s = createInitialState('male', ['wealth', 'emotional']);
  s.routineSlot2 = 'creative';
  s.routineSlot3 = 'coding';
  
  for (let week = 0; week < 336; week++) {
    s.weekendChoices = ['creative', 'club'];
    s.vacationChoices = ['creative', 'art-lesson', 'rest'];
    
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

async function runSocial(): Promise<GameState> {
  let s = createInitialState('female', ['emotional', 'freedom']);
  s.routineSlot2 = 'club';
  s.routineSlot3 = 'volunteer';
  
  for (let week = 0; week < 336; week++) {
    s.weekendChoices = ['hang-out', 'club'];
    s.vacationChoices = ['club', 'volunteer', 'hang-out'];
    
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
  console.log('=== 7년 장기 플레이 밸런스 분석 ===\n');
  
  const academic = await runBalanced();
  console.log('학업형 (자습+운동): 자습/경운 루틴');
  console.log(`  Academic: ${academic.stats.academic.toFixed(1)}`);
  console.log(`  Social: ${academic.stats.social.toFixed(1)}`);
  console.log(`  Talent: ${academic.stats.talent.toFixed(1)}`);
  console.log(`  Mental: ${academic.stats.mental.toFixed(1)}`);
  console.log(`  Health: ${academic.stats.health.toFixed(1)}`);
  console.log(`  Burnout: ${academic.burnoutCount}\n`);
  
  const talent = await runTalentFocus();
  console.log('특기형 (창작+코딩): 창작/코딩 루틴');
  console.log(`  Academic: ${talent.stats.academic.toFixed(1)}`);
  console.log(`  Social: ${talent.stats.social.toFixed(1)}`);
  console.log(`  Talent: ${talent.stats.talent.toFixed(1)}`);
  console.log(`  Mental: ${talent.stats.mental.toFixed(1)}`);
  console.log(`  Health: ${talent.stats.health.toFixed(1)}`);
  console.log(`  Burnout: ${talent.burnoutCount}\n`);
  
  const social = await runSocial();
  console.log('사교형 (동아리+봉사): 동아리/봉사 루틴');
  console.log(`  Academic: ${social.stats.academic.toFixed(1)}`);
  console.log(`  Social: ${social.stats.social.toFixed(1)}`);
  console.log(`  Talent: ${social.stats.talent.toFixed(1)}`);
  console.log(`  Mental: ${social.stats.mental.toFixed(1)}`);
  console.log(`  Health: ${social.stats.health.toFixed(1)}`);
  console.log(`  Burnout: ${social.burnoutCount}\n`);
}

main().catch(e => console.error(e));
