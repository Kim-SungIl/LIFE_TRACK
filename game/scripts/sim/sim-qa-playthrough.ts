/**
 * QA 플레이스루 하네스 — N개 플레이 페르소나로 7년(336주) 자동 플레이스루.
 * 결정론적(seededRandom) 풀 플레이 → 최종 스탯/엔딩/번아웃/이벤트/친밀도/시험 수집.
 * store.resolveEvent 와 동일한 해결(resolveEventLikeStore) 사용 — 메모리 슬롯·followup 반영.
 *
 * 실행: npx tsx scripts/sim/sim-qa-playthrough.ts [출력디렉토리]
 * 출력: <dir>/qa-<persona>.json (페르소나별) + 콘솔 요약표
 */
import { createInitialState, processWeek, hashInitialState, getWeekInfo } from '../../src/engine/gameEngine';
import { ACTIVITIES, NPC_COMPANION_ACTIVITIES, getActivityCost } from '../../src/engine/activities';
import { calculateEnding } from '../../src/engine/ending';
import { resolveEventLikeStore, talkToNpcLikeStore } from '../lib/y1-sim-resolve';
import { isNpcInteractable } from '../../src/engine/relationshipSignals';
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
  companionFocus?: string; // 주말/방학 동행 활동(+3)을 이 NPC에게 몰빵 (met 이후부터)
  companionSpread?: boolean; // 동행을 최저 친밀도 met NPC에게 분산 (전원 친구 상한 측정)
  tutoringY6?: boolean;  // Y6+ 주말 슬롯에 집중과외 투입 (돈 sink 측정)
  // 알바 밸브 측정 — part-time은 unlockYear 4(중3)이고 requires도 year>=4다(activities.ts:216).
  // processWeek는 돈만 보고 unlock/requires를 안 보므로 tutoringY6과 동일하게 **하네스에서 수동 게이트**한다.
  // 이 게이트를 빼면 Y1~Y3에 존재하지 않는 수입이 생겨 측정 자체가 거짓이 된다.
  partTimeY4?: boolean;        // Y4+ 주말 1슬롯을 알바로 (Y1~3은 p.weekend 그대로)
  partTimeVacationY4?: boolean; // Y4+ 방학 1슬롯도 알바로 (밸브 상한 측정)
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
  regretNpcStoryOverlap: number;
  finalMentalState: string;
  totalWeeksPlayed: number;
  eventsResolved: number;
  examsSat: { type: string; mockGrade?: number; rank?: number | null; avg?: number }[];
  suneungMockGrade: number | null;
  npcIntimacy: { id: string; name: string; intimacy: number; met: boolean }[];
  npcPeakIntimacy: Record<string, number>;   // 7년 중 최고 친밀도 (감쇠 전 도달점)
  npcYearPeaks: Record<string, Record<number, number>>;  // npc→year→그 학년 최고점 (학년 게이트 tier 도달성)
  reachFired: { npc: string; year: number; tier: number }[];  // 발동된 reach (starvation 측정)
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
  // ===== 돈 계측 =====
  // 기존 페르소나는 루틴 2칸이 전부 무료 활동이라 "매주 반복되는 고정비"가 한 번도 안 켜졌다.
  // finalMoney 하나만 봐서는 "돈이 남아돈다"는 결론밖에 안 나온다(측정 아티팩트).
  // 아래 지표는 유료 루틴을 켠 페르소나에서 실제로 돈이 마르는지, 마르면 무슨 일이 생기는지를 본다.
  moneyByYear: Record<number, number>;     // 학년 종료 시점 잔액
  minMoney: number;                        // 7년 최저 잔액
  // 주의: 잔액은 매주 용돈 지급 뒤에 읽히므로 "수입 미만"으로 재면 항상 0이 나온다.
  // 의미 있는 신호는 "다음 주 루틴비를 못 낼 상태로 주를 마쳤는가"다.
  brokeWeeks: number;
  routineWeeks: number;                    // 루틴이 돌아야 했던 학기 주 수 (스킵률 분모)
  routineSkippedForMoney: number;          // 돈이 없어 방과후 루틴이 안 돌아간 슬롯 수
  weekendSkippedForMoney: number;          // 돈이 없어 주말/방학 활동이 스킵된 슬롯 수
  routineSpend: number;                    // 7년 누적 루틴 지출(실제 집행분)
}

