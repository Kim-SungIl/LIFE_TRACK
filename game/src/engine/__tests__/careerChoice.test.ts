// **T66 — 진로 갈림길.** 두 갈래(특기 / 수능·학업)가 실제로 열린 판에서만 졸업 직전에 묻는다.
//
// 이 파일이 잠그는 것:
//   1. 열린 갈래 표(careerBranchesOf) — 문턱 양방향, 강제 루트는 닫힘.
//   2. 선택값 반영 — 열린 갈래 안에서만, 손상값·닫힌 갈래·갈림 없는 판은 자동 판정.
//   3. 장면(careerChoice.ts)이 같은 함수를 본다 — 선택지 순서·문장의 진로 이름·효과 없음.
//   4. **배선** — 실제 store 경로에서 장면이 뜨고, 고른 갈래가 엔딩과 기록실(완주 타이틀)에 닿는다.
//      순수함수만 잠그면 장면이 아예 안 뜨는 상태도 초록이다(#381·#397).
// 자동 판정이 T66 이전과 바이트 단위로 같다는 증명은 endingT66Invariance.test.ts(4,000판 격자).
import { beforeEach, describe, expect, it } from 'vitest';
import { calculateEnding, careerBranchesOf } from '../ending';
import { buildCareerChoiceEvent, careerChoicePending, CAREER_CHOICE_EVENT_ID } from '../careerChoice';
import { applyYearTransition, createInitialState } from '../gameEngine';
import { migrateLoadedState } from '../stateMigration';
import { useGameStore } from '../store';
import { assignCurrentEvent } from '../eventPresentation';
import { DIRECT_SEQUEL_IDS, FOLLOWUP_EVENT_IDS } from '../events/constants';
import { clearArchive, loadArchive } from '../archive';
import type { CareerBranch, ExamResult, GameEvent, GameState, ParentStrength, Stats, Track } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];

function suneung(mockGrade: number): ExamResult {
  const blank = { score: 0, grade: 'C' as const, delta: 0 };
  return {
    subjects: { korean: blank, english: blank, math: blank, socialScience: blank, artsPhysical: blank },
    average: 0, rank: null, prevRank: null, comment: '', parentReaction: '', teacherReaction: '',
    examType: 'suneung', schoolLevel: 'high', year: 7, semester: 2, mockGrade,
  };
}

interface Fx {
  stats?: Partial<Stats>;
  track?: Track | null;
  mockGrade?: number;
  burnoutCount?: number;
  totalTiredWeeks?: number;
  careerChoice?: CareerBranch | string;
}

/** Y7 끝(엔딩 전환 직전) 상태. 기본은 겸비 판(특기 95 · 학업 92 · 이과 · 수능 1) = 두 갈래가 열린다. */
function y7(fx: Fx = {}): GameState {
  const s = createInitialState('female', PARENTS, { rngSeed: 7 });
  s.year = 7;
  s.week = 49;
  s.stats = { academic: 92, talent: 95, social: 70, mental: 80, health: 70, ...fx.stats };
  s.track = fx.track === undefined ? 'science' : fx.track;
  s.examResults = [suneung(fx.mockGrade ?? 1)];
  s.burnoutCount = fx.burnoutCount ?? 0;
  s.totalTiredWeeks = fx.totalTiredWeeks ?? 0;
  if (fx.careerChoice !== undefined) s.careerChoice = fx.careerChoice as CareerBranch;
  return s;
}

