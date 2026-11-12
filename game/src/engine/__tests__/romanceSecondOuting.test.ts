// 두 번째 연인 만남(romance-outings.ts ROMANCE_OUTING2) — 실제 store·processWeek 경로로.
// 첫 만남을 마치고 4주 이상 지난 뒤, 연인과 실제로 놀았던 주에 한 번 열린다. 도입부는 첫 만남에서
// 고른 답을 받고, 졸업 '계속 만나자' 대사는 가장 최근 만남을 잇는다. 수치는 하나도 안 바뀐다.
import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import { GAME_EVENTS } from '../events';
import { ROMANCE_OUTING2_GAP, ROMANCE_OUTING_EVENTS } from '../events/romance-outings';
import { yearToPhaseTag } from '../memorySystem';
import {
  ALL_ROMANCE_OUTING_IDS, ROMANCE_OUTING2_IDS, ROMANCE_OUTING2_TEXT, ROMANCE_OUTING_IDS, hasRomanceOuting2,
  presentRomanceEvent, romanceOutingRecall,
} from '../romance';
import { recallSlots } from '../romanceMoments';
import { migrateLoadedState } from '../stateMigration';
import { NPC_DIALOGUES } from '../dialogues';
import { useGameStore } from '../store';
import { clearArchive, loadArchive } from '../archive';
import { resolveEventCgRelPaths } from '../eventCg';
import { npcStoryRows } from '../npcStoryPool';
import type { GameState } from '../types';

beforeEach(() => { localStorage.clear(); clearArchive(); });

const ROUTES = [
  { npc: 'subin', gender: 'male', closing: 'subin-farewell' },
  { npc: 'jihun', gender: 'female', closing: 'jihun-hs-graduation' },
] as const;
type Route = (typeof ROUTES)[number];
const cur = () => useGameStore.getState().state!;
const hangOut = (s: GameState, week: number, r: Route) =>
  processWeek({ ...s, week, phase: 'weekday', currentEvent: null, weekendChoices: ['hang-out', 'rest'] }, { 'hang-out:0': r.npc });

/** 사귀는 중이고 다른 이야기는 다 본 판(경합 없이 만남만 본다) — 첫 만남을 30주에 실제로 겪고 firstChoice를 고른다. */
function afterFirstOuting(r: Route, firstChoice: 0 | 1): GameState {
  const s = createInitialState(r.gender, ['emotional', 'info'], { rngSeed: 7 });
  Object.assign(s, { year: 6, week: 30, phase: 'weekday', currentEvent: null, isVacation: false, money: 100,
    routineSlot2: 'self-study', routineSlot3: 'self-study',
    relationship: { npcId: r.npc, status: 'dating', year: 6, week: 20 } });
  s.npcs.forEach(n => { n.met = n.id === r.npc; n.intimacy = n.id === r.npc ? 95 : 0; });
  s.events = GAME_EVENTS.filter(e => !ALL_ROMANCE_OUTING_IDS.has(e.id)).map(e => ({ ...e, year: 5, week: 1, resolvedChoice: 0 }));
  // 실측 지형: 고2쯤엔 growth 두 칸을 앞 학년 중요도 7 기억이 쥐고 있어 만남(6) 기억은 칸에 못 들어간다.
  s.memorySlots = [2, 4].map(year => ({ id: `growth_${year}_old`, category: 'growth' as const, week: 10, year,
    sourceEventId: `old-${year}`, choiceIndex: 0, recallText: `앞 학년 ${year}`, npcIds: [r.npc], importance: 7,
    phaseTag: yearToPhaseTag(year), toneTag: 'warm' as const }));
  const out = hangOut(s, 30, r);
  expect(out.currentEvent?.id, '전제: 첫 만남이 먼저 열린다').toBe(ROMANCE_OUTING_IDS[r.npc]);
  useGameStore.setState({ state: out });
  useGameStore.getState().resolveEvent(firstChoice);
  return cur();
}

