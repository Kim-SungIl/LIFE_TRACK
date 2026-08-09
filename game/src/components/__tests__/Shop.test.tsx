// @vitest-environment jsdom
// Shop — 상점 UI 배선의 계약:
// 카테고리 탭 전환, canBuyItem 결과→disabled/라벨, 비-gift onBuy, gift→npc-select 라우팅, 닫기.
// 선물 대상 부재 NPC 게이트(전출·졸업) — isNpcInteractable SSOT와 UI 목록 정합.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { Shop } from '../Shop';
import { SHOP_CATEGORIES, SHOP_ITEMS, type ItemCategory, type ShopItem } from '../../engine/shopSystem';
import { npcAbsence } from '../../engine/relationshipSignals';
import { makeState, makeEvent, withNpc } from '../../test/fixtures';
import type { GameState } from '../../engine/types';

const DOYUN_SPLIT = makeEvent({ id: 'doyun-school-split', resolvedChoice: 0, year: 2, week: 2 });

function catLabel(cat: ItemCategory): string {
  const info = SHOP_CATEGORIES[cat];
  return `${info.emoji} ${info.name}`;
}

/** requireYear 없는 해당 카테고리 아이템 — 목록 전환 단언용 (이름 하드코딩 회피) */
function sampleItem(category: ItemCategory): ShopItem {
  const found = SHOP_ITEMS.find(i => i.category === category && !i.requireYear);
  if (!found) throw new Error(`SHOP_ITEMS에 requireYear 없는 ${category} 아이템이 없습니다`);
  return found;
}

function renderShop(stateOverrides?: Partial<GameState>) {
  const onBuy = vi.fn();
  const onClose = vi.fn();
  const state = makeState(stateOverrides);
  const utils = render(<Shop state={state} onBuy={onBuy} onClose={onClose} />);
  return { ...utils, onBuy, onClose, state };
}

describe('Shop 카테고리 탭', () => {
  it('카테고리 탭을 렌더하고, 탭 클릭 시 목록이 해당 카테고리로 전환된다', () => {
    renderShop({ year: 1, money: 99999 });
    const categories = Object.keys(SHOP_CATEGORIES) as ItemCategory[];
    for (const cat of categories) {
      expect(screen.getByRole('button', { name: catLabel(cat) })).toBeInTheDocument();
    }

    // 기본 selectedCat='consumable'
    const consumable = sampleItem('consumable');
    const growth = sampleItem('growth');
    expect(screen.getByText(consumable.name)).toBeInTheDocument();
    expect(screen.queryByText(growth.name)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: catLabel('growth') }));
    expect(screen.getByText(growth.name)).toBeInTheDocument();
    expect(screen.queryByText(consumable.name)).not.toBeInTheDocument();
  });
});

describe('Shop affordability UI 배선', () => {
  it('money=0이면 구매 버튼이 disabled이고 거부 사유 라벨을 쓴다', () => {
    renderShop({ money: 0, year: 1 });
    const rejected = screen.getAllByRole('button', { name: '돈이 부족해요' });
    expect(rejected.length).toBeGreaterThan(0);
    for (const btn of rejected) {
      expect(btn).toBeDisabled();
    }
    expect(screen.queryByRole('button', { name: '구매' })).not.toBeInTheDocument();
  });

  it('money가 충분하면 최소 1개 이상 구매 버튼이 enabled다', () => {
    renderShop({ money: 99999, year: 1 });
    const buyButtons = screen.getAllByRole('button', { name: '구매' });
    expect(buyButtons.length).toBeGreaterThan(0);
    expect(buyButtons.some(b => !b.hasAttribute('disabled'))).toBe(true);
  });
});

