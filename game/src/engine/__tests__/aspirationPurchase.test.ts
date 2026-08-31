// T22 고가 1회성 구매(처방 C) 계약.
//
// 이 파일이 잠그는 것은 "함수가 옳게 계산한다"가 아니라 **기능이 실제로 돈다**이다.
// 이 리포의 반복된 실패는 순수함수만 잠근 테스트였다(#381 배선 누락, #397 훅 호출 삭제,
// #409 도달 가능성 누락). 그래서 여기서는 네 층을 각각 본다:
//   1) 카탈로그 리터럴 (밸런스 계약 — 가격·효과·게이트)
//   2) 구매가 상태 세 곳을 동시에 바꾸는가 (소유·영구보너스·회상)
//   3) 영구 보너스가 **processWeek의 실제 성장**에 반영되는가 (+ target 음성 대조)
//   4) 세이브를 JSON으로 왕복해도 살아남는가 (+ 구세이브 폴백)
import { describe, expect, it } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import { migrateLoadedState } from '../stateMigration';
import { SHOP_ITEMS, canBuyItem, applyItemEffects, type ShopItem } from '../shopSystem';
import type { GameState, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['emotional', 'info'];

function fixture(overrides: Partial<GameState> = {}): GameState {
  return Object.assign(createInitialState('male', PARENTS, { rngSeed: 42 }), overrides);
}

const ASPIRATION = SHOP_ITEMS.filter(i => i.category === 'aspiration');
const byId = (id: string): ShopItem => {
  const found = ASPIRATION.find(i => i.id === id);
  if (!found) throw new Error(`aspiration 아이템 없음: ${id}`);
  return found;
};

describe('T22 카탈로그 — 밸런스 리터럴', () => {
  // 가격은 빌드별 도달 개수로 설계했다(무료 1542만 → 4개 / 혼합 804만 → 3개 / 유료 326만 → 1개).
  // 총액을 내리면 사장액이 안 빠지고, 올리면 무료 빌드조차 못 산다. 그래서 리터럴로 잠근다.
  it('4종의 가격과 총액이 고정돼 있다', () => {
    expect(ASPIRATION.map(i => [i.id, i.price])).toEqual([
      ['desk-setup', 150],
      ['own-instrument', 200],
      ['language-trip', 350],
      ['admission-consulting', 300],
    ]);
    expect(ASPIRATION.reduce((a, i) => a + i.price, 0)).toBe(1000);
  });

  it('가장 싼 것도 기존 상점 최고가(태블릿 15만)의 10배 이상이다', () => {
    // "모아서 사는 것"이라는 성질 자체를 잠근다 — 주간 소액으로 내려오면 이 기능은 의미가 없다.
    const cheapest = Math.min(...ASPIRATION.map(i => i.price));
    const otherMax = Math.max(...SHOP_ITEMS.filter(i => i.category !== 'aspiration').map(i => i.price));
    expect(otherMax).toBe(15);
    expect(cheapest).toBeGreaterThanOrEqual(otherMax * 10);
  });

  it('영구 효과 크기와 대상이 고정돼 있다 (파워 나선 방지선)', () => {
    const perm = ASPIRATION.flatMap(i =>
      i.effects.filter(e => e.type === 'permanent' && e.buffAmount)
        .map(e => [i.id, e.buffTarget, e.buffAmount]));
    expect(perm).toEqual([
      ['desk-setup', 'study', 0.08],
      ['own-instrument', 'talent', 0.10],
      ['language-trip', 'all', 0.05],
      ['admission-consulting', 'study', 0.10],
    ]);
  });

  it('4종 모두 oncePerRun이고 회상 슬롯을 1칸씩 남긴다', () => {
    for (const i of ASPIRATION) {
      expect(i.oncePerRun, `${i.id}는 1회성이어야 한다`).toBe(true);
      expect(i.effects.filter(e => e.memory), `${i.id}의 회상 초안`).toHaveLength(1);
    }
  });

  it('학년·방학 게이트가 고정돼 있다', () => {
    expect(ASPIRATION.map(i => [i.id, i.requireYear ?? 1, !!i.seasonal])).toEqual([
      ['desk-setup', 1, false],
      ['own-instrument', 2, false],
      ['language-trip', 3, true],
      ['admission-consulting', 5, false],
    ]);
  });
});

describe('T22 구매 — 상태 세 곳이 함께 바뀐다', () => {
  it('구매하면 소유·영구보너스·회상이 동시에 생기고 잔액이 정확히 빠진다', () => {
    const item = byId('desk-setup');
    const state = fixture({ year: 3, week: 10, money: 500 });
    const { newState } = applyItemEffects(item, state);

    expect(newState.money).toBe(350);                       // 500 − 150
    expect(newState.ownedItems).toContain('desk-setup');
    expect(newState.permanentBonuses).toEqual([
      { id: 'perm-desk', name: '내 방 책상·PC', target: 'study', amount: 0.08 },
    ]);
    const slot = newState.memorySlots.find(m => m.sourceEventId === 'shop_desk-setup');
    expect(slot, '구매가 회상 슬롯을 남겨야 한다').toBeTruthy();
    expect(slot!.category).toBe('growth');
    expect(slot!.importance).toBe(6);
  });

  it('원본 상태는 안 바뀐다 (clone 경유)', () => {
    const state = fixture({ year: 3, week: 10, money: 500 });
    applyItemEffects(byId('desk-setup'), state);
    expect(state.money).toBe(500);
    expect(state.ownedItems).toEqual([]);
    expect(state.permanentBonuses).toEqual([]);
  });

  it('한 번 사면 다시 못 산다 — 돈이 남아도', () => {
    const item = byId('own-instrument');
    const rich = fixture({ year: 7, week: 10, money: 9999 });
    expect(canBuyItem(item, rich, {}).ok).toBe(true);

    const after = applyItemEffects(item, rich).newState;
    const check = canBuyItem(item, after, {});
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('이미 가지고 있어요');
    // 소유 판정이 잔액보다 먼저 나와야 한다 — "돈이 부족해요"가 뜨면 계속 모으게 만든다.
    expect(after.money).toBeGreaterThan(item.price);
  });

  it('음성 대조: oncePerRun이 아닌 아이템은 두 번 사도 막히지 않는다', () => {
    // ownedItems 게이트가 모든 아이템을 막아버리는 구현으로 바뀌면 여기서 잡힌다.
    const snack = SHOP_ITEMS.find(i => i.id === 'snack')!;
    expect(snack.oncePerRun).toBeUndefined();
    const s1 = fixture({ year: 3, week: 10, money: 500 });
    const s2 = applyItemEffects(snack, s1).newState;
    expect(canBuyItem(snack, s2, {}).ok).toBe(true);
    expect(s2.ownedItems).toEqual([]);   // 1회성이 아니면 소유 목록에 안 들어간다
  });

  it('게이트는 소유 목록이 아니라 oncePerRun을 읽는다', () => {
    // 앞의 음성 대조만으로는 부족했다: ownedItems에는 1회성 아이템만 들어가므로
    // `item.oncePerRun &&`를 지워도 반복 아이템은 애초에 목록에 없어 통과해버린다
    // (뮤테이션 M5가 실제로 샜다). 소유 목록에 id가 들어 있어도 반복 아이템은
    // 계속 살 수 있어야 한다 — 그래야 조건이 진짜로 읽히는 것이다.
    const snack = SHOP_ITEMS.find(i => i.id === 'snack')!;
    const state = fixture({ year: 3, week: 10, money: 500, ownedItems: ['snack'] });
    expect(canBuyItem(snack, state, {}).ok).toBe(true);
  });

  it('중복 부여 방지: 같은 영구 보너스가 두 번 쌓이지 않는다', () => {
    const item = byId('desk-setup');
    const once = applyItemEffects(item, fixture({ year: 3, week: 10, money: 900 })).newState;
    const twice = applyItemEffects(item, once).newState;   // 게이트를 우회해 직접 호출
    expect(twice.permanentBonuses).toHaveLength(1);
    expect(twice.ownedItems).toEqual(['desk-setup']);
  });
});

describe('T22 영구 보너스가 실제 주간 성장에 반영된다', () => {
  function weekWith(bonuses: GameState['permanentBonuses']): GameState {
    return processWeek(fixture({
      year: 3, week: 10, money: 500,
      stats: { academic: 40, social: 40, talent: 20, mental: 70, health: 70 },
      routineSlot2: 'self-study', routineSlot3: 'self-study',
      weekendChoices: ['self-study'],
      permanentBonuses: bonuses,
    }));
  }

  it('study 보너스가 붙으면 학업이 더 오른다 (배선 확인)', () => {
    const off = weekWith([]);
    const on = weekWith([{ id: 'perm-desk', name: '내 방 책상·PC', target: 'study', amount: 0.08 }]);
    expect(on.stats.academic).toBeGreaterThan(off.stats.academic);
  });

  it('음성 대조: 대상 카테고리가 다르면 안 붙는다', () => {
    // target 필터를 지우고 전부 합산하는 구현이면 여기서 잡힌다.
    const off = weekWith([]);
    const wrong = weekWith([{ id: 'perm-instrument', name: '내 악기', target: 'talent', amount: 0.10 }]);
    expect(wrong.stats.academic).toBe(off.stats.academic);
  });

  it("target 'all'은 카테고리와 무관하게 붙는다", () => {
    const off = weekWith([]);
    const all = weekWith([{ id: 'perm-abroad', name: '여름 어학연수', target: 'all', amount: 0.05 }]);
    expect(all.stats.academic).toBeGreaterThan(off.stats.academic);
  });

  it('영구 보너스는 주가 지나도 줄지 않는다 (틱다운을 안 탄다)', () => {
    let s = fixture({
      year: 3, week: 10, money: 500,
      routineSlot2: 'self-study', routineSlot3: 'self-study',
      weekendChoices: ['self-study'],
      permanentBonuses: [{ id: 'perm-desk', name: '내 방 책상·PC', target: 'study', amount: 0.08 }],
    });
    for (let i = 0; i < 12; i++) s = processWeek(s);
    expect(s.permanentBonuses).toEqual([
      { id: 'perm-desk', name: '내 방 책상·PC', target: 'study', amount: 0.08 },
    ]);
  });
});

describe('T22 세이브 왕복', () => {
  it('JSON 직렬화를 거쳐도 영구 보너스와 소유 목록이 남는다', () => {
    // remainingWeeks: Infinity 로 구현했다면 JSON에서 null이 되어 여기서 죽는다(#424와 같은 종류).
    const bought = applyItemEffects(byId('desk-setup'), fixture({ year: 3, week: 10, money: 500 })).newState;
    const reloaded = migrateLoadedState(JSON.parse(JSON.stringify(bought)) as GameState);
    expect(reloaded.permanentBonuses).toEqual(bought.permanentBonuses);
    expect(reloaded.permanentBonuses[0].amount).toBe(0.08);
    expect(reloaded.ownedItems).toEqual(['desk-setup']);
  });

  it('구세이브(필드 자체가 없음)는 빈 배열로 로드된다', () => {
    const legacy = JSON.parse(JSON.stringify(fixture({ year: 3, week: 10 }))) as Record<string, unknown>;
    delete legacy.permanentBonuses;
    delete legacy.ownedItems;
    const loaded = migrateLoadedState(legacy as unknown as GameState);
    expect(loaded.permanentBonuses).toEqual([]);
    expect(loaded.ownedItems).toEqual([]);
  });
});
