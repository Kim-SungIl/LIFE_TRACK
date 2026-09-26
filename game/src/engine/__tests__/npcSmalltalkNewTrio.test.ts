// 신규 3인(서아·시우·예린) 스몰톡 풀 — 엔트리 부재로 범용 폴백("별 다른 일 없이")에
// 빠지던 회귀 방지. 티어·학교급 셀이 실제로 풀에 누적되는지까지 확인한다.
import { describe, expect, it } from 'vitest';
import { NPC_SMALLTALK, type SmalltalkBucket, type NpcSmalltalkPool } from '../talkData/npcSmalltalk';
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
    // 계절 분할(2026-09-26) 이후 티어 셀이 base·schoolOnly·vacationOnly 셋에 나뉜다.
    // "등장 창에 티어 셀이 있다"는 계약은 **세 벌 합산** 기준이어야 유지된다 —
    // 실제로 siwoo의 고등 warm 4줄은 전부 학교 시설 관찰이라 schoolOnly로 갔고 base는 비었다.
    const cell = (pool: NpcSmalltalkPool, tier: 'warm' | 'close' | 'deep', level: 'elementary' | 'middle' | 'high') =>
      [pool[tier], pool.schoolOnly?.[tier], pool.vacationOnly?.[tier]]
        .flatMap(b => b?.[level]?.common ?? []);
    const absent = (pool: NpcSmalltalkPool, tier: 'warm' | 'close' | 'deep', level: 'elementary' | 'middle' | 'high') =>
      pool[tier]?.[level] === undefined
      && pool.schoolOnly?.[tier]?.[level] === undefined
      && pool.vacationOnly?.[tier]?.[level] === undefined;

    const seoa = NPC_SMALLTALK.seoa;
    for (const tier of ['warm', 'close', 'deep'] as const) {
      expect(cell(seoa, tier, 'middle').length, `seoa.${tier}.middle`).toBeGreaterThan(0);
      expect(cell(seoa, tier, 'high').length, `seoa.${tier}.high`).toBeGreaterThan(0);
      expect(absent(seoa, tier, 'elementary'), `seoa.${tier}.elementary`).toBe(true);
    }
    for (const id of ['siwoo', 'yerin'] as const) {
      const pool = NPC_SMALLTALK[id];
      for (const tier of ['warm', 'close', 'deep'] as const) {
        expect(cell(pool, tier, 'high').length, `${id}.${tier}.high`).toBeGreaterThan(0);
        expect(absent(pool, tier, 'elementary'), `${id}.${tier}.elementary`).toBe(true);
        expect(absent(pool, tier, 'middle'), `${id}.${tier}.middle`).toBe(true);
      }
    }
  });

  it('진행형 대화 원칙 — 종결형 폴백 문구가 풀에 섞여 있지 않다', () => {
    for (const id of ['seoa', 'siwoo', 'yerin'] as const) {
      const pool = NPC_SMALLTALK[id];
      // 계절 분할(2026-09-26) 이후 같은 줄이 base·schoolOnly·vacationOnly 셋에 나뉘어 산다.
      // 톤 검사도 총량 하한도 **세 벌을 합친 풀** 기준이어야 의미가 유지된다 —
      // base만 세면 학기 전용을 옮긴 만큼 하한이 저절로 깎인다.
      const tiersOf = (t?: { common?: string[]; warm?: SmalltalkBucket; close?: SmalltalkBucket; deep?: SmalltalkBucket }) => t ? [
        ...(t.common ?? []),
        ...[t.warm, t.close, t.deep].flatMap(b =>
          [b?.elementary, b?.middle, b?.high].flatMap(g => g?.common ?? [])),
      ] : [];
      const all = [...tiersOf(pool), ...tiersOf(pool.schoolOnly), ...tiersOf(pool.vacationOnly)];
      expect(all.length).toBeGreaterThanOrEqual(15);
      for (const line of all) expect(line).not.toContain('지나갔다');
    }
  });
});
