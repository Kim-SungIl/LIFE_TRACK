// #2 조사 — social 98 수렴의 출처가 활동발인지 이벤트발인지 분리 측정.
// 순수 사교-방치 빌드(club/hang-out/봉사 없음, social=0 활동만)로 7년 시뮬.
//   Run A: 이벤트 스킵 (활동 + 자연 decay만)
//   Run B: 이벤트 발동 + 첫 선택지 적용 (이벤트 social 기여 포함)
// 실행: cd game && npx tsx scripts/tools/probe-social-source.ts

import { createInitialState, processWeek } from '../../src/engine/gameEngine';
import { getFollowupForWeek } from '../../src/engine/events';
import type { ParentStrength } from '../../src/engine/types';

const PARENTS: [ParentStrength, ParentStrength] = ['wealth', 'emotional'];

function run(applyEvents: boolean): { social: number; socialByYear: number[]; eventSocial: number } {
  let s = createInitialState('male', PARENTS);
  // 순수 방치 빌드: social을 주는 활동을 전혀 쓰지 않는다.
  s.routineSlot2 = 'self-study';
  s.routineSlot3 = 'light-exercise';
  const socialByYear: number[] = [];
  let eventSocial = 0;
  let lastYear = 1;

  for (let week = 0; week < 336; week++) {
    s.weekendChoices = ['self-study', 'self-study'];
    s.vacationChoices = ['self-study', 'self-study'];
    s = processWeek(s);
    while (s.currentEvent) {
      const ev = s.currentEvent;
      if (applyEvents) {
        const ch = ((s.gender === 'female' && ev.femaleChoices) ? ev.femaleChoices : ev.choices)[0];
        for (const [k, v] of Object.entries(ch.effects)) {
          const key = k as keyof typeof s.stats;
          if (k === 'social') eventSocial += v as number;
          s.stats[key] = Math.max(0, Math.min(100, s.stats[key] + (v as number)));
        }
      }
      s.events.push({ ...ev, resolvedChoice: 0, week: s.week, year: s.year });
      s.currentEvent = null;
      const fu = getFollowupForWeek(s);
      if (fu) s.currentEvent = fu;
    }
    if (s.year !== lastYear) { socialByYear.push(Math.round(s.stats.social * 10) / 10); lastYear = s.year; }
  }
  socialByYear.push(Math.round(s.stats.social * 10) / 10);
  return { social: Math.round(s.stats.social * 10) / 10, socialByYear, eventSocial: Math.round(eventSocial * 10) / 10 };
}

console.log('\n=== #2 social 출처 분리: 순수 사교-방치 빌드(7년) ===');
console.log('빌드: 루틴 self-study/light-exercise, 주말 self-study×2 (social 주는 활동 0개)\n');

const a = run(false);
console.log('Run A — 이벤트 스킵 (활동+decay만)');
console.log('  최종 social =', a.social);
console.log('  학년말 social 추이 =', a.socialByYear.join(' → '));

const b = run(true);
console.log('\nRun B — 이벤트 발동 + 첫 선택지 적용');
console.log('  최종 social =', b.social);
console.log('  학년말 social 추이 =', b.socialByYear.join(' → '));
console.log('  이벤트가 더한 social 총량 =', b.eventSocial);

console.log('\n=== 해석 ===');
console.log(`  활동/decay만으로 social = ${a.social} (외톨이 위기 임계 <25 ${a.social < 25 ? '도달 ✓' : '미도달 ✗'})`);
console.log(`  이벤트 기여분 = ${(Math.round((b.social - a.social) * 10) / 10)} (이벤트 social 총량 ${b.eventSocial})`);
