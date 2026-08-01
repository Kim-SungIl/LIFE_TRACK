import { describe, expect, it } from 'vitest';
import { createInitialState } from '../gameEngine';
import {
  applyItemEffects,
  canBuyItem,
  limitKey,
  type ShopItem,
} from '../shopSystem';
import type { GameState, ParentStrength, StatKey } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const RNG_SEED = 42;

function fixture(overrides: Partial<GameState> = {}): GameState {
  return Object.assign(createInitialState('male', PARENTS, { rngSeed: RNG_SEED }), overrides);
}

/** 최소 ShopItem fixture — SHOP_ITEMS 실데이터에 결합하지 않음 */
function item(partial: Partial<ShopItem> & Pick<ShopItem, 'id' | 'price'>): ShopItem {
  return {
    name: '테스트 아이템',
    description: 'fixture',
    category: 'consumable',
    emoji: '🧪',
    effects: [],
    ...partial,
  };
}

describe('limitKey', () => {
  it('returns limitGroup when set, otherwise id', () => {
    expect(limitKey(item({ id: 'a', price: 1, limitGroup: 'outing' }))).toBe('outing');
    expect(limitKey(item({ id: 'snack-x', price: 1 }))).toBe('snack-x');
  });
});

describe('canBuyItem', () => {
  it('rejects when money is insufficient', () => {
    const state = fixture({ money: 2, year: 5 });
    expect(canBuyItem(item({ id: 'pricey', price: 3 }), state, {})).toEqual({
      ok: false,
      reason: '돈이 부족해요',
    });
  });

  it('rejects when requireYear is not met', () => {
    const state = fixture({ money: 10, year: 2 });
    // requireYear 5 → yearNames[4] = '고1'
    expect(canBuyItem(item({ id: 'tablet-x', price: 1, requireYear: 5 }), state, {})).toEqual({
      ok: false,
      reason: '고1부터 구매 가능',
    });
  });

  it('rejects when requireStat is not met', () => {
    const state = fixture({ money: 10, year: 1 });
    state.stats.academic = 40;
    const shopItem = item({
      id: 'stat-gate',
      price: 1,
      requireStat: { stat: 'academic' as StatKey, min: 50 },
    });
    expect(canBuyItem(shopItem, state, {})).toEqual({
      ok: false,
      reason: '학업 50 이상 필요',
    });
  });

  it('rejects requireBirthday items when no met friend has a birthday this week', () => {
    // 생일 주차는 GAME_EVENTS의 *-birthday 이벤트에서 파생(jihun 14 등) — week 1은 누구의 생일도 아님.
    const state = fixture({ money: 10, year: 1, week: 1 });
    expect(canBuyItem(item({ id: 'cake-x', price: 1, requireBirthday: true }), state, {})).toEqual({
      ok: false,
      reason: '생일인 친구가 있을 때만',
    });
  });

  it('allows requireBirthday items when a met friend has a birthday this week', () => {
    // jihun 생일 주차 = 14. met인 친구의 생일 주차면 게이트 통과.
    const state = fixture({ money: 10, year: 1, week: 14 });
    state.npcs.find(n => n.id === 'jihun')!.met = true;
    expect(canBuyItem(item({ id: 'cake-x', price: 1, requireBirthday: true }), state, {})).toEqual({
      ok: true,
    });
  });

  it('rejects when maxPerWeek is exceeded via weekPurchases[limitKey]', () => {
    const state = fixture({ money: 10, year: 1 });
    const shopItem = item({ id: 'snack-x', price: 1, maxPerWeek: 2, limitGroup: 'outing' });
    expect(canBuyItem(shopItem, state, { outing: 2 })).toEqual({
      ok: false,
      reason: '이번 주 구매 한도 초과',
    });
    // 한도 미만이면 통과 (다른 가드도 통과)
    expect(canBuyItem(shopItem, state, { outing: 1 })).toEqual({ ok: true });
  });

  it('rejects seasonal items outside vacation', () => {
    const state = fixture({ money: 10, year: 1, isVacation: false });
    expect(canBuyItem(item({ id: 'camp-x', price: 1, seasonal: true }), state, {})).toEqual({
      ok: false,
      reason: '방학 기간에만 구매 가능',
    });
    const vac = fixture({ money: 10, year: 1, isVacation: true });
    expect(canBuyItem(item({ id: 'camp-x', price: 1, seasonal: true }), vac, {})).toEqual({
      ok: true,
    });
  });

  it('rejects when a conflicting buff is already active', () => {
    const state = fixture({
      money: 10,
      year: 1,
      activeBuffs: [
        { id: 'energy-boost', name: '에너지', target: 'all', amount: 0.15, remainingWeeks: 3 },
      ],
    });
    const shopItem = item({
      id: 'energy-x',
      price: 1,
      effects: [{ type: 'buff', buffId: 'energy-boost', buffDuration: 1, buffTarget: 'all', buffAmount: 0.15 }],
    });
    expect(canBuyItem(shopItem, state, {})).toEqual({
      ok: false,
      reason: '이미 활성 (3주 남음)',
    });
  });

  it('returns ok when all guards pass', () => {
    const state = fixture({
      money: 10,
      year: 5,
      isVacation: true,
      activeBuffs: [],
      stats: { academic: 60, social: 30, talent: 20, mental: 50, health: 40 },
    });
    const shopItem = item({
      id: 'ok-item',
      price: 2,
      requireYear: 3,
      requireStat: { stat: 'academic', min: 50 },
      maxPerWeek: 1,
      seasonal: true,
      effects: [{ type: 'buff', buffId: 'fresh-buff', buffDuration: 2, buffTarget: 'all', buffAmount: 0.1 }],
    });
    expect(canBuyItem(shopItem, state, {})).toEqual({ ok: true });
  });

  it('returns the first failing guard when multiple conditions are violated', () => {
    // 소스 순서: money → requireYear → …  → 돈 부족이 year 미달보다 먼저
    const state = fixture({ money: 0, year: 1 });
    expect(
      canBuyItem(item({ id: 'prio', price: 5, requireYear: 5 }), state, {}),
    ).toEqual({ ok: false, reason: '돈이 부족해요' });
  });
});

