import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import { GAME_EVENTS } from '../events';
import { getEventForWeek, getFollowupForWeek, getReachForWeek } from '../events/selection';
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

// 적격(페이싱이 고를 수 있는가)만 본다 — 화면 시점은 아래 '연인 지훈의 졸업식' 블록이 실제 루프로 잠근다.
it('지훈 졸업의 방학·초반 주차는 기존 조건대로 열리고 메타 임계도 우회한다', () => {
  const s = dating('jihun'); Object.assign(s, { year: 7, week: 1, isVacation: true });
  s.npcs.find(n => n.id === 'jihun')!.intimacy = 20;
  const adjusted = romanceEventEligibility(event('jihun-hs-graduation'), s);
  expect(adjusted.reach!.tier).toBe(0);
  expect(adjusted.condition!(s)).toBe(true);
});

// 위 테스트가 보는 건 **적격**이다(페이싱이 고를 수 있다). 화면 시점은 별개다 — 연애 판본이 문턱을 0으로 내리면
// 조건이 Y7 첫 주부터 참이라, 앵커가 없던 동안 「졸업식. 식이 끝나고…」와 졸업 뒤 관계 결정이 Y7 W2~22에 떴다.
// 표시는 reach.anchorWeek(46, 고교 졸업식)로 미룬다 — 페이싱·조건은 그대로다(reachAnchorReservation.test.ts 계약 A).
describe('연인 지훈의 졸업식은 졸업식 주에 온다', () => {
  const GRAD = 'jihun-hs-graduation';
  const ANCHOR = 46;

  /** 고백을 Y6 openWeek에 받아들인 판의 Y7을 실제 루프로 산다. 졸업 장면이 뜬 주와 결정 결과를 돌려준다. */
  function liveY7(openWeek: number): { shownWeek: number | null; hasDecision: boolean; graduation: string | undefined } {
    let s = createInitialState('female', ['emotional', 'info'], { rngSeed: 7000 + openWeek });
    Object.assign(s, { year: 7, week: 1, phase: 'weekday', currentEvent: null });
    const j = s.npcs.find(n => n.id === 'jihun')!;
    j.met = true; j.intimacy = 80;
    s.events = [{ ...event(ROMANCE_ROUTES.jihun.opening), year: 6, week: openWeek, resolvedChoice: 3 }];
    s.relationship = { npcId: 'jihun', status: 'dating', year: 6, week: openWeek };
    let shownWeek: number | null = null;
    let hasDecision = false;
    for (let guard = 0; guard < 400 && s.phase !== 'ending'; guard++) {
      if (s.phase === 'event' && s.currentEvent) {
        const choices = s.currentEvent.femaleChoices ?? s.currentEvent.choices;
        let pick = choices.findIndex(c => !c.relationshipSelect && !c.romanceConversation);
        if (s.currentEvent.id === GRAD) {
          const together = choices.findIndex(c => c.relationshipSelect?.decision === 'together');
          hasDecision = together >= 0;
          if (together >= 0) pick = together;
        }
        s = resolveEventLikeStore(s, Math.max(0, pick));
        continue;
      }
      if (s.phase === 'result' || s.phase === 'year-end') { s.phase = 'weekday'; continue; }
      s = processWeek(s);
    }
    // 화면의 state.week가 아니라 **기록된 발생주**로 본다. 연쇄는 week++ 뒤에 돌아서 state.week가 발생주+1이다 —
    // 그걸로 비교하면 발생주 45에 뜬 컷도 46으로 보여 "앵커 이후"를 통과한다(chain N−1 착지 함정).
    const rec = s.events.find(e => e.id === GRAD && e.year === 7);
    shownWeek = rec?.week ?? null;
    return { shownWeek, hasDecision, graduation: s.relationship?.graduation };
  }

  /** 앵커를 잠시 떼고 돌린다 — 픽스처가 정말 이른 픽에 닿는지 보는 양성 대조. */
  function withoutAnchor<T>(fn: () => T): T {
    const e = event(GRAD);
    const saved = e.reach!.anchorWeek;
    e.reach!.anchorWeek = undefined;
    try { return fn(); } finally { e.reach!.anchorWeek = saved; }
  }

  const OPEN_WEEKS = [10, 30, 45];

  /** 같은 판을 **제품 store**로 산다 — 미러는 W48 연쇄 뒤 학년을 넘기지 않지만 store는 그 자리에서 넘긴다
   *  (3자 검수: 미러만 잠그면 store에서 예약이 W48 비우기 전에 묻혀도 초록일 수 있다). */
  function liveY7Store(openWeek: number): { shownWeek: number | null; hasDecision: boolean; graduation: string | undefined } {
    const s0 = createInitialState('female', ['emotional', 'info'], { rngSeed: 7000 + openWeek });
    Object.assign(s0, { year: 7, week: 1, phase: 'weekday', currentEvent: null });
    const j = s0.npcs.find(n => n.id === 'jihun')!;
    j.met = true; j.intimacy = 80;
    s0.events = [{ ...event(ROMANCE_ROUTES.jihun.opening), year: 6, week: openWeek, resolvedChoice: 3 }];
    s0.relationship = { npcId: 'jihun', status: 'dating', year: 6, week: openWeek };
    useGameStore.setState({ state: s0 });
    let hasDecision = false;
    for (let guard = 0; guard < 600; guard++) {
      const st = useGameStore.getState().state!;
      if (st.phase === 'ending') break;
      const api = useGameStore.getState();
      if (st.phase === 'event' && st.currentEvent) {
        const choices = st.currentEvent.femaleChoices ?? st.currentEvent.choices;
        let pick = choices.findIndex(c => !c.relationshipSelect && !c.romanceConversation);
        if (st.currentEvent.id === GRAD) {
          const together = choices.findIndex(c => c.relationshipSelect?.decision === 'together');
          hasDecision = together >= 0;
          if (together >= 0) pick = together;
        }
        api.resolveEvent(Math.max(0, pick));
      } else if (st.phase === 'result') api.setPhase('weekday');
      else if (st.phase === 'year-end') api.advanceFromYearEnd();
      else if (st.phase === 'weekday') api.advanceWeek();
      else break;
    }
    const f = useGameStore.getState().state!;
    expect(f.phase, '전제: store 루프가 엔딩까지 갔다').toBe('ending');
    const rec = f.events.find(e => e.id === GRAD && e.year === 7);
    return { shownWeek: rec?.week ?? null, hasDecision, graduation: f.relationship?.graduation };
  }

  it('양성 대조 — 앵커가 없으면 같은 판에서 졸업식이 졸업 전에 뜬다', () => {
    // 이게 거짓이면 아래 "46주 이후"는 픽스처가 원래 늦게 뜨는 판이라서 초록일 뿐이다.
    for (const w of OPEN_WEEKS) {
      const base = withoutAnchor(() => liveY7(w));
      expect(base.shownWeek, `Y6 W${w} 고백: 대조군에서 안 떴다`).not.toBeNull();
      expect(base.shownWeek!, `Y6 W${w} 고백: 대조군이 이미 졸업 무렵이다 — 대조가 공허하다`).toBeLessThan(ANCHOR);
    }
  });

  it('고백 시점과 무관하게 졸업식 주(46) 이후에만 뜨고, 결정이 붙고, 기록된다', () => {
    for (const w of OPEN_WEEKS) {
      const run = liveY7(w);
      expect(run.shownWeek, `Y6 W${w} 고백: 졸업 장면이 아예 안 떴다(예약 유실)`).not.toBeNull();
      expect(run.shownWeek!, `Y6 W${w} 고백: 졸업식 전에 떴다`).toBeGreaterThanOrEqual(ANCHOR);
      expect(run.hasDecision, `Y6 W${w} 고백: 졸업 뒤 관계 결정이 안 붙었다`).toBe(true);
      expect(run.graduation, `Y6 W${w} 고백: 결정이 엔딩까지 안 갔다`).toBe('together');
    }
  });

  it('제품 store 경로에서도 같다 — 졸업식 주 이후·결정·엔딩 기록', { timeout: 60_000 }, () => {
    for (const w of OPEN_WEEKS) {
      const run = liveY7Store(w);
      expect(run.shownWeek, `store Y6 W${w} 고백: 졸업 장면이 아예 안 떴다`).not.toBeNull();
      expect(run.shownWeek!, `store Y6 W${w} 고백: 졸업식 전에 떴다`).toBeGreaterThanOrEqual(ANCHOR);
      expect(run.hasDecision, `store Y6 W${w} 고백: 결정이 안 붙었다`).toBe(true);
      expect(run.graduation, `store Y6 W${w} 고백: 결정이 엔딩까지 안 갔다`).toBe('together');
    }
    // 양성 대조(store) — 앵커를 떼면 같은 store 판이 졸업 전에 띄운다.
    const base = withoutAnchor(() => liveY7Store(OPEN_WEEKS[0]));
    expect(base.shownWeek!, 'store 대조가 이미 졸업 무렵이다 — 공허').toBeLessThan(ANCHOR);
  });
});