describe('Shop 구매 / 닫기', () => {
  it('enabled 구매(비-gift) 클릭 → onBuy(item) 1회, targetNpcId 없음', () => {
    const { onBuy } = renderShop({ money: 99999, year: 1 });
    fireEvent.click(screen.getAllByRole('button', { name: '구매' })[0]);
    expect(onBuy).toHaveBeenCalledTimes(1);
    const [item, targetNpcId] = onBuy.mock.calls[0] as [ShopItem, string | undefined];
    expect(item.category).not.toBe('gift');
    expect(targetNpcId).toBeUndefined();
    expect(onBuy.mock.calls[0]).toHaveLength(1);
  });

  it('disabled 버튼은 onClick 가드로 onBuy를 호출하지 않는다', () => {
    const { onBuy } = renderShop({ money: 0, year: 1 });
    const rejected = screen.getAllByRole('button', { name: '돈이 부족해요' })[0];
    fireEvent.click(rejected);
    expect(onBuy).not.toHaveBeenCalled();
  });

  it('닫기 ✕ → onClose 호출', () => {
    const { onClose } = renderShop();
    fireEvent.click(screen.getByRole('button', { name: '닫기 ✕' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Shop gift 라우팅', () => {
  it('gift + met npc → npc-select 모달, npc 선택 시 onBuy(item, npcId)', () => {
    const base = makeState({ money: 99999, year: 3 });
    const met = base.npcs.find(n => n.met);
    if (!met) throw new Error('fixture에 met npc가 필요합니다');

    const onBuy = vi.fn();
    render(<Shop state={base} onBuy={onBuy} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: catLabel('gift') }));
    const buyButtons = screen.getAllByRole('button', { name: '구매' });
    expect(buyButtons.length).toBeGreaterThan(0);
    fireEvent.click(buyButtons[0]);

    // 아직 onBuy 없음 — npc 선택 대기
    expect(onBuy).not.toHaveBeenCalled();

    // 목록에서 고른 gift 아이템으로 모달 제목 구성 (이름 하드코딩 회피)
    const giftItems = SHOP_ITEMS.filter(
      i => i.category === 'gift' && (!i.requireYear || base.year >= i.requireYear),
    );
    const modal = giftItems
      .map(i => screen.queryByRole('dialog', { name: `${i.emoji} ${i.name} — 누구에게 줄까?` }))
      .find(Boolean);
    expect(modal).toBeTruthy();

    fireEvent.click(within(modal!).getByRole('button', { name: new RegExp(met.name) }));
    expect(onBuy).toHaveBeenCalledTimes(1);
    const [item, npcId] = onBuy.mock.calls[0] as [ShopItem, string];
    expect(item.category).toBe('gift');
    expect(npcId).toBe(met.id);
  });

  it("gift + met npc 없음 → '아직 선물을 줄 친구가 없어요...' 표시 + onBuy 미호출", () => {
    const base = makeState({ money: 99999, year: 3 });
    const state: GameState = { ...base, npcs: base.npcs.map(n => ({ ...n, met: false })) };

    const onBuy = vi.fn();
    render(<Shop state={state} onBuy={onBuy} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: catLabel('gift') }));
    const buyButtons = screen.getAllByRole('button', { name: '구매' });
    expect(buyButtons.length).toBeGreaterThan(0);
    fireEvent.click(buyButtons[0]);

    expect(screen.getByText('아직 선물을 줄 친구가 없어요...')).toBeInTheDocument();
    expect(onBuy).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: /누구에게 줄까/ })).not.toBeInTheDocument();
  });
});

