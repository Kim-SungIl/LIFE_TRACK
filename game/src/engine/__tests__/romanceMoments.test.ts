// 연애 순간 다시 보기(romanceMoments.ts) — 실제 store 경로로 겪은 장면만 파생되고, state는 그대로다.
import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import { GAME_EVENTS } from '../events';
import { assignCurrentEvent } from '../eventPresentation';
import { useGameStore } from '../store';
import { clearArchive } from '../archive';
import { resolveEventCgRelPaths } from '../eventCg';
import { ALL_ROMANCE_OUTING_IDS, ROMANCE_OUTING_IDS } from '../romance';
import { recallSlots, romanceMomentSlots } from '../romanceMoments';
import { yearToPhaseTag } from '../memorySystem';
import type { GameState, MemorySlot } from '../types';

beforeEach(() => { localStorage.clear(); clearArchive(); });

const ROUTES = [
  { npc: 'subin', gender: 'male', entry: 'subin-hs-studyboard', opening: 'subin-hs-confess', accept: 0, defer: 1,
    closing: 'subin-farewell', together: 2 },
  { npc: 'jihun', gender: 'female', entry: 'jihun-hs-unsaid', opening: 'jihun-hs-unsaid', accept: 3, defer: 0,
    closing: 'jihun-hs-graduation', together: 3 },
] as const;
type Route = (typeof ROUTES)[number];
const cur = () => useGameStore.getState().state!;

/** 고2 30주, 그 루트 상대만 만난 판 — growth 두 칸을 앞 학년 중요도 7 기억이 차지하고 있다(실측 지형). */
function base(r: Route): GameState {
  const s = createInitialState(r.gender, ['emotional', 'info'], { rngSeed: 42 });
  Object.assign(s, { year: 6, week: 30, isVacation: false, phase: 'weekday', currentEvent: null, money: 100,
    routineSlot2: 'self-study', routineSlot3: 'self-study' });
  s.npcs.forEach(n => { n.met = n.id === r.npc; n.intimacy = n.id === r.npc ? 95 : 0; });
  const old = (id: string, year: number): MemorySlot => ({ id: `growth_${year}_${id}`, category: 'growth', week: 10, year,
    sourceEventId: id, choiceIndex: 0, recallText: id, npcIds: [r.npc], importance: 7, phaseTag: yearToPhaseTag(year), toneTag: 'warm' });
  s.memorySlots = [old('old-a', 2), old('old-b', 4)];
  return s;
}

/** 고백(또는 단어장 → 고백) 장면을 열어 choice를 고른다. */
function confess(r: Route, choice: number): void {
  const s = base(r);
  assignCurrentEvent(s, GAME_EVENTS.find(e => e.id === r.entry)!, 30);
  useGameStore.setState({ state: s });
  if (r.npc === 'subin') useGameStore.getState().resolveEvent(3);
  expect(cur().currentEvent?.id).toBe(r.opening);
  useGameStore.getState().resolveEvent(choice);
}

