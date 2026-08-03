// 신규 3인(서아·시우·예린) 스몰톡 풀 — 엔트리 부재로 범용 폴백("별 다른 일 없이")에
// 빠지던 회귀 방지. 티어·학교급 셀이 실제로 풀에 누적되는지까지 확인한다.
import { describe, expect, it } from 'vitest';
import { NPC_SMALLTALK } from '../talkData/npcSmalltalk';
import { getNpcSmalltalk } from '../talkSystem';
import { createInitialState } from '../gameEngine';
import type { GameState, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const FALLBACK = '오늘은 별 다른 일 없이 지나갔다.';

function talkState(npcId: string, intimacy: number, year: number): GameState {
  const state = createInitialState('male', PARENTS, { rngSeed: 42 });
  state.year = year;
  const npc = state.npcs.find(n => n.id === npcId)!;
  npc.met = true;
  npc.intimacy = intimacy;
  return state;
}

describe('신규 3인 스몰톡 풀', () => {
  it.each<[string, number]>([
    ['seoa', 4], ['seoa', 6], ['siwoo', 6], ['yerin', 6],
  ])('%s(Y%i)는 폴백이 아닌 캐릭터 대사를 돌려준다', (npcId, year) => {
    const line = getNpcSmalltalk(talkState(npcId, 20, year), npcId);
    expect(line).not.toBe(FALLBACK);
    expect(line.startsWith('"')).toBe(true);
  });

  it('서아는 중등·고등 티어 셀을 모두 갖고, 시우·예린은 high 셀만 갖는다 (등장 창 정합)', () => {
    const seoa = NPC_SMALLTALK.seoa;
    for (const tier of [seoa.warm, seoa.close, seoa.deep]) {
      expect(tier?.middle?.common?.length).toBeGreaterThan(0);
      expect(tier?.high?.common?.length).toBeGreaterThan(0);
      expect(tier?.elementary).toBeUndefined();
    }
    for (const id of ['siwoo', 'yerin'] as const) {
      const pool = NPC_SMALLTALK[id];
      for (const tier of [pool.warm, pool.close, pool.deep]) {
        expect(tier?.high?.common?.length).toBeGreaterThan(0);
        expect(tier?.elementary).toBeUndefined();
        expect(tier?.middle).toBeUndefined();
      }
    }
  });

  it('진행형 대화 원칙 — 종결형 폴백 문구가 풀에 섞여 있지 않다', () => {
    for (const id of ['seoa', 'siwoo', 'yerin'] as const) {
      const pool = NPC_SMALLTALK[id];
      const all = [
        ...pool.common,
        ...[pool.warm, pool.close, pool.deep].flatMap(t =>
          [t?.elementary, t?.middle, t?.high].flatMap(g => g?.common ?? [])),
      ];
      expect(all.length).toBeGreaterThanOrEqual(15);
      for (const line of all) expect(line).not.toContain('지나갔다');
    }
  });
});
