/**
 * 월 단위 vs 주 단위 — **플레이어 행동이 달라질 때** 결과가 어떻게 갈리는가.
 *
 * monthPlaybackEquivalence는 "같은 계획이면 같은 결과"만 증명한다. 월 단위의 밸런스 질문은 그 바깥이다:
 * 매주 반응하던 플레이어가 한 달에 한 번만 반응하게 되면(피로·말걸기) 무엇이 달라지나.
 *
 * 행동 4종(루틴·주말 기본 계획은 같고, 반응만 다르다):
 *   W-react   주 단위(플래그 꺼짐). 매주 지쳤으면(tired 또는 피로 60+) 주말·방학을 휴식으로. 말걸기 기회가 뜨면 매주 말 건다.
 *   W-fixed   주 단위, 반응 없음(골든 드라이버와 같은 성격). 말걸기는 W-react와 같다 — 피로 반응 효과만 가른다.
 *   M-active  월 단위. 달 초에 한 번 피로를 보고 그 달 주말을 정한다. 초대는 전부 수락(돈이 안 되면 거절).
 *             재생 중 💬 배지가 뜨면 멈춰서 말 건다. 번아웃 멈춤이면 남은 주를 휴식으로 다시 짠다.
 *   M-passive 월 단위, 재생 중 💬을 안 누른다. 대신 달 초 계획 화면에서 적립(talkBank)을 다 쓴다.
 *
 * 공통: 사건은 보이고 돈이 되는 첫 선택지(firstPickableChoice). 동행 활동엔 친밀도 순 첫 친구.
 * 대화는 쓸 수 있는 기회를 다 쓴다 — 친구 미니 이벤트 먼저, 그다음 가정(선택지면 0번). 적립(talkBank)도 같은 경로로 소비.
 * 루틴 4종: 정본 paid·mixed·free + 갈아넣기(grind, 번아웃이 실제로 나는 판). 월 계획 저장은 계획 화면의 돈 잠금(overspent)을 흉내 낸다 —
 * store는 돈을 안 봐서, 안 흉내 내면 유료 판이 W1에서 plan-invalid에 영원히 갇힌다.
 * 실행: npx tsx scripts/sim/sim-monthly-vs-weekly.ts [시드수=12]   (MVW_DECLINE=1 — 초대를 전부 거절하는 대조)
 *       MVW_LINES=1 — 재생 카드 머리 줄(cardLine, 카드와 같은 함수)이 한 판에 몇 번·몇 종 나갔나를 행동별로 덧붙인다.
 */
import { installMemoryStorage, layoutSlots } from '../lib/week-driver';
import { SIM_ROUTINES, assertRoutineIds, type Routine } from '../lib/sim-routines';
import { NPC_COMPANION_ACTIVITIES } from '../../src/engine/activities';
import { createInitialState, predictWeekOutcome } from '../../src/engine/gameEngine';
import { calculateEnding } from '../../src/engine/ending';
import { GAME_EVENTS } from '../../src/engine/events';
import { assignCurrentEvent, firstPickableChoice } from '../../src/engine/eventPresentation';
import { getCurrentMonthPlan, plannedWeekCost } from '../../src/engine/monthPlan';
import { generateMonthInvites } from '../../src/engine/monthInvites';
import { checkPlannedWeek, getMonthRun, hadTalkChance, talkBankCount } from '../../src/engine/monthPlayback';
import { isNpcInteractable } from '../../src/engine/relationshipSignals';
import { slotCountFor } from '../../src/engine/slotCount';
import { getAvailableNpcEvents, getEligibleParentClimax } from '../../src/engine/talkSystem';
import { getMonthBlock, getWeekInfo } from '../../src/engine/weekMath';
import { assignSlot, getConfirmGate, getWeekSlotCount } from '../../src/engine/weekendPlan';
import type { GameState, MonthPlan } from '../../src/engine/types';
import { getRoutineDueCost } from '../../src/engine/monthlyMoney';
import { canSpend } from '../../src/engine/spendableMoney';
import { cloneGameState } from '../../src/engine/stateClone';
import { cardLine } from '../../src/engine/talkData/playbackLines';

