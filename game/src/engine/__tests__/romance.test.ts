import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../gameEngine';
import { GAME_EVENTS } from '../events';
import { getReachForWeek } from '../events/selection';
import { assignCurrentEvent, presentEvent } from '../eventPresentation';
import { migrateLoadedState } from '../stateMigration';
import { cloneGameState } from '../stateClone';
import { useGameStore } from '../store';
import { calculateEnding } from '../ending';
import { resolveNpcClosure } from '../endingNpc';
import { getNpcSmalltalk } from '../talkSystem';
import { getNpcDialogue, NPC_DIALOGUES } from '../dialogues';
import { NPC_SMALLTALK } from '../talkData';
import * as rng from '../rng';
import { applyRelationshipChoice, buildSubinConfession, isDating, romanceEventEligibility, sanitizeRelationship, ROMANCE_ROUTES, SUBIN_CONVERSATION_ENTRY } from '../romance';
import type { RomanceNpc } from '../romance';
import type { GameEvent, GameState } from '../types';
import { resolveEventLikeStore } from '../../../scripts/lib/y1-sim-resolve';

const baseline = JSON.parse(readFileSync(new URL('./romance-main-baseline.json', import.meta.url), 'utf8')) as {
  scenes: Record<string, GameEvent>; closures: string[];
};
const event = (id: string) => GAME_EVENTS.find(e => e.id === id)!;
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
function ready(npcId: RomanceNpc): GameState {
  const route = ROMANCE_ROUTES[npcId];
  const s = createInitialState(route.gender, ['emotional', 'info'], { rngSeed: 42 });
  Object.assign(s, { year: route.openingYear, week: 30, phase: 'weekday', currentEvent: null, isVacation: false });
  s.npcs.forEach(n => { n.intimacy = n.id === npcId ? route.tier : 0; n.met = n.id === npcId; n.weekStartIntimacy = n.intimacy - 1; });
  return s;
}
function storeResolve(s: GameState, index: number) {
  useGameStore.setState({ state: s });
  useGameStore.getState().resolveEvent(index);
  return useGameStore.getState().state!;
}
function jihunChoice(index: number) {
  const s = ready('jihun');
  const picked = getReachForWeek(s)!;
  expect(picked.id).toBe('jihun-hs-unsaid');
  assignCurrentEvent(s, picked, 30);
  s.week = 31;
  return storeResolve(s, index);
}
function subinConversation() {
  const s = ready('subin');
  assignCurrentEvent(s, event(SUBIN_CONVERSATION_ENTRY), 30);
  s.week = 31;
  return storeResolve(s, 3);
}
function dating(npcId: RomanceNpc) {
  return npcId === 'jihun' ? jihunChoice(3) : storeResolve(subinConversation(), 0);
}

beforeEach(() => useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} }));
afterEach(() => vi.restoreAllMocks());

