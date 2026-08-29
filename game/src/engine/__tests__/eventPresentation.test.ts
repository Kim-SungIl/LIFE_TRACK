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

// 검수에서 **뮤테이션이 통과해 버린** 두 계약. 코드 주석은 위험을 명시했는데 단언이 없었다.
describe('변이 계약 — 잠그지 않으면 조용히 깨지는 것들', () => {
  it('rotation_axis_includes_year: 같은 주차라도 학년이 다르면 다른 변이를 고른다', () => {
    // absWeek를 week로 바꾸는 변이가 전 스위트를 통과했다. 같은 band 안에서 학년만 다른
    // 두 좌표가 서로 다른 인덱스를 내야 축이 살아 있다(고등 = Y5·Y6·Y7).
    const catalog = chore('president-errand');
    const n = catalog.schoolVariants!.high.length;
    expect(n, '이 단언이 성립하려면 고등 변이가 2개 이상이어야 한다').toBeGreaterThan(1);

    const week = 10;
    const indices = [5, 6, 7].map(y => pickVariantIndex(y, week, n));
    expect(new Set(indices).size, 'rotation_axis_includes_year').toBeGreaterThan(1);

    // 표현 층에서도 실제로 갈리는지 — 인덱스만 잠그면 presentEvent가 안 써도 통과한다.
    const bodies = [5, 6, 7].map(y => presentEvent({ ...catalog, week }, ctx(y, week)).description);
    expect(new Set(bodies).size, '학년이 본문까지 바꾼다').toBeGreaterThan(1);
  });

  it('rotation_axis_alive_for_every_plausible_length: 변이 개수를 늘려도 학년 축이 안 죽는다', () => {
    // 학년이 1 늘 때 인덱스 이동량이 length의 배수면 축이 죽는다. 지금 길이(2)만 확인하면
    // **길이를 바꾸는 순간 조용히 재발**한다 — 실제로 두 번 겪었다(이동량 48 → 전멸,
    // 49 = 7² → length 7에서 전멸). 그래서 특정 길이가 아니라 구간 전체를 잠근다.
    // `toEqual([])`은 양쪽이 비면 통과한다(empty-empty). 루프 범위를 좁히는 것만으로 검사가
    // 통째로 공허해지므로, **무엇을 실제로 봤는지**를 함께 잠근다.
    // **전멸만 보면 부분 퇴화를 놓친다.** 이동량 49(YEAR_MIX=1)일 때 L=14는 7학년이
    // 인덱스 2종으로 접히는데 `seen.size === 1`이 아니라서 통과한다. 그래서 "다 같지는 않다"가
    // 아니라 **min(7, L)개를 전부 채우는지**를 본다(이동량이 length와 서로소일 때의 성질).
    const weak: string[] = [];
    const checked: number[] = [];
    for (let L = 2; L <= 60; L++) {
      checked.push(L);
      for (const w of [1, 10, 25, 48]) {
        const seen = new Set([1, 2, 3, 4, 5, 6, 7].map(y => pickVariantIndex(y, w, L)));
        if (seen.size !== Math.min(7, L)) weak.push(`L=${L} w=${w}: ${seen.size}종(기대 ${Math.min(7, L)})`);
      }
    }
    // `toEqual([])`은 양쪽이 비면 통과한다(empty-empty). 루프 범위를 좁히는 것만으로 검사가
    // 통째로 공허해지므로, **무엇을 실제로 봤는지**를 함께 잠근다.
    expect(checked.length, '구간 자체가 잠겨 있어야 한다 (L=2..60)').toBe(59);
    expect(checked[0]).toBe(2);
    expect(checked[checked.length - 1]).toBe(60);
    expect(weak, 'rotation_axis_alive_for_every_plausible_length').toEqual([]);

    // 주차 축도 함께 살아 있어야 한다(학년만 섞고 주차를 잃으면 반쪽이다).
    for (const L of [2, 3, 5, 7]) {
      const byWeek = new Set([5, 6, 7, 8].map(w => pickVariantIndex(3, w, L)));
      expect(byWeek.size, `L=${L}: 주차 축`).toBeGreaterThan(1);
    }
  });

  it('variant_clears_catalog_female_fields: 구운 이벤트에 카탈로그 성별 필드가 남지 않는다', () => {
    // 남으면 resolveEvent(store)가 원본 femaleChoices를 집어 변이가 통째로 사라진다.
    // 카탈로그 잡무엔 성별 필드가 없으므로, 있는 상황을 만들어 놓고 확인한다(양성 픽스처).
    const catalog = chore('president-errand');
    const withFemale: GameEvent = {
      ...catalog,
      femaleDescription: '여성 카탈로그 본문',
      femaleChoices: catalog.choices.map((c, i) => ({ ...c, text: `여성 ${i}`, message: `여성 메시지 ${i}` })),
    };
    const baked = presentEvent({ ...withFemale, week: 10 }, ctx(6, 10, 'female'));

    expect(baked.femaleChoices, 'variant_clears_catalog_female_fields').toBeUndefined();
    expect(baked.femaleDescription).toBeUndefined();
    // 그리고 실제로 변이 문장이 이겼는지 — 삭제만 확인하면 빈 결과도 통과한다.
    expect(baked.description).toBe(catalog.schoolVariants!.high[pickVariantIndex(6, 10, catalog.schoolVariants!.high.length)].description);
    expect(baked.choices[0].message).not.toBe('여성 메시지 0');
  });

  it('presentedFemaleChoices: 여성 문장을 집은 선택지만 기록된다 (resolvedFemale 판정 근거)', () => {
    // 이벤트 단위 boolean이면 choice[1]에만 여성 문장이 있어도 choice[0]을 고른 판까지
    // 여성 경로로 샌다. 엔딩은 (이벤트, 선택지) 짝으로 갈리므로 인덱스로 남긴다.
    const catalog = chore('president-errand');
    const idx = pickVariantIndex(6, 10, catalog.schoolVariants!.high.length);

    // 여성 문장이 없는 지금의 잡무 → 비어 있다.
    expect(presentEvent({ ...catalog, week: 10 }, ctx(6, 10, 'female')).presentedFemaleChoices)
      .toBeUndefined();

    // 변이의 **두 번째 선택지에만** 여성 결과문을 얹는다.
    const high = catalog.schoolVariants!.high.map((v, i) => (i === idx
      ? { ...v, femaleDescription: '여성 변이 본문', choices: v.choices.map((c, j) => (j === 1 ? { ...c, femaleMessage: '여성 결과 1' } : c)) }
      : v));
    const withFemaleVariant: GameEvent = {
      ...catalog,
      schoolVariants: { ...catalog.schoolVariants!, high },
    };
    const baked = presentEvent({ ...withFemaleVariant, week: 10 }, ctx(6, 10, 'female'));
    expect(baked.presentedFemaleChoices, 'presentedFemaleChoices').toEqual([1]);
    expect(baked.description).toBe('여성 변이 본문');
    expect(baked.choices[1].message).toBe('여성 결과 1');

    // 남성은 여성 문장을 안 집으므로 비어 있다.
    expect(presentEvent({ ...withFemaleVariant, week: 10 }, ctx(6, 10, 'male')).presentedFemaleChoices)
      .toBeUndefined();
  });
});
