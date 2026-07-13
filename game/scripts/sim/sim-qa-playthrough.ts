/**
 * QA 플레이스루 하네스 — N개 플레이 페르소나로 7년(336주) 자동 플레이스루.
 * 결정론적(seededRandom) 풀 플레이 → 최종 스탯/엔딩/번아웃/이벤트/친밀도/시험 수집.
 * store.resolveEvent 와 동일한 해결(resolveEventLikeStore) 사용 — 메모리 슬롯·followup 반영.
 *
 * 실행: npx tsx scripts/sim/sim-qa-playthrough.ts [출력디렉토리]
 * 출력: <dir>/qa-<persona>.json (페르소나별) + 콘솔 요약표
 */
import { createInitialState, processWeek, hashInitialState } from '../../src/engine/gameEngine';
import { calculateEnding, calculateHappinessGrade } from '../../src/engine/ending';
import { resolveEventLikeStore, talkToNpcLikeStore } from '../lib/y1-sim-resolve';
import { getAvailableNpcEvents } from '../../src/engine/talkSystem';
import { NPC_MINI_EVENTS } from '../../src/engine/talkData';
import type { GameState, ParentStrength, EventChoice } from '../../src/engine/types';
import * as fs from 'fs';

type ChoicePolicy = 'first' | 'academic' | 'social' | 'talent' | 'mental' | 'health' | 'balanced' | 'last';

interface Persona {
  name: string;
  label: string;          // 사람이 읽는 설명
  gender: 'male' | 'female';
  parents: [ParentStrength, ParentStrength];
  routineSlot2: string;
  routineSlot3: string;
  weekend: string[];
  vacation: string[];
  policy: ChoicePolicy;
  talk?: boolean;        // 매주 친밀도 최상위 NPC에게 말걸기 (미니톡/tier 측정)
  talkFocus?: string;    // 설정 시 그 NPC에게만 집중 말걸기 (focused ceiling 측정)
  tutoringY6?: boolean;  // Y6+ 주말 슬롯에 집중과외 투입 (돈 sink 측정)
}

// 선택지 정책 — effects 를 보고 인덱스 선택. tie 면 첫 번째.
function pickChoice(choices: EventChoice[], policy: ChoicePolicy): number {
  if (!choices || choices.length === 0) return 0;
  if (policy === 'first') return 0;
  if (policy === 'last') return choices.length - 1;
  const score = (ch: EventChoice): number => {
    const e = ch.effects || {};
    const fat = ch.fatigueEffect ?? 0;
    const npcInt = (ch.npcEffects || []).reduce((a: number, n) => a + (n.intimacyChange ?? 0), 0);
    if (policy === 'balanced') {
      const sum = (e.academic ?? 0) + (e.social ?? 0) + (e.talent ?? 0) + (e.mental ?? 0) + (e.health ?? 0);
      return sum - Math.max(0, fat) * 0.5 + npcInt * 0.5;
    }
    if (policy === 'social') return (e.social ?? 0) + npcInt; // 관계몰빵은 친밀도까지
    return e[policy] ?? 0;
  };
  let best = 0, bestScore = -Infinity;
  for (let i = 0; i < choices.length; i++) {
    const sc = score(choices[i]);
    if (sc > bestScore) { bestScore = sc; best = i; }
  }
  return best;
}

interface Result {
  persona: string;
  label: string;
  gender: string;
  parents: string[];
  policy: string;
  endedAtYear: number;
  endedAtWeek: number;
  reachedEnding: boolean;
  finalStats: GameState['stats'];
  ending: { path: string; achievement: string; happiness: string; detail?: string; title?: string };
  happinessGrade: string;
  burnoutCount: number;
  regretCardBody: number;
  regretCardShown: boolean;
  regretMemorialOverlap: number;
  finalMentalState: string;
  totalWeeksPlayed: number;
  eventsResolved: number;
  examsSat: { type: string; mockGrade?: number; rank?: number | null; avg?: number }[];
  suneungMockGrade: number | null;
  npcIntimacy: { id: string; name: string; intimacy: number; met: boolean }[];
  memorySlots: number;
  regretSlots: number;        // regret/betrayal/melancholy 톤 슬롯 수 (후회카드 재료)
  regretRecalls: string[];    // 그 슬롯들의 recallText (재료 품질 점검)
  toneCounts: Record<string, number>;
  talkEventsFired: number;
  talkEventIds: string[];
  finalMoney: number;
  maxConsecutiveTired: number;
  avgFatigue: number;
  tiredRate: number;   // tired/burnout 주 비율 (%)
}