function runPersona(p: Persona, seed: number): Result {
  let s = createInitialState(p.gender, p.parents, { rngSeed: seed });
  s.routineSlot2 = p.routineSlot2;
  s.routineSlot3 = p.routineSlot3;
  let eventsResolved = 0;
  let maxConsecutiveTired = 0;   // 데스 스파이럴/영구락 회귀 가드
  let fatigueSum = 0, weekCount = 0;   // 평균 fatigue (중간 과부하 밴드 확인용)
  let tiredWeeks = 0;
  // 돈 계측 — 스킵은 로그 메시지가 유일한 신호다(엔진이 카운터를 안 남김).
  // applyRoutineActivities / applyWeekendActivities 둘 다 '💰 돈이 부족해서 …' 를 push한다.
  const moneyByYear: Record<number, number> = {};
  let minMoney = s.money, brokeWeeks = 0;
  let routineSkippedForMoney = 0, weekendSkippedForMoney = 0, routineSpend = 0, routineWeeks = 0;
  const peakIntimacy: Record<string, number> = {};  // 드리프트(감쇠) 전 최고점 — scarcity 측정용
  const yearPeaks: Record<string, Record<number, number>> = {};  // npc → year → 그 학년 내 최고점 (학년 게이트 tier 도달성)

  // 학년 전환(week>48 → year-end 처리)이 학년당 49회 진행이라 7년에 343회+ 필요 → 상한 넉넉히.
  for (let week = 0; week < 420; week++) {
    // Y5+ 집중과외 투입 — requires(year>=5)를 하네스에서 수동 게이트 (processWeek는 돈만 체크)
    s.weekendChoices = (p.tutoringY6 && s.year >= 5)
      ? ['private-tutoring', p.weekend[1] ?? 'rest']
      : (p.partTimeY4 && s.year >= 4)
        ? ['part-time', p.weekend[1] ?? 'rest']
        : p.weekend;
    s.vacationChoices = (p.partTimeVacationY4 && s.year >= 4)
      ? ['part-time', p.vacation[1] ?? 'rest', p.vacation[2] ?? 'rest']
      : p.vacation;

    // 동행(+3) — UI npcActivityMap 시뮬. 이번 주 실제 돌아갈 슬롯(학기=주말/방학=방학)의
    // 동행 가능 활동에만 배정 (processWeek는 map을 무조건 적용하므로 주차 정합 필수).
    let npcMap: Record<string, string> | undefined;
    if (p.companionFocus || p.companionSpread) {
      const acts = getWeekInfo(s.week).isVacation ? s.vacationChoices : s.weekendChoices;
      const eligible = [...new Set((acts ?? []).filter(a => NPC_COMPANION_ACTIVITIES.includes(a)))];
      if (eligible.length > 0) {
        const met = s.npcs.filter(n => n.met);
        if (p.companionFocus) {
          const target = met.find(n => n.id === p.companionFocus);
          if (target) npcMap = Object.fromEntries(eligible.map(a => [a, target.id]));
        } else if (met.length > 0) {
          // spread: 활동마다 최저 친밀도 순으로 서로 다른 NPC
          const sorted = [...met].sort((a, b) => a.intimacy - b.intimacy);
          npcMap = Object.fromEntries(eligible.map((a, i) => [a, sorted[i % sorted.length].id]));
        }
      }
    }
    const yearBefore = s.year;
    const wasVacation = getWeekInfo(s.week).isVacation;
    s = processWeek(s, npcMap);

    // ── 돈 계측 ──
    // 스킵 판정은 로그 메시지로만 가능하다. 루틴/주말이 같은 문구를 쓰므로 활동 이름으로 가른다
    // (그래서 유료 페르소나는 루틴과 주말에 서로 다른 활동을 쓴다).
    {
      const msgs = (s.weekLog?.messages ?? []).filter(m => m.includes('돈이 부족해서'));
      const routineNames = [s.routineSlot2, s.routineSlot3]
        .map(id => id ? ACTIVITIES.find(a => a.id === id)?.name : null)
        .filter((n): n is string => !!n);
      for (const m of msgs) {
        if (routineNames.some(n => m.includes(n))) routineSkippedForMoney++;
        else weekendSkippedForMoney++;
      }
      let nextRoutineCost = 0;
      if (!wasVacation) {
        routineWeeks++;
        for (const id of [s.routineSlot2, s.routineSlot3]) {
          if (!id) continue;
          const act = ACTIVITIES.find(a => a.id === id);
          if (!act) continue;
          const cost = getActivityCost(act, yearBefore);
          nextRoutineCost += cost;
          if (cost > 0 && !msgs.some(m => m.includes(act.name))) routineSpend += cost;
        }
      }
      minMoney = Math.min(minMoney, s.money);
      // 다음 주 루틴비를 못 낼 상태로 주를 마쳤는가 — UI의 routineTooExpensive와 같은 판정.
      if (nextRoutineCost > 0 && s.money < nextRoutineCost) brokeWeeks++;
      moneyByYear[yearBefore] = Math.round(s.money);
    }

    // 말걸기 — processWeek가 npcEventPendingThisWeek를 굴린 직후, 친밀도 최상위 met NPC에게.
    // pending이면 발동 가능한 NPC를 우선 (미니톡 fire 극대화 → tier 도달 측정).
    if (p.talk) {
      if (p.talkFocus) {
        // 집중 측정: 대상 NPC가 met이면 그 NPC에게만 말걸기 (focused ceiling 측정)
        if (s.npcs.find(n => n.id === p.talkFocus && isNpcInteractable(n, s))) s = talkToNpcLikeStore(s, p.talkFocus);
      } else {
        // 부재(전출·졸업) 친구는 플레이어가 고를 수 없다. met만으로 뽑으면 게이트에 걸려 no-op이 되고
        // 그 주 말걸기가 통째로 날아가 미니톡·친밀도가 과소 측정된다(특히 ?? candidates[0]가
        // 친밀도 최고값인 부재 하은을 집으면 Y4·Y7 48주가 전부 유실).
        const candidates = s.npcs.filter(n => isNpcInteractable(n, s)).sort((a, b) => b.intimacy - a.intimacy);
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

    for (const n of s.npcs) {
      peakIntimacy[n.id] = Math.max(peakIntimacy[n.id] ?? 0, n.intimacy);
      const yp = (yearPeaks[n.id] ??= {});
      yp[s.year] = Math.max(yp[s.year] ?? 0, n.intimacy);
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
    happinessGrade: ending.happiness,
    burnoutCount: s.burnoutCount ?? 0,
    finalMentalState: (s as { mentalState?: string }).mentalState ?? '?',
    totalWeeksPlayed: s.totalWeeksPlayed ?? 0,
    eventsResolved,
    examsSat: s.examResults.map(e => ({ type: e.examType, mockGrade: e.mockGrade, rank: e.rank ?? null, avg: e.average })),
    suneungMockGrade: suneung?.mockGrade ?? null,
    npcIntimacy: s.npcs.map(n => ({ id: n.id, name: n.name, intimacy: Math.round(n.intimacy), met: n.met })),
    npcPeakIntimacy: Object.fromEntries(Object.entries(peakIntimacy).map(([k, v]) => [k, Math.round(v)])),
    npcYearPeaks: Object.fromEntries(Object.entries(yearPeaks).map(([k, m]) =>
      [k, Object.fromEntries(Object.entries(m).map(([y, v]) => [y, Math.round(v)]))])),
    reachFired: s.events.filter(e => e.reach).map(e => ({ npc: e.reach!.npc, year: e.reach!.year, tier: e.reach!.tier })),
    memorySlots: s.memorySlots?.length ?? 0,
    // 후회카드 측정 — 본문 장수(화해 마감 제외), 노출 여부, 회고와의 이중노출(0이어야 정상)
    regretCardBody: (ending.regretHighlights ?? []).filter(h => !h.isClosing).length,
    regretCardShown: (ending.regretHighlights?.length ?? 0) > 0,
    regretMemorialOverlap: (() => {
      const mem = new Set((ending.memorialHighlights ?? []).map(h => h.recallText));
      return (ending.regretHighlights ?? []).filter(h => !h.isClosing && mem.has(h.recallText)).length;
    })(),
    // npcStories↔regret 교차노출 — npcStory 문자열에 regret 본문 recallText가 임베드(substring)됐는지.
    // bestRecallFor가 betrayal만 제외해 betrayal 아닌 후회풀 슬롯이 양쪽 노출될 수 있음(선재 이슈 계측).
    regretNpcStoryOverlap: (() => {
      const stories = ending.npcStories ?? [];
      return (ending.regretHighlights ?? [])
        .filter(h => !h.isClosing)
        .filter(h => stories.some(st => st.includes(h.recallText))).length;
    })(),
    ...(() => {
      const slots = s.memorySlots ?? [];
      // selectRegretHighlights 풀 정의와 일치: 톤(regret/melancholy/burden) OR 카테고리(failure/betrayal/bypass/unspoken_debt).
      // (구버전은 betrayal을 톤처럼 세고 burden을 빠뜨려 풀 크기를 오측정했음)
      const REGRET_TONES = new Set(['regret', 'melancholy', 'burden']);
      const REGRET_CATEGORIES = new Set(['failure', 'betrayal', 'bypass', 'unspoken_debt']);
      const toneCounts: Record<string, number> = {};
      const regretRecalls: string[] = [];
      for (const sl of slots) {
        const t = (sl as { toneTag?: string }).toneTag ?? 'none';
        const cat = (sl as { category?: string }).category ?? '';
        toneCounts[t] = (toneCounts[t] ?? 0) + 1;
        if (REGRET_TONES.has(t) || REGRET_CATEGORIES.has(cat)) regretRecalls.push((sl as { recallText?: string }).recallText ?? '');
      }
      return { regretSlots: regretRecalls.length, regretRecalls, toneCounts };
    })(),
    talkEventsFired: s.talkEventsFired?.length ?? 0,
    talkEventIds: s.talkEventsFired ?? [],
    finalMoney: Math.round(s.money),
    maxConsecutiveTired,
    avgFatigue: Math.round((fatigueSum / Math.max(1, weekCount)) * 10) / 10,
    tiredRate: Math.round((tiredWeeks / Math.max(1, weekCount)) * 100),
    moneyByYear,
    minMoney: Math.round(minMoney),
    brokeWeeks,
    routineWeeks,
    routineSkippedForMoney,
    weekendSkippedForMoney,
    routineSpend: Math.round(routineSpend),
  };
}

// ===== 플레이 페르소나 (29종) — 시드 12개와 곱해 348판. 개수를 바꾸면 이 주석도 고칠 것 =====
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
  // 캐스트 밸런스 검수(balance-review-brief) — 신규 3인 집중 ceiling + 전원 친구 scarcity 측정
  { name: 'focus-seoa', label: '서아 집중(중2 데뷔 몰빵+동행)', gender: 'female', parents: ['emotional', 'freedom'], routineSlot2: 'club', routineSlot3: 'self-study', weekend: ['hang-out', 'club'], vacation: ['hang-out', 'club', 'rest'], policy: 'social', talk: true, talkFocus: 'seoa', companionFocus: 'seoa' },
  { name: 'focus-siwoo', label: '시우 집중(고1 데뷔 몰빵+동행)', gender: 'male', parents: ['emotional', 'freedom'], routineSlot2: 'club', routineSlot3: 'self-study', weekend: ['hang-out', 'club'], vacation: ['hang-out', 'club', 'rest'], policy: 'social', talk: true, talkFocus: 'siwoo', companionFocus: 'siwoo' },
  { name: 'focus-yerin', label: '예린 집중(고1 데뷔 몰빵+동행)', gender: 'female', parents: ['emotional', 'freedom'], routineSlot2: 'club', routineSlot3: 'self-study', weekend: ['hang-out', 'club'], vacation: ['hang-out', 'club', 'rest'], policy: 'social', talk: true, talkFocus: 'yerin', companionFocus: 'yerin' },
  { name: 'all-friends-max', label: '전원 친구(관계 극한+동행 분산)', gender: 'female', parents: ['emotional', 'freedom'], routineSlot2: 'club', routineSlot3: 'club', weekend: ['hang-out', 'club'], vacation: ['hang-out', 'club', 'rest'], policy: 'social', talk: true, companionSpread: true },

  // ===== 유료 루틴 (2026-08-09 추가) =====
  // ⚠ 해석 주의: 이 하네스는 processWeek(엔진)만 돌린다. 엔진은 잔액이 모자라면 그 슬롯을
  // **조용히 스킵**하지만(applyRoutineActivities의 '💰 돈이 부족해서' 분기), 실제 게임은
  // MainWeekScreen의 routineTooExpensive가 **루틴 2칸 합계** 기준으로 확정 버튼을 잠근다.
  // 즉 인게임에서는 "스킵"이 아니라 "루틴을 바꾸기 전엔 주를 넘길 수 없음"으로 나타난다.
  // → routineSkippedForMoney는 "엔진이 스킵했을 주", brokeWeeks는 "UI가 막았을 주"로 읽을 것.
  // 여기까지의 페르소나는 routineSlot2/3가 전부 무료 활동(self-study·club·creative·coding·
  // light-exercise)이라 **매주 반복되는 고정비 채널이 한 번도 안 켜졌다**. 그래서 "돈이 남아돈다"는
  // 결론이 나왔는데, 그건 게임의 절반만 측정한 것이다. 루틴은 학기 중 매주 2칸이 과금되고
  // (applyRoutineActivities → applyActivity), 잔액이 모자라면 그 슬롯이 통째로 스킵된다.
  // 주간 수입은 3만(wealth 5만)인데 학원은 Y1 2 / Y3 3 / Y6 4만, PT는 2만이다.
  // 주의: 루틴과 주말에 같은 활동을 쓰면 스킵 로그를 어느 쪽인지 가를 수 없다(위 계측 코드 참조).
  { name: 'paid-routine-poor', label: '유료루틴: 학원+PT / 무-wealth', gender: 'male', parents: ['strict', 'freedom'], routineSlot2: 'academy', routineSlot3: 'gym', weekend: ['self-study', 'rest'], vacation: ['self-study', 'rest', 'rest'], policy: 'academic', talk: true },
  { name: 'paid-routine-rich', label: '유료루틴: 학원+PT / wealth', gender: 'male', parents: ['wealth', 'freedom'], routineSlot2: 'academy', routineSlot3: 'gym', weekend: ['self-study', 'rest'], vacation: ['self-study', 'rest', 'rest'], policy: 'academic', talk: true },
  { name: 'paid-routine-double-academy', label: '유료루틴: 학원×2 (최대 고정비)', gender: 'male', parents: ['strict', 'freedom'], routineSlot2: 'academy', routineSlot3: 'internet-lecture', weekend: ['self-study', 'rest'], vacation: ['self-study', 'rest', 'rest'], policy: 'academic', talk: true },
  { name: 'paid-full-spend', label: '유료루틴+유료주말(예체능) 풀지출', gender: 'female', parents: ['strict', 'freedom'], routineSlot2: 'academy', routineSlot3: 'gym', weekend: ['art-lesson', 'rest'], vacation: ['art-lesson', 'rest', 'rest'], policy: 'balanced', talk: true },
  // 대조군 — 위와 모든 조건이 같고 루틴만 무료. 유료화의 순효과를 이 쌍으로 읽는다.
  { name: 'free-routine-control', label: '대조군: 동일 조건 / 무료 루틴', gender: 'male', parents: ['strict', 'freedom'], routineSlot2: 'self-study', routineSlot3: 'light-exercise', weekend: ['self-study', 'rest'], vacation: ['self-study', 'rest', 'rest'], policy: 'academic', talk: true },

  // 알바 밸브 — paid-routine-poor와 **모든 조건이 동일**하고 주말 1슬롯만 Y4+에 알바로 바뀐다.
  // 이 쌍의 차이가 곧 밸브의 순효과다. 알바는 Y4(중3)부터라 Y1~Y3은 paid-routine-poor와 완전히 같고,
  // 그 구간의 적자는 밸브로 메울 수 없다는 사실이 결과에 그대로 남는다.
  { name: 'paid-routine-parttime', label: '유료루틴+주말알바(Y4~)', gender: 'male', parents: ['strict', 'freedom'], routineSlot2: 'academy', routineSlot3: 'gym', weekend: ['self-study', 'rest'], vacation: ['self-study', 'rest', 'rest'], policy: 'academic', talk: true, partTimeY4: true },
  // 밸브 상한 — 주말+방학 모두 알바. 이것도 못 메우면 알바로는 해결이 안 되는 것이다.
  { name: 'paid-routine-parttime-max', label: '유료루틴+주말/방학알바(Y4~)', gender: 'male', parents: ['strict', 'freedom'], routineSlot2: 'academy', routineSlot3: 'gym', weekend: ['self-study', 'rest'], vacation: ['self-study', 'rest', 'rest'], policy: 'academic', talk: true, partTimeY4: true, partTimeVacationY4: true },
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
  // 돈 — moneyMean(최종 잔액) 하나로는 "쌓였다"만 보이고 도중에 말랐는지가 안 보인다.
  minMoneyMean: number;
  brokeWeeksMean: number;
  routineSkipRate: number;   // 루틴이 돌아야 했던 학기 주 대비 스킵 비율(%)
  routineSkipMean: number;
  weekendSkipMean: number;
  routineSpendMean: number;
  moneyY2Mean: number;   // 중2 종료 잔액 — 기존 백로그가 "529만원"이라고 적은 지점
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
    minMoneyMean: Math.round(runs.reduce((a, r) => a + r.minMoney, 0) / runs.length),
    brokeWeeksMean: Math.round(runs.reduce((a, r) => a + r.brokeWeeks, 0) / runs.length),
    routineSkipRate: Math.round(
      (runs.reduce((a, r) => a + r.routineSkippedForMoney, 0) /
       Math.max(1, runs.reduce((a, r) => a + r.routineWeeks * 2, 0))) * 100),
    routineSkipMean: Math.round(runs.reduce((a, r) => a + r.routineSkippedForMoney, 0) / runs.length),
    weekendSkipMean: Math.round(runs.reduce((a, r) => a + r.weekendSkippedForMoney, 0) / runs.length),
    routineSpendMean: Math.round(runs.reduce((a, r) => a + r.routineSpend, 0) / runs.length),
    moneyY2Mean: Math.round(runs.reduce((a, r) => a + (r.moneyByYear[2] ?? 0), 0) / runs.length),
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

  // ===== 돈 흐름 =====
  // 최종 잔액만 보면 전부 "쌓였다"로 보인다. 루틴 고정비를 켠 페르소나가 도중에 마르는지,
  // 말라서 루틴이 실제로 안 돌아간 주가 몇 주인지가 이 표의 목적이다.
  console.log(`\n=== 돈 흐름 (평균 / ${SEEDS} 시드) ===`);
  console.log(pad('persona', 30), pad('중2末', 8), pad('최종', 8), pad('최저', 7), pad('빠듯주', 8), pad('루틴스킵', 14), pad('주말스킵', 9), pad('루틴지출', 9));
  for (const a of aggs) {
    console.log(
      pad(a.persona, 30),
      pad(`${a.moneyY2Mean}만`, 8),
      pad(`${a.moneyMean}만`, 8),
      pad(`${a.minMoneyMean}만`, 7),
      pad(`${a.brokeWeeksMean}주`, 8),
      pad(`${a.routineSkipMean}슬롯(${a.routineSkipRate}%)`, 14),
      pad(`${a.weekendSkipMean}회`, 9),
      pad(`${a.routineSpendMean}만`, 9),
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
  // 100주+ 락은 오류 아님 — 만성 탈진은 실패엔딩(재수/쉼표)으로 라우팅됨(#266). 무휴식 grind 페르소나에서 예상되는 값.
  console.log(`최장 연속 tired: ${maxTiredAll}주 / 100주+ 락 run: ${lockRuns} (만성 탈진 → 실패엔딩 라우팅, grind 페르소나 예상값 — #266)`);
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
  console.log(`\n--- 후회카드 재료 (regret/melancholy/burden 톤 OR failure/betrayal/bypass/unspoken_debt 카테고리) ---`);
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
  const npcOverlapRuns = allRuns.filter(r => r.regretNpcStoryOverlap > 0).length;
  const npcOverlapTotal = allRuns.reduce((a, r) => a + r.regretNpcStoryOverlap, 0);
  console.log(`NPC근황과 교차노출: ${npcOverlapRuns}/${allRuns.length} run (${Math.round(npcOverlapRuns / allRuns.length * 100)}%), 총 ${npcOverlapTotal}건`);

  console.log(`\n결과 JSON: ${outDir}/qa-<persona>.json (시드별 배열) + qa-agg.json`);
}

main();
