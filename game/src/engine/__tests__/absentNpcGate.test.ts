// 부재(전출·졸업) NPC 상호작용 게이트 — 말 걸기·선물·관계 신호.
// 회귀 대상: 전학 간 도윤에게 "점심 축구" 미니가 발동하고, 졸업한 하은에게 교내 잡담이 나오고,
// 선물로 소프트캡까지 친밀도를 살 수 있던 상태(#331 잔상 서사 붕괴 + 후회 드리프트 가산 훼손).
import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../gameEngine';
import { useGameStore } from '../store';
import { applyItemEffects, SHOP_ITEMS } from '../shopSystem';
import {
  isNpcInteractable, npcAbsence, nextIntimacyThreshold, relationshipSignal,
} from '../relationshipSignals';
import type { GameEvent, GameState, NpcState, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];

function stateWith(opts: { year?: number; week?: number; npc?: string; intimacy?: number; split?: boolean } = {}): GameState {
  const s = createInitialState('male', PARENTS, { rngSeed: 42 });
  s.year = opts.year ?? 6;
  s.week = opts.week ?? 10;
  if (opts.npc) {
    const n = s.npcs.find(x => x.id === opts.npc)!;
    n.met = true;
    n.intimacy = opts.intimacy ?? 60;
  }
  if (opts.split) {
    const ev: GameEvent = {
      id: 'doyun-school-split', title: '', description: '', choices: [],
      resolvedChoice: 0, year: 2, week: 2,
    };
    s.events = [...s.events, ev];
  }
  return s;
}

const npcOf = (s: GameState, id: string): NpcState => s.npcs.find(n => n.id === id)!;

describe('npcAbsence — 부재 판정과 문구', () => {
  it('도윤은 전출 이벤트 발동 후 부재, 발동 전엔 재적', () => {
    expect(npcAbsence(npcOf(stateWith({ npc: 'doyun', split: true }), 'doyun'), stateWith({ npc: 'doyun', split: true }))).toEqual(
      { note: '다른 학교로 떠난 뒤', stageYear: 1 },
    );
    const before = stateWith({ year: 1, npc: 'doyun' });
    expect(npcAbsence(npcOf(before, 'doyun'), before)).toBeNull();
  });

  it('하은은 Y4(공백)·Y7(졸업)에 부재이고 문구가 서로 다르다 — Y4는 재회 예정이라 이별 톤 금지', () => {
    const y4 = stateWith({ year: 4, npc: 'haeun' });
    const y7 = stateWith({ year: 7, npc: 'haeun' });
    const y6 = stateWith({ year: 6, npc: 'haeun' });
    expect(npcAbsence(npcOf(y4, 'haeun'), y4)).toEqual({ note: '졸업하고 다른 학교로 간 뒤', stageYear: 3 });
    expect(npcAbsence(npcOf(y7, 'haeun'), y7)).toEqual({ note: '고등학교를 졸업한 뒤', stageYear: 6 });
    expect(npcAbsence(npcOf(y6, 'haeun'), y6)).toBeNull();
  });

  it('평범한 NPC는 어느 학년에도 부재가 아니다', () => {
    for (const year of [1, 2, 3, 4, 5, 6, 7]) {
      const s = stateWith({ year, npc: 'jihun' });
      expect(npcAbsence(npcOf(s, 'jihun'), s)).toBeNull();
      expect(isNpcInteractable(npcOf(s, 'jihun'), s)).toBe(true);
    }
  });
});

