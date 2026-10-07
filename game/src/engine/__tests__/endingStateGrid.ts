// T66 불변 증명용 상태 격자 — 테스트(endingT66Invariance.test.ts)와 T66 **이전** 코드에서 기대값을
// 뜬 일회성 스크립트가 **같은 함수**를 써야 비교가 성립하므로 따로 둔다(vitest 의존 없음).
//
// 무작위가 아니라 결정론적 LCG — 같은 N이면 언제나 같은 판들이 나온다. 진로·행복 문턱 근처
// (talent 85·90, academic 70·80, mental 15·30·40, burnout 2·4·6, tired 235, 학년별 저멘탈 4·10·20주)에
// 값이 몰리도록 후보 목록에서 고른다 — 균등 0~100이면 문턱 칸이 거의 안 걸린다.
import { createInitialState } from '../gameEngine';
import { BEST_TIER, DEPARTED_NPC_ID } from '../endingNpc';
import type { ExamResult, GameState, ParentStrength, Track } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];

function lcg(seed: number) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 0x100000000;
  };
}

function suneung(mockGrade: number): ExamResult {
  const blank = { score: 0, grade: 'C' as const, delta: 0 };
  return {
    subjects: { korean: blank, english: blank, math: blank, socialScience: blank, artsPhysical: blank },
    average: 0, rank: null, prevRank: null, comment: '', parentReaction: '', teacherReaction: '',
    examType: 'suneung', schoolLevel: 'high', year: 7, semester: 2, mockGrade,
  };
}

const NEAR = {
  talent: [10, 50, 84.9, 85, 87, 89.9, 90, 95, 100],
  academic: [20, 55, 69.9, 70, 75, 79.9, 80, 85, 88, 95],
  mental: [5, 14.9, 15, 29.9, 30, 39.9, 40, 55, 80, 95],
  other: [8, 19.9, 20, 45, 60, 80, 97],
  burnout: [0, 0, 0, 1, 2, 3, 4, 5, 6, 8],
  tired: [0, 120, 234, 235, 300],
  lowWeeks: [0, 0, 0, 1, 3, 4, 9, 10, 19, 20, 30],
  vlowWeeks: [0, 0, 0, 0, 1, 2, 4],
} as const;

const pick = <T,>(r: () => number, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];

/** 엔딩 판정 격자. careerChoice는 넣지 않는다(= 자동 판정 = T66 이전과 같아야 하는 판). */
export function endingStateGrid(n: number, seed = 20261007): GameState[] {
  const r = lcg(seed);
  const out: GameState[] = [];
  for (let i = 0; i < n; i++) {
    const st = createInitialState(r() < 0.5 ? 'female' : 'male', PARENTS, { rngSeed: 42 });
    st.stats = {
      academic: pick(r, NEAR.academic), talent: pick(r, NEAR.talent), mental: pick(r, NEAR.mental),
      social: pick(r, NEAR.other), health: pick(r, NEAR.other),
    };
    st.track = pick(r, [null, 'humanities', 'science'] as (Track | null)[]);
    const mg = pick(r, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    st.examResults = mg === 0 ? [] : [suneung(mg)];
    st.burnoutCount = pick(r, NEAR.burnout);
    st.totalTiredWeeks = pick(r, NEAR.tired);
    st.lowMentalWeeksByYear = Array.from({ length: 7 }, () => pick(r, NEAR.lowWeeks));
    st.veryLowMentalWeeksByYear = st.lowMentalWeeksByYear.map(l => Math.min(l, pick(r, NEAR.vlowWeeks)));
    st.burnoutCountByYear = Array.from({ length: 7 }, () => (r() < 0.8 ? 0 : pick(r, [1, 2, 3])));
    const friends = pick(r, [0, 0, 2, 5, 6]);
    const targets = st.npcs.filter(x => x.id !== DEPARTED_NPC_ID).slice(0, friends).map(x => x.id);
    st.npcs = st.npcs.map(x => (targets.includes(x.id)
      ? { ...x, met: true, intimacy: BEST_TIER }
      : { ...x, met: true, intimacy: 0 }));
    out.push(st);
  }
  return out;
}

/** 판정 층만 — 회상·근황(기억·RNG 의존)과 T66이 **새로** 얹은 recoveryNote는 뺀다. */
export function judgmentLine(e: {
  title: string; description: string; achievement: string; achievementNote: string | null;
  growthShape: string | null; growthNote: string | null; happiness: string; total: number;
  career: string; careerDetail: string; suneungGrade: number | null;
}): string {
  return [e.title, e.description, e.achievement, e.achievementNote ?? '-', e.growthShape ?? '-',
    e.growthNote ?? '-', e.happiness, e.total, e.career, e.careerDetail, e.suneungGrade ?? '-'].join('|');
}

/** FNV-1a 32bit — 수천 줄을 인라인 기대값 하나로 접는다. */
export function digest(lines: readonly string[]): string {
  let h = 0x811c9dc5;
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      h ^= line.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= 0x0a;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
