import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../gameEngine';
import { GAME_EVENTS } from '../events';
import { assignCurrentEvent } from '../eventPresentation';
import { useGameStore } from '../store';
import { resolveNpcClosure } from '../endingNpc';
import { migrateLoadedState } from '../stateMigration';
import { cloneGameState } from '../stateClone';
import { canStartRomanceRetry, ROMANCE_RETRY_IDS, ROMANCE_ROUTES, SUBIN_CONVERSATION_ENTRY, sanitizeRelationship } from '../romance';
import type { RomanceNpc } from '../romance';
import type { GameState } from '../types';
import { resolveEventLikeStore } from '../../../scripts/lib/y1-sim-resolve';

function choose(state: GameState, index: number) {
  useGameStore.setState({ state });
  useGameStore.getState().resolveEvent(index);
  return useGameStore.getState().state!;
}
function deferred(npcId: RomanceNpc, choice: number, week = 30): GameState {
  const route = ROMANCE_ROUTES[npcId];
  let s = createInitialState(route.gender, ['emotional', 'info'], { rngSeed: 42 });
  Object.assign(s, { year: 6, week, phase: 'weekday', currentEvent: null, isVacation: false });
  s.npcs.forEach(n => { n.met = n.id === npcId; n.intimacy = n.id === npcId ? 100 : 0; });
  assignCurrentEvent(s, GAME_EVENTS.find(e => e.id === (npcId === 'subin' ? SUBIN_CONVERSATION_ENTRY : route.opening))!, week);
  if (npcId === 'subin') s = choose(s, 3);
  s = choose(s, choice);
  // Isolate the next planning screen after normal weekly chains are completed.
  s.currentEvent = null; s.phase = 'weekday'; s.week = week + 4;
  return s;
}
function open(state: GameState, npcId: RomanceNpc) {
  useGameStore.setState({ state });
  expect(useGameStore.getState().startRomanceRetry(npcId)).toBe(true);
  return useGameStore.getState().state!;
}
beforeEach(() => useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} }));

