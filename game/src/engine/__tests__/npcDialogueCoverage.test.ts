// NPC 인사말 커버리지 — 상세 카드의 첫 화면이 '...'으로 비던 회귀 방지.
// 원인: NPC_DIALOGUES에 도윤·서아·시우·예린 키가 없어 getNpcDialogue가 '...'을 반환.
//
// ⚠️ 상태 선택 주의: getNpcDialogue는 priority 내림차순 첫 매칭이라 시험(90)·방학(85)이
// 친밀도 풀(80/60/0)을 통째로 가린다. 초판이 year:6, week:12를 썼는데 Y6 스케줄에
// 12: 'mock'이 있어 그 주가 시험기간(examSystem.getExamSchedule) — 친밀도를 0~65로 훑어도
// 전부 시험 풀만 나와서 p60·p0 폴백에 도달하는 테스트가 하나도 없었다. 평시 주차는 W3.
import { describe, expect, it } from 'vitest';
import { getNpcDialogue, NPC_DIALOGUES } from '../dialogues';
import { NPC_SMALLTALK } from '../talkData/npcSmalltalk';
import { createInitialState } from '../gameEngine';
import { isExamPeriod } from '../examSystem';
import type { GameState, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const EMPTY = '...';
const NEW_FOUR = ['doyun', 'seoa', 'siwoo', 'yerin'];

// 전 캐스트 — createInitialState의 npcs가 SSOT(신규 NPC 추가 시 이 테스트가 자동으로 커버).
const ALL_NPC_IDS = createInitialState('male', PARENTS, { rngSeed: 42 }).npcs.map(n => n.id);

function stateAt(patch: Partial<GameState> = {}): GameState {
  return { ...createInitialState('male', PARENTS, { rngSeed: 42 }), ...patch };
}

// 평시(비시험·비방학) — 친밀도 티어 풀에 실제로 도달하는 유일한 상태.
function plainState(patch: Partial<GameState> = {}): GameState {
  return stateAt({ year: 6, week: 3, isVacation: false, ...patch });
}

function expectSpoken(line: string, ctx: string) {
  // undefined가 string으로 새는 경로(빈 풀)까지 잡으려면 not.toBe('...')로는 부족하다.
  expect(typeof line, ctx).toBe('string');
  expect(line, ctx).not.toBe(EMPTY);
  expect(line.trim(), ctx).not.toBe('');
}

describe('getNpcDialogue — 전 캐스트 커버리지', () => {
  it('테스트가 쓰는 평시 주차는 실제로 시험기간이 아니다 (풀 도달 전제)', () => {
    expect(isExamPeriod(6, 3)).toBe(false);
    expect(isExamPeriod(1, 3)).toBe(false);
  });

  it('모든 NPC가 친밀도 전 구간에서 빈 인사말을 내지 않는다 (평시)', () => {
    for (const id of ALL_NPC_IDS) {
      for (const intimacy of [0, 15, 30, 50, 65, 80, 95]) {
        for (let i = 0; i < 20; i++) { // 풀 내 랜덤 픽이라 반복 샘플링
          expectSpoken(getNpcDialogue(id, intimacy, plainState()), `${id}@${intimacy}`);
        }
      }
    }
  });

  it('시험기간·방학 상태에서도 빈 인사말이 없다', () => {
    for (const id of ALL_NPC_IDS) {
      // 시험기간은 학년·주차 조합에 의존하므로 여러 주차를 훑는다.
      for (const week of [3, 8, 12, 17, 22, 30, 38, 44]) {
        for (const isVacation of [false, true]) {
          for (const intimacy of [0, 40, 90]) {
            const line = getNpcDialogue(id, intimacy, stateAt({ year: 6, week, isVacation }));
            expectSpoken(line, `${id} W${week} vac=${isVacation} int=${intimacy}`);
          }
        }
      }
    }
  });

  it('신규 4인은 친밀도 티어(0/30·50/80)가 실제로 갈린다 — 평시 기준', () => {
    for (const id of NEW_FOUR) {
      const sample = (int: number) => {
        const s = new Set<string>();
        for (let i = 0; i < 40; i++) s.add(getNpcDialogue(id, int, plainState()));
        return s;
      };
      const low = sample(10);   // p0 폴백
      const mid = sample(40);   // p60
      const high = sample(90);  // p100
      for (const [label, set] of [['저', low], ['중', mid], ['고', high]] as const) {
        expect(set.size, `${id} ${label}친밀도 풀`).toBeGreaterThan(1);
      }
      // 세 티어가 서로 다른 풀이어야 한다 — 임계(30/50/80)가 깨지면 여기서 겹친다.
      expect([...high].filter(l => low.has(l)), `${id} 고↔저 분리`).toEqual([]);
      expect([...high].filter(l => mid.has(l)), `${id} 고↔중 분리`).toEqual([]);
      expect([...mid].filter(l => low.has(l)), `${id} 중↔저 분리`).toEqual([]);
    }
  });

  it('도윤의 "6학년도 끝" 인사말은 겨울방학 중 졸업식 전에만 나온다', () => {
    const sample = (week: number) => {
      const s = new Set<string>();
      for (let i = 0; i < 60; i++) s.add(getNpcDialogue('doyun', 55, stateAt({ year: 1, week, isVacation: true })));
      return [...s];
    };
    // 여름방학(W20~24) — 2학기가 남아 있어 미래형이 이르다.
    expect(sample(22).some(l => l.includes('6학년도 끝'))).toBe(false);
    expect(sample(22).some(l => l.includes('중학교 가면'))).toBe(false);
    // 겨울방학이되 초등 졸업식(Y1 W46) 전.
    expect(sample(45).some(l => l.includes('6학년도 끝'))).toBe(true);
    // 졸업식 뒤 — 이미 끝난 뒤라 미래형이 모순.
    expect(sample(47).some(l => l.includes('6학년도 끝'))).toBe(false);
  });

  it('미등록 id는 여전히 방어적으로 "..."을 반환한다 (폴백 계약 유지)', () => {
    expect(getNpcDialogue('nobody-here', 50, stateAt())).toBe(EMPTY);
  });
});

// 인사말은 상세 카드에, 잡담은 '말 걸기'에 — NpcDetailModal이 둘을 같은 말풍선 자리에
// 연속으로 띄운다. 문장이 겹치면 말을 걸어도 아무 일 없는 것처럼 보인다.
describe('인사말 ↔ 잡담 문장 중복 금지', () => {
  const norm = (s: string) => s.replace(/["'…\s.?!,~]/g, '');

  function smalltalkLinesOf(npcId: string): string[] {
    const entry = NPC_SMALLTALK[npcId];
    if (!entry) return [];
    const out: string[] = [];
    const walk = (v: unknown) => {
      if (typeof v === 'string') out.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(entry);
    return out;
  }

  it('NPC별로 인사말과 잡담이 같은 문장을 쓰지 않는다', () => {
    const collisions: string[] = [];
    for (const id of ALL_NPC_IDS) {
      const smalltalk = new Set(smalltalkLinesOf(id).map(norm));
      for (const pool of NPC_DIALOGUES[id] ?? []) {
        for (const line of pool.lines) {
          if (smalltalk.has(norm(line))) collisions.push(`${id} p${pool.priority}: ${line}`);
        }
      }
    }
    expect(collisions).toEqual([]);
  });
});
