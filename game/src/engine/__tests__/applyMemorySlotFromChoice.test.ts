import { describe, expect, it } from 'vitest';
import { createInitialState } from '../gameEngine';
import {
  ANNUAL_EVENT_IDS,
  applyMemorySlotFromChoice,
  yearToPhaseTag,
} from '../memorySystem';
import type {
  EventChoice,
  GameEvent,
  GameState,
  MemorySlotDraft,
  ParentStrength,
} from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const RNG_SEED = 42;

// applyMemorySlotFromChoice importance 게이트 — memorySystem.ts와 동일한 계약 상수.
// (소스 주석 문자열을 파싱하지 않음 — 값 변경 시 이 상수·케이스를 함께 갱신)
const MIN_IMPORTANCE_TO_SLOT = 3;

function fixture(overrides: Partial<GameState> = {}): GameState {
  const state = createInitialState('male', PARENTS, { rngSeed: RNG_SEED });
  state.memorySlots = [];
  state.year = 3;
  state.week = 12;
  return Object.assign(state, overrides);
}

function draft(partial: Partial<MemorySlotDraft> = {}): MemorySlotDraft {
  return {
    category: 'growth',
    importance: MIN_IMPORTANCE_TO_SLOT,
    recallText: '처음으로 손을 들어 말했던 그날의 교실.',
    ...partial,
  };
}

function choice(memorySlotDraft?: MemorySlotDraft): EventChoice {
  return {
    text: '선택',
    effects: {},
    message: 'ok',
    ...(memorySlotDraft ? { memorySlotDraft } : {}),
  };
}

function event(id: string): GameEvent {
  return {
    id,
    title: 't',
    description: 'd',
    choices: [],
  };
}

describe('applyMemorySlotFromChoice', () => {
  it('noops when choice.memorySlotDraft is missing', () => {
    const state = fixture();
    applyMemorySlotFromChoice(state, event('ev-a'), 0, choice());
    expect(state.memorySlots).toHaveLength(0);
  });

  it('skips when draft.importance < MIN_IMPORTANCE_TO_SLOT', () => {
    const state = fixture();
    applyMemorySlotFromChoice(
      state,
      event('ev-b'),
      0,
      choice(draft({ importance: MIN_IMPORTANCE_TO_SLOT - 1 })),
    );
    expect(state.memorySlots).toHaveLength(0);
  });

  it('skips when event.id is in ANNUAL_EVENT_IDS', () => {
    // ANNUAL_EVENT_IDS export 집합의 대표 1개 — 연간 이벤트는 슬롯 생성 금지
    const annualId = 'elementary-graduation';
    expect(ANNUAL_EVENT_IDS.has(annualId)).toBe(true);

    const state = fixture();
    applyMemorySlotFromChoice(state, event(annualId), 0, choice(draft()));
    expect(state.memorySlots).toHaveLength(0);
  });

  it('skips when a slot with the same sourceEventId already exists', () => {
    const state = fixture({
      memorySlots: [
        {
          id: 'growth_1_1_0',
          category: 'growth',
          week: 1,
          year: 1,
          sourceEventId: 'ev-dup',
          choiceIndex: 0,
          recallText: '예전에 이미 남은 기억.',
          importance: 5,
          phaseTag: 'early',
        },
      ],
    });
    applyMemorySlotFromChoice(state, event('ev-dup'), 1, choice(draft({ importance: 9 })));
    // 중복 방지 — push 없음, 기존 1개 유지
    expect(state.memorySlots).toHaveLength(1);
    expect(state.memorySlots[0].id).toBe('growth_1_1_0');
  });

  it('pushes one slot when guards pass (id/phaseTag/source fields)', () => {
    const state = fixture({ year: 5, week: 8 });
    const d = draft({
      category: 'discovery',
      importance: 7,
      toneTag: 'warm',
      npcIds: ['jihun'],
      recallText: '새 반에서 이름을 부르던 첫 아침.',
    });
    const choiceIndex = 2;

    applyMemorySlotFromChoice(state, event('ev-ok'), choiceIndex, choice(d));

    // in-place mutate 계약 — 호출 후 길이/내용으로 락 (불변성 단언 금지)
    expect(state.memorySlots).toHaveLength(1);
    const slot = state.memorySlots[0];
    // id 규약: {category}_{year}_{week}_{choiceIndex}
    expect(slot.id).toBe(`discovery_5_8_${choiceIndex}`);
    expect(slot.sourceEventId).toBe('ev-ok');
    expect(slot.importance).toBe(7);
    expect(slot.category).toBe('discovery');
    expect(slot.choiceIndex).toBe(choiceIndex);
    expect(slot.recallText).toBe(d.recallText);
    expect(slot.npcIds).toEqual(['jihun']);
    expect(slot.toneTag).toBe('warm');
    // phaseTag는 yearToPhaseTag(state.year)와 일치 — year 5 → late (손계산)
    expect(slot.phaseTag).toBe('late');
    expect(slot.phaseTag).toBe(yearToPhaseTag(5));
  });

  it('creates a slot at exactly MIN_IMPORTANCE_TO_SLOT (inclusive gate)', () => {
    const state = fixture();
    applyMemorySlotFromChoice(
      state,
      event('ev-min'),
      0,
      choice(draft({ importance: MIN_IMPORTANCE_TO_SLOT })),
    );
    expect(state.memorySlots).toHaveLength(1);
    expect(state.memorySlots[0].importance).toBe(MIN_IMPORTANCE_TO_SLOT);
  });
});
