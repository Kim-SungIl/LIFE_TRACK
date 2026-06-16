// #4 tired 데드존 — 결정론적 A/B probe (동일 시나리오, 완주 필터 없음).
// 고정 빌드 4종을 7년(336주) 돌려 mentalState 분포를 집계한다.
// 실행: cd game && npx tsx scripts/tools/probe-tired-ab.ts
//   (stash로 gameEngine 탈출조건을 되돌린 뒤/적용한 뒤 각각 실행해 비교)

import { createInitialState, processWeek } from '../../src/engine/gameEngine';
import { getFollowupForWeek } from '../../src/engine/events';
import type { ParentStrength } from '../../src/engine/types';

type Build = { id: string; parents: [ParentStrength, ParentStrength]; r2: string; r3: string; weekend: [string, string] };

const BUILDS: Build[] = [
  { id: '그라인드(strict+info, 학원)', parents: ['strict', 'info'], r2: 'academy', r3: 'self-study', weekend: ['academy', 'self-study'] },
  { id: '학업(자습+운동)', parents: ['resilience', 'emotional'], r2: 'self-study', r3: 'light-exercise', weekend: ['self-study', 'self-study'] },
  { id: '균형(자습+동아리)', parents: ['emotional', 'wealth'], r2: 'self-study', r3: 'club', weekend: ['self-study', 'club'] },
  { id: '방치(휴식만)', parents: ['freedom', 'wealth'], r2: 'self-study', r3: 'self-study', weekend: ['self-study', 'self-study'] },
];

function runBuild(b: Build): { normal: number; tired: number; burnout: number; maxTiredStreak: number } {
  let s = createInitialState('male', b.parents);
  s.routineSlot2 = b.r2;
  s.routineSlot3 = b.r3;
  let normal = 0, tired = 0, burnout = 0, streak = 0, maxStreak = 0;
  for (let week = 0; week < 336; week++) {
    s.weekendChoices = [...b.weekend];
    s.vacationChoices = [...b.weekend];
    s = processWeek(s);
    let guard = 0;
    while (s.currentEvent && guard++ < 20) {
      const ev = s.currentEvent;
      const ch = ((s.gender === 'female' && ev.femaleChoices) ? ev.femaleChoices : ev.choices)[0];
      for (const [k, v] of Object.entries(ch.effects)) {
        const key = k as keyof typeof s.stats;
        s.stats[key] = Math.max(0, Math.min(100, s.stats[key] + (v as number)));
      }
      s.events.push({ ...ev, resolvedChoice: 0, week: s.week, year: s.year });
      s.currentEvent = null;
      const fu = getFollowupForWeek(s);
      if (fu) s.currentEvent = fu;
    }
    if (s.mentalState === 'normal') { normal++; streak = 0; }
    else if (s.mentalState === 'tired') { tired++; streak++; }
    else { burnout++; streak++; }
    if (streak > maxStreak) maxStreak = streak;
  }
  return { normal, tired, burnout, maxTiredStreak: maxStreak };
}

console.log('\n=== #4 tired A/B probe (빌드별 7년=336주 mentalState 분포) ===\n');
let totT = 0, totB = 0, totN = 0;
for (const b of BUILDS) {
  const r = runBuild(b);
  totN += r.normal; totT += r.tired; totB += r.burnout;
  const pct = (n: number) => `${(n / 336 * 100).toFixed(1)}%`;
  console.log(`${b.id}`);
  console.log(`  normal ${pct(r.normal)} · tired ${pct(r.tired)} · burnout ${pct(r.burnout)} · 최장 연속(tired+burnout) ${r.maxTiredStreak}주`);
}
const grand = totN + totT + totB;
console.log(`\n전체: normal ${(totN / grand * 100).toFixed(1)}% · tired ${(totT / grand * 100).toFixed(1)}% · burnout ${(totB / grand * 100).toFixed(1)}%`);
