// 재발동 셋(ANNUAL_REFIRE_IDS)과 슬롯 금지 셋(ANNUAL_EVENT_IDS)의 분리 계약.
//
// 원래 한 Set이 두 역할을 겸했다. 그래서 "축제를 매년 열고 싶다"가 곧 "축제 기억 슬롯 3건을
// 버린다"였고, 선택지가 없었다. 이 파일은 **두 축이 독립임**을 잠근다 — 셋을 다시 하나로
// 합치거나 selection.ts가 슬롯 금지 셋을 보게 되면 여기서 깨진다.
//
// 순수 함수만 잠그지 않으려고 selection 쪽은 실제 이벤트(sports-day)로 getEventForWeek를
// 통과시키고, 슬롯 쪽도 실제 이벤트(school-festival)의 draft를 쓴다.
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../gameEngine';
import {
  ANNUAL_EVENT_IDS,
  ANNUAL_REFIRE_IDS,
  applyMemorySlotFromChoice,
} from '../memorySystem';
import { getEventForWeek } from '../events/selection';
import { GAME_EVENTS } from '../events';
import type { GameEvent, GameState, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];

// 두 셋 어디에도 없고, 고정주차이며 condition이 없는 실제 이벤트 — "등재 안 하면 안 뜬다" 관찰용.
// jihun-call은 1회성이 명시된 의도다(verify-fixed-event-priority.ts, npc/doyun.ts 주석 참조).
const REFIRE_PROBE_ID = 'jihun-call';
// memorySlotDraft를 가지면서 재발동 셋에만 등재된 실제 이벤트 — 이 조합이 두 셋 분리의 존재 이유다.
const SLOT_PROBE_ID = 'school-festival';

function findEvent(id: string): GameEvent {
  const ev = GAME_EVENTS.find(e => e.id === id);
  if (!ev) throw new Error(`픽스처 전제 붕괴: ${id} 가 GAME_EVENTS에 없다`);
  return ev;
}

function fixture(overrides: Partial<GameState> = {}): GameState {
  const state = createInitialState('male', PARENTS, { rngSeed: 42 });
  state.memorySlots = [];
  return Object.assign(state, overrides);
}

// 테스트가 모듈 레벨 Set을 mutate하므로 매번 원상복구한다(누출 시 다른 파일까지 오염된다).
const addedRefire: string[] = [];
const addedAnnual: string[] = [];
function addRefire(id: string) { if (!ANNUAL_REFIRE_IDS.has(id)) { ANNUAL_REFIRE_IDS.add(id); addedRefire.push(id); } }
function addAnnual(id: string) { if (!ANNUAL_EVENT_IDS.has(id)) { ANNUAL_EVENT_IDS.add(id); addedAnnual.push(id); } }
afterEach(() => {
  for (const id of addedRefire.splice(0)) ANNUAL_REFIRE_IDS.delete(id);
  for (const id of addedAnnual.splice(0)) ANNUAL_EVENT_IDS.delete(id);
});

// 고정주차 이벤트가 "이미 발동했다"고 기록된 state — 재발동 허용 여부만 남는 상황을 만든다.
function stateWithPriorFiring(id: string): GameState {
  const def = findEvent(id);
  if (typeof def.week !== 'number') throw new Error(`픽스처 전제 붕괴: ${id} 는 고정주차가 아니다`);
  return fixture({
    year: 4,
    week: def.week,
    isVacation: false,
    events: [{ ...def, year: 2, week: def.week, resolvedChoice: 0 }],
  });
}