describe('기존 장면과 선택 번호 보존', () => {
  it('append_preserves_legacy_indices: 본문과 기존 선택지 전체가 main 스냅샷과 같다', () => {
    for (const id of Object.keys(baseline.scenes)) {
      const npcId = id.startsWith('jihun') ? 'jihun' : 'subin';
      const s = ready(npcId);
      if (id === ROMANCE_ROUTES[npcId].closing) {
        s.year = 7; s.relationship = { npcId, status: 'dating', year: 6, week: 30 };
      }
      const before = baseline.scenes[id];
      expect(json(event(id))).toEqual(before);
      const shown = presentEvent(event(id), s);
      const legacy = s.gender === 'female' ? before.femaleChoices! : before.choices;
      expect(shown.description).toBe(s.gender === 'female' ? before.femaleDescription : before.description);
      expect(json(shown.choices.slice(0, legacy.length))).toEqual(legacy);
      expect(shown.choices).toHaveLength(legacy.length + (s.year === 7 ? 2 : 1));
      expect(json(presentEvent(shown, s).choices)).toEqual(json(shown.choices));
      for (const extra of shown.choices.slice(legacy.length)) {
        expect(extra.effects).toEqual(legacy[0].effects);
        expect(extra.npcEffects).toEqual(legacy[0].npcEffects);
        expect(extra.timeCost).toEqual(legacy[0].timeCost);
      }
    }
  });

  it('지훈은 93에 도달해야 열리며 4번째 선택만 연애를 기록한다', () => {
    const s = ready('jihun');
    s.npcs.find(n => n.id === 'jihun')!.intimacy = 92;
    expect(romanceEventEligibility(event('jihun-hs-unsaid'), s).condition!(s)).toBe(false);
    expect(event('jihun-hs-unsaid').reach!.tier).toBe(93);
    expect(jihunChoice(3).relationship).toEqual({ npcId: 'jihun', status: 'dating', year: 6, week: 30 });
    for (const i of [0, 1, 2]) {
      const after = jihunChoice(i);
      expect(after.relationship).toBeUndefined();
      expect(resolveNpcClosure(after, 'jihun', 93)!.text).toBe(baseline.closures[i]);
      expect(after.events.find(e => e.id === 'jihun-hs-unsaid')!.resolvedChoice).toBe(i);
    }
  });

  it('기존 여주 대사와 성별 경로를 유지한다', () => {
    const after = jihunChoice(0);
    expect(presentEvent(event('jihun-hs-injury'), after).choices).toEqual(event('jihun-hs-injury').femaleChoices);
    const male = ready('jihun'); male.gender = 'male';
    expect(presentEvent(event('jihun-hs-unsaid'), male).choices).toEqual(event('jihun-hs-unsaid').choices);
    const female = ready('subin'); female.gender = 'female';
    expect(presentEvent(event(SUBIN_CONVERSATION_ENTRY), female).choices).toEqual(event(SUBIN_CONVERSATION_ENTRY).choices);
  });

  it('legacy_reach_cooldown: 자동 reach 수와 수빈의 24주 대기 규칙을 유지한다', () => {
    expect(GAME_EVENTS.some(e => e.id === ROMANCE_ROUTES.subin.opening)).toBe(false);
    expect(GAME_EVENTS.filter(e => e.reach?.npc === 'subin' && e.reach.year === 6)).toHaveLength(2);
    const s = ready('subin');
    s.npcs.find(n => n.id === 'subin')!.intimacy = 80;
    s.npcs.find(n => n.id === 'subin')!.weekStartIntimacy = 80;
    s.events.push({ ...event('subin-hs-momfight'), year: 6, week: 2 });
    s.week = 8;
    expect(getReachForWeek(s)).toBeNull();
    s.week = 26;
    expect(getReachForWeek(s)?.id).toBe(SUBIN_CONVERSATION_ENTRY);
  });
});

