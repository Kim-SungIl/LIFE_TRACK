/**
 * QA 플레이스루 하네스 — N개 플레이 페르소나로 7년(336주) 자동 플레이스루.
 * 결정론적(seededRandom) 풀 플레이 → 최종 스탯/엔딩/번아웃/이벤트/친밀도/시험 수집.
 * store.resolveEvent 와 동일한 해결(resolveEventLikeStore) 사용 — 메모리 슬롯·followup 반영.
 *
 * 실행: npx tsx scripts/sim/sim-qa-playthrough.ts [출력디렉토리] [시드수]
 * 출력: <dir>/qa-<persona>.json (페르소나별) + 콘솔 요약표
 *
 * **정직성(T47)** — 이 하네스는 값을 재는 도구라 자기 결함이 곧 밸런스 오판이 된다. 세 가지를 못 박는다:
 *   · 페르소나는 제품에서 만들 수 있는 조합이어야 유효 표에 든다(lib/qa-persona.ts validatePersona).
 *     위반 페르소나는 지우지 않고 `invalid`로 표시해 **별도 표**로 낸다(극단 스트레스 표본).
 *   · 돈 계측(minMoney·brokeWeeks·moneyByYear)은 이벤트 해결·미니톡 money 효과 **뒤**에 읽는다.
 *     앞에서 읽으면 이벤트가 쓴 돈이 안 보여 paid-full-spend의 빠듯한 주가 0으로 나왔다(실측 36~38주).
 *   · 매주 processWeek 직전에 제품의 확정 잠금 규칙 3종을 재현해 센다(lib/qa-ui-week-gates.ts).
 *     엔진은 조용히 스킵하지만 제품은 그 주를 넘길 수 없다 — "스킵된 슬롯"과 "잠긴 주"는 다른 수다.
 * **충실도(T54)** — T47이 범위 밖으로 남긴 셋:
 *   · 말걸기는 **이벤트를 닫은 뒤, 다음 주 확정 앞**에 한다(제품 순서 — runPersona 루프 머리의 근거 주석).
 *     이벤트 앞에서 걸면 RNG 소비 순서·미니톡 학년 게이트(W48 말걸기가 다음 학년 W1로)가 제품과 어긋난다.
 *   · brokeWeeks의 "다음 주 루틴비"는 **다음 주 좌표**(학년 경계 W48→W1 포함)로 판정한다(lib nextWeekRoutineCost).
 *   · 극단 사이의 빈칸 — 중간 투입 페르소나 2종(mid-input-*)을 유효 표본에 넣었다.
 */
import { createInitialState, processWeek, hashInitialState, getWeekInfo } from '../../src/engine/gameEngine';
import { ACTIVITIES, NPC_COMPANION_ACTIVITIES, getActivityCost } from '../../src/engine/activities';
import { calculateEnding } from '../../src/engine/ending';
import { resolveEventLikeStore, talkToNpcLikeStore } from '../lib/y1-sim-resolve';
import { isNpcInteractable } from '../../src/engine/relationshipSignals';
import { getAvailableNpcEvents } from '../../src/engine/talkSystem';
import { NPC_MINI_EVENTS } from '../../src/engine/talkData';
import type { GameState, EventChoice } from '../../src/engine/types';
import { validatePersona, personaMarkMismatches, type Persona, type ChoicePolicy } from './lib/qa-persona';
import { evaluateUiWeekGates, nextWeekRoutineCost, productViewOfWeek } from './lib/qa-ui-week-gates';
import * as fs from 'fs';
import { pathToFileURL } from 'url';

export type { Persona } from './lib/qa-persona';

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
    // 성취 등급에 적대적인 정책 — bestAxis = max(학업, 특기, 생활)을 낮추는 쪽을 고른다.
    // **'효과합 최소'로는 안 된다**: 그 정책은 멘탈·사회성에 큰 음수가 붙은 *학업 양수* 선택지를
    // 집어서 오히려 학업을 78~85까지 올린다(실측). 축 기준으로 재야 학업이 40대로 내려간다.
    if (policy === 'axis-min') {
      const axes = (e.academic ?? 0) + (e.talent ?? 0)
        + ((e.mental ?? 0) + (e.health ?? 0) + (e.social ?? 0)) / 3;
      return -axes;   // 아래 루프가 최대값을 고르므로 부호를 뒤집어 최소를 고르게 한다
    }
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
  // ===== 제품 확정 잠금 재현(T47, lib/qa-ui-week-gates.ts) — 매주 processWeek 직전에 판정 =====
  // 엔진은 조용히 스킵하지만 제품은 그 주를 넘길 수 없다. "제품이라면 확정이 잠겼을 주"를 규칙별로 센다.
  uiRoutineLockWeeks: number;   // ① routineTooExpensive (MainWeekScreen.tsx:130)
  uiPreviewSkipWeeks: number;   // ② predictWeekOutcome.skipped reason==='money' (MainWeekScreen.tsx:168-177)
  uiPickerBlockWeeks: number;   // ③ 선택 순서 누적 잔액 게이트 (ActivityPicker.tsx:135 + MainWeekScreen.tsx:407)
  uiConfirmLockWeeks: number;   // ① ∨ ② = 제품 moneyBlocked — 돈 때문에 확정 버튼이 잠긴 주
}