describe('careerBranchesOf — 열린 갈래 표', () => {
  it('겸비 판(특기 90+ · 학업 80+)은 두 갈래가 열리고 자동은 일반 진로', () => {
    const b = careerBranchesOf(y7());
    expect(b.open).toEqual(['general', 'specialist']);
    expect(b.auto).toBe('general');
    expect(b.outcomes.general?.path).toBe('의대 합격');
    expect(b.outcomes.specialist?.path).toBe('예술/체육 특기자');
  });

  it('특기 85~89 · 학업 70+도 두 갈래 — 특기 갈래 라벨은 "예체능 진학"', () => {
    const b = careerBranchesOf(y7({ stats: { talent: 87, academic: 72 }, track: 'humanities', mockGrade: 3 }));
    expect(b.open).toEqual(['general', 'specialist']);
    expect(b.outcomes.specialist?.path).toBe('예체능 진학');
    expect(b.outcomes.general?.path).toBe('인서울 문과');
  });

  // 문턱은 양방향으로 잠근다 — 한쪽만 두면 문턱을 옮기는 뮤테이션이 반대 방향으로 통과한다.
  it.each([
    // [설명, talent, academic, 기대 open]
    ['talent 84.9 → 특기 갈래 없음', 84.9, 95, ['general']],
    ['talent 85 → 두 갈래', 85, 95, ['general', 'specialist']],
    ['talent 87 · academic 69.9 → 특기만', 87, 69.9, ['specialist']],
    ['talent 87 · academic 70 → 두 갈래', 87, 70, ['general', 'specialist']],
    ['talent 89.9 · academic 70 → 두 갈래(85 구간 문턱 70)', 89.9, 70, ['general', 'specialist']],
    ['talent 90 · academic 79.9 → 특기만(90 구간 문턱 80)', 90, 79.9, ['specialist']],
    ['talent 90 · academic 80 → 두 갈래', 90, 80, ['general', 'specialist']],
  ] as const)('%s', (_label, talent, academic, open) => {
    expect(careerBranchesOf(y7({ stats: { talent, academic } })).open).toEqual(open);
  });

  it('특기 갈래 라벨은 talent 90에서 갈린다(89.9 예체능 진학 / 90 특기자)', () => {
    expect(careerBranchesOf(y7({ stats: { talent: 89.9, academic: 85 } })).outcomes.specialist?.path).toBe('예체능 진학');
    expect(careerBranchesOf(y7({ stats: { talent: 90, academic: 85 } })).outcomes.specialist?.path).toBe('예술/체육 특기자');
  });

  // CAREER_FORCED — 몸·마음 게이트가 정한 결말은 메뉴로 내밀지 않는다(ending.ts 주석).
  it.each([
    ['번아웃 6+ → 재수 결심', { burnoutCount: 6 }, '재수 결심'],
    ['번아웃 4 · mental 29 → 재수 결심', { burnoutCount: 4, stats: { mental: 29 } }, '재수 결심'],
    ['mental 14.9 → 잠시 쉼표', { stats: { mental: 14.9 } }, '잠시 쉼표'],
    ['만성 탈진 · health 19 → 잠시 쉼표', { totalTiredWeeks: 235, stats: { health: 19 } }, '잠시 쉼표'],
    ['만성 탈진 · mental 39 → 재수 결심', { totalTiredWeeks: 235, stats: { mental: 39 } }, '재수 결심'],
    ['수능 7 · 번아웃 2 → 잠시 쉼표', { mockGrade: 7, burnoutCount: 2 }, '잠시 쉼표'],
  ] as const)('강제 루트는 갈림길을 닫는다: %s', (_l, fx, path) => {
    const b = careerBranchesOf(y7(fx as Fx));
    expect(b.open).toEqual(['general']);
    expect(b.outcomes.general?.path).toBe(path);
  });

  it('강제 루트 문턱의 반대편은 열린다(번아웃 5 · mental 30 / mental 15)', () => {
    expect(careerBranchesOf(y7({ burnoutCount: 5, stats: { mental: 30 } })).open).toHaveLength(2);
    expect(careerBranchesOf(y7({ stats: { mental: 15 } })).open).toHaveLength(2);
  });

  it('수능 실패(전문대 / 재수)는 강제가 아니다 — 특기로 가는 길이 실제로 열려 있으니 묻는다', () => {
    const b = careerBranchesOf(y7({ mockGrade: 8 }));
    expect(b.outcomes.general?.path).toBe('전문대 / 재수');
    expect(b.open).toEqual(['general', 'specialist']);
  });
});