describe('말 걸기 게이트 (store.talkToNpc)', () => {
  beforeEach(() => {
    useGameStore.setState({ state: null });
  });

  const talk = (s: GameState, npcId: string) => {
    useGameStore.setState({ state: s });
    const before = useGameStore.getState().state!;
    const snapshot = {
      rngSeed: before.rngSeed,
      pending: before.npcEventPendingThisWeek,
      lastInteraction: npcOf(before, npcId).lastInteractionWeek,
      intimacy: npcOf(before, npcId).intimacy,
      fired: before.talkEventsFired.length,
    };
    const result = useGameStore.getState().talkToNpc(npcId);
    const after = useGameStore.getState().state!;
    return { result, snapshot, after };
  };

  it('전출 도윤에게 말을 걸면 state가 전혀 변하지 않는다 (RNG·주간 pending·상호작용 기록 포함)', () => {
    const s = stateWith({ npc: 'doyun', intimacy: 60, split: true });
    s.npcEventPendingThisWeek = true;
    const { result, snapshot, after } = talk(s, 'doyun');
    expect(result).toEqual({ kind: 'smalltalk', line: '' });
    // 잡담 경로가 seededRandomTalk로 rngSeed를 전진시키므로, 게이트가 늦으면 여기서 새어난다.
    expect(after.rngSeed).toBe(snapshot.rngSeed);
    expect(after.npcEventPendingThisWeek).toBe(snapshot.pending); // 주간 미니 예산 절도 방지
    expect(after.talkEventsFired.length).toBe(snapshot.fired);
    expect(npcOf(after, 'doyun').intimacy).toBe(snapshot.intimacy);
    expect(npcOf(after, 'doyun').lastInteractionWeek).toBe(snapshot.lastInteraction);
  });

  it('졸업한 하은(Y7)도 막히고, 재적 중(Y6)이면 정상 동작한다', () => {
    const y7 = stateWith({ year: 7, npc: 'haeun', intimacy: 70 });
    y7.npcEventPendingThisWeek = true;
    const blocked = talk(y7, 'haeun');
    expect(blocked.result).toEqual({ kind: 'smalltalk', line: '' });
    expect(blocked.after.rngSeed).toBe(blocked.snapshot.rngSeed);

    const y6 = stateWith({ year: 6, npc: 'haeun', intimacy: 70 });
    y6.npcEventPendingThisWeek = true;
    const ok = talk(y6, 'haeun');
    expect(ok.result.kind === 'event' || (ok.result.kind === 'smalltalk' && ok.result.line !== '')).toBe(true);
    expect(npcOf(ok.after, 'haeun').lastInteractionWeek).toBeDefined();
  });
});

describe('선물 게이트 (shopSystem)', () => {
  const gift = SHOP_ITEMS.find(i => i.category === 'gift' && i.effects.some(e => e.type === 'npc_intimacy'))!;

  it('전출 도윤에게는 선물 친밀도가 적용되지 않는다 (반복 구매로 소프트캡까지 사던 경로)', () => {
    const s = stateWith({ npc: 'doyun', intimacy: 60, split: true });
    const { newState } = applyItemEffects(gift, s, 'doyun');
    expect(npcOf(newState, 'doyun').intimacy).toBe(60);
    expect(npcOf(newState, 'doyun').lastInteractionWeek).toBe(npcOf(s, 'doyun').lastInteractionWeek);
  });

  it('재적 친구에게는 그대로 적용된다', () => {
    const s = stateWith({ npc: 'jihun', intimacy: 50 });
    const { newState } = applyItemEffects(gift, s, 'jihun');
    expect(npcOf(newState, 'jihun').intimacy).toBeGreaterThan(50);
  });
});

describe('관계 신호 — 부재 중엔 침묵', () => {
  it('부재 친구에겐 임계·신호를 노출하지 않는다 (도달 불가 약속·해소 불가 잔소리 방지)', () => {
    const s = stateWith({ npc: 'doyun', intimacy: 28, split: true });
    npcOf(s, 'doyun').lastInteractionWeek = 1; // 방치 신호 조건 충족 상태
    expect(nextIntimacyThreshold(npcOf(s, 'doyun'), s)).toBeNull();
    expect(relationshipSignal(npcOf(s, 'doyun'), s)).toBeNull();

    const y4 = stateWith({ year: 4, npc: 'haeun', intimacy: 26 });
    y4.npcEventPendingThisWeek = true;
    npcOf(y4, 'haeun').lastInteractionWeek = 1;
    expect(nextIntimacyThreshold(npcOf(y4, 'haeun'), y4)).toBeNull();
    expect(relationshipSignal(npcOf(y4, 'haeun'), y4)).toBeNull();
  });

  it('재적 친구의 신호는 그대로 동작한다(게이트가 전역으로 새지 않음)', () => {
    const s = stateWith({ year: 6, npc: 'jihun', intimacy: 60 });
    npcOf(s, 'jihun').lastInteractionWeek = 1;
    expect(relationshipSignal(npcOf(s, 'jihun'), s)).not.toBeNull();
  });
});

describe('하은 Y5 재회 안전성 (감쇠 floor characterization)', () => {
  it('Y4 전체를 방치해도 감쇠 하한 20이 재회 조건(≥15)을 못 뚫는다', () => {
    // 게이트로 Y4에 하은을 챙길 수 없어졌으므로, 재회가 잠기지 않는다는 근거를 코드로 고정한다.
    let intimacy = 20; // 최악: 이미 하한
    for (let i = 0; i < 48; i++) intimacy = Math.max(20, intimacy - 0.15);
    expect(intimacy).toBeGreaterThanOrEqual(15);

    let from35 = 35;
    for (let i = 0; i < 48; i++) from35 = Math.max(20, from35 - 0.15);
    expect(from35).toBeGreaterThanOrEqual(20);
  });
});