type Behavior = 'W-react' | 'W-fixed' | 'M-active' | 'M-passive';
const BEHAVIORS: Behavior[] = ['W-react', 'W-fixed', 'M-active', 'M-passive'];
// 갈아넣기 — 번아웃이 실제로 나는 판(sim-qa-playthrough grind-burnout과 같은 활동). 정본 루틴은 번아웃 0이라 피로 반응을 못 잰다.
const GRIND: Routine = { name: 'grind', label: '갈아넣기', parents: ['strict', 'strict'],
  slot2: 'self-study', slot3: 'coding', weekend: ['self-study', 'self-study'], vacation: ['self-study', 'self-study', 'self-study'] };
const ROUTINES = [...SIM_ROUTINES.filter(r => ['paid', 'mixed', 'free'].includes(r.name)), GRIND];
const STEP_LIMIT = 8000;

const storage = installMemoryStorage();
void storage;
const { useGameStore: store } = await import('../../src/engine/store');
const api = store.getState;
const now = (): GameState => { const s = api().state; if (!s) throw new Error('state 없음'); return s; };

const isTired = (s: GameState) => s.mentalState !== 'normal' || s.fatigue >= 60;

function companionFor(s: GameState): string | null {
  const npc = s.npcs.filter(n => n.met && isNpcInteractable(n, s)).sort((a, b) => b.intimacy - a.intimacy || a.id.localeCompare(b.id))[0];
  return npc ? npc.id : null;
}
function talkTarget(s: GameState): string | null {
  const npc = s.npcs
    .filter(n => n.met && n.intimacy >= 30 && isNpcInteractable(n, s) && getAvailableNpcEvents(s, n.id).length > 0)
    .sort((a, b) => b.intimacy - a.intimacy)[0];
  return npc ? npc.id : null;
}
function weekActivities(r: Routine, s: GameState, vac: boolean, rest: boolean): string[] {
  const n = slotCountFor(s.parents, vac);
  if (rest) return layoutSlots(Array(n).fill('rest'), n);
  return layoutSlots(vac ? r.vacation : r.weekend, n);
}
function companions(s: GameState, acts: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const npc = companionFor(s);
  if (npc) acts.forEach((id, i) => { if (id && NPC_COMPANION_ACTIVITIES.includes(id)) map[`${id}:${i}`] = npc; });
  return map;
}

interface Run {
  routine: string; behavior: Behavior; seed: number; ok: boolean; err?: string;
  ach: string; hap: string; burnout: number; tiredWeeks: number; talkEvents: number; homeEvents: number;
  peak70: number; peak80: number; dating: boolean; money: number; spent: number; blockedWeeks: number;
  fallbacks: number; blockedMonths: number; manualWeeks: number; invAcc: number; invDec: number; kept: number; broken: number; stops: Record<string, number>; replans: number;
  /** 재생 카드에 나간 머리 줄(월말·시험 결산 주와 결산 독백은 뺀다) */
  cardLines: string[];
}

