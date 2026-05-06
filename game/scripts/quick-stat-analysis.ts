import { createInitialState } from '../src/engine/gameEngine';

console.log('=== 게임 QA: 밸런스 분석 ===\n');

// 활동 효율 분석
import { ACTIVITIES } from '../src/engine/activities';

console.log('1. 학업 활동 효율 (academic 효과):');
const studyActs = ACTIVITIES.filter(a => a.category === 'study');
for (const act of studyActs) {
  const aca = act.effects.academic || 0;
  const fatigue = act.fatigue;
  const cost = act.moneyCost;
  const efficiency = aca / (fatigue > 0 ? fatigue : 1);
  console.log(`  ${act.name}: academic=${aca}, fatigue=${fatigue}, cost=${cost}, 효율=${efficiency.toFixed(2)}`);
}

console.log('\n2. 특기/사교 활동 (비주류 스탯) 달성 경로:');
const talentActs = ACTIVITIES.filter(a => a.category === 'talent');
const socialActs = ACTIVITIES.filter(a => a.category === 'social');
console.log('  Talent 활동:');
for (const act of talentActs) {
  const tal = act.effects.talent || 0;
  console.log(`    ${act.name}: talent=${tal}, fatigue=${act.fatigue}`);
}
console.log('  Social 활동:');
for (const act of socialActs) {
  const soc = act.effects.social || 0;
  console.log(`    ${act.name}: social=${soc}, fatigue=${act.fatigue}`);
}

console.log('\n3. Mental 회복 활동 vs Fatigue 회복:');
const mentalActs = ACTIVITIES.filter(a => (a.effects.mental || 0) > 0);
const restActs = ACTIVITIES.filter(a => a.fatigue < 0);
console.log('  Mental 회복 활동:');
for (const act of mentalActs.slice(0, 5)) {
  const men = act.effects.mental || 0;
  console.log(`    ${act.name}: mental=${men}, fatigue=${act.fatigue}`);
}
console.log('  Fatigue 회복 활동:');
for (const act of restActs) {
  const fMen = act.effects.mental || 0;
  console.log(`    ${act.name}: fatigue=${act.fatigue}, mental=${fMen}`);
}

console.log('\n4. 초기 스탯 (부모 강점 미적용):');
const initial = createInitialState('male', ['emotional', 'freedom']);
console.log(`  Academic: ${initial.stats.academic}, Social: ${initial.stats.social}, Talent: ${initial.stats.talent}`);
console.log(`  Mental: ${initial.stats.mental}, Health: ${initial.stats.health}`);
console.log(`  Fatigue: ${initial.fatigue}`);

console.log('\n5. 부모 강점 영향:');
import { getParentMods } from '../src/engine/parentModifiers';
const mods = getParentMods(['wealth', 'info']);
console.log(`  wealth+info 초기 보너스:`, mods.initStatBonus);
console.log(`  주간 수입: ${mods.weeklyIncome}, 생활비: ${mods.livingCost}`);
console.log(`  학업 효율 보너스: +${(mods.studyEfficiencyBonus * 100).toFixed(0)}%`);
