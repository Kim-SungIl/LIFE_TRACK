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