describe('Shop gift 부재 NPC 게이트', () => {
  /** gift 탭 → 첫 구매 클릭. 모달/빈 메시지 분기 전 공통 조작. */
  function openGiftBuy(state: GameState, onBuy = vi.fn()) {
    render(<Shop state={state} onBuy={onBuy} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: catLabel('gift') }));
    const buyButtons = screen.getAllByRole('button', { name: '구매' });
    expect(buyButtons.length).toBeGreaterThan(0);
    fireEvent.click(buyButtons[0]);
    return onBuy;
  }

  /** 열린 gift npc-select 모달 — 아이템 이름은 SHOP_ITEMS에서 파생 */
  function findGiftSelectModal(year: number): HTMLElement {
    const giftItems = SHOP_ITEMS.filter(
      i => i.category === 'gift' && (!i.requireYear || year >= i.requireYear),
    );
    const modal = giftItems
      .map(i => screen.queryByRole('dialog', { name: `${i.emoji} ${i.name} — 누구에게 줄까?` }))
      .find(Boolean);
    expect(modal).toBeTruthy();
    return modal as HTMLElement;
  }

  it('전출한 도윤은 선물 대상에서 빠지고 재적 친구(지훈)는 남는다', () => {
    const state = makeState({ money: 99999, year: 3, events: [DOYUN_SPLIT] });
    state.npcs = withNpc(
      withNpc(state.npcs, 'doyun', { met: true, intimacy: 45 }),
      'jihun',
      { met: true, intimacy: 50 },
    );
    const doyun = state.npcs.find(n => n.id === 'doyun')!;
    const jihun = state.npcs.find(n => n.id === 'jihun')!;
    // 전제: 전출 이벤트 id가 부재를 만든다 — id가 바뀌면 여기서 먼저 실패해야 한다.
    expect(npcAbsence(doyun, state)).toBeTruthy();
    expect(npcAbsence(jihun, state)).toBeNull();

    openGiftBuy(state);
    const modal = findGiftSelectModal(state.year);
    expect(within(modal).queryByRole('button', { name: new RegExp(doyun.name) })).toBeNull();
    expect(within(modal).getByRole('button', { name: new RegExp(jihun.name) })).toBeInTheDocument();
  });

  it('하은은 Y4·Y7에 선물 대상에서 빠지고 Y6(재적)에는 나온다', () => {
    for (const year of [4, 7] as const) {
      cleanup();
      const state = makeState({ money: 99999, year });
      state.npcs = withNpc(
        withNpc(state.npcs, 'haeun', { met: true, intimacy: 70 }),
        'jihun',
        { met: true, intimacy: 50 },
      );
      const haeun = state.npcs.find(n => n.id === 'haeun')!;
      const jihun = state.npcs.find(n => n.id === 'jihun')!;
      expect(npcAbsence(haeun, state)).toBeTruthy();
      expect(npcAbsence(jihun, state)).toBeNull();

      openGiftBuy(state);
      const modal = findGiftSelectModal(year);
      expect(within(modal).queryByRole('button', { name: new RegExp(haeun.name) })).toBeNull();
      expect(within(modal).getByRole('button', { name: new RegExp(jihun.name) })).toBeInTheDocument();
    }

    cleanup();
    const y6 = makeState({ money: 99999, year: 6 });
    y6.npcs = withNpc(
      withNpc(y6.npcs, 'haeun', { met: true, intimacy: 70 }),
      'jihun',
      { met: true, intimacy: 50 },
    );
    const haeunY6 = y6.npcs.find(n => n.id === 'haeun')!;
    const jihunY6 = y6.npcs.find(n => n.id === 'jihun')!;
    expect(npcAbsence(haeunY6, y6)).toBeNull();

    openGiftBuy(y6);
    const modalY6 = findGiftSelectModal(6);
    expect(within(modalY6).getByRole('button', { name: new RegExp(haeunY6.name) })).toBeInTheDocument();
    expect(within(modalY6).getByRole('button', { name: new RegExp(jihunY6.name) })).toBeInTheDocument();
  });

  it('재적 친구를 고르면 onBuy(item, npcId)가 그 id로 호출된다 (부재 친구 선택 경로 없음)', () => {
    const state = makeState({ money: 99999, year: 3, events: [DOYUN_SPLIT] });
    state.npcs = withNpc(
      withNpc(state.npcs, 'doyun', { met: true, intimacy: 45 }),
      'jihun',
      { met: true, intimacy: 50 },
    );
    const doyun = state.npcs.find(n => n.id === 'doyun')!;
    const jihun = state.npcs.find(n => n.id === 'jihun')!;
    expect(npcAbsence(doyun, state)).toBeTruthy();

    const onBuy = openGiftBuy(state);
    const modal = findGiftSelectModal(state.year);
    expect(within(modal).queryByRole('button', { name: new RegExp(doyun.name) })).toBeNull();

    fireEvent.click(within(modal).getByRole('button', { name: new RegExp(jihun.name) }));
    expect(onBuy).toHaveBeenCalledTimes(1);
    const [item, npcId] = onBuy.mock.calls[0] as [ShopItem, string];
    expect(item.category).toBe('gift');
    expect(npcId).toBe(jihun.id);
    expect(npcId).not.toBe(doyun.id);
  });

  it("met이지만 전원 부재면 '아직 선물을 줄 친구가 없어요...' + onBuy 미호출", () => {
    // met:false 경로와 구분 — 만난 친구는 있지만 전부 전출/부재인 상태.
    const state = makeState({ money: 99999, year: 3, events: [DOYUN_SPLIT] });
    state.npcs = withNpc(
      withNpc(state.npcs, 'doyun', { met: true, intimacy: 45 }),
      'jihun',
      { met: false },
    );
    const doyun = state.npcs.find(n => n.id === 'doyun')!;
    expect(doyun.met).toBe(true);
    expect(npcAbsence(doyun, state)).toBeTruthy();
    expect(state.npcs.filter(n => n.met).every(n => npcAbsence(n, state))).toBe(true);

    const onBuy = openGiftBuy(state);
    expect(screen.getByText('아직 선물을 줄 친구가 없어요...')).toBeInTheDocument();
    expect(onBuy).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: /누구에게 줄까/ })).not.toBeInTheDocument();
  });

  it('부재 친구가 있어도 비-gift 구매는 onBuy(item) 1회·targetNpcId 없음', () => {
    const state = makeState({ money: 99999, year: 3, events: [DOYUN_SPLIT] });
    state.npcs = withNpc(state.npcs, 'doyun', { met: true, intimacy: 45 });
    expect(npcAbsence(state.npcs.find(n => n.id === 'doyun')!, state)).toBeTruthy();

    const onBuy = vi.fn();
    render(<Shop state={state} onBuy={onBuy} onClose={vi.fn()} />);
    // 기본 탭=consumable (비-gift)
    fireEvent.click(screen.getAllByRole('button', { name: '구매' })[0]);
    expect(onBuy).toHaveBeenCalledTimes(1);
    const [item, targetNpcId] = onBuy.mock.calls[0] as [ShopItem, string | undefined];
    expect(item.category).not.toBe('gift');
    expect(targetNpcId).toBeUndefined();
    expect(onBuy.mock.calls[0]).toHaveLength(1);
  });
});
