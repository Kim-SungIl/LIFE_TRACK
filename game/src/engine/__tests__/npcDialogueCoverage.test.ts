// NPC 인사말 커버리지 — 상세 카드의 첫 화면이 '...'으로 비던 회귀 방지.
// 원인: NPC_DIALOGUES에 도윤·서아·시우·예린 키가 없어 getNpcDialogue가 '...'을 반환.
import { describe, expect, it } from 'vitest';
import { getNpcDialogue } from '../dialogues';
import { createInitialState } from '../gameEngine';
import type { GameState, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const EMPTY = '...';

// 전 캐스트 — createInitialState의 npcs가 SSOT(신규 NPC 추가 시 이 테스트가 자동으로 커버).
const ALL_NPC_IDS = createInitialState('male', PARENTS, { rngSeed: 42 }).npcs.map(n => n.id);

function stateAt(patch: Partial<GameState> = {}): GameState {
  return { ...createInitialState('male', PARENTS, { rngSeed: 42 }), ...patch };
}

describe('getNpcDialogue — 전 캐스트 커버리지', () => {
  it('모든 NPC가 친밀도 전 구간에서 빈 인사말("...")을 내지 않는다', () => {
    const missing: string[] = [];
    for (const id of ALL_NPC_IDS) {
      for (const intimacy of [0, 15, 30, 50, 65, 80, 95]) {
        for (let i = 0; i < 20; i++) { // 풀 내 랜덤 픽이라 반복 샘플링
          const line = getNpcDialogue(id, intimacy, stateAt({ year: 6, week: 12 }));
          if (line === EMPTY || line.trim() === '') missing.push(`${id}@${intimacy}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('시험기간·방학 상태에서도 빈 인사말이 없다', () => {
    for (const id of ALL_NPC_IDS) {
      // 시험기간은 학년·주차 조합에 의존하므로 여러 주차를 훑는다.
      for (const week of [3, 12, 20, 28, 36, 44]) {
        for (const isVacation of [false, true]) {
          const line = getNpcDialogue(id, 55, stateAt({ year: 6, week, isVacation }));
          expect(line, `${id} W${week} vac=${isVacation}`).not.toBe(EMPTY);
        }
      }
    }
  });

  it('신규 4인은 친밀도가 오르면 다른 티어 문장이 나온다(단일 문장 고정이 아님)', () => {
    for (const id of ['doyun', 'seoa', 'siwoo', 'yerin']) {
      const low = new Set<string>();
      const high = new Set<string>();
      for (let i = 0; i < 40; i++) {
        low.add(getNpcDialogue(id, 10, stateAt({ year: 6, week: 12 })));
        high.add(getNpcDialogue(id, 90, stateAt({ year: 6, week: 12 })));
      }
      expect(low.size, `${id} 저친밀도 풀`).toBeGreaterThan(1);
      expect(high.size, `${id} 고친밀도 풀`).toBeGreaterThan(1);
      // 티어가 실제로 갈린다 — 최상위 티어 문장이 최하위 풀에 섞여 있지 않다.
      const overlap = [...high].filter(l => low.has(l));
      expect(overlap, `${id} 티어 분리`).toEqual([]);
    }
  });

  it('미등록 id는 여전히 방어적으로 "..."을 반환한다 (폴백 계약 유지)', () => {
    expect(getNpcDialogue('nobody-here', 50, stateAt())).toBe(EMPTY);
  });
});