describe('ANNUAL 두 셋의 분리', () => {
  it('전제: 재발동 프로브는 어느 셋에도 없다', () => {
    expect(ANNUAL_REFIRE_IDS.has(REFIRE_PROBE_ID), `${REFIRE_PROBE_ID} 가 재발동 셋에 있으면 이 파일의 관찰이 무의미하다`).toBe(false);
    expect(ANNUAL_EVENT_IDS.has(REFIRE_PROBE_ID), `${REFIRE_PROBE_ID} 가 슬롯 금지 셋에 있으면 이 파일의 관찰이 무의미하다`).toBe(false);
  });

  it('전제: 슬롯 프로브는 재발동 셋에만 있다 (두 셋 분리의 존재 이유)', () => {
    expect(ANNUAL_REFIRE_IDS.has(SLOT_PROBE_ID), `${SLOT_PROBE_ID} 는 매년 열려야 한다`).toBe(true);
    expect(ANNUAL_EVENT_IDS.has(SLOT_PROBE_ID), `${SLOT_PROBE_ID} 를 슬롯 금지 셋에 넣으면 기억 슬롯 3건이 조용히 사라진다`).toBe(false);
    expect(findEvent(SLOT_PROBE_ID).choices.some(c => c.memorySlotDraft), '슬롯 draft가 없으면 이 프로브는 분리를 관찰하지 못한다').toBe(true);
  });

  it('"매년 재발동 + 슬롯 유지" 조합이 실제로 쓰이고 있다', () => {
    // 이 차집합이 비면 두 셋을 나눌 이유가 사라진 것이다(= 다시 하나로 합쳐도 되는 상태).
    const refireButKeepsSlot = [...ANNUAL_REFIRE_IDS].filter(id => !ANNUAL_EVENT_IDS.has(id));
    expect(refireButKeepsSlot).toContain(SLOT_PROBE_ID);
  });

  it('슬롯 금지 셋의 모든 이벤트는 재발동도 허용된다 (매년 오는 의례라서 슬롯을 안 만든다)', () => {
    const notRefiring = [...ANNUAL_EVENT_IDS].filter(id => !ANNUAL_REFIRE_IDS.has(id));
    expect(notRefiring, '슬롯만 막고 재발동은 막힌 이벤트 = 1회 발동인데 기억도 안 남는 사각지대').toEqual([]);
  });

  describe('재발동 축 (selection.ts)', () => {
    it('어느 셋에도 없으면 이미 발동한 고정주차 이벤트는 다시 안 뜬다', () => {
      const picked = getEventForWeek(stateWithPriorFiring(REFIRE_PROBE_ID)).event;
      expect(picked?.id).not.toBe(REFIRE_PROBE_ID);
    });

    it('재발동 셋에만 넣으면 다시 뜬다', () => {
      addRefire(REFIRE_PROBE_ID);
      const picked = getEventForWeek(stateWithPriorFiring(REFIRE_PROBE_ID)).event;
      expect(picked?.id).toBe(REFIRE_PROBE_ID);
    });

    it('슬롯 금지 셋에만 넣어도 재발동은 열리지 않는다 (selection이 그 셋을 보지 않는다)', () => {
      // 이 단언이 selection.ts가 어느 셋을 참조하는지 고정한다.
      // 다시 ANNUAL_EVENT_IDS를 보게 만들면 여기서 깨진다.
      addAnnual(REFIRE_PROBE_ID);
      const picked = getEventForWeek(stateWithPriorFiring(REFIRE_PROBE_ID)).event;
      expect(picked?.id).not.toBe(REFIRE_PROBE_ID);
    });

    it('슬롯을 가진 재발동 이벤트도 실제로 다시 뜬다 (셋 조작 없음)', () => {
      // 두 PR의 최종 산출물 — 축제가 Y2에 소진되지 않고 고등에서도 열린다.
      const picked = getEventForWeek(stateWithPriorFiring(SLOT_PROBE_ID)).event;
      expect(picked?.id).toBe(SLOT_PROBE_ID);
    });
  });

  describe('슬롯 축 (memorySystem.ts)', () => {
    const slotChoiceIndex = 0;
    const slotDraftOf = (id: string) => {
      const c = findEvent(id).choices[slotChoiceIndex];
      if (!c?.memorySlotDraft) throw new Error(`픽스처 전제 붕괴: ${id} c${slotChoiceIndex} 에 memorySlotDraft가 없다`);
      return c;
    };

    it('재발동 셋에만 있으면 슬롯이 생긴다 (매년 열리면서 기억도 남는 조합)', () => {
      // 셋을 건드리지 않는다 — school-festival의 실제 등재 상태가 이 조합이다.
      const state = fixture({ year: 5, week: 30 });
      applyMemorySlotFromChoice(state, findEvent(SLOT_PROBE_ID), slotChoiceIndex, slotDraftOf(SLOT_PROBE_ID));
      expect(state.memorySlots).toHaveLength(1);
    });

    it('슬롯 금지 셋에 있으면 슬롯이 안 생긴다', () => {
      addAnnual(SLOT_PROBE_ID);
      const state = fixture({ year: 5, week: 30 });
      applyMemorySlotFromChoice(state, findEvent(SLOT_PROBE_ID), slotChoiceIndex, slotDraftOf(SLOT_PROBE_ID));
      expect(state.memorySlots).toHaveLength(0);
    });

    it('재발동 이벤트가 여러 해 발동해도 슬롯은 1개다 (sourceEventId 중복 가드)', () => {
      const state = fixture({ year: 5, week: 30 });
      const ev = findEvent(SLOT_PROBE_ID);
      applyMemorySlotFromChoice(state, ev, slotChoiceIndex, slotDraftOf(SLOT_PROBE_ID));
      state.year = 6;
      applyMemorySlotFromChoice(state, ev, slotChoiceIndex, slotDraftOf(SLOT_PROBE_ID));
      expect(state.memorySlots).toHaveLength(1);
    });
  });
});