function runOne(r: Routine, behavior: Behavior, seed: number): Run {
  const gender = seed % 2 ? 'female' : 'male';
  const initial = createInitialState(gender, r.parents, { rngSeed: seed });
  const first = GAME_EVENTS.find(e => e.id === 'first-week')!;
  assignCurrentEvent(initial, first, first.week ?? 1);
  store.setState({ state: initial, runDelta: null, npcActivityMap: {} });

  const monthly = behavior.startsWith('M');
  const out: Run = {
    routine: r.name, behavior, seed, ok: false, ach: '-', hap: '-', burnout: 0, tiredWeeks: 0, talkEvents: 0, homeEvents: 0,
    peak70: 0, peak80: 0, dating: false, money: 0, spent: 0, blockedWeeks: 0,
    fallbacks: 0, blockedMonths: 0, manualWeeks: 0, invAcc: 0, invDec: 0, kept: 0, broken: 0, stops: {}, replans: 0, cardLines: [],
  };
  const peak: Record<string, number> = {};
  const unsub = store.subscribe((st, prev) => {
    const s = st.state;
    if (!s) return;
    for (const n of s.npcs) if (n.met) peak[n.id] = Math.max(peak[n.id] ?? 0, n.intimacy);
    if (s.relationship) out.dating = true;
    const entering = (s.phase === 'result' || ((s.phase === 'year-end' || s.phase === 'ending') && s.weekLog?.week === 48))
      && prev.state?.phase !== s.phase;
    if (entering) for (const p of s.weekLog?.promises ?? []) { if (p.kept) out.kept++; else out.broken++; }
  });
  const talk = (target: string | null) => {
    if (!target) return;
    if (api().talkToNpc(target).kind !== 'smalltalk') out.talkEvents++;
  };
  const homeChance = (s: GameState) => getEligibleParentClimax(s) != null || s.parentEventPendingThisWeek || talkBankCount(s, 'home') > 0;
  const talkHome = () => {
    const r2 = api().talkToHome();
    if (r2.kind !== 'event') return false;
    out.homeEvents++;
    if (r2.event.choices?.length) api().resolveParentTalkChoice(r2.event.id, 0);
    return true;
  };
  /** 이번 주 쓸 수 있는 대화를 다 쓴다 — 친구 미니 이벤트 먼저, 그다음 가정. 적립(talkBank)도 이 경로로 소비된다. */
  const spendTalks = () => {
    for (let k = 0; k < 8; k++) {
      const s = now();
      const t = (s.npcEventPendingThisWeek || talkBankCount(s, 'npc') > 0) ? talkTarget(s) : null;
      if (t) { const before = out.talkEvents; talk(t); if (out.talkEvents > before) continue; }
      if (homeChance(now()) && talkHome()) continue;
      break;
    }
  };

  /** 지금 주부터 달 끝까지 계획. rest=true면 주말·방학 전부 휴식(초대 칸은 지킨다). */
  const buildPlan = (s: GameState, existing: MonthPlan | null, rest: boolean, acceptAll: boolean, strip: boolean): MonthPlan => {
    const block = getMonthBlock(s.week);
    const invites = existing?.invites ?? generateMonthInvites(s).map(inv => ({ ...inv, accepted: acceptAll }));
    const weeks = Array.from({ length: block.endWeek - s.week + 1 }, (_, i) => s.week + i).map(week => {
      const vac = getWeekInfo(week).isVacation;
      let activities = weekActivities(r, s, vac, rest);
      if (strip) activities = activities.map(id => (id === 'rest' || id === 'self-study' ? id : ''));
      let npcChoices = companions(s, activities);
      for (const inv of invites) {
        if (!inv.accepted || inv.week !== week) continue;
        activities = assignSlot(activities, inv.slotIdx, inv.activityId);
        npcChoices = Object.fromEntries(Object.entries(npcChoices).filter(([k]) => {
          const m = /^(.+):(\d+)$/.exec(k);
          return !!m && activities[Number(m[2])] === m[1];
        }));
        npcChoices[`${inv.activityId}:${inv.slotIdx}`] = inv.npcId;
      }
      return { week, activities, npcChoices };
    });
    return { year: s.year, month: block.index, weeks, invites };
  };
  /** 저장이 거부되면 플레이어가 하는 순서로 물러선다: 초대 거절 → 유료 칸 비우기 → 무료 루틴. */
  const savePlan = (rest: boolean) => {
    const s = now();
    const existing = getCurrentMonthPlan(s);
    const decline = process.env.MVW_DECLINE === "1";
    const tries: [boolean, boolean][] = existing ? [[true, false], [true, true]] : decline ? [[false, false], [false, true]] : [[true, false], [false, false], [false, true]];
    // 계획 화면의 [이번 달 시작] 잠금(MonthPlanScreen overspent) — store는 돈을 안 본다.
    const overspent = (plan: MonthPlan) => {
      const st = now();
      return st.money - getRoutineDueCost(st) - plan.weeks.reduce((a, w) => a + plannedWeekCost(w.activities, st.year), 0) < 0;
    };
    let blocked = false;
    for (const [acc, strip] of tries) {
      const plan = buildPlan(now(), existing, rest, acc, strip);
      if (overspent(plan)) { blocked = true; continue; }
      if (!api().setMonthPlan(plan)) {
        if (blocked && !existing) out.blockedMonths++;
        if (!existing) for (const inv of plan.invites ?? []) { if (inv.accepted) out.invAcc++; else out.invDec++; }
        return;
      }
    }
    if (!existing) out.blockedMonths++;
    api().setRoutine('self-study', null);
    out.fallbacks++;
    const plan = buildPlan(now(), existing, rest, false, true);
    const why = api().setMonthPlan(plan);
    if (why) throw new Error(`계획 거부 Y${s.year} W${s.week}: ${why}`);
    if (!existing) for (const inv of plan.invites ?? []) { if (inv.accepted) out.invAcc++; else out.invDec++; }
  };

  /** 플레이어의 루틴 관리 — 돈이 되면 원래 루틴으로 돌아가고(남은 주 몫을 낸다), 못 내면 무료 루틴으로. */
  const ensureRoutine = () => {
    const s = now();
    if (s.isVacation) return;
    if (s.routineSlot2 !== r.slot2 || s.routineSlot3 !== r.slot3) {
      const probe = cloneGameState(s);
      probe.routineSlot2 = r.slot2; probe.routineSlot3 = r.slot3;
      if (canSpend(s, getRoutineDueCost(probe))) api().setRoutine(r.slot2, r.slot3);
    }
    if (getConfirmGate(now(), { skipped: [] }).routineTooExpensive) { api().setRoutine('self-study', null); out.fallbacks++; }
  };
  /** 주간 화면에서 손으로 한 주 확정 — 확정 잠금이 풀릴 때까지 플레이어가 하는 일을 한다. */
  const manualWeek = (rest: boolean) => {
    const p = now();
    let acts = weekActivities(r, p, p.isVacation, rest).slice(0, getWeekSlotCount(p));
    let npc = companions(p, acts);
    let gate = getConfirmGate(p, predictWeekOutcome(p, acts, npc));
    if (gate.moneyBlocked) api().markMoneyBlockedWeek();
    for (let fix = 0; gate.disabled; fix++) {
      if (fix >= 3) throw new Error(`확정 잠금 Y${p.year} W${p.week} ${JSON.stringify(gate)}`);
      if (gate.routineTooExpensive) { api().setRoutine('self-study', null); out.fallbacks++; }
      else if (gate.unaffordableIds.length) acts = acts.map(id => (gate.unaffordableIds.includes(id) ? '' : id));
      else if (gate.reserveBreached) acts = acts.map(id => (id === 'rest' || id === 'self-study' ? id : ''));
      else throw new Error(`돈 아닌 잠금 ${JSON.stringify(gate)}`);
      npc = companions(now(), acts);
      gate = getConfirmGate(now(), predictWeekOutcome(now(), acts, npc));
    }
    api().confirmWeek(acts, npc);
  };
  let routineSet = false;
  let restRemaining = false;
  try {
    for (let step = 0; step < STEP_LIMIT; step++) {
      const s = now();
      if (s.phase === 'ending') { out.ok = true; break; }
      if (s.phase === 'year-end') { api().advanceFromYearEnd(); continue; }
      if (s.phase === 'event') {
        const e = s.currentEvent!;
        api().resolveEvent(firstPickableChoice(s, s.gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices));
        continue;
      }
      if (s.phase === 'result') {
        if (!monthly) { api().setPhase('weekday'); continue; }
        const run = s.monthRun;
        const lw = s.weekLog?.week;
        if (run && lw != null && s.weekLog?.year === run.year && getMonthBlock(lw).index === run.month && getMonthBlock(lw).endWeek === lw) {
          api().finishMonth();
          continue;
        }
        // 카드 경로(screenRoute 'card')와 같은 조건 — 재생이 처리한 주, 시험 주 아님. 결산 독백 자리는 문장 표가 아니라 뺀다.
        const entry = run?.log[run.log.length - 1];
        if (s.weekLog && entry && entry.week === lw && entry.auto && !s.weekLog.examResult) {
          const line = cardLine(s, s.weekLog, '\u0000');
          if (line !== '\u0000') out.cardLines.push(line);
        }
        if (behavior === 'M-active' && hadTalkChance(s)) api().pausePlayback('talk');
        api().continuePlayback();
        continue;
      }
      if (!routineSet) { api().setRoutine(r.slot2, r.slot3); routineSet = true; continue; }

      if (!monthly) {
        // 주 단위 — 매주 계획
        spendTalks();
        if (now().phase !== s.phase) continue;
        ensureRoutine();
        manualWeek(behavior === 'W-react' && isTired(now()));
        continue;
      }

      // 월 단위
      if (!getCurrentMonthPlan(s)) {
        // 달 초 계획 화면 — 적립 대화를 먼저 쓴다(둘 다), 이번 주 기회도.
        spendTalks();
        if (now().phase !== s.phase) continue;
        restRemaining = false;
        ensureRoutine();
        savePlan(isTired(now()));
        api().startMonthPlayback();
        continue;
      }
      const run = getMonthRun(s);
      if (!run) { api().startMonthPlayback(); if (!getMonthRun(now())) throw new Error(`재생 시작 불가 Y${s.year} W${s.week}`); continue; }
      const stop = run.stop ?? 'none';
      out.stops[stop] = (out.stops[stop] ?? 0) + 1;
      if (stop === 'talk') { spendTalks(); if (now().phase !== s.phase) continue; }
      if (stop === 'burnout' && !restRemaining) { restRemaining = true; out.replans++; savePlan(true); }
      if (stop === 'plan-invalid') { out.replans++; ensureRoutine(); savePlan(restRemaining); }
      if (checkPlannedWeek(now())) { out.manualWeeks++; manualWeek(restRemaining); continue; }
      api().resumePlayback();
    }
  } catch (e) {
    out.err = (e as Error).message.slice(0, 160);
  }
  unsub();
  const f = now();
  if (!out.ok && !out.err) out.err = `STEP_LIMIT Y${f.year} W${f.week} phase=${f.phase} stop=${f.monthRun?.stop}(${f.monthRun?.stopDetail}) money=${f.money} status=${f.monthRun?.status} plan=${!!getCurrentMonthPlan(f)}`;
  if (out.ok) {
    const end = calculateEnding(f);
    out.ach = end.achievement; out.hap = end.happiness;
  }
  out.burnout = f.burnoutCount ?? 0;
  out.tiredWeeks = f.totalTiredWeeks ?? 0;
  out.peak70 = Object.values(peak).filter(v => v >= 70).length;
  out.peak80 = Object.values(peak).filter(v => v >= 80).length;
  out.money = Math.round(f.money);
  out.spent = Math.round((f.moneySpentByYear ?? []).reduce((a, b) => a + b, 0));
  out.blockedWeeks = (f.moneyBlockedWeeksByYear ?? []).reduce((a, b) => a + b, 0);
  return out;
}