describe('one player-initiated romance revisit', () => {
  it.each([['subin', 1], ['subin', 2], ['jihun', 0], ['jihun', 1], ['jihun', 2]] as const)(
    '%s original choice %i permits one revisit after four weeks', (npcId, choice) => {
      const s = deferred(npcId, choice);
      s.week = 33;
      expect(canStartRomanceRetry(s, npcId)).toBe(false);
      s.week = 34;
      expect(canStartRomanceRetry(s, npcId)).toBe(true);
      const pending = open(s, npcId);
      expect(useGameStore.getState().startRomanceRetry(npcId)).toBe(false);
      const loaded = migrateLoadedState(cloneGameState(pending));
      expect(loaded.currentEvent).toEqual(pending.currentEvent);
      const after = choose(loaded, 0);
      expect(after.relationship).toEqual({ npcId, status: 'dating', year: 6, week: 34 });
      expect(after.phase).toBe('weekday');
      expect(after.currentEvent).toBeNull();
      expect(canStartRomanceRetry(after, npcId)).toBe(false);
      expect(migrateLoadedState(cloneGameState(after)).relationship).toEqual(after.relationship);
    });

  it.each(['subin', 'jihun'] as const)('%s explicit refusal has no penalty and consumes the opportunity', npcId => {
    const s = deferred(npcId, 1);
    s.weekLog = { year: 6, week: 33, statChanges: { mental: 1 }, fatigueChange: 0, moneyChange: 0, messages: ['지난 주의 기록'], skipped: [], milestoneMessages: [] };
    const pending = open(s, npcId);
    const sim = resolveEventLikeStore(pending, 1);
    const after = choose(pending, 1);
    expect(after.relationship).toBeUndefined();
    expect(after.stats).toEqual(s.stats);
    expect(after.npcs).toEqual(s.npcs);
    expect(after.rngSeed).toBe(s.rngSeed);
    expect(after.talkRngSeed).toBe(s.talkRngSeed);
    expect(after.eventTimeCost).toBe(s.eventTimeCost);
    expect(after.week).toBe(s.week);
    expect(after.weekLog).toEqual(s.weekLog);
    expect(after.phase).toBe(s.phase);
    expect(after.events.filter(e => e.id === ROMANCE_RETRY_IDS[npcId])).toHaveLength(1);
    expect(sim).toEqual(after);
    const loaded = migrateLoadedState(cloneGameState(after));
    loaded.week += 8;
    expect(canStartRomanceRetry(loaded, npcId)).toBe(false);
  });

  it.each([['subin', 69, 70], ['jihun', 92, 93]] as const)('%s uses the original intimacy threshold %i/%i', (npcId, below, threshold) => {
    const s = deferred(npcId, 1);
    s.npcs.find(n => n.id === npcId)!.intimacy = below;
    useGameStore.setState({ state: s });
    expect(canStartRomanceRetry(s, npcId)).toBe(false);
    expect(useGameStore.getState().startRomanceRetry(npcId)).toBe(false);
    s.npcs.find(n => n.id === npcId)!.intimacy = threshold;
    expect(canStartRomanceRetry(s, npcId)).toBe(true);
    expect(choose(open(s, npcId), 0).relationship?.npcId).toBe(npcId);
  });

  it.each(['subin', 'jihun'] as const)('%s acceptance changes relationship without immediate stat, time or random effects', npcId => {
    const s = deferred(npcId, 1);
    const pending = open(s, npcId);
    const after = choose(pending, 0);
    expect(after.relationship?.status).toBe('dating');
    expect(after.stats).toEqual(s.stats);
    expect(after.npcs).toEqual(s.npcs);
    expect(after.eventTimeCost).toBe(s.eventTimeCost);
    expect(after.week).toBe(s.week);
    expect(after.rngSeed).toBe(s.rngSeed);
    expect(after.talkRngSeed).toBe(s.talkRngSeed);
    expect(resolveEventLikeStore(pending, 0)).toEqual(after);
  });

  it.each([-1, 2, Number.NaN])('invalid retry choice %s mutates neither store nor simulator', index => {
    const pending = open(deferred('subin', 1), 'subin');
    const before = cloneGameState(pending);
    expect(choose(pending, index)).toBe(pending);
    expect(pending).toEqual(before);
    expect(resolveEventLikeStore(pending, index)).toBe(pending);
    expect(pending).toEqual(before);
  });

  it.each(['subin', 'jihun'] as const)('%s declining a revisit leaves subsequent weekly events and automatic chains unchanged', npcId => {
    let untouched = deferred(npcId, 1);
    let declined = choose(open(cloneGameState(untouched), npcId), 1);
    const baselineEventCount = untouched.events.length;
    const comparable = (s: GameState) => ({
      stats: s.stats, npcs: s.npcs, rngSeed: s.rngSeed, talkRngSeed: s.talkRngSeed,
      eventTimeCost: s.eventTimeCost, currentEvent: s.currentEvent, phase: s.phase,
      week: s.week, year: s.year, weekLog: s.weekLog,
      events: s.events.filter(e => e.id !== ROMANCE_RETRY_IDS[npcId]),
    });
    function advance(s: GameState) {
      useGameStore.setState({ state: s, npcActivityMap: {} });
      useGameStore.getState().setPhase('weekday');
      useGameStore.getState().advanceWeek();
      return useGameStore.getState().state!;
    }
    for (let week = 0; week < 8; week++) {
      untouched = advance(untouched);
      declined = advance(declined);
      expect(comparable(declined)).toEqual(comparable(untouched));
      let chainLength = 0;
      while (untouched.currentEvent) {
        expect(++chainLength).toBeLessThan(20);
        untouched = choose(untouched, 0);
        declined = choose(declined, 0);
        expect(comparable(declined)).toEqual(comparable(untouched));
      }
    }
    expect(untouched.events.length).toBeGreaterThan(baselineEventCount);
  });

  it.each(['subin', 'jihun'] as const)('%s late year-six choice can start dating in year seven and graduate', npcId => {
    const s = deferred(npcId, 1, 45);
    s.year = 7; s.week = 1;
    expect(canStartRomanceRetry(s, npcId)).toBe(true);
    const after = choose(open(s, npcId), 0);
    expect(sanitizeRelationship(after.relationship, s.gender)).toEqual(after.relationship);
    const loaded = migrateLoadedState(cloneGameState(after));
    const closing = GAME_EVENTS.find(e => e.id === ROMANCE_ROUTES[npcId].closing)!;
    loaded.week = 40;
    assignCurrentEvent(loaded, closing, 40);
    const index = loaded.currentEvent!.choices.findIndex(c => c.relationshipSelect?.decision === 'together');
    expect(index).toBeGreaterThan(0);
    expect(choose(loaded, index).relationship?.graduation).toBe('together');
  });

  it.each(['weekday', 'weekend', 'vacation'] as const)('returns to %s without opening automatic chains', phase => {
    const s = deferred('subin', 1); s.phase = phase;
    const pending = open(s, 'subin');
    expect(choose(migrateLoadedState(cloneGameState(pending)), 1).phase).toBe(phase);
  });

  it.each([0, 1, 2])('Jihun original choice %i closes its unfinished conversation only after a successful revisit', firstChoice => {
    const s = deferred('jihun', firstChoice);
    const before = resolveNpcClosure(s, 'jihun', 100)!;
    const declined = choose(open(cloneGameState(s), 'jihun'), 1);
    expect(resolveNpcClosure(declined, 'jihun', 100)).toEqual(before);
    const accepted = choose(open(cloneGameState(s), 'jihun'), 0);
    const closure = resolveNpcClosure(accepted, 'jihun', 100)!;
    expect(closure.text).toContain('지금도 가장 친한 친구다');
    expect(closure.text).toContain('나중에 다시 마주 앉아 끝까지 나눴다');
    expect(closure.text).not.toContain('아직도 가끔 궁금하다');
    expect(closure.excludeEventIds.has(ROMANCE_RETRY_IDS.jihun)).toBe(true);
    expect(closure.excludeEventIds.has(ROMANCE_ROUTES.jihun.opening)).toBe(true);
    const noRelationship = { ...accepted, relationship: undefined };
    expect(resolveNpcClosure(noRelationship, 'jihun', 100)).toEqual(before);
  });

  it('excludes the successful Subin revisit memory from the relationship closure', () => {
    const accepted = choose(open(deferred('subin', 1), 'subin'), 0);
    expect(resolveNpcClosure(accepted, 'subin', 100)!.excludeEventIds.has(ROMANCE_RETRY_IDS.subin)).toBe(true);
  });

  it('rejects unsafe entry states, early/late dates and a resolved graduation', () => {
    const s = deferred('subin', 1);
    const blocked: GameState[] = [
      { ...s, gender: 'female' }, { ...s, year: 5 }, { ...s, year: 8 }, { ...s, week: 49 },
      ...(['event', 'result', 'ending', 'year-end', 'semester-end', 'setup'] as const).map(phase => ({ ...s, phase })),
      { ...s, currentEvent: GAME_EVENTS[0] },
      { ...s, relationship: { npcId: 'subin', status: 'dating', year: 6, week: 30 } },
      { ...s, relationship: { npcId: 'subin', status: 'ended', year: 6, week: 30, graduation: 'apart' } },
      { ...s, npcs: s.npcs.map(n => ({ ...n, intimacy: 0 })) },
      { ...s, npcs: s.npcs.map(n => ({ ...n, met: false })) },
      { ...s, events: [...s.events, { ...GAME_EVENTS.find(e => e.id === 'subin-farewell')!, year: 7, week: 40, resolvedChoice: 0 }] },
      { ...s, events: [] },
    ];
    for (const state of blocked) {
      useGameStore.setState({ state });
      expect(useGameStore.getState().startRomanceRetry('subin')).toBe(false);
      expect(useGameStore.getState().state).toBe(state);
    }
  });

  it('cannot fabricate a pending retry or replay it after consumption', () => {
    const pending = open(deferred('jihun', 1), 'jihun');
    for (const mutate of [
      (s: GameState) => { s.events = []; },
      (s: GameState) => { s.currentEvent!.week = 1; },
      (s: GameState) => { s.currentEvent!.romanceReturnPhase = 'ending' as never; },
      (s: GameState) => { s.events.push({ ...s.currentEvent!, year: 6, week: 34, resolvedChoice: 1 }); },
    ]) {
      const broken = cloneGameState(pending); mutate(broken);
      const loaded = migrateLoadedState(broken);
      expect(loaded.currentEvent).toBeNull();
      expect(loaded.phase).toBe('weekday');
      expect(loaded.relationship).toBeUndefined();
    }
  });
});