function runPersona(p: Persona, seed: number): Result {
  let s = createInitialState(p.gender, p.parents, { rngSeed: seed });
  s.routineSlot2 = p.routineSlot2;
  s.routineSlot3 = p.routineSlot3;
  let eventsResolved = 0;
  let maxConsecutiveTired = 0;   // 데스 스파이럴/영구락 회귀 가드
  let fatigueSum = 0, weekCount = 0;   // 평균 fatigue (중간 과부하 밴드 확인용)
  let tiredWeeks = 0;

  // 학년 전환(week>48 → year-end 처리)이 학년당 49회 진행이라 7년에 343회+ 필요 → 상한 넉넉히.
  for (let week = 0; week < 420; week++) {
    // Y5+ 집중과외 투입 — requires(year>=5)를 하네스에서 수동 게이트 (processWeek는 돈만 체크)
    s.weekendChoices = (p.tutoringY6 && s.year >= 5)
      ? ['private-tutoring', p.weekend[1] ?? 'rest']
      : p.weekend;
    s.vacationChoices = p.vacation;
    s = processWeek(s);

    // 말걸기 — processWeek가 npcEventPendingThisWeek를 굴린 직후, 친밀도 최상위 met NPC에게.
    // pending이면 발동 가능한 NPC를 우선 (미니톡 fire 극대화 → tier 도달 측정).
    if (p.talk) {
      if (p.talkFocus) {
        // 집중 측정: 대상 NPC가 met이면 그 NPC에게만 말걸기 (focused ceiling 측정)
        if (s.npcs.find(n => n.id === p.talkFocus && n.met)) s = talkToNpcLikeStore(s, p.talkFocus);
      } else {
        const candidates = s.npcs.filter(n => n.met).sort((a, b) => b.intimacy - a.intimacy);
        const target = candidates.find(n => n.intimacy >= 30 && getAvailableNpcEvents(s, n.id).length > 0)
          ?? candidates[0];
        if (target) s = talkToNpcLikeStore(s, target.id);
      }
    }

    let guard = 0;
    while (s.currentEvent && guard++ < 20) {
      const ev = s.currentEvent;
      const choices = s.gender === 'female' && ev.femaleChoices ? ev.femaleChoices : ev.choices;
      const idx = pickChoice(choices, p.policy);
      s = resolveEventLikeStore(s, idx);
      eventsResolved++;
    }

    maxConsecutiveTired = Math.max(maxConsecutiveTired, s.consecutiveTiredWeeks ?? 0);
    fatigueSum += s.fatigue; weekCount++;
    if (s.mentalState === 'tired' || s.mentalState === 'burnout') tiredWeeks++;

    if (s.phase === 'year-end') {
      s.week = 1;
      s.year++;
      s.phase = 'weekday';
    }
    if (s.phase === 'ending') break;
  }

  const ending = calculateEnding(s);
  const suneung = s.examResults.find(e => e.examType === 'suneung');

  return {
    persona: p.name,
    label: p.label,
    gender: p.gender,
    parents: p.parents,
    policy: p.policy,
    endedAtYear: s.year,
    endedAtWeek: s.week,
    reachedEnding: s.phase === 'ending',
    finalStats: s.stats,
    ending: {
      path: ending.career,
      achievement: ending.achievement,
      happiness: ending.happiness,
      detail: ending.careerDetail,
      title: ending.title,
    },
    happinessGrade: calculateHappinessGrade(s.stats.mental, s.stats.social, s.stats.health),
    burnoutCount: s.burnoutCount ?? 0,
    finalMentalState: (s as { mentalState?: string }).mentalState ?? '?',
    totalWeeksPlayed: s.totalWeeksPlayed ?? 0,
    eventsResolved,
    examsSat: s.examResults.map(e => ({ type: e.examType, mockGrade: e.mockGrade, rank: e.rank ?? null, avg: e.average })),
    suneungMockGrade: suneung?.mockGrade ?? null,
    npcIntimacy: s.npcs.map(n => ({ id: n.id, name: n.name, intimacy: Math.round(n.intimacy), met: n.met })),
    memorySlots: s.memorySlots?.length ?? 0,
    // 후회카드 측정 — 본문 장수(화해 마감 제외), 노출 여부, 회고와의 이중노출(0이어야 정상)
    regretCardBody: (ending.regretHighlights ?? []).filter(h => !h.isClosing).length,
    regretCardShown: (ending.regretHighlights?.length ?? 0) > 0,
    regretMemorialOverlap: (() => {
      const mem = new Set((ending.memorialHighlights ?? []).map(h => h.recallText));
      return (ending.regretHighlights ?? []).filter(h => !h.isClosing && mem.has(h.recallText)).length;
    })(),
    ...(() => {
      const slots = s.memorySlots ?? [];
      const REGRET_TONES = new Set(['regret', 'betrayal', 'melancholy']);
      const toneCounts: Record<string, number> = {};
      const regretRecalls: string[] = [];
      for (const sl of slots) {
        const t = (sl as { toneTag?: string }).toneTag ?? 'none';
        toneCounts[t] = (toneCounts[t] ?? 0) + 1;
        if (REGRET_TONES.has(t)) regretRecalls.push((sl as { recallText?: string }).recallText ?? '');
      }
      return { regretSlots: regretRecalls.length, regretRecalls, toneCounts };
    })(),
    talkEventsFired: s.talkEventsFired?.length ?? 0,
    talkEventIds: s.talkEventsFired ?? [],
    finalMoney: Math.round(s.money),
    maxConsecutiveTired,
    avgFatigue: Math.round((fatigueSum / Math.max(1, weekCount)) * 10) / 10,
    tiredRate: Math.round((tiredWeeks / Math.max(1, weekCount)) * 100),
  };
}