describe('수빈 졸업은 Y7 40~42주 후속 경합에 밀리지 않는다', () => {
  // 열리는 주가 셋뿐인데, 배열에서 앞선 지훈 후속 셋이 함께 남아 있으면 세 주를 다 가져간다.
  function contested(datingSubin: boolean): GameState {
    const s = datingSubin ? dating('subin') : ready('subin');
    Object.assign(s, { year: 7, week: 40, isVacation: false, phase: 'weekday', currentEvent: null });
    Object.assign(s.npcs.find(n => n.id === 'jihun')!, { met: true, intimacy: 70, weekStartIntimacy: 70 });
    // 정상 플레이라면 몇 해 전에 끝났을 앞 순번 후속은 발동 처리한다.
    for (const id of ['jihun-basketball', 'jihun-secret', 'subin-bridge', 'subin-lonely', 'subin-divorce', 'subin-dream']) {
      s.events.push({ ...event(id), year: 5, week: 10, resolvedChoice: 0 });
    }
    return s;
  }
  function runWindow(s: GameState): string[] {
    const picked: string[] = [];
    for (const week of [40, 41, 42]) {
      s.week = week;
      const e = getEventForWeek(s).event!;
      picked.push(e.id);
      s.events.push({ ...e, year: 7, week, resolvedChoice: 0 });
    }
    return picked;
  }

  it('연애가 아닌 판은 기존 배열 순서 그대로 — 지훈 후속 셋이 창을 채운다(경합이 실재한다는 대조군)', () => {
    const s = contested(false);
    expect(getEventForWeek(s).event!.id).toBe('jihun-fight');
    expect(runWindow(s)).toEqual(['jihun-fight', 'jihun-support', 'jihun-promise']);
  });

  // 맞교환: 3주에 4개라 하나는 빠진다. 연인 판에서는 우정 장면(jihun-promise)을 내주고 졸업 선택을 살린다.
  // 정상 플레이에선 fight·support가 이전 해에 지나가 promise도 41·42주에 들어간다.
  it('연인이면 40주 첫 칸에 졸업 대화가 오고 이별·지속 선택지가 붙는다 — 창이 꽉 차면 jihun-promise를 내준다', () => {
    const s = contested(true);
    expect(isDating(s, 'subin')).toBe(true);
    expect(getFollowupForWeek(s)!.id).toBe('subin-farewell');
    const picked = runWindow(contested(true));
    expect(picked[0]).toBe('subin-farewell');
    expect(picked.slice(1)).toEqual(['jihun-fight', 'jihun-support']);
    assignCurrentEvent(s, getEventForWeek(s).event!, 40);
    expect(s.currentEvent!.choices.map(c => c.relationshipSelect?.decision).filter(Boolean)).toEqual(['together', 'apart']);
    // 순위 상향은 복사본에만 — 카탈로그 원본을 고치면 연애가 아닌 판까지 졸업이 앞선다.
    expect(event('subin-farewell').selectionPriority).toBeUndefined();
    expect(getEventForWeek(contested(false)).event!.id).toBe('jihun-fight');
  });

  it('상향은 한 칸뿐 — 반장 선거 후속(20·21)이 함께 남아 있으면 반장이 먼저다', () => {
    const s = contested(true);
    s.events.push({ ...event('class-president-2'), year: 7, week: 25, resolvedChoice: 0 });
    expect(getEventForWeek(s).event!.id).toBe('class-president-2-speech');
    expect(getFollowupForWeek(s)!.id).toBe('class-president-2-speech');
  });
});