describe.each(ROUTES)('$npc', r => {
  it(`첫 만남 ${ROMANCE_OUTING2_GAP}주 전엔 안 열리고, ${ROMANCE_OUTING2_GAP}주 지나 연인과 놀면 열린다`, () => {
    const s = afterFirstOuting(r, 0);
    expect(hangOut(s, 30 + ROMANCE_OUTING2_GAP - 1, r).currentEvent?.id).not.toBe(ROMANCE_OUTING2_IDS[r.npc]);
    expect(hangOut(s, 30 + ROMANCE_OUTING2_GAP, r).currentEvent?.id).toBe(ROMANCE_OUTING2_IDS[r.npc]);
  });

  it('연인과 놀지 않은 주·졸업 약속을 정한 뒤·헤어진 뒤엔 열리지 않는다', () => {
    const s = afterFirstOuting(r, 0);
    const week = 30 + ROMANCE_OUTING2_GAP;
    const solo = processWeek({ ...s, week, phase: 'weekday', currentEvent: null, weekendChoices: ['hang-out', 'rest'] }, {});
    expect(solo.currentEvent?.id).not.toBe(ROMANCE_OUTING2_IDS[r.npc]);
    const promised = { ...s, relationship: { ...s.relationship!, graduation: 'together' as const } };
    expect(hangOut(promised, week, r).currentEvent?.id).not.toBe(ROMANCE_OUTING2_IDS[r.npc]);
    const ended = { ...s, relationship: { ...s.relationship!, status: 'ended' as const, graduation: 'apart' as const } };
    expect(hangOut(ended, week, r).currentEvent?.id).not.toBe(ROMANCE_OUTING2_IDS[r.npc]);
    // 엔진이 졸업 뒤엔 만남을 아예 묻지 않으니, 사건 조건 자체도 따로 잠근다(양성 대조와 한 쌍).
    const cond = ROMANCE_OUTING_EVENTS.find(e => e.id === ROMANCE_OUTING2_IDS[r.npc])!.condition!;
    expect(cond({ ...s, week }), '양성 대조').toBe(true);
    expect(cond({ ...promised, week })).toBe(false);
  });

  it('첫 만남을 안 겪었으면 두 번째는 없다 — 연인과 놀면 첫 만남이 열린다', () => {
    const s = afterFirstOuting(r, 0);
    const noFirst = { ...s, events: s.events.filter(e => e.id !== ROMANCE_OUTING_IDS[r.npc]) };
    expect(hangOut(noFirst, 40, r).currentEvent?.id).toBe(ROMANCE_OUTING_IDS[r.npc]);
  });

  it.each([0, 1] as const)('도입부가 첫 만남의 답(%s)을 받고, 저장 복원에도 한 번만 붙는다', first => {
    const opened = hangOut(afterFirstOuting(r, first), 30 + ROMANCE_OUTING2_GAP, r);
    const t = ROMANCE_OUTING2_TEXT[r.npc];
    expect(opened.currentEvent!.description).toBe(`${t.head}\n${t.callback[first]}\n${t.tail}`);
    const restored = migrateLoadedState(JSON.parse(JSON.stringify(opened)))!;
    const again = presentRomanceEvent(restored.currentEvent!, restored);
    expect(again.description.split(t.callback[first]).length - 1).toBe(1);
    expect(again.description).not.toContain(t.callback[1 - first]);
  });

  it.each([0, 1] as const)('선택 %s — 수치 불변, 결산으로, 인사말·회고·졸업 회상이 이어지고 다시 안 열린다', choice => {
    const opened = hangOut(afterFirstOuting(r, 1), 30 + ROMANCE_OUTING2_GAP, r);
    useGameStore.setState({ state: opened });
    const { stats, money } = opened;
    const intimacy = opened.npcs.find(n => n.id === r.npc)!.intimacy;
    useGameStore.getState().resolveEvent(choice);
    const done = cur();
    expect(done.stats).toEqual(stats);
    expect(done.money).toBe(money);
    expect(done.npcs.find(n => n.id === r.npc)!.intimacy).toBe(intimacy);
    expect(done.phase).toBe('result');
    expect(done.currentEvent).toBeNull();
    expect(hasRomanceOuting2(done, r.npc)).toBe(true);
    // 그림 — 두 선택이 같은 한 장, 해결과 동시에 기록실에 한 번 적립된다
    const file = `high/${ROMANCE_OUTING2_IDS[r.npc]}_${r.gender === 'male' ? 'm' : 'f'}.png`;
    expect(resolveEventCgRelPaths(ROMANCE_OUTING2_IDS[r.npc], choice, r.gender, 6)[0]).toBe(file);
    expect(loadArchive().cgFiles.filter(f => f === file)).toHaveLength(1);
    // 인사말
    const greet = r.npc === 'subin' ? '그 언덕 또 가자' : '그날 높게만 보내느라';
    expect(NPC_DIALOGUES[r.npc].filter(p => p.condition(95, done)).flatMap(p => p.lines).some(l => l.startsWith(greet))).toBe(true);
    expect(done.memorySlots.some(m => ALL_ROMANCE_OUTING_IDS.has(m.sourceEventId)), '전제: 만남 기억은 칸에서 밀렸다').toBe(false);
    // 회고 — 칸에서 밀린 첫·두 번째 만남이 겪은 순서로 한 번씩(이벤트 기록 파생)
    expect(recallSlots(done).map(m => m.sourceEventId).filter(id => ALL_ROMANCE_OUTING_IDS.has(id)))
      .toEqual([ROMANCE_OUTING_IDS[r.npc], ROMANCE_OUTING2_IDS[r.npc]]);
    // 졸업 '계속 만나자' — 가장 최근(두 번째) 만남을 잇고, 첫 만남 회상은 붙이지 않는다
    const closing = presentRomanceEvent(GAME_EVENTS.find(e => e.id === r.closing)!, { ...done, year: 7 });
    const choices = r.gender === 'female' && closing.femaleChoices ? closing.femaleChoices : closing.choices;
    const together = choices.find(c => c.relationshipSelect?.decision === 'together')!.message;
    expect(together.endsWith(romanceOutingRecall(done, r.npc))).toBe(true);
    const second = r.npc === 'subin' ? (choice === 1 ? '멀리 가도' : '먼저 말해 줘') : (choice === 1 ? '받기 좋은 공만' : '더 빠른 공');
    expect(together).toContain(second);
    expect(together).not.toContain(r.npc === 'subin' ? '예약 유효' : '공동 우승');
    // 다시 안 열린다
    expect(hangOut(done, 30 + ROMANCE_OUTING2_GAP * 2, r).currentEvent?.id).not.toBe(ROMANCE_OUTING2_IDS[r.npc]);
  });
});

