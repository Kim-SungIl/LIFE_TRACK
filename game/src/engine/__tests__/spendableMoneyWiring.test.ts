// 쓸 수 있는 돈 SSOT의 **배선** — 판정들이 잔액이 아니라 spendableMoney를 실제로 따르는가.
//
// spendableMoneySsot.test.ts는 소스 모양(직접 비교가 허용 목록에만 있나)을 본다. 그건 서식에 기대는
// 약한 잠금이라, 여기서는 행위를 본다: spendableMoney를 "예약 5만원이 걸린" 가짜로 바꾸면
// 이벤트 선택지·상점·확정 잠금·이벤트 조건이 **잔액은 충분한데도** 잠겨야 한다. 지금 제품의
// getSpendableMoney는 잔액을 그대로 돌려주므로, 이 배선이 없으면 월 계획의 예약이 생겨도 아무도 안 따른다.
import { describe, expect, it, vi } from 'vitest';

const RESERVED = 5;
vi.mock('../spendableMoney', () => ({
  getSpendableMoney: (s: { money: number }) => s.money - RESERVED,
  canSpend: (s: { money: number }, cost: number) => cost <= 0 || s.money - RESERVED >= cost,
  getSpendableForPlanning: (s: { money: number }) => s.money - RESERVED,
  canSpendWhilePlanning: (s: { money: number }, cost: number) => cost <= 0 || s.money - RESERVED >= cost,
}));

import { createInitialState } from '../gameEngine';
import { isChoiceUnaffordable } from '../eventPresentation';
import { SHOP_ITEMS, canBuyItem } from '../shopSystem';
import { getConfirmGate } from '../weekendPlan';
import { MINJAE_EVENTS } from '../events/npc/minjae';
import type { EventChoice } from '../types';

function stateWith(money: number) {
  const s = createInitialState('male', ['strict', 'info'], { rngSeed: 11 });
  s.money = money;
  return s;
}

describe('예약이 걸리면(가짜 5만) 잔액이 충분해도 새 지출은 잠긴다', () => {
  it('이벤트 선택지 — 잔액 7, 비용 3이면 잠긴다(쓸 수 있는 돈 2)', () => {
    const choice = { text: '', message: '', effects: {}, moneyEffect: -3 } as EventChoice;
    expect(isChoiceUnaffordable(choice, stateWith(7))).toBe(true);
    expect(isChoiceUnaffordable(choice, stateWith(8))).toBe(false); // 경계: 쓸 수 있는 돈 3 = 비용 3
  });

  it('상점 — 가격만큼 쓸 수 있어야 산다', () => {
    const item = SHOP_ITEMS.find(i => i.price > 0 && !i.requireYear)!;
    expect(item, '전제: 학년 제한 없는 유료 품목').toBeTruthy();
    expect(canBuyItem(item, stateWith(item.price), {}).ok).toBe(false);
    expect(canBuyItem(item, stateWith(item.price + RESERVED), {}).ok).toBe(true);
  });

  it('확정 잠금 — 루틴비를 쓸 수 있는 돈으로 못 내면 잠긴다', () => {
    const s = stateWith(4);
    s.isVacation = false;
    s.week = 4; // 달의 마지막 주 — 이번 달 몫이 한 주치라 내야 할 학원비가 잔액(4) 이하가 된다(월 단위 선불)
    s.routineSlot2 = 'academy';
    s.routineSlot3 = null;
    const gate = getConfirmGate(s, { skipped: [] });
    expect(gate.routineCost, '전제: 학원비가 잔액(4) 이하다').toBeLessThanOrEqual(4);
    expect(gate.routineTooExpensive).toBe(true);
    expect(gate.disabled).toBe(true);
  });

  it('이벤트 조건 — 민재 생일의 책 선물(쓸 수 있는 돈 10 이상)', () => {
    const ev = MINJAE_EVENTS.find(e => e.id === 'minjae-birthday')!;
    // MINJAE_EVENTS는 리터럴 배열이라 선택지 모양이 유니온으로 추론된다 — 계약 타입으로 읽는다.
    const choices = ev.choices as readonly EventChoice[];
    const book = choices.find(c => c.moneyEffect === -5 && c.condition)!;
    expect(book, '전제: 조건 달린 5만원 선택지').toBeTruthy();
    expect(book.condition!(stateWith(12))).toBe(false); // 잔액 12, 쓸 수 있는 돈 7
    expect(book.condition!(stateWith(15))).toBe(true);
  });
});