// ===== 12 플레이 페르소나 =====
const PERSONAS: Persona[] = [
  { name: 'academic-max', label: '공부 몰빵(학업 최대화)', gender: 'male', parents: ['strict', 'wealth'], routineSlot2: 'self-study', routineSlot3: 'self-study', weekend: ['self-study', 'self-study'], vacation: ['self-study', 'self-study', 'rest'], policy: 'academic', talk: true, tutoringY6: true },
  { name: 'social-max', label: '친구 몰빵(관계 최대화)', gender: 'female', parents: ['emotional', 'freedom'], routineSlot2: 'club', routineSlot3: 'club', weekend: ['club', 'club'], vacation: ['club', 'rest', 'rest'], policy: 'social', talk: true },
  { name: 'talent-max', label: '특기충(창작/코딩)', gender: 'male', parents: ['wealth', 'emotional'], routineSlot2: 'creative', routineSlot3: 'coding', weekend: ['creative', 'club'], vacation: ['creative', 'art-lesson', 'rest'], policy: 'talent', talk: true, tutoringY6: true },
  { name: 'balanced', label: '균형형(올라운드)', gender: 'female', parents: ['emotional', 'wealth'], routineSlot2: 'self-study', routineSlot3: 'light-exercise', weekend: ['self-study', 'club'], vacation: ['self-study', 'creative', 'rest'], policy: 'balanced', talk: true, tutoringY6: true },
  { name: 'mental-care', label: '멘탈 우선(쉼/회복형)', gender: 'female', parents: ['emotional', 'freedom'], routineSlot2: 'light-exercise', routineSlot3: 'club', weekend: ['rest', 'club'], vacation: ['rest', 'rest', 'club'], policy: 'mental', talk: true },
  { name: 'health-max', label: '체력/운동형', gender: 'male', parents: ['resilience', 'strict'], routineSlot2: 'light-exercise', routineSlot3: 'light-exercise', weekend: ['light-exercise', 'club'], vacation: ['light-exercise', 'rest', 'rest'], policy: 'health', talk: true },
  { name: 'neglect-first', label: '방치형(항상 첫 선택)', gender: 'male', parents: ['freedom', 'freedom'], routineSlot2: 'self-study', routineSlot3: 'light-exercise', weekend: ['self-study', 'club'], vacation: ['rest', 'rest', 'rest'], policy: 'first', talk: true },
  { name: 'grind-burnout', label: '갈아넣기(번아웃 유도)', gender: 'female', parents: ['strict', 'strict'], routineSlot2: 'self-study', routineSlot3: 'coding', weekend: ['self-study', 'self-study'], vacation: ['self-study', 'self-study', 'self-study'], policy: 'academic', talk: true, tutoringY6: true },
  { name: 'last-choice', label: '청개구리(항상 마지막 선택)', gender: 'male', parents: ['emotional', 'info'], routineSlot2: 'club', routineSlot3: 'creative', weekend: ['club', 'creative'], vacation: ['rest', 'creative', 'club'], policy: 'last', talk: true },
  { name: 'info-parent', label: '정보형 부모+균형', gender: 'female', parents: ['info', 'wealth'], routineSlot2: 'self-study', routineSlot3: 'club', weekend: ['self-study', 'club'], vacation: ['self-study', 'rest', 'club'], policy: 'balanced', talk: true, tutoringY6: true },
  { name: 'poor-resilience', label: '저자원 회복형(무지출 가정)', gender: 'male', parents: ['resilience', 'freedom'], routineSlot2: 'light-exercise', routineSlot3: 'self-study', weekend: ['self-study', 'rest'], vacation: ['rest', 'self-study', 'rest'], policy: 'balanced', talk: true },
  { name: 'social-female-romance', label: '여주 관계+균형(연애루트 노출)', gender: 'female', parents: ['emotional', 'emotional'], routineSlot2: 'club', routineSlot3: 'self-study', weekend: ['club', 'self-study'], vacation: ['club', 'creative', 'rest'], policy: 'social', talk: true },
  // ⓐ 검증용 — 중간 과부하: 열심히 하지만 갈아넣진 않음(휴식 없음). fatigue 45~59 밴드를 노림.
  { name: 'mid-overload-study', label: '중간과부하(공부+동아리, 무휴식)', gender: 'male', parents: ['strict', 'emotional'], routineSlot2: 'self-study', routineSlot3: 'club', weekend: ['self-study', 'club'], vacation: ['self-study', 'club', 'self-study'], policy: 'academic', talk: true },
  // C7-B 검증용 — 동일 학업+과외 루틴, wealth(수입5) vs 무-wealth(수입3): 돈 희소화로 wealth가 과외를 더 감당하는가
  { name: 'money-rich-acad', label: '돈검증: wealth 학업+과외', gender: 'male', parents: ['wealth', 'freedom'], routineSlot2: 'self-study', routineSlot3: 'self-study', weekend: ['self-study', 'self-study'], vacation: ['self-study', 'self-study', 'rest'], policy: 'academic', talk: true, tutoringY6: true },
  { name: 'money-poor-acad', label: '돈검증: 무-wealth 학업+과외', gender: 'male', parents: ['freedom', 'freedom'], routineSlot2: 'self-study', routineSlot3: 'self-study', weekend: ['self-study', 'self-study'], vacation: ['self-study', 'self-study', 'rest'], policy: 'academic', talk: true, tutoringY6: true },
  { name: 'mid-overload-allround', label: '중간과부하(올라운드 풀가동, 무휴식)', gender: 'female', parents: ['emotional', 'info'], routineSlot2: 'self-study', routineSlot3: 'creative', weekend: ['club', 'creative'], vacation: ['self-study', 'creative', 'club'], policy: 'balanced', talk: true },
  { name: 'focus-haeun', label: '하은 집중(선배 관계 몰빵)', gender: 'female', parents: ['emotional', 'freedom'], routineSlot2: 'club', routineSlot3: 'self-study', weekend: ['club', 'rest'], vacation: ['rest', 'club', 'rest'], policy: 'social', talk: true, talkFocus: 'haeun' },
  { name: 'focus-junha', label: '준하 집중(전학생 관계 몰빵)', gender: 'male', parents: ['emotional', 'freedom'], routineSlot2: 'club', routineSlot3: 'self-study', weekend: ['club', 'rest'], vacation: ['rest', 'club', 'rest'], policy: 'social', talk: true, talkFocus: 'junha' },
];