describe('경계·손상·연쇄 (3자 검수 보강)', () => {
  const r = ROUTES[1];
  const cond = (id: string) => ROMANCE_OUTING_EVENTS.find(e => e.id === id)!.condition!;

  it('간격은 4주로 못박는다 — 상수를 고쳐도 테스트가 따라가지 않게', () => {
    expect(ROMANCE_OUTING2_GAP).toBe(4);
  });

  it('고2 끝 첫 만남 → 학년을 넘겨 고3 2주에 열린다(1주는 간격 3)', () => {
    const s = afterFirstOuting(r, 0);
    const first = s.events.find(e => e.id === ROMANCE_OUTING_IDS[r.npc])!;
    // 첫 만남 기록을 고2 46주로 옮긴다(기록은 동결 — 새 객체로 교체).
    const moved = { ...s, events: s.events.map(e => e === first ? { ...e, week: 46 } : e) };
    const y7 = (week: number) => processWeek({ ...moved, year: 7, week, phase: 'weekday', currentEvent: null,
      weekendChoices: ['hang-out', 'rest'] }, { 'hang-out:0': r.npc });
    expect(y7(1).currentEvent?.id).not.toBe(ROMANCE_OUTING2_IDS[r.npc]);
    expect(y7(2).currentEvent?.id).toBe(ROMANCE_OUTING2_IDS[r.npc]);
  });

  it('48주(학년 전환 주)엔 열지 않는다 — 47주가 양성 대조', () => {
    const s = afterFirstOuting(r, 0);
    const c = cond(ROMANCE_OUTING2_IDS[r.npc]);
    expect(c({ ...s, year: 7, week: 47 })).toBe(true);
    expect(c({ ...s, year: 7, week: 48 })).toBe(false);
  });

  it('첫 만남 기록의 선택이 0·1이 아니면(손상) 열지 않는다', () => {
    const s = afterFirstOuting(r, 0);
    const c = cond(ROMANCE_OUTING2_IDS[r.npc]);
    const withFirst = (resolvedChoice: number) => ({ ...s, week: 40,
      events: s.events.map(e => e.id === ROMANCE_OUTING_IDS[r.npc] ? { ...e, resolvedChoice } : e) });
    expect(c(withFirst(1)), '양성 대조').toBe(true);
    expect(c(withFirst(2))).toBe(false);
  });

  it('해결 뒤 같은 주에 사건을 덧붙이지 않는다 — 연쇄가 고를 후보가 남은 판에서도', () => {
    const opened = hangOut(afterFirstOuting(r, 0), 30 + ROMANCE_OUTING2_GAP, r);
    // 다 본 판이면 연쇄가 고를 게 없어 공허하게 통과한다 — 만남 기록만 남기고 지쳐 있는 판으로 바꾼다.
    const romanceOnly = opened.events.filter(e => ALL_ROMANCE_OUTING_IDS.has(e.id));
    useGameStore.setState({ state: { ...opened, events: romanceOnly, fatigue: 95,
      stats: { ...opened.stats, mental: 5 } } });
    useGameStore.getState().resolveEvent(0);
    expect(cur().currentEvent).toBeNull();
    expect(cur().phase).toBe('result');
  });
});

it('두 번째 만남은 선택적 보너스 — 이야기 완주율 분모에 들어가지 않는다', () => {
  // 양성 대조: 진짜 이야기 하나를 보면 seen이 1이 된다 — 행을 못 찾아 0으로 읽히는 공허 통과를 막는다.
  const seen = (ids: string[], npc: string) => npcStoryRows(ids, { subin: 95, jihun: 95 }).find(row => row.id === npc)?.seen;
  expect(seen(['subin-hs-firstdream'], 'subin'), '양성 대조').toBe(1);
  for (const npc of ['subin', 'jihun'] as const) expect(seen(Object.values(ROMANCE_OUTING2_IDS), npc), npc).toBe(0);
});