/**
 * 엔진·해결 함수 주입 — 테스트가 계측 **순서**(이벤트 뒤에 잔액을 읽는가)를 잠글 때만 바꾼다.
 * 제품 경로는 DEFAULT_DEPS 하나다. 순수 계측 함수만 잠그면 배선(호출 순서)이 빈다(#381 전례).
 */
export interface PlaythroughDeps {
  processWeek: typeof processWeek;
  resolveEvent: typeof resolveEventLikeStore;
  talkToNpc: typeof talkToNpcLikeStore;
}
export const DEFAULT_DEPS: PlaythroughDeps = { processWeek, resolveEvent: resolveEventLikeStore, talkToNpc: talkToNpcLikeStore };

export function runPersona(p: Persona, seed: number, deps: PlaythroughDeps = DEFAULT_DEPS): Result {
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
  let uiRoutineLockWeeks = 0, uiPreviewSkipWeeks = 0, uiPickerBlockWeeks = 0, uiConfirmLockWeeks = 0;
  const peakIntimacy: Record<string, number> = {};  // 드리프트(감쇠) 전 최고점 — scarcity 측정용
  const yearPeaks: Record<string, Record<number, number>> = {};  // npc → year → 그 학년 내 최고점 (학년 게이트 tier 도달성)

  // 학년 전환(week>48 → year-end 처리)이 학년당 49회 진행이라 7년에 343회+ 필요 → 상한 넉넉히.
  for (let week = 0; week < 420; week++) {
    // ── 말걸기(T54) — **이번 주 확정 앞, 지난주 이벤트를 전부 닫은 뒤**. 제품 순서의 근거:
    //   · GameScreen.tsx의 phase 라우터는 `currentEvent && phase==='event'`(:336 EventScene) →
    //     `phase==='result'`(:412 WeeklyResultScreen) → 그 밖(:446 MainWeekScreen) 순으로 고르고,
    //     `onTalkNpc`(:456)를 받는 화면은 MainWeekScreen뿐이다(MainWeekScreen.tsx:277 handleTalkNpc).
    //   · store.advanceWeek(:567)은 processWeek 뒤 phase를 'result'(이벤트면 'event')로 두고, 이벤트 체인이
    //     끝나면 다시 'result'(store.ts:415) → 결산 "계속"이 'weekday'로 돌려야 비로소 말걸기가 보인다.
    //   즉 플레이어의 한 주는 [말걸기 → 확정(processWeek) → 이벤트 → 결산]이고, 말걸기는 지난주 processWeek가
    //   굴린 npcEventPendingThisWeek를 **다음 주 계획 화면**에서 소비한다. 학년말도 같다 — year-end 화면을 넘긴
    //   새 학년 W1 계획 화면에서 건다(W49·year-end 상태에서 걸면 미니톡 학년 게이트가 한 학년 어긋난다).
    //   T47까지는 processWeek 직후·이벤트 **앞**이었다 — RNG(잡담이 rngSeed를 전진) 소비 순서가 제품과 달랐다.
    // pending이면 발동 가능한 NPC를 우선 (미니톡 fire 극대화 → tier 도달 측정).
    if (p.talk) {
      if (p.talkFocus) {
        // 집중 측정: 대상 NPC가 met이면 그 NPC에게만 말걸기 (focused ceiling 측정)
        if (s.npcs.find(n => n.id === p.talkFocus && isNpcInteractable(n, s))) s = deps.talkToNpc(s, p.talkFocus);
      } else {
        // 부재(전출·졸업) 친구는 플레이어가 고를 수 없다. met만으로 뽑으면 게이트에 걸려 no-op이 되고
        // 그 주 말걸기가 통째로 날아가 미니톡·친밀도가 과소 측정된다(특히 ?? candidates[0]가
        // 친밀도 최고값인 부재 하은을 집으면 Y4·Y7 48주가 전부 유실).
        const candidates = s.npcs.filter(n => isNpcInteractable(n, s)).sort((a, b) => b.intimacy - a.intimacy);
        const target = candidates.find(n => n.intimacy >= 30 && getAvailableNpcEvents(s, n.id).length > 0)
          ?? candidates[0];
        if (target) s = deps.talkToNpc(s, target.id);
      }
    }

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
    const weekBefore = s.week;
    const wasVacation = getWeekInfo(weekBefore).isVacation;

    // ── 제품 확정 잠금 재현(T47) — 플레이어가 확정 버튼을 누르는 바로 그 상태에서 판정한다 ──
    // 값은 바꾸지 않는다. 잠겼어도 하네스는 그대로 진행한다(엔진이 스킵) — 그래서 "잠겼을 주"는
    // 실제 플레이와 다른 궤적 위의 수다. 유료 페르소나 해석 시 이 수가 0이 아니면 그 판은
    // 제품에서 그대로 재현되지 않는 판이다.
    {
      const view = productViewOfWeek(s);
      const planned = view.isVacation ? s.vacationChoices : s.weekendChoices;
      const g = evaluateUiWeekGates(view, planned ?? [], npcMap);
      if (g.routineLocked) uiRoutineLockWeeks++;
      if (g.previewSkipped.length > 0) uiPreviewSkipWeeks++;
      if (g.pickerBlocked.length > 0) uiPickerBlockWeeks++;
      if (g.confirmLocked) uiConfirmLockWeeks++;
    }

    s = deps.processWeek(s, npcMap);

    // ── 스킵 계측 ── (엔진이 이 주에 남긴 로그 — 이벤트·미니톡과 무관하므로 여기서 읽는다)
    // 스킵 판정은 로그 메시지로만 가능하다. 루틴/주말이 같은 문구를 쓰므로 활동 이름으로 가른다
    // (그래서 유료 페르소나는 루틴과 주말에 서로 다른 활동을 쓴다).
    // 다음 주 루틴비(T54) — **다음 주 좌표**로 판정한다. 이번 주 `wasVacation`으로 재면 학기 마지막 주(W19·W42)를
    // 있지도 않은 루틴비로 빠듯하다 세고 방학 마지막 주(W24·W48)를 놓친다. W48→W1은 학년(단가)도 바뀐다.
    const nextRoutineCost = nextWeekRoutineCost(s, yearBefore, weekBefore);
    {
      const msgs = (s.weekLog?.messages ?? []).filter(m => m.includes('돈이 부족해서'));
      const routineNames = [s.routineSlot2, s.routineSlot3]
        .map(id => id ? ACTIVITIES.find(a => a.id === id)?.name : null)
        .filter((n): n is string => !!n);
      for (const m of msgs) {
        if (routineNames.some(n => m.includes(n))) routineSkippedForMoney++;
        else weekendSkippedForMoney++;
      }
      // 이번 주에 돌아간 루틴(지출·분모)은 이번 주 좌표가 맞다 — processWeek가 방금 과금한 주니까.
      if (!wasVacation) {
        routineWeeks++;
        for (const id of [s.routineSlot2, s.routineSlot3]) {
          if (!id) continue;
          const act = ACTIVITIES.find(a => a.id === id);
          if (!act) continue;
          const cost = getActivityCost(act, yearBefore);
          if (cost > 0 && !msgs.some(m => m.includes(act.name))) routineSpend += cost;
        }
      }
    }

    let guard = 0;
    while (s.currentEvent && guard++ < 20) {
      const ev = s.currentEvent;
      const choices = s.gender === 'female' && ev.femaleChoices ? ev.femaleChoices : ev.choices;
      const idx = pickChoice(choices, p.policy);
      s = deps.resolveEvent(s, idx);
      eventsResolved++;
    }

    // ── 돈 계측 ── **이벤트 해결·미니톡 뒤에** 읽는다(T47). 이벤트 선택지(moneyEffect)와 미니톡
    // (effects.money)이 잔액을 바꾸는데, 그 앞에서 읽으면 "주를 마친 잔액"이 아니라 활동 직후 잔액이다.
    // 실측: paid-full-spend에서 앞에서 읽으면 brokeWeeks 0, 뒤에서 읽으면 36~38주 — 이벤트가 쓴 돈이
    // 다음 주 루틴비를 못 내게 만드는 주가 통째로 안 보였다.
    {
      minMoney = Math.min(minMoney, s.money);
      // 다음 주 루틴비를 못 낼 상태로 주를 마쳤는가 — 다음 주 계획 화면의 routineTooExpensive(①)와 같은 판정.
      if (nextRoutineCost > 0 && s.money < nextRoutineCost) brokeWeeks++;
      moneyByYear[yearBefore] = Math.round(s.money);
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
      // store.advanceFromYearEnd 미러 — isVacation·semester를 안 고치면 새 학년 1주차가 겨울방학 값을
      // 들고 확정 화면 규칙(①의 방학 0원)에 들어간다. 엔진 자체는 prepareWeekContext가 다시 계산하므로 무해.
      s.week = 1;
      s.year++;
      s.currentEvent = null;
      s.phase = 'weekday';
      const nextInfo = getWeekInfo(s.week);
      s.semester = nextInfo.semester;
      s.isVacation = nextInfo.isVacation;
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
    uiRoutineLockWeeks, uiPreviewSkipWeeks, uiPickerBlockWeeks, uiConfirmLockWeeks,
  };
}

// ===== 플레이 페르소나 (33종) — 시드 12개와 곱해 396판. 개수를 바꾸면 이 주석도 고칠 것 =====
// (주의: 이 주석은 T30 전까지 "29종/348판"이었는데 배열은 이미 30종이었다 — 실측으로 바로잡았다.)
//
// **`invalid: true`(T47) — 제품에서 만들 수 없는 조합 10종.** 부모 강점 동일(TitleScreen toggle이 못 만들고
// lastSetup이 거부) 5종 + 루틴 슬롯2=슬롯3(SlotEditPopup이 후보에서 제외) 6종, 겹침 1(money-poor-acad).
// 지우지 않는 이유: 극단 스트레스 표본이다 — 같은 강점 2배 배율의 상한, 한 활동 2칸의 피로 축적, 번아웃 락이
// 실패 엔딩으로 라우팅되는지 같은 회귀 가드는 이 표본에서만 보인다. 다만 유효 표본과 **섞어 세면** 헤드라인이
// 부푼다(3시드 93판 실측: (a)(b)를 빼면 번아웃 24.7 → 14.3%, S 67.7 → 71.4%). 요약은 두 표로 가른다.
// 사유는 손으로 적지 않는다 — validatePersona가 낸다. 표시와 판정이 어긋나면 main()이 기동을 거부한다.
export const PERSONAS: Persona[] = [
  { name: 'academic-max', label: '공부 몰빵(학업 최대화)', gender: 'male', parents: ['strict', 'wealth'], routineSlot2: 'self-study', routineSlot3: 'self-study', weekend: ['self-study', 'self-study'], vacation: ['self-study', 'self-study', 'rest'], policy: 'academic', talk: true, tutoringY6: true, invalid: true },
  { name: 'social-max', label: '친구 몰빵(관계 최대화)', gender: 'female', parents: ['emotional', 'freedom'], routineSlot2: 'club', routineSlot3: 'club', weekend: ['club', 'club'], vacation: ['club', 'rest', 'rest'], policy: 'social', talk: true, invalid: true },
  { name: 'talent-max', label: '특기충(창작/코딩)', gender: 'male', parents: ['wealth', 'emotional'], routineSlot2: 'creative', routineSlot3: 'coding', weekend: ['creative', 'club'], vacation: ['creative', 'art-lesson', 'rest'], policy: 'talent', talk: true, tutoringY6: true },
  { name: 'balanced', label: '균형형(올라운드)', gender: 'female', parents: ['emotional', 'wealth'], routineSlot2: 'self-study', routineSlot3: 'light-exercise', weekend: ['self-study', 'club'], vacation: ['self-study', 'creative', 'rest'], policy: 'balanced', talk: true, tutoringY6: true },
  { name: 'mental-care', label: '멘탈 우선(쉼/회복형)', gender: 'female', parents: ['emotional', 'freedom'], routineSlot2: 'light-exercise', routineSlot3: 'club', weekend: ['rest', 'club'], vacation: ['rest', 'rest', 'club'], policy: 'mental', talk: true },
  { name: 'health-max', label: '체력/운동형', gender: 'male', parents: ['resilience', 'strict'], routineSlot2: 'light-exercise', routineSlot3: 'light-exercise', weekend: ['light-exercise', 'club'], vacation: ['light-exercise', 'rest', 'rest'], policy: 'health', talk: true, invalid: true },
  // **진짜 최소투입 페르소나.** 이 배열의 다른 29종은 이름이 '방치형'이어도 루틴 2칸과 주말·방학을
  // 전부 채운다 — 그래서 348판 최저 bestAxis가 84.9였고 성취 C·D가 0판이었다. 그건 엔진이 C를
  // 못 내는 게 아니라 **하네스가 그 구간에 닿지 않은 것**이다(이 페르소나로 C가 잡힌다).
  // 제품 합법성: 학기 중 루틴 슬롯2는 비울 수 없고(MainWeekScreen) 루틴 슬롯엔 rest 계열을 못 넣는다
  // (SlotEditPopup) — 그래서 슬롯2는 가장 이득이 적은 비휴식(sns, 피로 2 / social +1 mental −1)으로
  // 채우고 슬롯3·주말·방학만 비운다. 말걸기도 안 한다.
  // (T47) 부모 freedom×2는 제품 불가 — 그래도 남긴다: 성취 C의 양성 대조군은 이 표본뿐이다(achievementReach.test도 같은 조합).
  { name: 'min-input', label: '최소투입(루틴1칸·주말비움·축최소 선택)', gender: 'male', parents: ['freedom', 'freedom'], routineSlot2: 'sns-activity', routineSlot3: '', weekend: [], vacation: [], policy: 'axis-min', invalid: true },
  { name: 'neglect-first', label: '방치형(항상 첫 선택)', gender: 'male', parents: ['freedom', 'freedom'], routineSlot2: 'self-study', routineSlot3: 'light-exercise', weekend: ['self-study', 'club'], vacation: ['rest', 'rest', 'rest'], policy: 'first', talk: true, invalid: true },
  // (T47) strict×2는 제품 불가 — 번아웃 락(100주+ tired)이 실패 엔딩으로 라우팅되는지(#266)의 회귀 가드라 남긴다.
  { name: 'grind-burnout', label: '갈아넣기(번아웃 유도)', gender: 'female', parents: ['strict', 'strict'], routineSlot2: 'self-study', routineSlot3: 'coding', weekend: ['self-study', 'self-study'], vacation: ['self-study', 'self-study', 'self-study'], policy: 'academic', talk: true, tutoringY6: true, invalid: true },
  { name: 'last-choice', label: '청개구리(항상 마지막 선택)', gender: 'male', parents: ['emotional', 'info'], routineSlot2: 'club', routineSlot3: 'creative', weekend: ['club', 'creative'], vacation: ['rest', 'creative', 'club'], policy: 'last', talk: true },
  { name: 'info-parent', label: '정보형 부모+균형', gender: 'female', parents: ['info', 'wealth'], routineSlot2: 'self-study', routineSlot3: 'club', weekend: ['self-study', 'club'], vacation: ['self-study', 'rest', 'club'], policy: 'balanced', talk: true, tutoringY6: true },
  { name: 'poor-resilience', label: '저자원 회복형(무지출 가정)', gender: 'male', parents: ['resilience', 'freedom'], routineSlot2: 'light-exercise', routineSlot3: 'self-study', weekend: ['self-study', 'rest'], vacation: ['rest', 'self-study', 'rest'], policy: 'balanced', talk: true },
  // **중간 투입(T54).** 위까지의 유효 페르소나는 루틴 2칸·주말 2칸·방학 3칸을 전부 채우는 '성실'이거나 유료
  // 고정비를 켠 극단이고, 진짜 최소투입(min-input)은 부모 동일로 위반 표에 있다 — 그 사이(루틴 1칸만 두고
  // 주말 절반은 쉬는, 제품에서 가장 흔할 법한 플레이)를 유효 표본이 한 판도 안 밟았다. 슬롯3 비움은 제품
  // 합법(validatePersona: 슬롯2만 필수)이고 나머지도 전부 무료·1칸 활동이라 유효 표에 든다.
  { name: 'mid-input-study', label: '중간투입(무료루틴 1칸·주말 절반 휴식·공부 쪽)', gender: 'male', parents: ['info', 'resilience'], routineSlot2: 'self-study', routineSlot3: '', weekend: ['self-study', 'rest'], vacation: ['rest', 'self-study', 'rest'], policy: 'balanced', talk: true },
  { name: 'mid-input-social', label: '중간투입(무료루틴 1칸·주말 절반 휴식·동아리 쪽)', gender: 'female', parents: ['emotional', 'info'], routineSlot2: 'club', routineSlot3: '', weekend: ['club', 'rest'], vacation: ['rest', 'club', 'rest'], policy: 'balanced', talk: true },
  { name: 'social-female-romance', label: '여주 관계+균형(연애루트 노출)', gender: 'female', parents: ['emotional', 'emotional'], routineSlot2: 'club', routineSlot3: 'self-study', weekend: ['club', 'self-study'], vacation: ['club', 'creative', 'rest'], policy: 'social', talk: true, invalid: true },
  // ⓐ 검증용 — 중간 과부하: 열심히 하지만 갈아넣진 않음(휴식 없음). fatigue 45~59 밴드를 노림.
  { name: 'mid-overload-study', label: '중간과부하(공부+동아리, 무휴식)', gender: 'male', parents: ['strict', 'emotional'], routineSlot2: 'self-study', routineSlot3: 'club', weekend: ['self-study', 'club'], vacation: ['self-study', 'club', 'self-study'], policy: 'academic', talk: true },
  // C7-B 검증용 — 동일 학업+과외 루틴, wealth(수입5) vs 무-wealth(수입3): 돈 희소화로 wealth가 과외를 더 감당하는가
  // (T47) 이 쌍은 self-study×2 루틴이라 제품 불가. wealth 대조는 그대로 읽히지만(두 쪽이 같은 위반) 유효 표엔 못 든다.
  { name: 'money-rich-acad', label: '돈검증: wealth 학업+과외', gender: 'male', parents: ['wealth', 'freedom'], routineSlot2: 'self-study', routineSlot3: 'self-study', weekend: ['self-study', 'self-study'], vacation: ['self-study', 'self-study', 'rest'], policy: 'academic', talk: true, tutoringY6: true, invalid: true },
  { name: 'money-poor-acad', label: '돈검증: 무-wealth 학업+과외', gender: 'male', parents: ['freedom', 'freedom'], routineSlot2: 'self-study', routineSlot3: 'self-study', weekend: ['self-study', 'self-study'], vacation: ['self-study', 'self-study', 'rest'], policy: 'academic', talk: true, tutoringY6: true, invalid: true },
  { name: 'mid-overload-allround', label: '중간과부하(올라운드 풀가동, 무휴식)', gender: 'female', parents: ['emotional', 'info'], routineSlot2: 'self-study', routineSlot3: 'creative', weekend: ['club', 'creative'], vacation: ['self-study', 'creative', 'club'], policy: 'balanced', talk: true },
  { name: 'focus-haeun', label: '하은 집중(선배 관계 몰빵)', gender: 'female', parents: ['emotional', 'freedom'], routineSlot2: 'club', routineSlot3: 'self-study', weekend: ['club', 'rest'], vacation: ['rest', 'club', 'rest'], policy: 'social', talk: true, talkFocus: 'haeun' },
  { name: 'focus-junha', label: '준하 집중(전학생 관계 몰빵)', gender: 'male', parents: ['emotional', 'freedom'], routineSlot2: 'club', routineSlot3: 'self-study', weekend: ['club', 'rest'], vacation: ['rest', 'club', 'rest'], policy: 'social', talk: true, talkFocus: 'junha' },
  // 캐스트 밸런스 검수(balance-review-brief) — 신규 3인 집중 ceiling + 전원 친구 scarcity 측정
  { name: 'focus-seoa', label: '서아 집중(중2 데뷔 몰빵+동행)', gender: 'female', parents: ['emotional', 'freedom'], routineSlot2: 'club', routineSlot3: 'self-study', weekend: ['hang-out', 'club'], vacation: ['hang-out', 'club', 'rest'], policy: 'social', talk: true, talkFocus: 'seoa', companionFocus: 'seoa' },
  { name: 'focus-siwoo', label: '시우 집중(고1 데뷔 몰빵+동행)', gender: 'male', parents: ['emotional', 'freedom'], routineSlot2: 'club', routineSlot3: 'self-study', weekend: ['hang-out', 'club'], vacation: ['hang-out', 'club', 'rest'], policy: 'social', talk: true, talkFocus: 'siwoo', companionFocus: 'siwoo' },
  { name: 'focus-yerin', label: '예린 집중(고1 데뷔 몰빵+동행)', gender: 'female', parents: ['emotional', 'freedom'], routineSlot2: 'club', routineSlot3: 'self-study', weekend: ['hang-out', 'club'], vacation: ['hang-out', 'club', 'rest'], policy: 'social', talk: true, talkFocus: 'yerin', companionFocus: 'yerin' },
  { name: 'all-friends-max', label: '전원 친구(관계 극한+동행 분산)', gender: 'female', parents: ['emotional', 'freedom'], routineSlot2: 'club', routineSlot3: 'club', weekend: ['hang-out', 'club'], vacation: ['hang-out', 'club', 'rest'], policy: 'social', talk: true, companionSpread: true, invalid: true },
  // **관계형의 진짜 최적점(T30 추가).** all-friends-max와 루틴 한 칸(club → light-exercise)만 다르다.
  // 그 한 칸이 health 12.4 → 77.5를 가른다(6시드 실측) — 즉 이 배열은 여태 "절친을 9명 남기면서
  // 자기도 안 부순 판"을 한 번도 밟지 않았다. 그래서 360판 전체의 절친 최대치가 (몸이 성한 판에서)
  // 4명이었고, 그건 엔진이 5명을 못 내는 게 아니라 **하네스가 그 구간에 닿지 않은 것**이다
  // (min-input 페르소나를 넣은 이유와 같다). 관계 엔딩 타이틀의 양성 대조군이 여기다.
  { name: 'bond-max', label: '관계 극한+자기 관리(동행 분산·운동 1칸)', gender: 'female', parents: ['emotional', 'freedom'], routineSlot2: 'club', routineSlot3: 'light-exercise', weekend: ['hang-out', 'club'], vacation: ['hang-out', 'club', 'rest'], policy: 'social', talk: true, companionSpread: true },

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
  reachedEndingRuns: number;   // 엔딩 도달 run 수(7년 완주)
  // 제품 확정 잠금 재현(T47) — 규칙별 "잠겼을 주" 평균
  uiRoutineLockMean: number;
  uiPreviewSkipMean: number;
  uiPickerBlockMean: number;
  uiConfirmLockMean: number;
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
    reachedEndingRuns: runs.filter(r => r.reachedEnding).length,
    uiRoutineLockMean: Math.round(runs.reduce((a, r) => a + r.uiRoutineLockWeeks, 0) / runs.length),
    uiPreviewSkipMean: Math.round(runs.reduce((a, r) => a + r.uiPreviewSkipWeeks, 0) / runs.length),
    uiPickerBlockMean: Math.round(runs.reduce((a, r) => a + r.uiPickerBlockWeeks, 0) / runs.length),
    uiConfirmLockMean: Math.round(runs.reduce((a, r) => a + r.uiConfirmLockWeeks, 0) / runs.length),
  };
}

