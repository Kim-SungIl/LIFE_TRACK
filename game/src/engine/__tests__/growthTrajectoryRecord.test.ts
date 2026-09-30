// 성장 궤적 적립 — T62.
//
// 이 파일이 잠그는 건 **문장이 아니라 근거**다. ending.ts 쪽 테스트는 "궤적이 이러면 이 문장"을
// 보지만, 궤적을 **만드는 층**이 비어 있으면 제품에서는 영원히 판정 불가로 떨어져 7년 문장이
// 한 번도 안 나온다 — 그리고 그쪽 테스트는 전부 초록이다(#431: prop을 손으로 만든 테스트는
// 그 prop을 만드는 층의 누락을 원리상 못 잡는다).
import { describe, expect, it, beforeEach } from 'vitest';
import { achievementAxes, growthClaimHolds } from '../ending';
import { applyYearTransition, createInitialState, processWeek } from '../gameEngine';
import { migrateLoadedState } from '../stateMigration';
import { useGameStore } from '../store';
import type { GameState, ParentStrength, Stats } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];

function stateAt(year: number, stats: Partial<Stats> = {}): GameState {
  const s = createInitialState('male', PARENTS, { rngSeed: 99 });
  s.year = year;
  s.stats = { academic: 60, social: 50, talent: 40, mental: 55, health: 45, ...stats };
  return s;
}

describe('학년말마다 성취 3축이 남는다', () => {
  it('새 판은 빈 궤적으로 시작한다 — undefined가 아니다', () => {
    // undefined면 이 판은 **영원히 판정 불가**가 되어 7년 문장이 한 번도 안 나온다.
    expect(createInitialState('female', PARENTS, { rngSeed: 1 }).axesByYear).toEqual([]);
  });

  it('학년 전환이 그 해 칸에 값을 넣는다 — 인덱스는 year-1', () => {
    const s = stateAt(3, { academic: 71, talent: 33, mental: 90, health: 60, social: 30 });
    applyYearTransition(s);
    expect(s.axesByYear?.[2], 'Y3이 [2]가 아니다').toEqual([71, 33, 60]);   // life = (90+60+30)/3
    expect(s.axesByYear?.[0], '안 지난 해까지 채웠다').toBeUndefined();
  });

  it('남기는 값이 등급이 보는 값과 같다 — 두 층이 갈리지 않는다', () => {
    for (const stats of [
      { academic: 88, talent: 12, mental: 30, health: 40, social: 20 },
      { academic: 41, talent: 77, mental: 85, health: 81, social: 79 },
    ] as Stats[]) {
      const s = stateAt(5, stats);
      applyYearTransition(s);
      const ax = achievementAxes(stats);
      expect(s.axesByYear?.[4]).toEqual([ax.academic, ax.talent, ax.life]);
    }
  });

  it('같은 해를 두 번 지나도 배열이 밀리지 않는다 (인덱스 대입)', () => {
    const s = stateAt(2, { academic: 50 });
    applyYearTransition(s);
    s.stats.academic = 66;
    applyYearTransition(s);
    expect(s.axesByYear?.[1]?.[0], '나중 값으로 덮어써야 한다').toBe(66);
    expect(s.axesByYear?.filter(Boolean).length, '같은 해가 두 칸을 먹었다').toBe(1);
  });
});