describe('수빈의 선택적 후속 대화 — 실제 store와 시뮬', () => {
  it('기존 선택으로는 열리지 않고 추가 선택만 같은 발생 주에 대화를 연다', () => {
    for (const i of [0, 1, 2]) {
      const s = ready('subin'); assignCurrentEvent(s, event(SUBIN_CONVERSATION_ENTRY), 30);
      const after = storeResolve(s, i);
      expect(after.currentEvent?.id).not.toBe(ROMANCE_ROUTES.subin.opening);
      expect(after.relationship).toBeUndefined();
    }
    const entered = subinConversation();
    expect(entered.currentEvent?.id).toBe('subin-hs-confess');
    expect(entered.currentEvent?.week).toBe(30);
    expect(entered.relationship).toBeUndefined();
    const options = entered.currentEvent!.choices;
    expect(options).toHaveLength(3);
    for (const c of options) {
      expect(c.effects).toEqual(options[0].effects);
      expect(c.npcEffects).toEqual(options[0].npcEffects);
    }
    for (const i of [0, 1, 2]) {
      const store = storeResolve(cloneGameState(entered), i);
      const sim = resolveEventLikeStore(cloneGameState(entered), i);
      expect(store.relationship?.status).toBe(i === 0 ? 'dating' : undefined);
      expect(sim.relationship).toEqual(store.relationship);
      expect(sim.stats).toEqual(store.stats);
      expect(store.currentEvent?.id).not.toBe('subin-hs-confess');
    }
  });

  it('대화 진입과 연애 수락 양쪽이 시뮬에서도 게임과 같다', () => {
    const s = ready('subin'); assignCurrentEvent(s, event(SUBIN_CONVERSATION_ENTRY), 30); s.week = 31;
    const sim = resolveEventLikeStore(cloneGameState(s), 3);
    const actual = storeResolve(cloneGameState(s), 3);
    expect(json(sim.currentEvent)).toEqual(json(actual.currentEvent));
    expect(sim.stats).toEqual(actual.stats);
    expect(resolveEventLikeStore(sim, 0).relationship).toEqual(storeResolve(actual, 0).relationship);
  });

  it('후속 대화 진입 직후 저장·로드와 재렌더를 거쳐도 세 선택을 유지한다', () => {
    const before = subinConversation();
    const loaded = migrateLoadedState(cloneGameState(before));
    expect(json(loaded.currentEvent)).toEqual(json(before.currentEvent));
    expect(json(presentEvent(loaded.currentEvent!, loaded))).toEqual(json(loaded.currentEvent));
    expect(storeResolve(loaded, 0).relationship?.npcId).toBe('subin');
    expect(buildSubinConfession(ready('subin'))).toBeNull();
  });

  it('보류 대화는 추가 사건 예산이나 능력치를 소모하지 않는다', () => {
    const s = ready('subin'); assignCurrentEvent(s, event(SUBIN_CONVERSATION_ENTRY), 30); s.week = 31;
    const ordinary = storeResolve(cloneGameState(s), 0);
    const declined = storeResolve(storeResolve(cloneGameState(s), 3), 1);
    expect(declined.stats).toEqual(ordinary.stats);
    expect(declined.npcs).toEqual(ordinary.npcs);
    expect(declined.rngSeed).toBe(ordinary.rngSeed);
    expect(declined.eventTimeCost).toBe(ordinary.eventTimeCost);
    expect(declined.currentEvent?.id).toBe(ordinary.currentEvent?.id);
  });
});