// 위반 페르소나 표시(invalid)와 판정(validatePersona)이 어긋나면 기동을 거부한다 — 표가 거짓이 되기 전에.
export function assertPersonaMarks(personas: readonly Persona[] = PERSONAS): void {
  const mismatches = personaMarkMismatches(personas);
  if (mismatches.length > 0) {
    throw new Error(`페르소나 invalid 표시와 판정이 어긋난다(${mismatches.length}건):\n  ${mismatches.join('\n  ')}`);
  }
}

function printGroupSummary(title: string, aggs: PersonaAgg[], runs: Result[], seeds: number): void {
  const pad = (s: unknown, n: number) => String(s).padEnd(n);
  console.log(`\n=== ${title}: ${aggs.length} 페르소나 × ${seeds} 시드 = ${runs.length} runs, 7년 ===\n`);
  if (aggs.length === 0) { console.log('(없음)'); return; }
  console.log(pad('persona', 28), pad('번아웃%', 10), pad('avgFat', 7), pad('tired%', 7), pad('maxTir', 7), pad('엔딩도달', 9), pad('성취', 10), pad('행복', 10), pad('수능', 12));
  for (const a of aggs) {
    console.log(
      pad(a.persona, 28),
      pad(`${a.burnoutRate}%(${a.burnoutMean})`, 10),
      pad(a.avgFatigue, 7),
      pad(`${a.tiredRate}%`, 7),
      pad(a.maxTired, 7),
      pad(`${a.reachedEndingRuns}/${a.runs}`, 9),
      pad(fmtDist(a.achievementDist), 10),
      pad(fmtDist(a.happinessDist), 10),
      pad(fmtDist(a.suneungDist), 12),
    );
  }
  // ===== 그룹 집계 (밸런스 핵심 신호) =====
  const overall = {
    achievement: {} as Record<string, number>,
    happiness: {} as Record<string, number>,
    suneung: {} as Record<string, number>,
    path: {} as Record<string, number>,
    burnoutRuns: 0,
    reached: 0,
  };
  for (const r of runs) {
    tally(overall.achievement, r.ending.achievement);
    tally(overall.happiness, r.ending.happiness);
    tally(overall.suneung, r.suneungMockGrade == null ? '-' : String(r.suneungMockGrade));
    tally(overall.path, r.ending.path);
    if (r.burnoutCount > 0) overall.burnoutRuns++;
    if (r.reachedEnding) overall.reached++;
  }
  const pct = (n: number) => Math.round(n / Math.max(1, runs.length) * 100);
  console.log(`\n--- ${title} ${runs.length} runs 집계 ---`);
  console.log(`번아웃 발생 run: ${overall.burnoutRuns}/${runs.length} (${pct(overall.burnoutRuns)}%)`);
  console.log(`엔딩 도달 run: ${overall.reached}/${runs.length} (${pct(overall.reached)}%)`);
  const maxTiredAll = Math.max(0, ...runs.map(r => r.maxConsecutiveTired));
  const lockRuns = runs.filter(r => r.maxConsecutiveTired >= 100).length;
  // 100주+ 락은 오류 아님 — 만성 탈진은 실패엔딩(재수/쉼표)으로 라우팅됨(#266). 무휴식 grind 페르소나에서 예상되는 값.
  console.log(`최장 연속 tired: ${maxTiredAll}주 / 100주+ 락 run: ${lockRuns} (만성 탈진 → 실패엔딩 라우팅, grind 페르소나 예상값 — #266)`);
  console.log(`성취:  ${fmtDist(overall.achievement)}`);
  console.log(`행복:  ${fmtDist(overall.happiness)}`);
  console.log(`수능:  ${fmtDist(overall.suneung)}`);
  console.log(`진로:  ${fmtDist(overall.path)}`);
}

