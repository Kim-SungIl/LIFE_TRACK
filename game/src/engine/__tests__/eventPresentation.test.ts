import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { GAME_EVENTS } from '../events';
import { PRESIDENT_CHORE_IDS } from '../events/president';
import {
  assignCurrentEvent,
  pickVariantIndex,
  presentEvent,
  schoolBandForYear,
} from '../eventPresentation';
import { applyMemorySlotFromChoice } from '../memorySystem';
import * as rng from '../rng';
import { makeChoice, makeEvent, makeState } from '../../test/fixtures';
import type { EventTextVariant, GameEvent, SchoolBand, SchoolVariants } from '../types';

const HERE = dirname(fileURLToPath(import.meta.url));
const BANDS: SchoolBand[] = ['elementary', 'middle', 'high'];
const YEAR_FOR_BAND: Record<SchoolBand, number> = { elementary: 1, middle: 3, high: 6 };

function chore(id: (typeof PRESIDENT_CHORE_IDS)[number]): GameEvent {
  const ev = GAME_EVENTS.find(e => e.id === id);
  if (!ev) throw new Error(`${id} 없음`);
  return ev;
}

function ctx(year: number, week: number, gender: 'male' | 'female' = 'male') {
  return makeState({ year, week, gender });
}

describe('schoolVariants 커버리지', () => {
  it('presidentChore_schoolBandCoverage: 잡무 3종은 초/중/고 모두 2개 이상이다', () => {
    for (const id of PRESIDENT_CHORE_IDS) {
      const ev = chore(id);
      expect(ev.schoolVariants, `${id} schoolVariants`).toBeDefined();
      for (const band of BANDS) {
        const n = ev.schoolVariants![band].length;
        expect(n, `${id} ${band} 변이 수`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('variant copy has no digits or stat names (hide-numbers)', () => {
    const forbidden = /[0-9]|academic|social|talent|mental|health|fatigueEffect|친밀도/;
    for (const id of PRESIDENT_CHORE_IDS) {
      for (const band of BANDS) {
        for (const v of chore(id).schoolVariants![band]) {
          const blob = [v.description, ...v.choices.flatMap(c => [c.text, c.message])].join('\n');
          expect(blob, `${id} ${band}`).not.toMatch(forbidden);
        }
      }
    }
  });
});

describe('presentEvent 결정론', () => {
  it('same_state_same_variant: 같은 year/week/gender는 항상 같은 본문이다', () => {
    const ev = chore('president-errand');
    const a = presentEvent(ev, ctx(6, 10));
    const b = presentEvent(ev, ctx(6, 10));
    expect(a.description).toBe(b.description);
    expect(a.choices.map(c => c.text)).toEqual(b.choices.map(c => c.text));
  });

  it('presentEvent_is_idempotent: 구운 이벤트에 다시 적용해도 같다', () => {
    const ev = chore('president-mediate');
    const once = presentEvent(ev, ctx(3, 11));
    const twice = presentEvent(once, ctx(3, 11));
    expect(twice.description).toBe(once.description);
    expect(twice.choices[0].text).toBe(once.choices[0].text);
  });

  it('rotation_not_always_index_0: 같은 학교급에서 주차가 바뀌면 본문이 갈린다', () => {
    const ev = chore('president-speech');
    const w5 = presentEvent(ev, ctx(1, 5));
    const w6 = presentEvent(ev, ctx(1, 6));
    expect(pickVariantIndex(1, 5, 2)).not.toBe(pickVariantIndex(1, 6, 2));
    expect(w5.description, 'rotation_not_always_index_0').not.toBe(w6.description);
  });

  it('school_band_not_constant_elementary: 초/중/고 본문이 서로 다르다', () => {
    const ev = chore('president-errand');
    const week = 6; // absWeek % 2 === 0 → 각 밴드 [0]
    const texts = BANDS.map(band => presentEvent(ev, ctx(YEAR_FOR_BAND[band], week)).description);
    expect(new Set(texts).size, 'school_band_not_constant_elementary').toBe(3);
    expect(schoolBandForYear(1)).toBe('elementary');
    expect(schoolBandForYear(3)).toBe('middle');
    expect(schoolBandForYear(6)).toBe('high');
  });

  it('rngSeed_sequence_unchanged: 변이 선택은 seededRandom을 부르지 않는다', () => {
    const ev = chore('president-errand');
    const state = ctx(6, 10);
    const before = state.rngSeed;
    const spy = vi.spyOn(rng, 'seededRandom');
    presentEvent(ev, state);
    expect(state.rngSeed, 'rngSeed_sequence_unchanged').toBe(before);
    expect(spy, 'rngSeed_sequence_unchanged').not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('변이 × 효과·기억 슬롯', () => {
  it('choice_effects_identical_across_variants: 효과는 변이와 무관하게 카탈로그와 같다', () => {
    for (const id of PRESIDENT_CHORE_IDS) {
      const catalog = chore(id);
      for (const band of BANDS) {
        for (const week of [5, 6]) {
          const presented = presentEvent(catalog, ctx(YEAR_FOR_BAND[band], week));
          for (let i = 0; i < catalog.choices.length; i++) {
            expect(presented.choices[i].effects, 'choice_effects_identical_across_variants')
              .toEqual(catalog.choices[i].effects);
            expect(presented.choices[i].fatigueEffect).toBe(catalog.choices[i].fatigueEffect);
            expect(presented.choices[i].moneyEffect).toBe(catalog.choices[i].moneyEffect);
          }
        }
      }
    }
  });

  it('choice_effects_identical_across_variants: 변이 payload의 effects는 읽지 않는다', () => {
    const catalog = chore('president-errand');
    const poisoned = (desc: string): EventTextVariant => ({
      description: desc,
      choices: catalog.choices.map((c, i) => ({
        text: `변이 ${i}`,
        message: `메시지 ${i}`,
        ...(i === 0 ? { effects: { social: 99 } } : {}),
      })),
    } as EventTextVariant);
    const variants: SchoolVariants = {
      elementary: [poisoned('초A'), poisoned('초B')],
      middle: [poisoned('중A'), poisoned('중B')],
      high: [poisoned('고A'), poisoned('고B')],
    };
    const event: GameEvent = { ...catalog, schoolVariants: variants };
    const presented = presentEvent(event, ctx(6, 10));
    expect(presented.choices[0].effects, 'choice_effects_identical_across_variants')
      .toEqual(catalog.choices[0].effects);
    expect(presented.choices[0].effects).not.toEqual({ social: 99 });
  });

  it('memorySlotDraft·recallText는 변이와 무관하다', () => {
    const draft = {
      category: 'growth' as const,
      importance: 5,
      toneTag: 'warm' as const,
      recallText: '고정 회상 문장',
    };
    const variants: SchoolVariants = {
      elementary: [{ description: '초', choices: [{ text: 't', message: 'm1' }, { text: 't2', message: 'm2' }] }],
      middle: [{ description: '중', choices: [{ text: 't', message: 'm1' }, { text: 't2', message: 'm2' }] }],
      high: [{ description: '고', choices: [{ text: 't', message: 'm1' }, { text: 't2', message: 'm2' }] }],
    };
    const event = makeEvent({
      id: 'variant-slot-probe',
      schoolVariants: variants,
      choices: [
        makeChoice({ effects: { social: 1 }, memorySlotDraft: draft, message: '원본' }),
        makeChoice({ message: '원본2' }),
      ],
    });
    const presented = presentEvent(event, ctx(6, 10));
    expect(presented.choices[0].memorySlotDraft).toEqual(draft);
    expect(presented.choices[0].memorySlotDraft?.recallText).toBe('고정 회상 문장');

    const state = makeState({ memorySlots: [] });
    applyMemorySlotFromChoice(state, presented, 0, presented.choices[0]);
    expect(state.memorySlots).toHaveLength(1);
    expect(state.memorySlots[0].sourceEventId).toBe('variant-slot-probe');
    expect(state.memorySlots[0].recallText).toBe('고정 회상 문장');
    applyMemorySlotFromChoice(state, presented, 0, presented.choices[0]);
    expect(state.memorySlots).toHaveLength(1);
  });
});

describe('성별 × 변이', () => {
  it('variants_win_over_catalog_femaleDescription', () => {
    const event = makeEvent({
      description: '카탈로그 남',
      femaleDescription: '카탈로그 여',
      choices: [makeChoice({ text: '남 선택' })],
      femaleChoices: [makeChoice({ text: '여 선택' })],
      schoolVariants: {
        elementary: [{
          description: '변이 남',
          femaleDescription: '변이 여',
          choices: [{ text: '변이 남 선택', message: '남 결과', femaleText: '변이 여 선택', femaleMessage: '여 결과' }],
        }],
        middle: [{ description: '중', choices: [{ text: 't', message: 'm' }] }],
        high: [{ description: '고', choices: [{ text: 't', message: 'm' }] }],
      },
    });
    const male = presentEvent(event, ctx(1, 6, 'male'));
    const female = presentEvent(event, ctx(1, 6, 'female'));
    expect(male.description).toBe('변이 남');
    expect(female.description, 'variants_win_over_catalog_femaleDescription').toBe('변이 여');
    expect(female.description).not.toBe('카탈로그 여');
    expect(female.choices[0].text).toBe('변이 여 선택');
  });

  it('variant without female fields is shared by both genders', () => {
    const ev = chore('president-errand');
    const male = presentEvent(ev, ctx(1, 6, 'male'));
    const female = presentEvent(ev, ctx(1, 6, 'female'));
    expect(female.description).toBe(male.description);
    expect(female.choices[0].text).toBe(male.choices[0].text);
  });

  it('schoolVariants 없는 이벤트는 기존 femaleDescription을 쓴다', () => {
    const event = makeEvent({
      description: '남주 본문',
      femaleDescription: '여주 본문',
      choices: [makeChoice({ text: '남' })],
      femaleChoices: [makeChoice({ text: '여' })],
    });
    expect(presentEvent(event, ctx(1, 1, 'female')).description).toBe('여주 본문');
    expect(presentEvent(event, ctx(1, 1, 'male')).description).toBe('남주 본문');
  });
});

describe('currentEvent 대입 4경로', () => {
  function src(rel: string): string {
    return readFileSync(join(HERE, rel), 'utf8');
  }

  it('selectEventForWeek_uses_assignCurrentEvent', () => {
    expect(src('../gameEngine.ts'), 'selectEventForWeek_uses_assignCurrentEvent')
      .toMatch(/assignCurrentEvent\(state,\s*selection\.event,\s*state\.week\)/);
    expect(src('../gameEngine.ts')).not.toMatch(/state\.currentEvent\s*=\s*\{\s*\.\.\.selection\.event/);
  });

  it('followup_path_uses_assignCurrentEvent', () => {
    expect(src('../store.ts'), 'followup_path_uses_assignCurrentEvent')
      .toMatch(/assignCurrentEvent\(state,\s*followup,\s*occurrenceWeek\)/);
  });

  it('chain_path_uses_assignCurrentEvent', () => {
    expect(src('../store.ts'), 'chain_path_uses_assignCurrentEvent')
      .toMatch(/assignCurrentEvent\(state,\s*chainPick,\s*occurrenceWeek\)/);
  });

  it('firstScene_path_uses_assignCurrentEvent', () => {
    expect(src('../store.ts'), 'firstScene_path_uses_assignCurrentEvent')
      .toMatch(/assignCurrentEvent\(initial,\s*firstScene/);
  });

  it('assignCurrentEvent bakes variant text onto currentEvent', () => {
    const state = ctx(6, 10);
    const catalog = chore('president-errand');
    assignCurrentEvent(state, catalog, 10);
    expect(state.phase).toBe('event');
    expect(state.currentEvent?.description).toBe(presentEvent({ ...catalog, week: 10 }, state).description);
    expect(state.currentEvent?.description).not.toBe(catalog.schoolVariants!.middle[0].description);
    expect(state.currentEvent?.description).toBe(catalog.schoolVariants!.high[0].description);
  });
});
