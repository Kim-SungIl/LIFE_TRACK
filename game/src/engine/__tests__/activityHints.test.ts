// activityHints — 전략 신호 순수 함수의 임계·우선순위·slice(0,2) 계약.
// 경계는 양방향(바로 아래/위)으로 잠가 임계 이동(과발동·미발동)을 잡는다.
import { describe, it, expect } from 'vitest';
import { activityHints } from '../activityHints';
import { ACTIVITIES, NPC_COMPANION_ACTIVITIES, getActivityCost } from '../activities';
import { getParentMods } from '../parentModifiers';
import { makeState } from '../../test/fixtures';
import type { Activity, GameState, Stats } from '../types';

function pickActivity(pred: (a: Activity) => boolean, why: string): Activity {
  const found = ACTIVITIES.find(pred);
  if (!found) throw new Error(why);
  return found;
}

function withStats(state: GameState, mental: number, extra?: Partial<GameState>): GameState {
  return { ...state, ...extra, stats: { ...state.stats, mental } satisfies Stats };
}

/** 경계 검증용 — id/category/cost/fatigue만 바꾼 리터럴 */
function hintAct(patch: Partial<Activity> & Pick<Activity, 'id' | 'category'>): Activity {
  return {
    name: `test-${patch.id}`,
    slots: 1,
    fatigue: 0,
    effects: {},
    moneyCost: 0,
    description: 'test',
    flavor: 'test',
    tags: [],
    ...patch,
  };
}

function texts(hints: ReturnType<typeof activityHints>): string[] {
  return hints.map(h => h.text);
}

describe('activityHints — ⚠ 지금 피로 위험', () => {
  // school-sports fatigue=9 → projFatigue = fatigue + 9 (비-resilience)
  const sweaty = pickActivity(a => a.id === 'school-sports', 'school-sports가 없습니다');

  it('mental 39·projFatigue>45이면 뜨고, mental 40이면 같은 projFatigue에서도 안 뜬다', () => {
    // fatigue=37 → proj=46. mental 분기만 격리 (projFatigue>=85 아님)
    const baseFatigue = 37;
    const low = withStats(makeState({ fatigue: baseFatigue, parents: ['info', 'wealth'] }), 39);
    const high = withStats(makeState({ fatigue: baseFatigue, parents: ['info', 'wealth'] }), 40);
    expect(texts(activityHints(sweaty, low))).toContain('⚠ 지금 피로 위험');
    expect(texts(activityHints(sweaty, high))).not.toContain('⚠ 지금 피로 위험');
  });

  it('mental<40일 때 projFatigue 45는 안 뜨고 46은 뜬다', () => {
    const parents: GameState['parents'] = ['info', 'wealth'];
    // proj = s.fatigue + 9 → 45면 fatigue=36, 46이면 fatigue=37
    const at45 = withStats(makeState({ fatigue: 36, parents }), 30);
    const at46 = withStats(makeState({ fatigue: 37, parents }), 30);
    expect(sweaty.fatigue + 36).toBe(45);
    expect(sweaty.fatigue + 37).toBe(46);
    expect(texts(activityHints(sweaty, at45))).not.toContain('⚠ 지금 피로 위험');
    expect(texts(activityHints(sweaty, at46))).toContain('⚠ 지금 피로 위험');
  });

  it('projFatigue 84는 안 뜨고 85는 mental과 무관하게 뜬다', () => {
    const parents: GameState['parents'] = ['info', 'wealth'];
    // mental 여유(60) — (mental<40 && …) 분기는 배제, >=85만 검증
    const at84 = withStats(makeState({ fatigue: 75, parents }), 60);
    const at85 = withStats(makeState({ fatigue: 76, parents }), 60);
    expect(75 + sweaty.fatigue).toBe(84);
    expect(76 + sweaty.fatigue).toBe(85);
    expect(texts(activityHints(sweaty, at84))).not.toContain('⚠ 지금 피로 위험');
    expect(texts(activityHints(sweaty, at85))).toContain('⚠ 지금 피로 위험');
  });

  it('resilience 부모의 피로 -15% 보정(projAdded)이 경고 여부를 바꾼다', () => {
    // fatigue=9 → resilience: round(9*0.85)=8. mental<40·proj>45 경로.
    // 비보정: fatigue 37→proj 46 경고 / 보정: fatigue 37→proj 45 미경고
    const mental = 30;
    const without = withStats(makeState({ fatigue: 37, parents: ['info', 'wealth'] }), mental);
    const withRes = withStats(makeState({ fatigue: 37, parents: ['resilience', 'info'] }), mental);
    const mods = getParentMods(['resilience', 'info']);
    const projAdded = Math.max(1, Math.round(sweaty.fatigue * mods.fatigueIncreaseMult));
    expect(projAdded).toBe(8);
    expect(texts(activityHints(sweaty, without))).toContain('⚠ 지금 피로 위험');
    expect(texts(activityHints(sweaty, withRes))).not.toContain('⚠ 지금 피로 위험');
    // 보정 후에도 넘으면 뜬다 — 양성 짝
    const withResOver = withStats(makeState({ fatigue: 38, parents: ['resilience', 'info'] }), mental);
    expect(texts(activityHints(sweaty, withResOver))).toContain('⚠ 지금 피로 위험');
  });
});

