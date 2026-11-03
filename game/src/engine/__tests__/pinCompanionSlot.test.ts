// 약속 칸 고정(weekendPlan.pinCompanionSlot) — 친구 초대를 수락할 때 주간 화면·월 계획 화면이 같이 쓴다.
// assignSlot만 쓰면 그 칸을 덮던 2칸 활동의 나머지 칸이 남아 주말 2칸에 3칸어치가 실행됐다(PR #550 3자 검수).
import { describe, expect, it } from 'vitest';
import { pinCompanionSlot } from '../weekendPlan';
import { ACTIVITIES } from '../activities';

const two = ACTIVITIES.find(a => a.slots === 2)!.id;
const three = ACTIVITIES.find(a => a.slots === 3)?.id;

describe('pinCompanionSlot', () => {
  it('pin_clears_multi_sunday: 일요일에 고정하면 토·일을 덮던 2칸 활동을 통째로 비운다', () => {
    expect(pinCompanionSlot({ activities: [two, two], npcChoices: {} }, 1, 'hang-out', 'minjae'))
      .toEqual({ activities: ['', 'hang-out'], npcChoices: { 'hang-out:1': 'minjae' } });
  });

  it('pin_clears_multi_saturday: 토요일도 같다', () => {
    expect(pinCompanionSlot({ activities: [two, two], npcChoices: {} }, 0, 'hang-out', 'minjae').activities).toEqual(['hang-out', '']);
  });

  it('pin_keeps_other: 1칸 활동이나 다른 칸의 묶음은 그대로다', () => {
    expect(pinCompanionSlot({ activities: ['reading', 'game'], npcChoices: {} }, 1, 'hang-out', 'minjae').activities).toEqual(['reading', 'hang-out']);
    expect(pinCompanionSlot({ activities: [two, two, 'reading', ''], npcChoices: {} }, 3, 'hang-out', 'minjae').activities).toEqual([two, two, 'reading', 'hang-out']);
  });

  it('pin_adjacent_runs: 같은 2칸 활동이 두 번 이어져도 덮는 묶음 하나만 비운다', () => {
    expect(pinCompanionSlot({ activities: [two, two, two, two], npcChoices: {} }, 2, 'hang-out', 'minjae').activities).toEqual([two, two, 'hang-out', '']);
  });

  it('pin_three: 3칸 활동(방학)도 통째로', () => {
    expect(three, '전제: 3칸 활동이 있다').toBeDefined();
    expect(pinCompanionSlot({ activities: [three!, three!, three!, 'reading'], npcChoices: {} }, 1, 'hang-out', 'minjae').activities).toEqual(['', 'hang-out', '', 'reading']);
  });

  it('pin_companion_keys: 칸에서 사라진 활동의 동행 기록은 지우고 남은 칸의 것은 둔다', () => {
    const r = pinCompanionSlot({ activities: ['hang-out', 'hang-out'], npcChoices: { 'hang-out:0': 'jihun', 'hang-out:1': 'subin' } }, 1, 'study-group', 'minjae');
    expect(r.npcChoices).toEqual({ 'hang-out:0': 'jihun', 'study-group:1': 'minjae' });
  });

  it('pin_pads_holes: 빈 배열이면 앞 칸을 \'\'로 편다', () => {
    expect(pinCompanionSlot({ activities: [], npcChoices: {} }, 1, 'hang-out', 'minjae').activities).toEqual(['', 'hang-out']);
  });
});