function main() {
  const outDir = process.argv[2] || '/tmp/qa-results';
  const SEEDS = Number(process.argv[3]) || 12;   // 페르소나당 시드 수 (분포 표본)
  fs.mkdirSync(outDir, { recursive: true });

  // ===== 페르소나 유효성(T47) — 제품에서 만들 수 없는 조합은 별도 표로 =====
  assertPersonaMarks(PERSONAS);
  const invalidPersonas = PERSONAS.filter(p => p.invalid);
  console.log(`\n페르소나 ${PERSONAS.length}종 = 유효 ${PERSONAS.length - invalidPersonas.length} + 위반 ${invalidPersonas.length}(제품 불가 조합 — 극단 스트레스 표본, 유효 표와 섞어 세지 않는다)`);
  for (const p of invalidPersonas) console.log(`  ✗ ${p.name}: ${validatePersona(p).join(' / ')}`);

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

  const invalidNames = new Set(invalidPersonas.map(p => p.name));
  const validAggs = aggs.filter(a => !invalidNames.has(a.persona));
  const invalidAggs = aggs.filter(a => invalidNames.has(a.persona));
  const validRuns = allRuns.filter(r => !invalidNames.has(r.persona));
  const invalidRuns = allRuns.filter(r => invalidNames.has(r.persona));

  printGroupSummary('QA 분포 요약 — 유효 페르소나(제품에서 만들 수 있는 조합)', validAggs, validRuns, SEEDS);
  printGroupSummary('QA 분포 요약 — 위반 페르소나(제품 불가 · 극단 스트레스 표본, 밸런스 근거로 쓰지 말 것)', invalidAggs, invalidRuns, SEEDS);

  const pad = (s: unknown, n: number) => String(s).padEnd(n);

  // ===== 돈 흐름 =====
  // 최종 잔액만 보면 전부 "쌓였다"로 보인다. 루틴 고정비를 켠 페르소나가 도중에 마르는지,
  // 말라서 루틴이 실제로 안 돌아간 주가 몇 주인지가 이 표의 목적이다.
  // UI 열(T47): 제품이라면 확정이 잠겼을 주 — ①루틴합계 ②프리뷰스킵 ③피커누적 / 잠금=①∨②.
  // 엔진은 스킵하고 넘어가지만 제품은 여기서 멈춘다. 이 열이 0이 아닌 판은 제품에서 그대로 재현되지 않는다.
  console.log(`\n=== 돈 흐름 (평균 / ${SEEDS} 시드 · 위반 페르소나는 ✗) ===`);
  console.log(pad('persona', 30), pad('중2末', 8), pad('최종', 8), pad('최저', 7), pad('빠듯주', 8), pad('루틴스킵', 14), pad('주말스킵', 9), pad('루틴지출', 9), pad('UI①루틴', 8), pad('UI②프리뷰', 10), pad('UI③피커', 8), pad('UI잠금주', 8));
  for (const a of aggs) {
    console.log(
      pad(`${invalidNames.has(a.persona) ? '✗' : ' '}${a.persona}`, 30),
      pad(`${a.moneyY2Mean}만`, 8),
      pad(`${a.moneyMean}만`, 8),
      pad(`${a.minMoneyMean}만`, 7),
      pad(`${a.brokeWeeksMean}주`, 8),
      pad(`${a.routineSkipMean}슬롯(${a.routineSkipRate}%)`, 14),
      pad(`${a.weekendSkipMean}회`, 9),
      pad(`${a.routineSpendMean}만`, 9),
      pad(`${a.uiRoutineLockMean}주`, 8),
      pad(`${a.uiPreviewSkipMean}주`, 10),
      pad(`${a.uiPickerBlockMean}주`, 8),
      pad(`${a.uiConfirmLockMean}주`, 8),
    );
  }

  // ===== 미니톡/tier 도달 집계 (intimacyMin으로 정확 매핑) — 전체(유효+위반) =====
  const idToTier: Record<string, number> = {};
  for (const e of NPC_MINI_EVENTS) idToTier[e.id] = e.intimacyMin ?? 30;
  const firedIds = allRuns.flatMap(r => r.talkEventIds);
  const tierCount = (t: number) => firedIds.filter(id => (idToTier[id] ?? 30) === t).length;
  const uniqueIds = new Set(firedIds);
  console.log(`\n--- 미니톡 발동 (전체 ${allRuns.length} runs, 유효+위반) ---`);
  console.log(`총 발동: ${firedIds.length}회 / 고유 이벤트 ${uniqueIds.size}종 / run당 평균 ${Math.round(firedIds.length / allRuns.length * 10) / 10}회`);
  // 미니톡 tier 임계: 30/50/70/80 (80-게이트가 "tier90" 딥 콘텐츠). NPC별 도달 친밀도가 게이트.
  const deepUnique = [...uniqueIds].filter(id => (idToTier[id] ?? 30) === 80);
  console.log(`tier별: t30=${tierCount(30)}  t50=${tierCount(50)}  t70=${tierCount(70)}  t80(tier90딥)=${tierCount(80)}  (딥 고유 ${deepUnique.length}종: ${deepUnique.join(',')})`);

  // ===== 후회카드 재료 측정 (Phase 0) — 전체(유효+위반) =====
  console.log(`\n--- 후회카드 재료 (regret/melancholy/burden 톤 OR failure/betrayal/bypass/unspoken_debt 카테고리) — 전체 ${allRuns.length} runs ---`);
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
  console.log(`\n--- 후회카드 실제 노출 (selectRegretHighlights) — 전체 ${allRuns.length} runs ---`);
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

// 직접 실행일 때만 돈다 — 테스트가 PERSONAS·runPersona를 import해도 372판이 돌지 않게(run-chain.ts와 같은 가드).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