describe('도달 가능성 — 제품의 두 입구가 모두 채운다', () => {
  // "적립 함수가 옳다"와 "플레이하면 채워진다"는 다른 주장이다.
  //
  // ⚠️ 학년 전환의 입구는 **둘**이다. W48 처리 뒤 대기 이벤트가 없으면 processWeek이 곧장
  // 전환하지만, 이벤트가 걸리면 processWeek은 phase='event'로 멈추고 전환을 **미룬다** —
  // 그 뒤 store.resolveEventChain이 `week > 48`을 보고 수행한다(store.ts의 그 분기).
  // 엔진만 밀면 Y2~Y6이 통째로 안 돌아 "7칸이 찬다"가 거짓이 된다(초안에서 실제로 그랬다).
  beforeEach(() => {
    useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
  });

  it('입구 ① 대기 이벤트 없는 W48 — processWeek이 그 자리에서 채운다', () => {
    for (let year = 1; year <= 7; year++) {
      const s = stateAt(year, { academic: 40 + year * 5 });
      s.week = 48;
      const out = processWeek(s);
      const slot = out.axesByYear?.[year - 1];
      if (out.phase === 'event') continue;   // 이 해는 입구 ②로 간다 — 아래 테스트 소관
      expect(slot, `Y${year}에서 안 채워졌다`).toBeTruthy();
      // 값은 손으로 계산하지 않는다 — 주 진행이 감쇠를 먹이므로 착지값은 그 주의 결과다.
      const ax = achievementAxes(out.stats);
      expect(slot).toEqual([ax.academic, ax.talent, ax.life]);
    }
  });

  it('입구 ② W48에 이벤트가 걸린 해 — 이벤트를 닫을 때 채워진다', () => {
    // 이벤트 경로를 **실제로** 만든다: processWeek이 phase='event'로 멈춘 해를 찾아
    // 스토어의 resolveEvent로 닫고, 그때 칸이 차는지 본다.
    let covered = 0;
    for (let year = 1; year <= 7; year++) {
      const s = stateAt(year, { academic: 40 + year * 5 });
      s.week = 48;
      const out = processWeek(s);
      if (out.phase !== 'event' || !out.currentEvent) continue;
      expect(out.axesByYear?.[year - 1], `Y${year}: 이벤트로 멈췄는데 이미 채워졌다`).toBeFalsy();
      useGameStore.setState({ state: out, runDelta: null, npcActivityMap: {} });
      // 체인이 더 걸릴 수 있다 — 이벤트가 없어질 때까지 닫는다(제품에서 플레이어가 하는 일).
      for (let guard = 0; guard < 10 && useGameStore.getState().state?.currentEvent; guard++) {
        useGameStore.getState().resolveEvent(0);
      }
      const after = useGameStore.getState().state;
      expect(after?.axesByYear?.[year - 1], `Y${year}: 이벤트를 닫아도 안 채워졌다`).toBeTruthy();
      covered++;
    }
    // 이 경로를 한 번도 안 지났다면 위 단언은 전부 공허하다(#437 계열 — 모수를 세고 쓴다).
    expect(covered, 'W48에 이벤트가 걸리는 해가 하나도 없었다 — 이 테스트가 공허하다').toBeGreaterThan(0);
  });

  // 7칸이 다 차야 "7년"을 말할 자격이 생긴다 — 한 해라도 비면 그 해는 판정에서 빠지고
  // 주장은 6년치 근거로 서게 된다. 두 입구를 섞어 일곱 해를 끝까지 민다.
  it('일곱 해를 이어 지나면 일곱 칸이 연속으로 찬다', () => {
    let s = createInitialState('male', PARENTS, { rngSeed: 7 });
    for (let year = 1; year <= 7; year++) {
      s.year = year; s.week = 48; s.phase = 'weekday'; s.currentEvent = null;
      s.stats = { ...s.stats, academic: 40 + year * 5 };
      s = processWeek(s);
      if (s.phase === 'event') {
        useGameStore.setState({ state: s, runDelta: null, npcActivityMap: {} });
        for (let guard = 0; guard < 10 && useGameStore.getState().state?.currentEvent; guard++) {
          useGameStore.getState().resolveEvent(0);
        }
        s = useGameStore.getState().state!;
      }
    }
    expect(s.axesByYear?.length, '일곱 칸이 아니다').toBe(7);
    expect(s.axesByYear?.every(v => Array.isArray(v) && v.length === 3), '중간에 빈 칸이 있다').toBe(true);
    // 그리고 그 근거로 실제 판정이 선다 — 값이 있어도 판정이 null이면 이 층은 헛돈 것이다.
    expect(growthClaimHolds('singular', achievementAxes(s.stats), s.axesByYear)).not.toBeNull();
  });
});

describe('구세이브 — 백필하지 않는다', () => {
  it('궤적 없는 세이브는 undefined로 남는다 (빈 배열로 채우면 거짓 회고가 된다)', () => {
    // T25 돈 궤적과 같은 규칙. 빈 배열을 넣으면 "기록은 있는데 전부 0"이 되어 판정이
    // 거짓을 낸다 — undefined는 "판정 불가"라 최종 상태 문구로 안전하게 떨어진다.
    const old = createInitialState('male', PARENTS, { rngSeed: 3 }) as GameState;
    delete (old as { axesByYear?: unknown }).axesByYear;
    const loaded = migrateLoadedState(old);
    expect(loaded.axesByYear, '구세이브에 궤적을 지어냈다').toBeUndefined();
    expect(growthClaimHolds('twin', achievementAxes(loaded.stats), loaded.axesByYear)).toBeNull();
  });

  it('궤적이 있는 세이브는 그대로 통과한다', () => {
    const s = createInitialState('male', PARENTS, { rngSeed: 3 });
    s.axesByYear = [[50, 30, 40], [60, 32, 45]];
    expect(migrateLoadedState(s).axesByYear).toEqual([[50, 30, 40], [60, 32, 45]]);
  });
});
