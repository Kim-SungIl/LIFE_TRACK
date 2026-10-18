/**
 * 연애 도달성 진단 — 사용자 성공률 추정이 아닌, 고정된 행동 정책의 비교.
 * cd game && node --import tsx scripts/sim/sim-romance-attainability.ts
 * SEEDS=1,7 ROUTINES=paid POLICIES=story-targetbest,defer-retry TARGETS=subin OUT=/tmp/romance.json ...
 * 기본: 정본 생활 루틴 3 × 시드 3 × 정책 8 × 대상 2 = 144판.
 * story-targetbest는 친밀도 효과를 아는 공략 상한. first-choice는 선택 가능한 원문 중 첫 번째를 고르며
 * 사람의 중립 선택을 대표하지 않는다. 나머지는 같은 공략 선택에 행동 하나만 더한다.
 * missed-entry는 수빈의 진입 선택 놓침, 지훈의 고백 보류 후 재시도하지 않음을 뜻한다.
 * talks/companionSlots는 시도 횟수다.
 * full만 세 행동을 합친다. defer-retry / missed-entry는 story-targetbest의 분기 대조군.
 * 생활 활동은 고정하되 UI에서 비용 때문에 확정 불가이면 공통 무료 계획으로 그 주만 대체한다.
 * 선물은 해당 주 원래 계획 비용을 먼저 예약한 나머지 예산으로만 산다(예산예약 정책). 원래 동행 슬롯이 없는 주에는 동행도 없으므로 정책 강도는
 * 루틴마다 다르다. 같은 시드라도 대화·선택이 RNG 소비를 바꿀 수 있어 사건 표본은 달라진다.
 */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { ACTIVITIES, NPC_COMPANION_ACTIVITIES, canApplyActivity, collapseActivityChoices, getActivityCost } from '../../src/engine/activities';
import { isNpcEnrolled, isNpcInteractable } from '../../src/engine/relationshipSignals';
import { ROMANCE_RETRY_DELAY, ROMANCE_RETRY_IDS, ROMANCE_ROUTES, SUBIN_CONVERSATION_ENTRY, canStartRomanceRetry } from '../../src/engine/romance';
import { SHOP_ITEMS, canBuyItem } from '../../src/engine/shopSystem';
import { predictWeekOutcome } from '../../src/engine/gameEngine';
import { deriveTalkSeed } from '../../src/engine/rng';
import { useGameStore } from '../../src/engine/store';
import type { EventChoice, GameState } from '../../src/engine/types';
import { absWeek } from '../../src/engine/weekMath';
import { getWeekSlotCount } from '../../src/engine/weekendPlan';
import { SIM_ROUTINES, assertRoutineIds } from '../lib/sim-routines';
import type { Routine } from '../lib/sim-routines';

