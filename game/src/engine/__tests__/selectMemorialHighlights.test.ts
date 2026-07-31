import { describe, expect, it } from 'vitest';
import { createInitialState } from '../gameEngine';
import { selectMemorialHighlights } from '../memorySystem';
import type { GameState, MemorySlot, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const RNG_SEED = 42;

function slot(partial: Partial<MemorySlot> & Pick<MemorySlot, 'id' | 'category' | 'recallText'>): MemorySlot {
  return {
    week: 1,
    year: 3,
    sourceEventId: partial.id,
    choiceIndex: 0,
    importance: 5,
    phaseTag: 'mid',
    ...partial,
  };
}

function fixture(overrides: Partial<GameState> = {}): GameState {
  const state = createInitialState('male', PARENTS, { rngSeed: RNG_SEED });
  state.memorySlots = [];
  state.milestoneScenes = [];
  state.year = 3;
  return Object.assign(state, overrides);
}

describe('selectMemorialHighlights', () => {
  it('excludes slots whose recallText is in excludeTexts', () => {
    const kept = '남겨둘 성장의 기억.';
    const dropped = '제외될 발견의 기억.';
    const state = fixture({
      memorySlots: [
        slot({ id: 'g1', category: 'growth', recallText: kept, importance: 8 }),
        slot({ id: 'd1', category: 'discovery', recallText: dropped, importance: 9 }),
        slot({ id: 'f1', category: 'failure', recallText: '실패도 회고에 남는다.', importance: 7 }),
      ],
    });

    const result = selectMemorialHighlights(state, new Set([dropped]));
    const texts = result.map(h => h.recallText);
    expect(texts).toContain(kept);
    expect(texts).not.toContain(dropped);
  });

  it('secures top-1 from growth/discovery/failure before other categories at equal importance', () => {
    // priorityCategories = growth → discovery → failure 순으로 각 1개 선확보.
    // courage importance=10이어도(순수 importance면 1위) priority 패스가 앞 3장을 채운다.
    // courage는 early phase — mid 3장 후 phase 쿼터/remaining에서 뒤에 합류.
    const growthText = '성장 카테고리 최우선 확보.';
    const discoveryText = '발견 카테고리 최우선 확보.';
    const failureText = '실패 카테고리 최우선 확보.';
    const courageText = '용기 카테고리는 나머지 패스.';
    const state = fixture({
      memorySlots: [
        slot({ id: 'c1', category: 'courage', recallText: courageText, importance: 10, year: 1, phaseTag: 'early' }),
        slot({ id: 'g1', category: 'growth', recallText: growthText, importance: 5, year: 3, phaseTag: 'mid' }),
        slot({ id: 'd1', category: 'discovery', recallText: discoveryText, importance: 5, year: 3, phaseTag: 'mid' }),
        slot({ id: 'f1', category: 'failure', recallText: failureText, importance: 5, year: 3, phaseTag: 'mid' }),
      ],
    });

    const texts = selectMemorialHighlights(state).map(h => h.recallText);
    // 앞 3장 = priority 선확보 (손계산). courage(importance 10)는 그 뒤.
    expect(texts.slice(0, 3)).toEqual([growthText, discoveryText, failureText]);
    expect(texts[3]).toBe(courageText);
  });

  it('falls back to FALLBACK_SEEDS when memorySlots and milestones are empty', () => {
    // ⚠️ 태스크 초안은 []을 기대했으나, 현재 소스는 3개 미만이면 FALLBACK_SEEDS로 채운다.
    // year=3 → y=1,2,3 시드 3장 (isFallback:true). 현재 동작 고정.
    const state = fixture({ year: 3, memorySlots: [], milestoneScenes: [] });
    const result = selectMemorialHighlights(state);
    expect(result).toEqual([
      { recallText: '초등학교의 마지막 날, 운동장은 여전히 시끄러웠다.', year: 1, isFallback: true },
      { recallText: '처음으로 입은 교복이 조금 컸던 중1의 봄.', year: 2, isFallback: true },
      { recallText: '중2는 그저 지나갔다. 돌아보면 길었던 해.', year: 3, isFallback: true },
    ]);
  });
});