for (const npcId of ['subin', 'jihun'] as const) describe(`${npcId} 졸업·저장·대사`, () => {
  it('졸업 선택은 맨 뒤에 붙고 실제 store를 통해 지속·마무리를 엔딩에 합성한다', () => {
    for (const decision of ['together', 'apart'] as const) {
      const s = dating(npcId);
      Object.assign(s, { year: 7, week: 44, isVacation: true });
      const legacyEvent = event(ROMANCE_ROUTES[npcId].closing);
      const legacyCount = s.gender === 'female' ? legacyEvent.femaleChoices!.length : legacyEvent.choices.length;
      assignCurrentEvent(s, legacyEvent, 43);
      const loaded = migrateLoadedState(cloneGameState(s));
      expect(loaded.currentEvent!.choices[legacyCount].relationshipSelect?.decision).toBe('together');
      const after = storeResolve(loaded, legacyCount + (decision === 'apart' ? 1 : 0));
      expect(after.relationship?.graduation).toBe(decision);
      expect(isDating(after, npcId)).toBe(decision === 'together');
      const ordinary = { ...after, relationship: undefined };
      const baseText = resolveNpcClosure(ordinary, npcId, 80)!.text;
      const text = resolveNpcClosure(after, npcId, 80)!.text;
      expect(text.startsWith(`${baseText} `)).toBe(true);
      expect(text.length).toBeGreaterThan(baseText.length);
      after.npcs.forEach(n => { n.met = true; n.intimacy = n.id === npcId ? 20 : 100; });
      expect(calculateEnding(after).npcStories[0]).toContain(resolveNpcClosure(after, npcId, 20)!.text);
    }
  });

  it('closure_composes_motif: 연인이어도 기존 꿈·사진 모티프와 졸업 미도달 상태를 유지한다', () => {
    const s = dating(npcId);
    if (npcId === 'subin') {
      s.events.push({ ...event('subin-hs-momfight'), resolvedChoice: 2 }, { ...event('subin-hs-after'), resolvedChoice: 0 });
    }
    const baseText = resolveNpcClosure({ ...s, relationship: undefined }, npcId, 90)!.text;
    const text = resolveNpcClosure(s, npcId, 90)!.text;
    expect(text.startsWith(`${baseText} `)).toBe(true);
    expect(text).toContain('연인이 되었다');
    if (npcId === 'subin') expect(text).toContain('그 꿈을 접지 않았다');
  });

  it('additive_dialogue_keeps_legacy: 연인 인사·잡담에 기존 대사와 새 대사가 함께 나온다', () => {
    const s = dating(npcId);
    const greetings = NPC_DIALOGUES[npcId].find(p => p.additive)!.lines;
    const smalltalk = NPC_SMALLTALK[npcId].romance!.common!;
    expect(greetings.length).toBeGreaterThanOrEqual(8);
    expect(smalltalk.length).toBeGreaterThanOrEqual(8);
    let roll = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => roll);
    vi.spyOn(rng, 'seededRandomTalk').mockImplementation(() => roll);
    for (const week of [10, 22]) {
      s.week = week; s.isVacation = week === 22;
      const seenGreetings = new Set<string>(), seenTalk = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        roll = i / 1000;
        seenGreetings.add(getNpcDialogue(npcId, 95, s));
        seenTalk.add(getNpcSmalltalk(s, npcId));
      }
      for (const line of greetings) expect(seenGreetings.has(line)).toBe(true);
      for (const line of smalltalk) expect(seenTalk.has(line)).toBe(true);
      expect([...seenGreetings].some(l => !greetings.includes(l))).toBe(true);
      expect([...seenTalk].some(l => !smalltalk.includes(l))).toBe(true);
    }
  });

  it('greeting_smalltalk_head5_disjoint: 두 풀은 문두 5자를 공유하지 않는다', () => {
    const normalize = (s: string) => s.replace(/["'…\s.?!,~]/g, '').slice(0, 5);
    const talk: string[] = [];
    const walk = (x: unknown) => {
      if (typeof x === 'string') talk.push(x);
      else if (Array.isArray(x)) x.forEach(walk);
      else if (x && typeof x === 'object') Object.values(x).forEach(walk);
    };
    walk(NPC_SMALLTALK[npcId]);
    const heads = new Set(talk.map(normalize));
    expect(NPC_DIALOGUES[npcId].flatMap(p => p.lines).filter(l => heads.has(normalize(l)))).toEqual([]);
  });

  it('연애를 추정하지 않고 손상값과 과거 friends 값을 버린다', () => {
    const s = ready(npcId);
    expect(migrateLoadedState(cloneGameState(s)).relationship).toBeUndefined();
    const valid = { npcId, status: 'dating', year: ROMANCE_ROUTES[npcId].openingYear, week: 30 };
    expect(sanitizeRelationship(valid, s.gender)).toEqual(valid);
    for (const patch of [{ status: 'friends' }, { year: 5 }, { week: 0 }, { week: 49 }, { graduation: 'apart' }, { status: 'ended' }, { npcId: 'unknown' }]) {
      expect(sanitizeRelationship({ ...valid, ...patch }, s.gender)).toBeUndefined();
    }
    const candidate = npcId === 'jihun' ? presentEvent(event('jihun-hs-unsaid'), s).choices[3] : subinConversation().currentEvent!.choices[0];
    applyRelationshipChoice(s, { ...event('jihun-hs-unsaid'), id: 'unrelated' }, candidate, 30);
    expect(s.relationship).toBeUndefined();
  });
});

it('지훈 졸업의 방학·초반 주차는 기존 조건대로 열리고 메타 임계도 우회한다', () => {
  const s = dating('jihun'); Object.assign(s, { year: 7, week: 1, isVacation: true });
  s.npcs.find(n => n.id === 'jihun')!.intimacy = 20;
  const adjusted = romanceEventEligibility(event('jihun-hs-graduation'), s);
  expect(adjusted.reach!.tier).toBe(0);
  expect(adjusted.condition!(s)).toBe(true);
});