const policies = ['story-targetbest', 'first-choice', 'talk-only', 'companion-only', 'gifts-only', 'full', 'defer-retry', 'missed-entry'] as const;
type Policy = typeof policies[number];
type Target = keyof typeof ROMANCE_ROUTES;
function selected<T extends string>(env: string, choices: readonly T[]): T[] {
  const values = process.env[env]?.split(',') ?? [...choices];
  assert(values.length && values.every(v => choices.includes(v as T)), `Invalid ${env}: ${values}`);
  return [...new Set(values)] as T[];
}
const seeds = (process.env.SEEDS ?? '1,7,42').split(',').map(Number);
assert(seeds.length && seeds.every(n => Number.isSafeInteger(n) && n > 0), 'SEEDS must be positive integers');
const routines = SIM_ROUTINES.slice(0, 3);
const routineNames = selected('ROUTINES', routines.map(r => r.name));
const chosenPolicies = selected('POLICIES', policies);
const targets = selected('TARGETS', ['subin', 'jihun'] as const);
assertRoutineIds(routines);
const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => memory.set(key, value),
  removeItem: (key: string) => memory.delete(key), clear: () => memory.clear(),
} });
const state = () => useGameStore.getState().state!;
const npcIntimacy = (s: GameState, target: Target) => s.npcs.find(n => n.id === target)!.intimacy;
const stamp = (s: GameState, target: Target, week = s.week) => ({ year: s.year, week, intimacy: npcIntimacy(s, target) });
type Stamp = ReturnType<typeof stamp>;
function bestChoice(choices: EventChoice[], indices: number[], target: Target): number {
  let picked = indices[0] ?? -1, best = -Infinity;
  indices.forEach(i => {
    const choice = choices[i];
    const score = (choice.npcEffects ?? []).filter(n => n.npcId === target).reduce((sum, n) => sum + n.intimacyChange, 0);
    if (score > best) { best = score; picked = i; }
  });
  return picked;
}
function planCost(s: GameState, activities: string[], routineOnly = false): number {
  const cost = (id: string) => getActivityCost(ACTIVITIES.find(a => a.id === id)!, s.year);
  const routine = s.isVacation ? 0 : [s.routineSlot2, s.routineSlot3].filter(Boolean).reduce((sum, id) => sum + cost(id!), 0);
  return routine + (routineOnly ? 0 : collapseActivityChoices(activities).reduce((sum, id) => sum + Math.max(0, cost(id)), 0));
}
// MainWeekScreen: aggregate routine check plus engine preview's money skips.
function canConfirm(s: GameState, activities: string[]): boolean {
  return (s.isVacation || !!s.routineSlot2) && s.money >= planCost(s, activities, true)
    && !predictWeekOutcome(s, activities).skipped.some(skip => skip.reason === 'money');
}
function play(routine: Routine, policy: Policy, seed: number, target: Target) {
  const route = ROMANCE_ROUTES[target];
  memory.clear();
  useGameStore.getState().resetGame();
  useGameStore.getState().startGame(route.gender, routine.parents);
  // Seed before the first scene is resolved; retain the actual store's opening scene/run identity.
  useGameStore.setState({ state: { ...state(), rngSeed: seed, talkRngSeed: deriveTalkSeed(seed) } });
  useGameStore.getState().setRoutine(routine.slot2, routine.slot3);
  let entry: Stamp | null = null, opening: Stamp | null = null, accepted: Stamp | null = null;
  let retryEligible: Stamp | null = null, actualRetry: Stamp | null = null;
  let graduation: (Stamp & { decision: string }) | null = null;
  let giftAttempts = 0, giftSuccesses = 0, giftSpend = 0, talks = 0, companionSlots = 0, budgetDeferredGifts = 0, skippedChoices = 0;
  const freeFallbackWeeks: { year: number; week: number }[] = [];
  const reachHistory: (Stamp & { id: string; weekStartIntimacy: number | null })[] = [];
  const year6Gates: (Stamp & { weekStartIntimacy: number | null; lastReach: string | null; lastReachAbs: number | null })[] = [];
  const actionWeeks = new Set<number>();
  for (let guard = 0; guard < 8000 && state().phase !== 'ending'; guard++) {
    const api = useGameStore.getState(), s = state();
    if (s.phase === 'weekday') {
      const coordinate = absWeek(s.year, s.week);
      api.setRoutine(routine.slot2, routine.slot3);
      let activities = [...(s.isVacation ? routine.vacation : routine.weekend)];
      assert(activities.length <= getWeekSlotCount(s), 'Plan exceeds UI slot limit');
      const npc = s.npcs.find(n => n.id === target)!;
      // Returning from a manual retry is the same planning week: never repeat talk/gift actions.
      if (!actionWeeks.has(coordinate)) {
        actionWeeks.add(coordinate);
        if ((policy === 'talk-only' || policy === 'full') && isNpcInteractable(npc, s)) { api.talkToNpc(target); talks++; }
        if ((policy === 'gifts-only' || policy === 'full') && isNpcInteractable(npc, state())) {
          for (const id of ['small-gift', 'birthday-gift']) {
            const item = SHOP_ITEMS.find(item => item.id === id)!;
            giftAttempts++;
            const before = state();
            if (canBuyItem(item, before, before.weekPurchases ?? {}).ok) {
              if (before.money - item.price < planCost(before, activities)) { budgetDeferredGifts++; continue; }
              api.buyItem(item, target);
              const spent = before.money - state().money;
              assert(Math.abs(spent - item.price) < 1e-6, `Gift purchase not applied: ${id}`);
              giftSuccesses++; giftSpend += spent;
            }
          }
        }
        if (s.year === 6) {
          const previous = state().events.filter(e => e.reach?.npc === target).at(-1);
          year6Gates.push({ ...stamp(state(), target), weekStartIntimacy: npc.weekStartIntimacy ?? null,
            lastReach: previous?.id ?? null, lastReachAbs: previous ? absWeek(previous.year!, previous.week!) : null });
        }
      }
      const useFreeFallback = !canConfirm(state(), activities);
      if (useFreeFallback) {
        api.setRoutine('self-study', 'light-exercise');
        activities = activities.map(() => 'rest');
      }
      assert(canConfirm(state(), activities), 'Common free fallback is not confirmable');
      const companion: Record<string, string> = {};
      if ((policy === 'companion-only' || policy === 'full') && npc.met && isNpcEnrolled(npc, state())) {
        activities.forEach((id, slot) => {
          assert(ACTIVITIES.some(a => a.id === id), `Unknown activity ${id}`);
          if (NPC_COMPANION_ACTIVITIES.includes(id) && canApplyActivity(state(), id)) companion[`${id}:${slot}`] = target;
        });
      }
      if (canStartRomanceRetry(state(), target)) {
        retryEligible ??= stamp(state(), target);
        const source = state().events.find(e => e.id === route.opening)!;
        assert(coordinate - absWeek(source.year!, source.week!) >= ROMANCE_RETRY_DELAY, 'Retry before four weeks');
        if (policy === 'defer-retry') {
          assert(!actualRetry, 'Retry offered twice');
          assert(api.startRomanceRetry(target, { activities, npcChoices: companion }), 'Eligible retry failed');
          actualRetry = stamp(state(), target);
          continue;
        }
      }
      api.consumeRomancePlan();
      if (useFreeFallback) freeFallbackWeeks.push({ year: s.year, week: s.week });
      if (s.isVacation) api.setVacationChoices(activities); else api.setWeekendChoices(activities);
      api.setNpcActivityMap(companion); companionSlots += Object.keys(companion).length;
      api.advanceWeek();
    } else if (s.phase === 'event') {
      const event = s.currentEvent!;
      assert(event && Number.isInteger(event.week), 'Scene without occurrence week');
      const choices = s.gender === 'female' && event.femaleChoices ? event.femaleChoices : event.choices;
      if (s.year === 6 && !s.relationship) {
        if (target === 'subin' && event.id === SUBIN_CONVERSATION_ENTRY)
          assert(choices.some(c => c.romanceConversation === target), 'Missing Subin conversation choice');
        if (target === 'jihun' && event.id === route.opening)
          assert(choices.some(c => c.relationshipSelect?.decision === 'date'), 'Missing Jihun confession choice');
      }
      const occurrence = stamp(s, target, event.week);
      if (event.id === SUBIN_CONVERSATION_ENTRY && target === 'subin') entry = occurrence;
      if (event.id === route.opening) opening = occurrence;
      if (event.reach?.npc === target) reachHistory.push({ ...occurrence, id: event.id,
        weekStartIntimacy: s.npcs.find(n => n.id === target)!.weekStartIntimacy ?? null });
      const visible = choices.map((choice, index) => ({ choice, index })).filter(({ choice }) => !choice.condition || choice.condition(s));
      assert(visible.length > 0, `No visible choice in ${event.id}`);
      const available = visible.filter(({ choice }) => s.money >= Math.max(0, -(choice.moneyEffect ?? 0))).map(({ index }) => index);
      let index = -1;
      if (policy === 'defer-retry' && event.id === route.opening) index = target === 'subin' ? 1 : 0;
      else if (policy === 'missed-entry' && (event.id === SUBIN_CONVERSATION_ENTRY || event.id === route.opening)) index = 0;
      else if (policy !== 'first-choice') index = available.find(i =>
        choices[i].romanceConversation === target || choices[i].relationshipSelect?.decision === 'date' || choices[i].relationshipSelect?.decision === 'together') ?? -1;
      if (!available.includes(index)) index = policy === 'first-choice' ? (available[0] ?? -1) : bestChoice(choices, available, target);
      if (index === -1) { assert(available.length === 0, 'Skip despite an affordable choice'); skippedChoices++; }
      api.resolveEvent(index);
      if (state().relationship && !accepted) {
        assert(choices[index]?.relationshipSelect?.decision === 'date', 'Relationship appeared without explicit acceptance');
        assert(event.id === route.opening || event.id === ROMANCE_RETRY_IDS[target], 'Acceptance outside confession');
        accepted = { ...occurrence, intimacy: npcIntimacy(state(), target) };
        assert(state().relationship!.year === accepted.year && state().relationship!.week === accepted.week, 'Wrong relationship timestamp');
      }
      if (event.id === route.closing) graduation = { ...occurrence, decision: state().relationship?.graduation ?? 'no-relationship-decision' };
    } else if (s.phase === 'result') api.setPhase('weekday');
    else if (s.phase === 'year-end') api.advanceFromYearEnd();
    else throw new Error(`Unexpected phase: ${s.phase}`);
  }
  assert(state().phase === 'ending', `Did not finish: ${routine.name}/${policy}/${seed}/${target}`);
  return { routine: routine.name, policy, seed, target, entry, opening, accepted, retryEligible, actualRetry, graduation,
    finalRelationship: state().relationship ?? null, giftAttempts, giftSuccesses, giftSpend, budgetDeferredGifts, skippedChoices, talks, companionSlots, freeFallbackWeeks, reachHistory, year6Gates };
}
const rows = [];
for (const routine of routines.filter(r => routineNames.includes(r.name))) for (const policy of chosenPolicies)
  for (const seed of seeds) for (const target of targets) rows.push(play(routine, policy, seed, target));
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify({
  note: 'Deterministic policy comparison, not a user success-rate estimate. story-targetbest is an informed upper-bound policy; first-choice means the first available original choice, not human neutrality. Lifestyle plans are fixed except explicitly recorded common free fallback weeks when the UI would block confirmation. Gifts reserve the original week plan budget before spending. missed-entry means skipped Subin conversation or deferred Jihun confession without retry. talks/companionSlots count attempts. Companion opportunities differ by routine. Actions may change RNG consumption.', rows,
}, null, 2));
for (const policy of chosenPolicies) for (const target of targets) {
  const group = rows.filter(r => r.policy === policy && r.target === target);
  console.log(JSON.stringify({ policy, target, runs: group.length,
    entryShown: group.filter(r => r.entry).length, retryEligible: group.filter(r => r.retryEligible).length,
    acceptedWithoutGraduation: group.filter(r => r.accepted && !r.graduation).length,
    opened: group.filter(r => r.opening).length, accepted: group.filter(r => r.accepted).length,
    retried: group.filter(r => r.actualRetry).length, together: group.filter(r => r.finalRelationship?.graduation === 'together').length,
    openingWeeks: [...new Set(group.flatMap(r => r.opening ? [r.opening.week] : []))].sort((a, b) => a - b),
    freeFallbackWeeks: group.reduce((sum, r) => sum + r.freeFallbackWeeks.length, 0),
    skippedChoices: group.reduce((sum, r) => sum + r.skippedChoices, 0),
    giftSuccesses: group.reduce((sum, r) => sum + r.giftSuccesses, 0), giftSpend: group.reduce((sum, r) => sum + r.giftSpend, 0),
  }));
}
