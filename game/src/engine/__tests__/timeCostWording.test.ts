// 시간을 쓰는 선택지(timeCost)의 문장이 실제로 빠지는 칸을 반만 말하지 않는가.
//
// timeCost는 다음 주에 방과후 루틴 칸과 주말(방학이면 자유) 마지막 칸을 **둘 다** 뒤에서부터 지운다
// (gameEngine applyRoutineActivities + applyWeekendActivities). 그런데 지훈 전화는 "주말에 농구하러 간다"라고만
// 적어, 월 단위 돈에서 이미 낸 학원까지 빠지는 걸 숨겼다(2026-10-23, 디렉터: 문장을 사실대로). 그래서 선택지
// 문장이 시간대를 말한다면 방과후와 주말을 함께 말해야 한다. 시간대를 아예 말하지 않는 선택지는 그대로 둔다
// (장면의 때를 말하는 건 설명문의 몫이고, 빠지는 칸은 "(이미 낸 OO 빠짐)" 표시가 말한다).
import { describe, expect, it } from 'vitest';
import { GAME_EVENTS } from '../events';
import type { EventChoice, GameEvent } from '../types';

const WEEKDAY = /방과\s?후/;
const WEEKEND = /주말|토요일|일요일/;

function halfTruths(events: readonly GameEvent[]): string[] {
  const out: string[] = [];
  for (const e of events) {
    for (const list of [e.choices ?? [], e.femaleChoices ?? []] as EventChoice[][]) {
      for (const c of list) {
        if (!c.timeCost) continue;
        const says = { weekday: WEEKDAY.test(c.text), weekend: WEEKEND.test(c.text) };
        if (says.weekday !== says.weekend) out.push(`${e.id}: "${c.text}"`);
      }
    }
  }
  return out;
}

describe('timeCost 선택지 — 빠지는 칸을 반만 말하지 않는다', () => {
  it('시간대를 말하는 선택지는 방과후와 주말을 함께 말한다', () => {
    expect(halfTruths(GAME_EVENTS)).toEqual([]);
  });

  it('지훈 전화는 두 칸을 다 말한다 (고친 자리가 다시 반쪽으로 돌아가지 않게)', () => {
    const ev = GAME_EVENTS.find(e => e.id === 'jihun-call')!;
    for (const c of [...ev.choices, ...(ev.femaleChoices ?? [])].filter(x => x.timeCost)) {
      expect(c.text).toMatch(WEEKDAY);
      expect(c.text).toMatch(WEEKEND);
    }
  });

  it('자기검사 — 주말만·방과후만 말하면 잡고, 둘 다 말하거나 시간대가 없으면 통과', () => {
    const ev = (texts: string[]) => ({ id: 't', choices: texts.map(text => ({ text, effects: {}, message: '', timeCost: 1 })) }) as unknown as GameEvent;
    expect(halfTruths([ev(['주말에 농구하러 간다'])])).toHaveLength(1);
    expect(halfTruths([ev(['방과후에 남는다'])])).toHaveLength(1);
    expect(halfTruths([ev(['방과후랑 주말 하루 비워서 농구한다', '같이 간다'])])).toHaveLength(0);
  });
});

// 시간은 무언가를 포기하는 선택지만 쓴다(2026-11-01, 디렉터: "우유 당번 하나로 방과후를 빼는 건 말이 안 된다").
// 도달 이벤트 96건이 모든 선택지에 timeCost 1을 똑같이 달아, 고를 수 있는 대가가 아니라 친해지는 데 붙는 세금이었다.
// 어느 쪽을 골라도 빠지면 "(이미 낸 OO 빠짐)" 표시도 결정에 아무 정보를 못 준다.
function uniformlyCostly(events: readonly GameEvent[]): string[] {
  const out: string[] = [];
  for (const e of events) {
    for (const list of [e.choices ?? [], e.femaleChoices ?? []] as EventChoice[][]) {
      if (list.length >= 2 && list.every(c => c.timeCost)) out.push(e.id);
    }
  }
  return out;
}

// 도달 이벤트에서 시간을 쓰는 건 방과후 한 덩어리를 함께 쓰겠다고 하는 선택지뿐이다. 늘리려면 여기에 적고 들인다.
const REACH_TIME_SPENDERS = [
  'jihun-ramen-bet: "내기 콜. 단 둘 다 끝까지"',
  'jihun-ramen-bet: "네 페이스 지키면서 같이 가자"',
  'subin-hs-studyboard: "내가 같이 외워줄게" 옆에 앉는다',
];

describe('timeCost — 시간은 무언가를 포기하는 선택지만 쓴다', () => {
  it('모든 선택지가 시간을 쓰는 이벤트는 없다', () => {
    expect(uniformlyCostly(GAME_EVENTS)).toEqual([]);
  });

  it('도달 이벤트에서 시간을 쓰는 선택지는 정해 둔 것뿐이다', () => {
    const found = new Set<string>();
    for (const e of GAME_EVENTS.filter(x => x.reach)) {
      for (const c of [...e.choices, ...(e.femaleChoices ?? [])]) if (c.timeCost) found.add(`${e.id}: ${c.text}`);
    }
    expect([...found].sort()).toEqual([...REACH_TIME_SPENDERS].sort());
  });

  it('자기검사 — 전부 쓰면 잡고, 하나라도 안 쓰거나 선택지가 하나면 통과', () => {
    const ev = (costs: (1 | undefined)[]) => ({ id: 't', choices: costs.map(timeCost => ({ text: 'x', effects: {}, message: '', timeCost })) }) as unknown as GameEvent;
    expect(uniformlyCostly([ev([1, 1])])).toEqual(['t']);
    expect(uniformlyCostly([ev([1, undefined])])).toEqual([]);
    expect(uniformlyCostly([ev([1])])).toEqual([]);
  });
});