// ── 실행 ──
/** 한 판의 카드 머리 줄 — 나간 수 · 서로 다른 수 · 중복률(1 − 종/수) · 한 문장 최다 */
function lineStats(lines: string[]): { n: number; distinct: number; dup: number; max: number } {
  const count = new Map<string, number>();
  for (const l of lines) count.set(l, (count.get(l) ?? 0) + 1);
  return { n: lines.length, distinct: count.size, dup: lines.length ? 1 - count.size / lines.length : 0, max: Math.max(0, ...count.values()) };
}
assertRoutineIds(ROUTINES);
const N = Number(process.argv[2] ?? 12);
const seeds = Array.from({ length: N }, (_, i) => 1000 + i * 7919);
const runs: Run[] = [];
for (const r of ROUTINES) for (const b of BEHAVIORS) for (const seed of seeds) {
  runs.push(runOne(r, b, seed));
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (xs: Run[], f: (x: Run) => boolean) => Math.round((xs.filter(f).length / Math.max(1, xs.length)) * 100);
const dist = (xs: Run[], key: 'ach' | 'hap') => ['S', 'A', 'B', 'C', 'D'].map(g => `${g}${pct(xs, x => x[key] === g)}`).join(' ');
const fmt = (n: number, d = 1) => n.toFixed(d);

console.log(`시드 ${N} × 루틴 ${ROUTINES.length} × 행동 ${BEHAVIORS.length} = ${runs.length}판, 실패 ${runs.filter(x => !x.ok).length}`);
for (const x of runs.filter(x => !x.ok)) console.log(`  ✗ ${x.routine}/${x.behavior}/${x.seed}: ${x.err}`);
for (const r of ['ALL', ...ROUTINES.map(x => x.name)]) {
  console.log(`\n── ${r} ──`);
  console.log('행동        성취%            행복%            번아웃 판%/평균  tired주  친구+가정  절친70/80  연애%  잔액  지출  막힌주  강등/막힌달/손주  초대 수락/거절  약속 지킴/깨짐  멈춤');
  for (const b of BEHAVIORS) {
    const xs = runs.filter(x => x.ok && x.behavior === b && (r === 'ALL' || x.routine === r));
    const stops: Record<string, number> = {};
    for (const x of xs) for (const [k, v] of Object.entries(x.stops)) stops[k] = (stops[k] ?? 0) + v;
    const stopStr = Object.entries(stops).filter(([k]) => k !== 'none').map(([k, v]) => `${k}${fmt(v / xs.length)}`).join(' ');
    console.log([
      b.padEnd(10), dist(xs, 'ach').padEnd(16), dist(xs, 'hap').padEnd(16),
      `${pct(xs, x => x.burnout > 0)}%/${fmt(mean(xs.map(x => x.burnout)), 2)}`.padEnd(14),
      fmt(mean(xs.map(x => x.tiredWeeks))).padStart(6),
      `${fmt(mean(xs.map(x => x.talkEvents)))}+${fmt(mean(xs.map(x => x.homeEvents)))}`.padStart(10),
      `${fmt(mean(xs.map(x => x.peak70)), 2)}/${fmt(mean(xs.map(x => x.peak80)), 2)}`.padStart(11),
      `${pct(xs, x => x.dating)}`.padStart(5),
      fmt(mean(xs.map(x => x.money)), 0).padStart(5), fmt(mean(xs.map(x => x.spent)), 0).padStart(5),
      fmt(mean(xs.map(x => x.blockedWeeks))).padStart(6),
      `${fmt(mean(xs.map(x => x.fallbacks)))}/${fmt(mean(xs.map(x => x.blockedMonths)))}/${fmt(mean(xs.map(x => x.manualWeeks)))}`.padStart(12),
      `${fmt(mean(xs.map(x => x.invAcc)))}/${fmt(mean(xs.map(x => x.invDec)))}`.padStart(14),
      `${fmt(mean(xs.map(x => x.kept)))}/${fmt(mean(xs.map(x => x.broken)))}`.padStart(14),
      ` ${stopStr}`,
    ].join(' '));
  }
}

if (process.env.MVW_LINES === '1') {
  console.log('\n── 재생 카드 머리 줄(판당 평균) ──');
  console.log('행동        나간 줄   서로 다른 줄   중복률   한 문장 최다(평균/최대)');
  for (const b of BEHAVIORS.filter(x => x.startsWith('M-'))) {
    const xs = runs.filter(x => x.ok && x.behavior === b).map(x => lineStats(x.cardLines));
    console.log([
      b.padEnd(10), fmt(mean(xs.map(x => x.n))).padStart(8), fmt(mean(xs.map(x => x.distinct))).padStart(12),
      `${fmt(mean(xs.map(x => x.dup)) * 100)}%`.padStart(9),
      `${fmt(mean(xs.map(x => x.max)))}/${Math.max(0, ...xs.map(x => x.max))}`.padStart(14),
    ].join(' '));
  }
}