describe('applyItemEffects', () => {
  it('clones state (input immutable) and applies instant + price debit', () => {
    const state = fixture({ money: 10, fatigue: 20 });
    const shopItem = item({
      id: 'heal-x',
      price: 1.5,
      name: '회복제',
      effects: [{ type: 'instant', stat: 'fatigue', value: -5 }],
    });
    const moneyBefore = state.money;
    const fatigueBefore = state.fatigue;

    const { newState, messages } = applyItemEffects(shopItem, state);

    // clone 계약 — 입력 불변
    expect(state.money).toBe(moneyBefore);
    expect(state.fatigue).toBe(fatigueBefore);
    // 효과 반영: 10 - 1.5 = 8.5, fatigue 20-5 = 15
    expect(newState.money).toBe(8.5);
    expect(newState.fatigue).toBe(15);
    expect(messages).toEqual(['회복제를 구매했다!']);
  });

  it('adds buff to newState without mutating input activeBuffs', () => {
    const state = fixture({ money: 10, activeBuffs: [] });
    const shopItem = item({
      id: 'buff-x',
      price: 2,
      name: '집중',
      effects: [{ type: 'buff', buffId: 'focus', buffDuration: 3, buffTarget: 'study', buffAmount: 0.2 }],
    });

    const { newState } = applyItemEffects(shopItem, state);

    expect(state.activeBuffs).toEqual([]);
    expect(newState.activeBuffs).toEqual([
      { id: 'focus', name: '집중', target: 'study', amount: 0.2, remainingWeeks: 3 },
    ]);
    expect(newState.money).toBe(8);
  });

  it('applies npc_intimacy via grind softcap path when targetNpcId is set', () => {
    const state = fixture({ money: 10 });
    const npc = state.npcs.find(n => n.id === 'jihun');
    if (!npc) throw new Error('jihun missing');
    npc.intimacy = 40;
    npc.met = true;

    const shopItem = item({
      id: 'gift-x',
      price: 1,
      name: '작은 선물',
      effects: [{ type: 'npc_intimacy', npcBonus: 2 }],
    });

    const { newState, messages } = applyItemEffects(shopItem, state, 'jihun');

    // 입력 NPC 불변
    expect(npc.intimacy).toBe(40);
    const out = newState.npcs.find(n => n.id === 'jihun');
    // intimacy 40 밴드(×0.8): floor(2*0.8)=1 → 41
    expect(out?.intimacy).toBe(41);
    expect(messages.some(m => m.includes('작은 선물'))).toBe(true);
    expect(newState.money).toBe(9);
  });
});