describe.each(ROUTES)('$npc', r => {
  it('고백 수락 — 기억 칸에서 밀려도 회고에 한 장면으로 나오고, 그림은 수락 CG다', () => {
    confess(r, r.accept);
    const s = cur();
    expect(s.relationship?.status, '전제: 관계가 시작됐다').toBe('dating');
    expect(s.memorySlots.some(m => m.sourceEventId === r.opening), '전제: 칸 경쟁에서 밀렸다').toBe(false);
    const moments = romanceMomentSlots(s);
    expect(moments.map(m => [m.sourceEventId, m.year, m.week, m.choiceIndex])).toEqual([[r.opening, 6, 30, r.accept]]);
    expect(moments[0].recallText.length).toBeGreaterThan(0);
    expect(resolveEventCgRelPaths(moments[0].sourceEventId, moments[0].choiceIndex, r.gender, 6)[0])
      .toBe(r.npc === 'subin' ? 'high/subin-hs-confess_c0_m.png' : 'high/jihun-hs-unsaid_c3_f.png');
    // 표시 전용 — state의 기억 슬롯은 그대로다(엔딩 층이 읽는 값).
    // 원본을 건드리지 않는다 — 호출 전 스냅샷과 비교해야 push로 원본을 늘리는 회귀가 잡힌다.
    const snapshot = JSON.stringify(s.memorySlots);
    const before = s.memorySlots;
    const shown = recallSlots(s);
    expect(JSON.stringify(s.memorySlots)).toBe(snapshot);
    expect(s.memorySlots).toBe(before);
    expect(shown).not.toBe(s.memorySlots);
    expect(shown).toHaveLength(s.memorySlots.length + 1);
  });

  it('고백을 미루면 장면이 없고, 4주 뒤 재고백을 받아들이면 그 재고백이 나온다', () => {
    confess(r, r.defer);
    expect(romanceMomentSlots(cur())).toEqual([]);
    useGameStore.setState({ state: { ...cur(), week: 34, phase: 'weekday', currentEvent: null } });
    expect(useGameStore.getState().startRomanceRetry(r.npc)).toBe(true);
    useGameStore.getState().resolveEvent(0);
    const moments = romanceMomentSlots(cur());
    expect(moments.map(m => [m.sourceEventId, m.week])).toEqual([[`${r.npc}-romance-revisit`, 34]]);
    expect(resolveEventCgRelPaths(moments[0].sourceEventId, 0, r.gender, 6)[0]).toContain(r.npc === 'subin' ? 'subin-hs-confess' : 'jihun-hs-unsaid');
  });

  it('재고백에서 친구로 남으면 장면이 없다', () => {
    confess(r, r.defer);
    useGameStore.setState({ state: { ...cur(), week: 34, phase: 'weekday', currentEvent: null } });
    useGameStore.getState().startRomanceRetry(r.npc);
    useGameStore.getState().resolveEvent(1);
    expect(romanceMomentSlots(cur())).toEqual([]);
  });

  it('만남 — 연인과 놀았던 주에 열린 장면이 회고에 나오고, 그림은 만남 CG다', () => {
    confess(r, r.accept);
    const before = { ...cur(), week: 33, phase: 'weekday' as const, weekendChoices: ['hang-out', 'rest'] };
    // 다른 이야기와의 경합 없이 만남만 본다(romanceOutings.test.ts와 같은 처리).
    before.events = [...before.events, ...GAME_EVENTS.filter(e => !ALL_ROMANCE_OUTING_IDS.has(e.id))
      .map(e => ({ ...e, year: 5, week: 1, resolvedChoice: 0 }))];
    const out = processWeek(before, { 'hang-out:0': r.npc });
    expect(out.currentEvent?.id).toBe(ROMANCE_OUTING_IDS[r.npc]);
    useGameStore.setState({ state: out });
    useGameStore.getState().resolveEvent(1);
    const outing = romanceMomentSlots(cur()).find(m => m.sourceEventId === ROMANCE_OUTING_IDS[r.npc])!;
    expect(outing, '만남 장면').toBeDefined();
    expect([outing.year, outing.week, outing.choiceIndex]).toEqual([6, 33, 1]);
    // 만남 기록은 그 자체가 겪은 증거 — 관계 값이 손상돼도 만남은 남고, 관계로 판정하는 고백은 빠진다.
    const broken = romanceMomentSlots({ ...cur(), relationship: undefined }).map(m => m.sourceEventId);
    expect(broken).toEqual([ROMANCE_OUTING_IDS[r.npc]]);
    expect(resolveEventCgRelPaths(outing.sourceEventId, 1, r.gender, 6)[0])
      .toBe(`high/${ROMANCE_OUTING_IDS[r.npc]}_${r.gender === 'male' ? 'm' : 'f'}.png`);
  });

  it.each(['together', 'apart'] as const)('졸업 %s — 계속 만나기로 한 판만 장면이 된다', decision => {
    const s = base(r);
    Object.assign(s, { year: 7, week: 46, relationship: { npcId: r.npc, status: 'dating', year: 6, week: 30 } });
    assignCurrentEvent(s, GAME_EVENTS.find(e => e.id === r.closing)!, 46);
    useGameStore.setState({ state: s });
    useGameStore.getState().resolveEvent(decision === 'together' ? r.together : r.together + 1);
    expect(cur().relationship?.graduation).toBe(decision);
    const ids = romanceMomentSlots(cur()).map(m => m.sourceEventId);
    expect(ids.includes(r.closing)).toBe(decision === 'together');
    // 선택 기록만으로 추정하지 않는다 — 관계에 졸업 약속이 안 남은 값(손상·구세이브)이면 장면이 아니다.
    if (decision === 'together') {
      const { graduation: _drop, ...noPromise } = cur().relationship!;
      void _drop;
      expect(romanceMomentSlots({ ...cur(), relationship: noPromise }).map(m => m.sourceEventId)).not.toContain(r.closing);
    }
  });

  it('이미 기억 칸에 남은 장면은 겹쳐 내지 않는다', () => {
    // growth 칸이 비어 있던 판 — 고백 기억이 슬롯에 그대로 남는다.
    const fresh = base(r); fresh.memorySlots = [];
    assignCurrentEvent(fresh, GAME_EVENTS.find(e => e.id === r.entry)!, 30);
    useGameStore.setState({ state: fresh });
    if (r.npc === 'subin') useGameStore.getState().resolveEvent(3);
    useGameStore.getState().resolveEvent(r.accept);
    expect(cur().memorySlots.some(m => m.sourceEventId === r.opening), '전제: 칸에 남았다').toBe(true);
    expect(romanceMomentSlots(cur())).toEqual([]);
    expect(recallSlots(cur()).filter(m => m.sourceEventId === r.opening)).toHaveLength(1);
  });
});

describe('관계 기록이 없으면 추정하지 않는다', () => {
  it('수락 선택지 기록이 있어도 관계가 그 주에 시작되지 않았으면 장면이 아니다', () => {
    confess(ROUTES[0], ROUTES[0].accept);
    expect(romanceMomentSlots({ ...cur(), relationship: undefined })).toEqual([]);
    expect(romanceMomentSlots({ ...cur(), relationship: { npcId: 'subin', status: 'dating', year: 6, week: 29 } })).toEqual([]);
    // 성별이 맞지 않는 손상값
    expect(romanceMomentSlots({ ...cur(), gender: 'female' })).toEqual([]);
  });
});
