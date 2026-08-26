import { describe, expect, it } from 'vitest';
import { createInitialState } from '../gameEngine';
import {
  selectMemorialHighlights,
  selectRegretHighlights,
} from '../memorySystem';
import type { GameState, MemorySlot, NpcState, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const RNG_SEED = 42;

// selectRegretHighlights 계약 상수 — memorySystem.ts와 동일.
// (소스 주석 문자열을 파싱하지 않음 — 값 변경 시 이 상수·케이스를 함께 갱신)
const DRIFT_INTIMACY_MAX = 30; // met && intimacy<=30 → 드리프트 +1.5 (일반 npc는 +0.5)
const REGRET_CLOSING =
  '그때의 나를 탓하지 않기로 했다. 닿지 못한 채로도, 그 마음들은 있었다.';

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

function npc(partial: Partial<NpcState> & Pick<NpcState, 'id'>): NpcState {
  return {
    name: partial.id,
    intimacy: 50,
    description: '',
    emoji: '',
    met: true,
    ...partial,
  };
}

function fixture(overrides: Partial<GameState> = {}): GameState {
  const state = createInitialState('male', PARENTS, { rngSeed: RNG_SEED });
  state.memorySlots = [];
  state.milestoneScenes = [];
  state.year = 5;
  return Object.assign(state, overrides);
}

describe('selectRegretHighlights', () => {
  it('returns [] when no regret-pool slots exist (0장 허용, 폴백 없음)', () => {
    // growth+warm 만 — 후회 톤/카테고리 아님 → 풀 공백 → []
    const state = fixture({
      memorySlots: [
        slot({
          id: 'g1',
          category: 'growth',
          toneTag: 'warm',
          recallText: '따뜻한 성장의 기억만 있다.',
          importance: 9,
        }),
        slot({
          id: 'd1',
          category: 'discovery',
          toneTag: 'breakthrough',
          recallText: '발견의 순간만 남았다.',
          importance: 8,
        }),
      ],
    });
    expect(selectRegretHighlights(state)).toEqual([]);
  });

  it('filters pool to regret tones/categories only (growth/warm excluded)', () => {
    const regretText = '닿지 못한 실패의 밤.';
    // 본문 항목은 출처 슬롯을 그대로 싣는다(엔딩이 그림을 해석하는 재료) — 화해 마감 줄만 슬롯이 없다.
    const f1 = slot({
      id: 'f1',
      category: 'failure',
      toneTag: 'regret',
      recallText: regretText,
      importance: 4,
      year: 4,
      phaseTag: 'mid',
    });
    const state = fixture({
      memorySlots: [
        slot({
          id: 'g1',
          category: 'growth',
          toneTag: 'warm',
          recallText: '일반 성장은 후회 풀 밖.',
          importance: 10, // 더 높아도 풀 밖이면 후보 아님
        }),
        f1,
      ],
    });

    const result = selectRegretHighlights(state);
    // 본문 1 + closing 1
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ recallText: regretText, year: 4, slot: f1 });
    expect(result[1]).toEqual({
      recallText: REGRET_CLOSING,
      year: 5,
      isClosing: true,
    });
  });

  it('ranks drift (+1.5) above plain npc (+0.5) at equal importance', () => {
    // 손계산: importance 모두 5
    //   drift (met && intimacy<=30): 5+1.5 = 6.5 → 1위
    //   plain npc:                  5+0.5 = 5.5 → 2위
    //   no npc:                     5+0   = 5.0 → 후보만 (max 2장이라 미선정 가능)
    const driftText = '멀어진 관계의 후회.';
    const npcText = '아직 가까운 NPC의 후회.';
    const aloneText = '혼자 남은 실패의 기억.';

    const state = fixture({
      npcs: [
        npc({ id: 'jihun', met: true, intimacy: DRIFT_INTIMACY_MAX }), // 경계 포함 ≤30
        npc({ id: 'minjae', met: true, intimacy: DRIFT_INTIMACY_MAX + 1 }), // 31 → 드리프트 아님
      ],
      memorySlots: [
        // 의도적으로 alone → npc → drift 순서로 넣고, 점수가 재정렬하는지 락
        slot({
          id: 'alone',
          category: 'failure',
          recallText: aloneText,
          importance: 5,
          phaseTag: 'early',
          year: 2,
        }),
        slot({
          id: 'npc',
          category: 'betrayal',
          recallText: npcText,
          importance: 5,
          npcIds: ['minjae'],
          phaseTag: 'mid',
          year: 3,
        }),
        slot({
          id: 'drift',
          category: 'bypass',
          recallText: driftText,
          importance: 5,
          npcIds: ['jihun'],
          phaseTag: 'late',
          year: 5,
        }),
      ],
    });

    // score 손계산: drift 5+1.5=6.5 > npc 5+0.5=5.5 > alone 5.0 → 선정 순서를 함수 출력으로 검증
    const body = selectRegretHighlights(state).filter(h => !h.isClosing);
    expect(body.map(h => h.recallText)).toEqual([driftText, npcText]);
  });

  it('caps body at 2 cards and appends REGRET_CLOSING with isClosing', () => {
    const earlyText = '초반의 배신.';
    const midText = '중반의 실패.';
    const lateText = '후반의 빚.';
    const earlySlot = slot({
      id: 'b1',
      category: 'betrayal',
      recallText: earlyText,
      importance: 8,
      phaseTag: 'early',
      year: 1,
    });
    const midSlot = slot({
      id: 'f1',
      category: 'failure',
      recallText: midText,
      importance: 7,
      phaseTag: 'mid',
      year: 3,
    });
    const state = fixture({
      memorySlots: [
        earlySlot,
        midSlot,
        slot({
          id: 'u1',
          category: 'unspoken_debt',
          recallText: lateText,
          importance: 6,
          phaseTag: 'late',
          year: 6,
        }),
      ],
    });

    const result = selectRegretHighlights(state);
    // importance 8 → early, 그다음 다른 phaseTag 중 최고(7 mid). late(6)는 탈락.
    // 본문 2장은 출처 슬롯을 싣고, 화해 마감 줄만 슬롯이 없다(파생 문장이라 그릴 장면이 없다).
    expect(result).toEqual([
      { recallText: earlyText, year: 1, slot: earlySlot },
      { recallText: midText, year: 3, slot: midSlot },
      { recallText: REGRET_CLOSING, year: 5, isClosing: true },
    ]);
    // 2장째는 1장째와 다른 phaseTag + 다른 recallText
    expect(result[0].recallText).not.toBe(result[1].recallText);
  });

  it('excludes recallTexts listed in excludeTexts from the pool', () => {
    const kept = '남을 후회.';
    const dropped = '제외될 후회.';
    const state = fixture({
      memorySlots: [
        slot({
          id: 'f1',
          category: 'failure',
          recallText: dropped,
          importance: 9,
          phaseTag: 'early',
          year: 1,
        }),
        slot({
          id: 'b1',
          category: 'betrayal',
          recallText: kept,
          importance: 4,
          phaseTag: 'mid',
          year: 3,
        }),
      ],
    });

    const body = selectRegretHighlights(state, new Set([dropped])).filter(h => !h.isClosing);
    expect(body.map(h => h.recallText)).toEqual([kept]);
  });

  it('prevents dual exposure: regret top text excluded from memorial (layer order)', () => {
    // ending.ts 계약 재현:
    //   regret → (비-closing) recallText를 excludeTexts로 memorial에 전달
    // 양쪽 풀에 드는 고importance failure 슬롯이 후회 top → 회고에 없어야 함.
    const sharedText = '양쪽 풀에 드는 실패의 기억.';
    const memorialOnly = '회고 전용 성장의 기억.';
    const state = fixture({
      year: 5,
      memorySlots: [
        slot({
          id: 'shared',
          category: 'failure', // 후회 풀 + memorial priorityCategories
          toneTag: 'regret',
          recallText: sharedText,
          importance: 10,
          phaseTag: 'late',
          year: 5,
        }),
        slot({
          id: 'growth',
          category: 'growth',
          toneTag: 'warm',
          recallText: memorialOnly,
          importance: 5,
          phaseTag: 'mid',
          year: 3,
        }),
        slot({
          id: 'disc',
          category: 'discovery',
          toneTag: 'warm',
          recallText: '회고용 발견의 기억.',
          importance: 5,
          phaseTag: 'early',
          year: 2,
        }),
      ],
    });

    const regret = selectRegretHighlights(state);
    const regretBody = regret.filter(h => !h.isClosing);
    expect(regretBody[0]?.recallText).toBe(sharedText);

    const regretUsedTexts = new Set(regretBody.map(h => h.recallText));
    const memorial = selectMemorialHighlights(state, regretUsedTexts);
    expect(memorial.map(h => h.recallText)).not.toContain(sharedText);
    expect(memorial.map(h => h.recallText)).toContain(memorialOnly);
  });
});