// ===== 분포 집계 헬퍼 =====
const STAT_KEYS = ['academic', 'social', 'talent', 'mental', 'health'] as const;

interface PersonaAgg {
  persona: string;
  label: string;
  runs: number;
  burnoutRate: number;        // 번아웃 1회+ 발생한 run 비율
  burnoutMean: number;        // 평균 번아웃 횟수
  achievementDist: Record<string, number>;
  happinessDist: Record<string, number>;
  pathDist: Record<string, number>;
  suneungDist: Record<string, number>;   // 등급(1~9 / '-')별 run 수
  stats: Record<string, { mean: number; min: number; max: number }>;
  moneyMean: number;
  talkMean: number;
  avgFatigue: number;
  tiredRate: number;
  maxTired: number;
}

function tally(into: Record<string, number>, key: string): void {
  into[key] = (into[key] ?? 0) + 1;
}

// "S:5 A:6 B:1" 형식 — 많은 순.
function fmtDist(d: Record<string, number>): string {
  return Object.entries(d)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}:${v}`)
    .join(' ');
}

function aggregate(p: Persona, runs: Result[]): PersonaAgg {
  const achievementDist: Record<string, number> = {};
  const happinessDist: Record<string, number> = {};
  const pathDist: Record<string, number> = {};
  const suneungDist: Record<string, number> = {};
  const statAcc: Record<string, number[]> = {};
  for (const k of STAT_KEYS) statAcc[k] = [];
  let burnoutRuns = 0, burnoutSum = 0, moneySum = 0, talkSum = 0;

  for (const r of runs) {
    tally(achievementDist, r.ending.achievement);
    tally(happinessDist, r.ending.happiness);
    tally(pathDist, r.ending.path);
    tally(suneungDist, r.suneungMockGrade == null ? '-' : String(r.suneungMockGrade));
    for (const k of STAT_KEYS) statAcc[k].push(r.finalStats[k]);
    if (r.burnoutCount > 0) burnoutRuns++;
    burnoutSum += r.burnoutCount;
    moneySum += r.finalMoney;
    talkSum += r.talkEventsFired;
  }

  const stats: Record<string, { mean: number; min: number; max: number }> = {};
  for (const k of STAT_KEYS) {
    const arr = statAcc[k];
    stats[k] = {
      mean: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10,
      min: Math.round(Math.min(...arr)),
      max: Math.round(Math.max(...arr)),
    };
  }

  return {
    persona: p.name,
    label: p.label,
    runs: runs.length,
    burnoutRate: Math.round((burnoutRuns / runs.length) * 100),
    burnoutMean: Math.round((burnoutSum / runs.length) * 10) / 10,
    achievementDist, happinessDist, pathDist, suneungDist, stats,
    moneyMean: Math.round(moneySum / runs.length),
    talkMean: Math.round((talkSum / runs.length) * 10) / 10,
    avgFatigue: Math.round((runs.reduce((a, r) => a + r.avgFatigue, 0) / runs.length) * 10) / 10,
    tiredRate: Math.round(runs.reduce((a, r) => a + r.tiredRate, 0) / runs.length),
    maxTired: Math.max(...runs.map(r => r.maxConsecutiveTired)),
  };
}

function main() {
  const outDir = process.argv[2] || '/tmp/qa-results';
  const SEEDS = Number(process.argv[3]) || 12;   // 페르소나당 시드 수 (분포 표본)
  fs.mkdirSync(outDir, { recursive: true });

  const aggs: PersonaAgg[] = [];
  const allRuns: Result[] = [];

  for (const p of PERSONAS) {
    const runs: Result[] = [];
    for (let k = 0; k < SEEDS; k++) {
      // startedAt=k 고정 → 결정론적이고 재현 가능한 서로 다른 시드 (Date.now 비결정성 제거).
      const seed = hashInitialState({ gender: p.gender, parents: p.parents, startedAt: k });
      runs.push(runPersona(p, seed));
    }
    allRuns.push(...runs);
    fs.writeFileSync(`${outDir}/qa-${p.name}.json`, JSON.stringify(runs, null, 2));
    aggs.push(aggregate(p, runs));
  }
  fs.writeFileSync(`${outDir}/qa-agg.json`, JSON.stringify(aggs, null, 2));

  const pad = (s: unknown, n: number) => String(s).padEnd(n);
  console.log(`\n=== QA 분포 요약 (${aggs.length} 페르소나 × ${SEEDS} 시드 = ${allRuns.length} runs, 7년) ===\n`);
  console.log(pad('persona', 22), pad('번아웃%', 9), pad('avgFat', 7), pad('tired%', 7), pad('maxTir', 7), pad('성취', 10), pad('행복', 8), pad('수능', 12));
  for (const a of aggs) {
    console.log(
      pad(a.persona, 22),
      pad(`${a.burnoutRate}%(${a.burnoutMean})`, 9),
      pad(a.avgFatigue, 7),
      pad(`${a.tiredRate}%`, 7),
      pad(a.maxTired, 7),
      pad(fmtDist(a.achievementDist), 10),
      pad(fmtDist(a.happinessDist), 8),
      pad(fmtDist(a.suneungDist), 12),
    );
  }

  // ===== 전체 집계 (밸런스 핵심 신호) =====
  const overall = {
    achievement: {} as Record<string, number>,
    happiness: {} as Record<string, number>,
    suneung: {} as Record<string, number>,
    path: {} as Record<string, number>,
    burnoutRuns: 0,
  };
  for (const r of allRuns) {
    tally(overall.achievement, r.ending.achievement);
    tally(overall.happiness, r.ending.happiness);
    tally(overall.suneung, r.suneungMockGrade == null ? '-' : String(r.suneungMockGrade));
    tally(overall.path, r.ending.path);
    if (r.burnoutCount > 0) overall.burnoutRuns++;
  }
  console.log(`\n--- 전체 ${allRuns.length} runs 집계 ---`);
  console.log(`번아웃 발생 run: ${overall.burnoutRuns}/${allRuns.length} (${Math.round(overall.burnoutRuns / allRuns.length * 100)}%)`);
  const maxTiredAll = Math.max(...allRuns.map(r => r.maxConsecutiveTired));
  const lockRuns = allRuns.filter(r => r.maxConsecutiveTired >= 100).length;
  console.log(`최장 연속 tired: ${maxTiredAll}주 / 100주+ 락 run: ${lockRuns} (데스스파이럴 가드: 0이어야 정상)`);
  console.log(`성취:  ${fmtDist(overall.achievement)}`);
  console.log(`행복:  ${fmtDist(overall.happiness)}`);
  console.log(`수능:  ${fmtDist(overall.suneung)}`);
  console.log(`진로:  ${fmtDist(overall.path)}`);

  // ===== 미니톡/tier 도달 집계 (intimacyMin으로 정확 매핑) =====
  const idToTier: Record<string, number> = {};
  for (const e of NPC_MINI_EVENTS) idToTier[e.id] = e.intimacyMin ?? 30;
  const firedIds = allRuns.flatMap(r => r.talkEventIds);
  const tierCount = (t: number) => firedIds.filter(id => (idToTier[id] ?? 30) === t).length;
  const uniqueIds = new Set(firedIds);
  console.log(`\n--- 미니톡 발동 ---`);
  console.log(`총 발동: ${firedIds.length}회 / 고유 이벤트 ${uniqueIds.size}종 / run당 평균 ${Math.round(firedIds.length / allRuns.length * 10) / 10}회`);
  // 미니톡 tier 임계: 30/50/70/80 (80-게이트가 "tier90" 딥 콘텐츠). NPC별 도달 친밀도가 게이트.
  const deepUnique = [...uniqueIds].filter(id => (idToTier[id] ?? 30) === 80);
  console.log(`tier별: t30=${tierCount(30)}  t50=${tierCount(50)}  t70=${tierCount(70)}  t80(tier90딥)=${tierCount(80)}  (딥 고유 ${deepUnique.length}종: ${deepUnique.join(',')})`);

  // ===== 후회카드 재료 측정 (Phase 0) =====
  console.log(`\n--- 후회카드 재료 (regret/betrayal/melancholy 슬롯) ---`);
  const regretCounts = allRuns.map(r => r.regretSlots);
  const avgRegret = Math.round(regretCounts.reduce((a, b) => a + b, 0) / allRuns.length * 10) / 10;
  const runsWith2plus = allRuns.filter(r => r.regretSlots >= 2).length;
  const runsWith0 = allRuns.filter(r => r.regretSlots === 0).length;
  console.log(`run당 평균 ${avgRegret}개 / 0개 run ${runsWith0}(${Math.round(runsWith0 / allRuns.length * 100)}%) / 2개+ run ${runsWith2plus}(${Math.round(runsWith2plus / allRuns.length * 100)}%)`);
  console.log(`페르소나별 평균 regret 슬롯:`);
  for (const a of aggs) {
    const rs = allRuns.filter(r => r.persona === a.persona);
    const mean = Math.round(rs.reduce((s, r) => s + r.regretSlots, 0) / rs.length * 10) / 10;
    console.log(`  ${pad(a.persona, 22)} ${mean}`);
  }
  // 전체 톤 분포
  const toneAll: Record<string, number> = {};
  for (const r of allRuns) for (const [t, c] of Object.entries(r.toneCounts)) toneAll[t] = (toneAll[t] ?? 0) + c;
  console.log(`전체 슬롯 톤 분포: ${fmtDist(toneAll)}`);
  // regret recallText 샘플 (중복 제거 상위)
  const sampleRecalls = [...new Set(allRuns.flatMap(r => r.regretRecalls))].slice(0, 12);
  console.log(`regret recallText 샘플(${sampleRecalls.length}종):`);
  for (const t of sampleRecalls) console.log(`  · ${t}`);
  // ===== 후회카드 실제 노출 측정 (selectRegretHighlights 구현 검증) =====
  console.log(`\n--- 후회카드 실제 노출 (selectRegretHighlights) ---`);
  const shownRuns = allRuns.filter(r => r.regretCardShown).length;
  const bodyCounts = allRuns.map(r => r.regretCardBody);
  const avgBody = Math.round(bodyCounts.reduce((a, b) => a + b, 0) / allRuns.length * 10) / 10;
  const overlapTotal = allRuns.reduce((a, r) => a + r.regretMemorialOverlap, 0);
  const bodyDist: Record<string, number> = {};
  for (const c of bodyCounts) bodyDist[String(c)] = (bodyDist[String(c)] ?? 0) + 1;
  console.log(`카드 노출 run: ${shownRuns}/${allRuns.length} (${Math.round(shownRuns / allRuns.length * 100)}%) / 0장 run ${allRuns.length - shownRuns}`);
  console.log(`본문 장수 분포(화해 제외): ${fmtDist(bodyDist)} / run당 평균 ${avgBody}장 (최대 2 정상)`);
  console.log(`회고와 이중노출 총합 (0이어야 정상): ${overlapTotal}`);

  console.log(`\n결과 JSON: ${outDir}/qa-<persona>.json (시드별 배열) + qa-agg.json`);
}

main();