describe('선택값 반영 — 열린 갈래 안에서만', () => {
  it('두 갈래 판에서 특기를 고르면 엔딩 진로가 특기자다', () => {
    const e = calculateEnding(y7({ careerChoice: 'specialist' }));
    expect(e.career).toBe('예술/체육 특기자');
    expect(e.title).toContain('예술/체육 특기자');
  });

  it('두 갈래 판에서 일반을 고르면 = 자동 판정과 같다', () => {
    expect(calculateEnding(y7({ careerChoice: 'general' })).career).toBe('의대 합격');
    expect(calculateEnding(y7()).career).toBe('의대 합격');
  });

  it('갈림 없는 판에서는 선택값이 있어도 무시한다(특기 판에 general, 일반 판에 specialist)', () => {
    expect(calculateEnding(y7({ stats: { talent: 92, academic: 60 }, careerChoice: 'general' })).career)
      .toBe('예술/체육 특기자');
    expect(calculateEnding(y7({ stats: { talent: 60 }, careerChoice: 'specialist' })).career).toBe('의대 합격');
  });

  it('강제 루트 판에서는 특기 선택이 재수를 뒤집지 못한다', () => {
    expect(calculateEnding(y7({ burnoutCount: 6, careerChoice: 'specialist' })).career).toBe('재수 결심');
  });

  it('손상값은 거부하고 자동 판정으로 떨어진다', () => {
    expect(calculateEnding(y7({ careerChoice: 'foo' })).career).toBe('의대 합격');
  });

  it('선택은 엔딩 시점의 라이브 스탯으로 다시 판정한다 — 그 사이 갈래가 닫혔으면 자동', () => {
    // 특기를 골랐지만 엔딩 시점 talent가 85 아래로 내려간 판(정상 흐름에선 장면 뒤 스탯 변화가 없다).
    expect(calculateEnding(y7({ stats: { talent: 80 }, careerChoice: 'specialist' })).career).toBe('의대 합격');
  });
});

describe('갈림길 장면 — careerBranchesOf와 같은 값을 본다', () => {
  it('선택지 = 열린 갈래 순서(자동이 먼저), 문장에 그 판의 실제 진로 이름, 효과 없음', () => {
    const s = y7();
    const ev = buildCareerChoiceEvent(s)!;
    const b = careerBranchesOf(s);
    expect(ev.id).toBe(CAREER_CHOICE_EVENT_ID);
    expect(ev.choices.map(c => c.careerSelect)).toEqual(b.open);
    expect(ev.choices[0].text).toContain(b.outcomes.general!.path);
    expect(ev.choices[1].text).toContain(b.outcomes.specialist!.path);
    for (const c of ev.choices) {
      expect(c.effects).toEqual({});
      expect(c.fatigueEffect ?? 0).toBe(0);
      expect(c.moneyEffect ?? 0).toBe(0);
      expect(c.npcEffects ?? []).toEqual([]);
    }
  });

  it('갈래가 하나뿐인 판은 장면을 만들지 않고, pending도 거짓', () => {
    const s = y7({ stats: { talent: 60 } });
    expect(buildCareerChoiceEvent(s)).toBeNull();
    expect(careerChoicePending(s)).toBe(false);
  });

  it('pending은 Y7에서만, 한 판에 한 번(이미 골랐거나 이미 본 판은 다시 안 연다)', () => {
    expect(careerChoicePending(y7())).toBe(true);
    expect(careerChoicePending({ ...y7(), year: 6 })).toBe(false);
    expect(careerChoicePending(y7({ careerChoice: 'general' }))).toBe(false);
    // 손상값은 "이미 골랐다"가 아니다 — 엔딩도 무시하는 값이라 장면을 다시 열어야 두 층이 안 갈린다.
    expect(careerChoicePending(y7({ careerChoice: 'foo' }))).toBe(true);
    expect(careerChoicePending({ ...y7(), careerChoice: null as unknown as CareerBranch })).toBe(true);
    const seen = y7();
    seen.events = [{ id: CAREER_CHOICE_EVENT_ID, title: '', description: '', choices: [], resolvedChoice: -1 } as GameEvent];
    expect(careerChoicePending(seen)).toBe(false);
  });

  it('applyYearTransition(Y7)은 두 갈래 판에서 엔딩 대신 장면을 연다 — 학년 기록은 아직 안 적는다', () => {
    const s = y7();
    const milestonesBefore = s.milestoneScenes.length;
    applyYearTransition(s);
    expect(s.phase).toBe('event');
    expect(s.currentEvent?.id).toBe(CAREER_CHOICE_EVENT_ID);
    expect(s.year).toBe(7);
    expect(s.milestoneScenes.length).toBe(milestonesBefore);
  });

  it('갈림 없는 판의 applyYearTransition(Y7)은 예전처럼 곧장 엔딩', () => {
    const s = y7({ stats: { talent: 60 } });
    applyYearTransition(s);
    expect(s.phase).toBe('ending');
    expect(s.currentEvent).toBeNull();
  });

  it('장면 도중 저장/로드해도 장면이 같은 선택지로 다시 구워진다(카탈로그 밖 이벤트 복원)', () => {
    const s = y7();
    applyYearTransition(s);
    const loaded = migrateLoadedState(JSON.parse(JSON.stringify(s)) as GameState);
    expect(loaded.phase).toBe('event');
    expect(loaded.currentEvent?.id).toBe(CAREER_CHOICE_EVENT_ID);
    expect(loaded.currentEvent?.choices.map(c => c.text)).toEqual(s.currentEvent!.choices.map(c => c.text));
  });

  it('장면 도중 세이브가 손상돼 갈래가 닫혔으면, 로드는 장면을 버리고 곧장 엔딩으로 보낸다(유령 주·정지 없음)', () => {
    const s = y7();
    s.weekLog = { statChanges: {}, fatigueChange: 0, moneyChange: 0, messages: [], skipped: [], milestoneMessages: [], year: 7, week: 48 };
    applyYearTransition(s);
    expect(s.currentEvent?.id, '전제: 장면이 열렸다').toBe(CAREER_CHOICE_EVENT_ID);
    const raw = JSON.parse(JSON.stringify(s)) as GameState;
    raw.stats.talent = 60;   // 외부 편집·손상 — 정상 흐름에선 장면 뒤 스탯 변화가 없다
    const loaded = migrateLoadedState(raw);
    expect(loaded.currentEvent).toBeNull();
    expect(loaded.phase, '"사라진 ID" 경로(result/weekday)로 떨어지면 W49 유령 주를 돈다').toBe('ending');
    expect(loaded.year).toBe(8);
    expect(loaded.milestoneScenes.some(m => m.year === 7), 'Y7 학년 기록은 한 번 적힌다').toBe(true);
    expect(calculateEnding(loaded).career).toBe('의대 합격');
  });

  it('구세이브(careerChoice 없음)는 로드 후에도 값이 없다 — 백필하지 않는다', () => {
    const s = y7();
    const loaded = migrateLoadedState(JSON.parse(JSON.stringify(s)) as GameState);
    expect('careerChoice' in loaded && loaded.careerChoice !== undefined).toBe(false);
    expect(calculateEnding(loaded).career).toBe('의대 합격');
  });
});