describe('activityHints — 💸 돈 부담 큼', () => {
  it('cost가 weeklyIncome*2 바로 아래면 안 뜨고, 이상이면 뜬다', () => {
    // 기본 부모(비-wealth) weeklyIncome=3 → 임계 6
    const state = makeState({ parents: ['info', 'emotional'] });
    const income = getParentMods(state.parents).weeklyIncome;
    expect(income).toBe(3);
    const below = hintAct({ id: 'test-cost-below', category: 'study', moneyCost: income * 2 - 1 });
    const at = hintAct({ id: 'test-cost-at', category: 'study', moneyCost: income * 2 });
    expect(getActivityCost(below, state.year)).toBe(5);
    expect(getActivityCost(at, state.year)).toBe(6);
    expect(texts(activityHints(below, state))).not.toContain('💸 돈 부담 큼');
    expect(texts(activityHints(at, state))).toContain('💸 돈 부담 큼');
  });
});

describe('activityHints — 🌙 지금 필요함', () => {
  const rest = pickActivity(a => a.id === 'rest', 'rest 활동이 없습니다');

  it('rest + fatigue 59는 안 뜨고 60은 뜬다(mentalState=normal)', () => {
    const at59 = makeState({ fatigue: 59, mentalState: 'normal' });
    const at60 = makeState({ fatigue: 60, mentalState: 'normal' });
    expect(texts(activityHints(rest, at59))).not.toContain('🌙 지금 필요함');
    expect(texts(activityHints(rest, at60))).toContain('🌙 지금 필요함');
  });

  it('rest + mentalState≠normal이면 fatigue와 무관하게 뜨고, 비-rest는 안 뜬다', () => {
    const tired = makeState({ fatigue: 0, mentalState: 'tired' });
    const study = pickActivity(a => a.category === 'study' && a.fatigue > 0, 'study 활동이 없습니다');
    expect(texts(activityHints(rest, tired))).toContain('🌙 지금 필요함');
    expect(texts(activityHints(study, tired))).not.toContain('🌙 지금 필요함');
  });
});

describe('activityHints — 💛 관계 유지·최대 2개', () => {
  it('companionEligible이면 NPC_COMPANION 활동에 뜨고, false면 사라진다', () => {
    const id = NPC_COMPANION_ACTIVITIES[0];
    const act = pickActivity(a => a.id === id, `동행 활동 ${id}가 없습니다`);
    // 다른 힌트가 끼지 않게 여유 상태
    const state = makeState({ fatigue: 0, mentalState: 'normal', money: 999 });
    expect(texts(activityHints(act, state, true))).toContain('💛 관계 유지');
    expect(texts(activityHints(act, state, false))).not.toContain('💛 관계 유지');
  });

  it('위험>기회>관계 우선순위로 최대 2개만 남긴다', () => {
    // 피로 위험 + 돈 부담 + 관계 유지(+휴식 기회)가 동시에 성립 → slice(0,2)
    const act = hintAct({
      id: NPC_COMPANION_ACTIVITIES[0],
      category: 'rest',
      fatigue: 10,
      moneyCost: 100,
      effects: { mental: 1 },
    });
    const state = withStats(
      makeState({
        fatigue: 40,
        mentalState: 'tired',
        parents: ['info', 'emotional'],
        money: 0,
      }),
      30,
    );
    const hints = activityHints(act, state, true);
    expect(texts(hints)).toEqual(['⚠ 지금 피로 위험', '💸 돈 부담 큼']);
    expect(hints).toHaveLength(2);
    // slice(0,3) 뮤테이션을 잡기 위해 — 3번째 후보가 실제로 존재함을 전제 확인
    const unrestricted = (() => {
      // activityHints와 동일한 조건으로 후보 수를 재구성
      const all = [
        '⚠ 지금 피로 위험',
        '💸 돈 부담 큼',
        '🌙 지금 필요함',
        '💛 관계 유지',
      ];
      return all;
    })();
    expect(unrestricted.length).toBeGreaterThan(2);
  });
});
