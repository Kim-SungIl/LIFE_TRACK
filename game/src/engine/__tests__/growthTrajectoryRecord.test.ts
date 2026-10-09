// 성장 궤적 적립 — T62.
//
// 이 파일이 잠그는 건 **문장이 아니라 근거**다. ending.ts 쪽 테스트는 "궤적이 이러면 이 문장"을
// 보지만, 궤적을 **만드는 층**이 비어 있으면 제품에서는 영원히 판정 불가로 떨어져 7년 문장이
// 한 번도 안 나온다 — 그리고 그쪽 테스트는 전부 초록이다(#431: prop을 손으로 만든 테스트는
// 그 prop을 만드는 층의 누락을 원리상 못 잡는다).
import { describe, expect, it, beforeEach } from 'vitest';
import {
  achievementAxes, calculateEnding, GROWTH_NOTE, GROWTH_NOTE_FINAL, growthClaimHolds, isGrowthTrajectoryComplete,
} from '../ending';
import { CAREER_CHOICE_EVENT_ID } from '../careerChoice';
import { clearArchive } from '../archive';
import { applyYearTransition, createInitialState, processWeek } from '../gameEngine';
import { migrateLoadedState } from '../stateMigration';
import { useGameStore } from '../store';
import type { ExamResult, GameState, ParentStrength, Stats } from '../types';

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

  // 7칸이 다 차야 "7년"을 말할 자격이 생긴다 — 한 해라도 비면 판정 자체가 null이 되어(일곱 칸 검사)
  // 그 판은 7년 문장을 잃는다. 두 입구를 섞어 일곱 해를 끝까지 민다.
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
  it('궤적 없는 세이브는 undefined로 남는다 (지어내지 않는다)', () => {
    // T25 돈 궤적과 같은 규칙. `[]` 자체는 판정 불가라 무해하지만, 배열을 만들어 주면 이어지는 학년만
    // 찬 **부분 궤적**이 자란다(아래 "중간 로드" 테스트) — undefined는 끝까지 "판정 불가"로 남는다.
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

/** 스토어로 대기 사건을 닫는다(제품에서 플레이어가 하는 일). 갈림길은 `stopAt`이면 닫지 않고 멈춘다. */
function closeEvents(stopAt?: string): void {
  for (let guard = 0; guard < 10; guard++) {
    const cur = useGameStore.getState().state;
    if (!cur?.currentEvent || cur.phase !== 'event') return;
    if (stopAt && cur.currentEvent.id === stopAt) return;
    useGameStore.getState().resolveEvent(0);
  }
}

/** 일곱 해를 W48마다 밀어 끝까지 간다(위 "일곱 해" 테스트와 같은 두 입구 경로). `from`부터 시작. */
function playYears(s0: GameState, from: number): GameState {
  let s = s0;
  for (let year = from; year <= 7; year++) {
    s.year = year; s.week = 48; s.phase = 'weekday'; s.currentEvent = null;
    s.stats = { ...s.stats, academic: 40 + year * 5 };
    s = processWeek(s);
    if (s.phase === 'event') {
      useGameStore.setState({ state: s, runDelta: null, npcActivityMap: {} });
      closeEvents();
      s = useGameStore.getState().state!;
    }
  }
  return s;
}

describe('T62 3자 검수 — 갈림길 입구 (Y7 칸은 장면이 닫힌 뒤에 찬다)', () => {
  // 진로 갈림길이 열리는 판은 applyYearTransition이 **적립 전에** 장면을 걸고 빠진다. 그 뒤 엔딩
  // 전환은 store.resolveEvent의 갈림길 분기가 다시 applyYearTransition을 불러 수행한다 — 그 분기가
  // 전환을 인라인으로 하면(적립 생략) Y7 칸이 영영 비고, 그 판은 일곱 칸 검사에 걸려 7년 문장을
  // 잃는다. 위 두 입구 테스트는 갈림길이 안 열리는 스탯이라 이 경로를 지나지 않았다(검수 M2).
  beforeEach(() => {
    clearArchive();
    localStorage.clear();
    useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
  });

  function suneung(mockGrade: number): ExamResult {
    const blank = { score: 0, grade: 'C' as const, delta: 0 };
    return {
      subjects: { korean: blank, english: blank, math: blank, socialScience: blank, artsPhysical: blank },
      average: 0, rank: null, prevRank: null, comment: '', parentReaction: '', teacherReaction: '',
      examType: 'suneung', schoolLevel: 'high', year: 7, semester: 2, mockGrade,
    };
  }

  it('겸비 판: 장면이 열린 동안 Y7은 비어 있고, 닫으면 한 번 차서 일곱 칸이 된다', () => {
    const s = createInitialState('female', PARENTS, { rngSeed: 7 });
    s.year = 7; s.week = 48; s.phase = 'weekday'; s.currentEvent = null;
    // careerChoice.test의 겸비 판(특기 95 · 학업 92 · 이과 · 수능 1) — 두 갈래가 열린다.
    s.stats = { academic: 92, talent: 95, social: 70, mental: 80, health: 70 };
    s.track = 'science';
    s.examResults = [suneung(1)];
    s.burnoutCount = 0;
    s.totalTiredWeeks = 0;
    // Y1~Y6은 이미 찼다(정상 판). 특기 1위 · 학업 2위 · 생활 3위로 내내 같은 순서.
    s.axesByYear = Array.from({ length: 6 }, (_, i) => [60 + i * 4, 65 + i * 4, 50 + i] as [number, number, number]);
    useGameStore.setState({ state: s, runDelta: null, npcActivityMap: {} });
    useGameStore.getState().advanceWeek();
    closeEvents(CAREER_CHOICE_EVENT_ID);

    const open = useGameStore.getState().state!;
    expect(open.currentEvent?.id, '전제: 갈림길 장면이 떠야 이 경로를 지난다').toBe(CAREER_CHOICE_EVENT_ID);
    expect(open.axesByYear?.[6], '장면이 열리기 전에 Y7을 적었다(장면 뒤 스탯과 갈릴 수 있다)').toBeUndefined();
    expect(open.axesByYear?.length, '앞 여섯 칸은 그대로').toBe(6);

    useGameStore.getState().resolveEvent(0);
    const after = useGameStore.getState().state!;
    expect(after.phase, '전제: 장면 뒤 곧장 엔딩').toBe('ending');
    const ax = achievementAxes(after.stats);
    expect(after.axesByYear?.[6], '갈림길 분기가 Y7 적립을 건너뛰었다').toEqual([ax.academic, ax.talent, ax.life]);
    expect(after.axesByYear?.length, '한 번만 — 칸이 밀리거나 더 생기지 않는다').toBe(7);
    expect(isGrowthTrajectoryComplete(after.axesByYear), '일곱 칸이 꽉 차야 7년을 말한다').toBe(true);
    // 그리고 엔딩이 그 근거로 판정을 세운다(null이 아니다).
    const ending = calculateEnding(after);
    expect(ending.growthShape, '전제: 모양이 있는 판').not.toBeNull();
    expect(growthClaimHolds(ending.growthShape!, achievementAxes(after.stats), after.axesByYear)).not.toBeNull();
  });
});

describe('T62 3자 검수 — 구세이브 중간 로드는 궤적을 지어내지 않는다', () => {
  beforeEach(() => {
    clearArchive();
    localStorage.clear();
    useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
  });

  it('Y4에서 이은 구세이브는 끝까지 궤적이 없고, 엔딩은 7년을 말하지 않는다', () => {
    // `applyYearTransition`이 없는 배열을 만들어 주면(`??= []`) Y4~Y7 네 칸만 찬 부분 궤적이 생긴다.
    // 일곱 칸 검사가 판정은 null로 막지만, 근거를 지어내지 않는 것 자체를 잠근다(검수 M13).
    const old = createInitialState('male', PARENTS, { rngSeed: 11 }) as GameState;
    delete (old as { axesByYear?: unknown }).axesByYear;
    old.year = 4;
    old.stats = { academic: 60, social: 30, talent: 20, mental: 35, health: 30 };
    const loaded = migrateLoadedState(old);
    const end = playYears(loaded, 4);
    expect(end.phase, '전제: 엔딩까지 갔다').toBe('ending');
    expect(end.axesByYear, '구세이브에 궤적이 생겼다').toBeUndefined();
    const ending = calculateEnding(end);
    expect(ending.growthShape, '전제: 모양이 있는 판(문장이 나간다)').not.toBeNull();
    expect(ending.growthNote).toBe(GROWTH_NOTE_FINAL[ending.growthShape!]);
  });

  it('부분 궤적(앞 학년이 빈 성긴 배열)이 실려 와도 엔딩은 7년을 말하지 않는다', () => {
    const s = createInitialState('male', PARENTS, { rngSeed: 11 });
    s.axesByYear = [];
    s.stats = { academic: 60, social: 30, talent: 20, mental: 35, health: 30 };
    const end = playYears(s, 4);
    expect(end.axesByYear?.length, '전제: Y4~Y7을 적어 길이는 7').toBe(7);
    expect(isGrowthTrajectoryComplete(end.axesByYear)).toBe(false);
    const ending = calculateEnding(end);
    expect(ending.growthShape).not.toBeNull();
    expect(ending.growthNote, '네 해 근거로 7년을 말했다').toBe(GROWTH_NOTE_FINAL[ending.growthShape!]);
    expect(ending.growthNote).not.toBe(GROWTH_NOTE[ending.growthShape!]);
  });
});

describe('T62 3자 검수 — 비배열 손상값', () => {
  const BAD: unknown[] = ['abc', 5, true, {}];

  it('학년 전환이 터지지 않고, 손상값에 칸을 붙이지도 않는다', () => {
    for (const bad of BAD) {
      const s = stateAt(3);
      (s as unknown as { axesByYear: unknown }).axesByYear = bad;
      expect(() => applyYearTransition(s), `${JSON.stringify(bad)}에서 학년 전환이 터졌다`).not.toThrow();
      expect(s.phase, '전환은 그대로 진행된다').toBe('year-end');
      expect(s.axesByYear, '손상값을 고쳐 쓰거나 키를 붙였다').toStrictEqual(bad);
    }
  });

  it('엔딩이 터지지 않는다', () => {
    for (const bad of BAD) {
      const s = stateAt(8, { academic: 90, talent: 88, mental: 40, health: 40, social: 40 });
      (s as unknown as { axesByYear: unknown }).axesByYear = bad;
      expect(() => calculateEnding(s), `${JSON.stringify(bad)}에서 엔딩이 터졌다`).not.toThrow();
    }
  });

  it('로드는 비배열을 없는 것으로 접는다 (빈 배열·0으로 메우지 않는다)', () => {
    for (const bad of BAD) {
      const s = createInitialState('male', PARENTS, { rngSeed: 3 });
      (s as unknown as { axesByYear: unknown }).axesByYear = bad;
      expect(migrateLoadedState(s).axesByYear, `${JSON.stringify(bad)}`).toBeUndefined();
    }
  });
});
