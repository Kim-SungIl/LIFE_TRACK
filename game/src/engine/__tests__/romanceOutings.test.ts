import { beforeEach, expect, it } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import { GAME_EVENTS, getEventForWeek } from '../events';
import { ROMANCE_OUTING_EVENTS } from '../events/romance-outings';
import { ALL_ROMANCE_OUTING_IDS, ROMANCE_OUTING_IDS, hasRomanceOuting, presentRomanceEvent } from '../romance';
import { useGameStore } from '../store';
import { clearArchive, loadArchive } from '../archive';
import { albumFor, slotPath } from '../npcAlbum';
import { migrateLoadedState } from '../stateMigration';
import { NPC_DIALOGUES } from '../dialogues';

beforeEach(() => { localStorage.clear(); clearArchive(); });

for (const npc of ['subin', 'jihun'] as const) {
  const gender = npc === 'subin' ? 'male' : 'female';
  const id = ROMANCE_OUTING_IDS[npc];
  const file = `high/${id}_${gender === 'male' ? 'm' : 'f'}.png`;
  function fixture() {
    const s = createInitialState(gender, ['emotional', 'info'], { rngSeed: 7 });
    Object.assign(s, { year: 6, week: 30, phase: 'weekday', currentEvent: null, isVacation: false, money: 100,
      weekendChoices: ['hang-out', 'rest'], routineSlot2: 'self-study', routineSlot3: 'self-study',
      relationship: { npcId: npc, status: 'dating', year: 6, week: 20 } });
    s.npcs.forEach(n => { n.met = n.id === npc; n.intimacy = n.id === npc ? 95 : 0; });
    // 기존 이야기를 본 판: 다른 도달형과의 경합 없이 만남 자체를 검증한다.
    s.events = GAME_EVENTS.filter(e => !ALL_ROMANCE_OUTING_IDS.has(e.id))
      .map(e => ({ ...e, year: 6, week: 1, resolvedChoice: 0 }));
    return s;
  }

  it.each([0, 1])(`${npc} 만남 선택 %s → 기록·CG·회상·졸업, 저장 복원 및 재등장 방지`, choice => {
    const before = fixture();
    const out = processWeek(before, { 'hang-out:0': npc });
    expect(out.currentEvent?.id).toBe(id);
    expect(hasRomanceOuting(out, npc)).toBe(false);
    const restored = migrateLoadedState(JSON.parse(JSON.stringify(out)))!;
    expect(restored.currentEvent?.id).toBe(id);
    useGameStore.setState({ state: restored });
    const stats = { ...restored.stats };
    const money = restored.money;
    const intimacy = restored.npcs.find(n => n.id === npc)!.intimacy;
    useGameStore.getState().resolveEvent(choice);
    const done = useGameStore.getState().state!;
    expect(done.stats).toEqual(stats);
    expect(done.money).toBe(money);
    expect(done.npcs.find(n => n.id === npc)!.intimacy).toBe(intimacy);
    expect(done.phase).toBe('result');
    expect(done.currentEvent).toBeNull();
    expect(hasRomanceOuting(done, npc)).toBe(true);
    expect(loadArchive().cgFiles.filter(p => p === file)).toHaveLength(1);
    expect(albumFor(npc, gender).flatMap(b => b.slots).filter(s => slotPath(s, gender) === file)).toHaveLength(1);
    expect(ROMANCE_OUTING_EVENTS.find(e => e.id === id)!.condition!(done)).toBe(false);
    expect(NPC_DIALOGUES[npc].filter(p => p.condition(95, done)).flatMap(p => p.lines).some(l => l.includes(npc === 'subin' ? '카페에서 단어장' : '공원에서 기록 안 재고'))).toBe(true);
    const closing = GAME_EVENTS.find(e => e.id === (npc === 'subin' ? 'subin-farewell' : 'jihun-hs-graduation'))!;
    const shown = presentRomanceEvent(closing, { ...done, year: 7 });
    const choices = gender === 'female' && shown.femaleChoices ? shown.femaleChoices : shown.choices;
    expect(choices.find(c => c.relationshipSelect?.decision === 'together')!.message)
      .toContain(npc === 'subin' ? choice === 1 ? '예약 유효' : '단어장 덮고' : choice === 1 ? '공동 우승' : '그날 공원');
    const next = processWeek({ ...done, phase: 'weekday', weekendChoices: ['hang-out', 'rest'] }, { 'hang-out:0': npc });
    expect(next.currentEvent?.id).not.toBe(id);
  });

  it(`${npc} 친구·이별·다른 동행·실행 취소에는 열리지 않는다`, () => {
    const s = fixture();
    expect(processWeek({ ...s, relationship: undefined }, { 'hang-out:0': npc }).currentEvent?.id).not.toBe(id);
    expect(processWeek({ ...s, relationship: { ...s.relationship!, status: 'ended', graduation: 'apart' } }, { 'hang-out:0': npc }).currentEvent?.id).not.toBe(id);
    expect(processWeek(s, {}).currentEvent?.id).not.toBe(id);
    expect(processWeek({ ...s, eventTimeCost: 2 }, { 'hang-out:0': npc }).currentEvent?.id).not.toBe(id);
    expect(processWeek({ ...s, weekendChoices: ['rest', 'rest'] }, { 'hang-out:0': npc }).currentEvent?.id).not.toBe(id);
    expect(getEventForWeek(s).event?.id).not.toBe(id);
  });

  it(`${npc} 기존 고정 행사가 우선이며 다음 만남에 다시 기회가 온다`, () => {
    const s = fixture(); s.week = 29; s.events = [];
    Object.assign(s.npcs.find(n => n.id === 'subin')!, { met: true, intimacy: 95 });
    const first = processWeek(s, { 'hang-out:0': npc });
    expect(first.currentEvent?.id).toBe('subin-birthday');
    const second = processWeek(fixture(), { 'hang-out:0': npc });
    expect(second.currentEvent?.id).toBe(id);
  });
}
