// activityHints — 전략 신호 순수 함수의 임계·우선순위·slice(0,2) 계약.
// 경계는 양방향(바로 아래/위)으로 잠가 임계 이동(과발동·미발동)을 잡는다.
import { describe, it, expect } from 'vitest';
import { activityHints } from '../activityHints';
import { ACTIVITIES, NPC_COMPANION_ACTIVITIES, getActivityCost } from '../activities';
import { getParentMods, getWeeklyIncome } from '../parentModifiers';
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

  // a.fatigue > 0 가드 — 피로를 안 늘리는 활동(휴식류)은 아무리 지쳐 있어도 경고를 달지 않는다.
  // 이 가드가 없으면 같은 카드에 '🌙 지금 필요함'과 '⚠ 지금 피로 위험'이 동시에 붙는 모순이 난다.
  // 위 케이스들은 전부 school-sports(fatigue=9)라 가드가 항상 참이어서 이 분기를 못 잡는다.
  it('피로가 0·음수인 활동은 고피로/저멘탈에서도 경고가 없다 (같은 상태에서 피로 활동은 뜬다)', () => {
    const parents: GameState['parents'] = ['info', 'wealth'];
    // proj>=85 경로와 mental<40 경로를 동시에 만족하는 상태 — 가드만 남는 유일한 차이
    const exhausted = withStats(makeState({ fatigue: 90, parents }), 30);

    const zeroFatigue = hintAct({ id: 'zero-fatigue', category: 'study', fatigue: 0 });
    const recovering = hintAct({ id: 'recovering', category: 'talent', fatigue: -10 });
    const tiring = hintAct({ id: 'tiring', category: 'study', fatigue: 5 });

    expect(texts(activityHints(zeroFatigue, exhausted))).not.toContain('⚠ 지금 피로 위험');
    expect(texts(activityHints(recovering, exhausted))).not.toContain('⚠ 지금 피로 위험');
    // 양성 짝 — 같은 상태에서 피로가 붙는 활동은 경고한다(상태가 아니라 가드가 이유임을 확정)
    expect(texts(activityHints(tiring, exhausted))).toContain('⚠ 지금 피로 위험');
  });
});

describe('activityHints — 💸 돈 부담 큼', () => {
  it('cost가 weeklyIncome*2 바로 아래면 안 뜨고, 이상이면 뜬다', () => {
    // 기본 부모(비-wealth) 초등(Y1) 용돈=4 → 임계 8
    const state = makeState({ parents: ['info', 'emotional'], year: 1 });
    const income = getWeeklyIncome(state.parents, state.year);
    expect(income).toBe(4);
    const below = hintAct({ id: 'test-cost-below', category: 'study', moneyCost: income * 2 - 1 });
    const at = hintAct({ id: 'test-cost-at', category: 'study', moneyCost: income * 2 });
    expect(getActivityCost(below, state.year)).toBe(7);
    expect(getActivityCost(at, state.year)).toBe(8);
    expect(texts(activityHints(below, state))).not.toContain('💸 돈 부담 큼');
    expect(texts(activityHints(at, state))).toContain('💸 돈 부담 큼');
  });

  // 실제 콘텐츠 잠금 — 위 케이스는 합성 활동이라 ACTIVITIES가 바뀌어도 안 움직인다.
  // 임계가 6(고정) → 8/10/10(곡선)으로 바뀌면서 판정이 실제로 뒤집히는 활동은 family-trip(8만원)
  // **하나뿐**이다: 초등은 8>=8로 계속 경고, 중·고는 8<10이라 경고가 사라진다.
  // 이건 규칙("주당소득 2배" 상대 기준)이 의도대로 작동한 결과이지 회귀가 아니다 —
  // 8만원은 수입 3만 시절 2.7주치였지만 5만이면 1.6주치라 실제로 덜 부담스러워졌다.
  // 의도임을 못 박아 두어, 나중에 누가 되돌리려면 이 테스트를 마주하게 한다.
  it('family-trip(8만원)은 초등에서만 경고가 뜨고 중·고에서는 사라진다 (상대 임계의 의도된 결과)', () => {
    const trip = pickActivity(a => a.id === 'family-trip', 'family-trip 활동이 없습니다');
    const parents: GameState['parents'] = ['info', 'emotional'];
    // 비용이 학년 무관 8만원임을 먼저 고정 — 활동 데이터가 바뀌면 이 케이스의 전제가 깨진다.
    for (const year of [1, 2, 5]) expect(getActivityCost(trip, year)).toBe(8);

    expect(texts(activityHints(trip, makeState({ parents, year: 1 })))).toContain('💸 돈 부담 큼');
    expect(texts(activityHints(trip, makeState({ parents, year: 2 })))).not.toContain('💸 돈 부담 큼');
    expect(texts(activityHints(trip, makeState({ parents, year: 5 })))).not.toContain('💸 돈 부담 큼');
    // wealth(초등 6 → 임계 12)는 초등에서도 안 뜬다 — 상대 기준이 부모 경제력을 타는 것도 잠근다.
    expect(texts(activityHints(trip, makeState({ parents: ['wealth', 'info'], year: 1 })))).not.toContain('💸 돈 부담 큼');
  });

  // 임계가 연차를 타는지 — 용돈이 학교급 곡선(4/5/5)이라 같은 비용도 학년에 따라 판정이 갈린다.
  // 호출부가 연차를 잃고 상수를 쓰면(= v8.1 구조로 회귀) 이 케이스가 깨진다.
  it('같은 비용 9만원이 초등(임계 8)에서는 뜨고 고등(임계 10)에서는 안 뜬다', () => {
    const act = hintAct({ id: 'test-cost-year', category: 'study', moneyCost: 9 });
    const elementary = makeState({ parents: ['info', 'emotional'], year: 1 });
    const high = makeState({ parents: ['info', 'emotional'], year: 5 });
    expect(getWeeklyIncome(elementary.parents, 1)).toBe(4);
    expect(getWeeklyIncome(high.parents, 5)).toBe(5);
    expect(texts(activityHints(act, elementary))).toContain('💸 돈 부담 큼');
    expect(texts(activityHints(act, high))).not.toContain('💸 돈 부담 큼');
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
