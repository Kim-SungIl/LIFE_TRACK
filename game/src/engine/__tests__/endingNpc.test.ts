// NPC 엔딩 클로저 — variant 우선순위·recall 동문반복 방지·예린 제외·도윤 별도 레인.
// getTopNpcStories는 비공개이므로 calculateEnding(state).npcStories로 검증한다.
import { describe, expect, it } from 'vitest';
import { calculateEnding } from '../ending';
import { BEST_TIER, GOOD_TIER, MIN_INTIMACY } from '../endingNpc';
import { createInitialState } from '../gameEngine';
import type { GameEvent, GameState, MemorySlot, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const RNG_SEED = 42;

// 해결된 이벤트 기록 최소형 — 클로저 해석은 id/resolvedChoice/resolvedFemale만 본다.
function resolved(id: string, choiceIndex: number, female = false): GameEvent {
  return {
    id, title: id, description: '', choices: [],
    resolvedChoice: choiceIndex, resolvedFemale: female, year: 1, week: 1,
  };
}

function slot(id: string, sourceEventId: string, npcId: string, recallText: string, importance: number): MemorySlot {
  return {
    id, category: 'growth', week: 10, year: 6, sourceEventId, choiceIndex: 0,
    recallText, npcIds: [npcId], importance, phaseTag: 'late', toneTag: 'warm',
  };
}

// 지정 NPC만 임계 위로 올린 상태 — 나머지는 초기값(전원 MIN_INTIMACY 미만)이라 목록에 안 섞인다.
function stateWith(intimacies: Record<string, number>, events: GameEvent[] = [], memorySlots: MemorySlot[] = []): GameState {
  const state = createInitialState('male', PARENTS, { rngSeed: RNG_SEED });
  for (const npc of state.npcs) {
    const target = intimacies[npc.id];
    if (target !== undefined) {
      npc.met = true;
      npc.intimacy = target;
    }
  }
  state.events = events;
  state.memorySlots = memorySlots;
  return state;
}

describe('NPC 클로저 — 티어 프레임', () => {
  it('BEST/GOOD/FAINT 경계와 MIN 필터가 NPC 전용 문장을 고른다', () => {
    expect(calculateEnding(stateWith({ jihun: BEST_TIER })).npcStories[0]).toContain('12년째');
    expect(calculateEnding(stateWith({ jihun: BEST_TIER - 1 })).npcStories[0]).toContain('말보다 몸이 먼저');
    expect(calculateEnding(stateWith({ jihun: GOOD_TIER - 1 })).npcStories[0]).toContain('두 그림자');
    expect(calculateEnding(stateWith({ jihun: MIN_INTIMACY - 1 })).npcStories).toHaveLength(0);
  });

  it('미등록 NPC id는 기존 범용 티어 템플릿으로 폴백한다', () => {
    const state = stateWith({});
    state.npcs.push({
      id: 'zzz-custom', name: '테스트', intimacy: 90, description: '', emoji: '🙂', met: true,
    });
    expect(calculateEnding(state).npcStories[0]).toBe('테스트와는 지금도 가장 친한 친구다.');
  });
});

describe('NPC 클로저 — variant 해석', () => {
  it('variant가 티어 프레임에 우선하고, 배열 앞의 구체 조건이 먼저 매치된다', () => {
    // 못 꺼낸 한마디(c1) — best 티어여도 variant가 이긴다
    const unsaid = calculateEnding(stateWith({ jihun: 95 }, [resolved('jihun-hs-unsaid', 1)]));
    expect(unsaid.npcStories[0]).toContain('끝내 못 들은 한마디');
    // 여주 졸업(c0, resolvedFemale)이 unsaid보다 앞 — 둘 다 기록돼도 여주 variant가 선점
    const both = calculateEnding(stateWith({ jihun: 95 }, [
      resolved('jihun-hs-graduation', 0, true), resolved('jihun-hs-unsaid', 0, true),
    ]));
    expect(both.npcStories[0]).toContain('반칙이라던 그 말');
  });

  it('성별 분기는 resolvedFemale === true 기록만 인정한다', () => {
    // 남주 경로(c0, resolvedFemale=false)는 여주 졸업 variant에 매치되지 않는다
    const male = calculateEnding(stateWith({ jihun: 95 }, [resolved('jihun-hs-graduation', 0, false)]));
    expect(male.npcStories[0]).not.toContain('반칙');
    expect(male.npcStories[0]).toContain('12년째');
  });

  it('variant 매치 시 근거 이벤트발 recallText는 덧붙임에서 제외된다(동문반복 방지)', () => {
    const memories = [
      slot('m1', 'jihun-hs-unsaid', 'jihun', '둘만 남은 교실, 지훈이 끝내 못 꺼낸 한마디.', 9),
      slot('m2', 'jihun-other-event', 'jihun', '컵라면 내기에서 또 진 방과후.', 5),
    ];
    const ending = calculateEnding(stateWith({ jihun: 95 }, [resolved('jihun-hs-unsaid', 1)], memories));
    expect(ending.npcStories[0]).not.toContain('끝내 못 꺼낸 한마디.');
    expect(ending.npcStories[0]).toContain('컵라면 내기');
  });
});

describe('예린 — 결산선(c2) 제외', () => {
  it('yerin-not-a-trade c2 기록 시 예린은 근황 목록에서 빠진다', () => {
    const closed = calculateEnding(stateWith({ yerin: 75 }, [resolved('yerin-not-a-trade', 2)]));
    expect(closed.npcStories.join(' ')).not.toContain('예린');
    // c0(미수금)는 variant로 남는다
    const open = calculateEnding(stateWith({ yerin: 75 }, [resolved('yerin-not-a-trade', 0)]));
    expect(open.npcStories[0]).toContain('계산 없는 연락');
  });
});

describe('도윤 — 전출 NPC 별도 레인', () => {
  it('친밀도가 바닥이어도 이력 게이트를 통과하면 마지막 줄로 붙는다', () => {
    const state = stateWith({ jihun: 90, doyun: 20 }, [
      resolved('doyun-graduation-sign', 0), resolved('doyun-school-split', 0),
    ]);
    const stories = calculateEnding(state).npcStories;
    expect(stories).toHaveLength(2);
    expect(stories[1]).toContain('끝내 그 밥을 못 먹었다');
  });

  it('진심 서명(c0)도 창가 장면도 없으면 레인이 열리지 않는다', () => {
    const stories = calculateEnding(stateWith({ doyun: 20 }, [resolved('doyun-graduation-sign', 1)])).npcStories;
    expect(stories).toHaveLength(0);
  });

  it('창가 장면만 본 런은 기본(카톡 창) 문장, 여주 서명은 동그라미 문장', () => {
    const plain = calculateEnding(stateWith({ doyun: 20 }, [
      resolved('doyun-window-school', 1), resolved('doyun-graduation-sign', 2), resolved('doyun-school-split', 1),
    ])).npcStories;
    expect(plain[0]).toContain('마지막이 된 카톡 창');

    // 동그라미는 첫 만남 c1이 있어야 성립 — 없으면 여주 폴백(앨범 한 줄)로 내려간다 (codex P2)
    const femaleNoCircle = calculateEnding(stateWith({ doyun: 20 }, [
      resolved('doyun-graduation-sign', 1, true), resolved('doyun-window-school', 1),
    ])).npcStories;
    expect(femaleNoCircle[0]).not.toContain('동그라미');
    expect(femaleNoCircle[0]).toContain('앨범에 적어준 한 줄');

    const femaleCircle = calculateEnding(stateWith({ doyun: 20 }, [
      resolved('doyun-meet-elementary-f', 1, true), resolved('doyun-graduation-sign', 1, true),
      resolved('doyun-window-school', 1),
    ])).npcStories;
    expect(femaleCircle[0]).toContain('동그라미');
  });

  it('도윤은 친밀도가 높아도 티어 흐름에 섞이지 않는다(레인 1줄만)', () => {
    const stories = calculateEnding(stateWith({ doyun: 90 }, [resolved('doyun-graduation-sign', 0)])).npcStories;
    expect(stories).toHaveLength(1);
    expect(stories[0]).toContain('도윤');
  });
});