// ===== 배선: 실제 store 경로 =====
describe('store 배선 — 장면이 뜨고, 고른 갈래가 엔딩·기록실에 닿는다', () => {
  beforeEach(() => {
    clearArchive();
    localStorage.clear();
    useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
  });

  /** Y7 W48 계획 화면에서 주를 확정하고, 앞선 사건은 0번으로 닫으며 갈림길이나 엔딩까지 간다. */
  function playLastWeek(fx: Fx): { sawCrossroads: boolean } {
    const s = y7(fx);
    s.week = 48;
    s.phase = 'weekday';
    s.currentEvent = null;
    useGameStore.setState({ state: s });
    useGameStore.getState().advanceWeek();
    for (let guard = 0; guard < 10; guard++) {
      const cur = useGameStore.getState().state!;
      if (cur.phase !== 'event' || !cur.currentEvent) break;
      if (cur.currentEvent.id === CAREER_CHOICE_EVENT_ID) return { sawCrossroads: true };
      useGameStore.getState().resolveEvent(0);
    }
    return { sawCrossroads: false };
  }

  it('두 갈래 판: 엔딩 전에 장면이 뜨고, 특기를 고르면 엔딩·기록실 타이틀이 특기자다', () => {
    const { sawCrossroads } = playLastWeek({});
    expect(sawCrossroads, '갈림길 장면이 떠야 한다').toBe(true);
    const before = useGameStore.getState().state!;
    expect(before.phase).toBe('event');
    const idx = before.currentEvent!.choices.findIndex(c => c.careerSelect === 'specialist');
    expect(idx).toBeGreaterThanOrEqual(0);

    useGameStore.getState().resolveEvent(idx);
    const after = useGameStore.getState().state!;
    expect(after.phase, '장면 뒤에는 체인 없이 곧장 엔딩').toBe('ending');
    expect(after.careerChoice).toBe('specialist');
    expect(calculateEnding(after).career).toBe('예술/체육 특기자');
    // 완주 정산(commitOnEnding)이 같은 판정을 본다 — 화면과 기록실이 갈리면 안 된다(#441).
    expect(loadArchive().endings.some(t => t.includes('예술/체육 특기자'))).toBe(true);
  });

  it('두 갈래 판에서 일반을 고르면 자동 판정 그대로', () => {
    expect(playLastWeek({}).sawCrossroads).toBe(true);
    const idx = useGameStore.getState().state!.currentEvent!.choices.findIndex(c => c.careerSelect === 'general');
    useGameStore.getState().resolveEvent(idx);
    const after = useGameStore.getState().state!;
    expect(after.phase).toBe('ending');
    expect(calculateEnding(after).career).toBe('의대 합격');
  });

  it('갈림 없는 판: 장면 없이 엔딩으로 간다', () => {
    expect(playLastWeek({ stats: { talent: 60 } }).sawCrossroads).toBe(false);
    expect(useGameStore.getState().state!.phase).toBe('ending');
    expect(useGameStore.getState().state!.careerChoice).toBeUndefined();
  });

  // **두 번째 입구.** W48에 다른 사건이 대기 중이면 엔딩 전환은 processWeek가 아니라 그 사건을 닫는
  // resolveEvent(resolveEventChain)에서 일어난다 — 실플레이 갈림길의 절반 이상이 이 입구다(3자 검수 실측).
  // 이 입구가 게이트를 우회해도(예전식 인라인 전환) 위 테스트들은 processWeek 입구만 지나 초록이었다.
  it('W48 대기 사건을 닫는 입구(resolveEventChain)에서도 갈림길이 뜬다', () => {
    const s = y7();
    s.week = 49;
    s.weekLog = { statChanges: {}, fatigueChange: 0, moneyChange: 0, messages: [], skipped: [], milestoneMessages: [], year: 7, week: 48 };
    // 체인을 막는다 — 같은 주 followup(직접 후속 아님)이 이미 있고 이벤트가 3건 이상이면 체인 픽이 없다.
    const followup = [...FOLLOWUP_EVENT_IDS].find(id => !DIRECT_SEQUEL_IDS.has(id))!;
    const rec = (id: string) => ({ id, title: id, description: '', choices: [], resolvedChoice: 0, week: 48, year: 7 }) as GameEvent;
    s.events = [rec(followup), rec('__filler-1')];
    assignCurrentEvent(s, { id: '__w48-pending', title: 't', description: 'd', choices: [{ text: 'ok', effects: {}, message: 'm' }] }, 48);
    useGameStore.setState({ state: s });

    useGameStore.getState().resolveEvent(0);
    const after = useGameStore.getState().state!;
    expect(after.phase, '대기 사건을 닫자 엔딩으로 직행했다 — 두 번째 입구가 게이트를 우회한다').toBe('event');
    expect(after.currentEvent?.id).toBe(CAREER_CHOICE_EVENT_ID);
    expect(after.year).toBe(7);
  });

  it('손상된 careerChoice(\'foo\')가 남은 겸비 판도 장면이 뜨고, 고른 값으로 덮인다', () => {
    const { sawCrossroads } = playLastWeek({ careerChoice: 'foo' });
    expect(sawCrossroads).toBe(true);
    const idx = useGameStore.getState().state!.currentEvent!.choices.findIndex(c => c.careerSelect === 'specialist');
    useGameStore.getState().resolveEvent(idx);
    expect(calculateEnding(useGameStore.getState().state!).career).toBe('예술/체육 특기자');
  });

  it('모든 선택지가 잠긴 sentinel(-1)로 닫혀도 장면이 다시 뜨지 않고 엔딩(자동 판정)으로 간다', () => {
    expect(playLastWeek({}).sawCrossroads).toBe(true);
    useGameStore.getState().resolveEvent(-1);
    const after = useGameStore.getState().state!;
    expect(after.phase).toBe('ending');
    expect(calculateEnding(after).career).toBe('의대 합격');
  });
});
