import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../gameEngine';
import { GAME_EVENTS, getFollowupForWeek } from '../events';
import { getReachForWeek } from '../events/selection';
import { assignCurrentEvent, presentEvent } from '../eventPresentation';
import { migrateLoadedState } from '../stateMigration';
import { cloneGameState } from '../stateClone';
import { useGameStore } from '../store';
import { calculateEnding } from '../ending';
import { resolveNpcClosure } from '../endingNpc';
import { getNpcSmalltalk } from '../talkSystem';
import { getNpcDialogue } from '../dialogues';
import { applyRelationshipChoice, isDating, romanceEventEligibility, romanceLines, ROMANCE_ROUTES } from '../romance';
import type { RomanceNpc } from '../romance';
import type { GameEvent } from '../types';
import { resolveEventLikeStore } from '../../../scripts/lib/y1-sim-resolve';

const event = (id: string) => GAME_EVENTS.find(e => e.id === id)! as GameEvent;
function opening(npcId: RomanceNpc) {
  const route = ROMANCE_ROUTES[npcId];
  const s = createInitialState(route.gender, ['emotional', 'info'], { rngSeed: 42 });
  Object.assign(s, { year: 6, week: 11, phase: 'weekday', currentEvent: null, isVacation: false });
  s.npcs.forEach(n => { n.intimacy = n.id === npcId ? route.tier : 0; n.met = n.id === npcId; });
  assignCurrentEvent(s, event(route.opening), 10);
  return s;
}
function resolve(npcId: RomanceNpc, choiceIndex: number) {
  const s = opening(npcId);
  useGameStore.setState({ state: s });
  useGameStore.getState().resolveEvent(choiceIndex);
  return useGameStore.getState().state!;
}

beforeEach(() => useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} }));

for (const npcId of ['subin', 'jihun'] as const) describe(`${npcId} 첫 연애`, () => {
  it('명시적 동의만 연애를 시작하고, 발생 주차를 저장하며 시뮬과 결과가 같다', () => {
    const before = opening(npcId);
    expect(before.relationship).toBeUndefined();
    expect(before.currentEvent!.choices[1].text).toContain('사귀자');
    const sim = resolveEventLikeStore(cloneGameState(before), 1);
    const after = resolve(npcId, 1);
    expect(after.relationship).toEqual({ npcId, status: 'dating', year: 6, week: 10 });
    expect(sim.relationship).toEqual(after.relationship);
    expect(after.events.filter(e => e.id === ROMANCE_ROUTES[npcId].opening)).toHaveLength(1);
    expect(after.memorySlots.some(m => m.npcIds?.includes(npcId) && m.recallText.includes('좋아한다'))).toBe(true);
  });

  it('친구 선택과 연애 선택의 능력치·친밀도·돈·시간 효과가 같다', () => {
    const friends = resolve(npcId, 0);
    const dating = resolve(npcId, 1);
    expect(friends.relationship?.status).toBe('friends');
    expect(isDating(friends, npcId)).toBe(false);
    expect(friends.stats).toEqual(dating.stats);
    expect(friends.npcs).toEqual(dating.npcs);
    expect(friends.money).toBe(dating.money);
    expect(friends.eventTimeCost).toBe(dating.eventTimeCost);
    expect(resolveNpcClosure(friends, npcId, 80)?.text).toContain('우정');
  });

  it('직렬화·로드·재렌더에서 선택지가 뒤바뀌지 않고 관계도 유지된다', () => {
    const before = opening(npcId);
    const loaded = migrateLoadedState(cloneGameState(before));
    expect(loaded.currentEvent?.choices).toEqual(before.currentEvent?.choices);
    expect(presentEvent(loaded.currentEvent!, loaded).choices).toEqual(before.currentEvent?.choices);
    const dating = resolve(npcId, 1);
    const reloaded = migrateLoadedState(cloneGameState(dating));
    expect(reloaded.relationship).toEqual(dating.relationship);
    expect(getNpcDialogue(npcId, 20, reloaded)).toBeTruthy();
    expect(romanceLines(reloaded, npcId)).toContain(getNpcSmalltalk(reloaded, npcId));
  });

  it('친밀도가 떨어져도 자동 이별하지 않고, 졸업 선택을 엔딩까지 반영한다', () => {
    for (const decision of ['together', 'apart'] as const) {
      const s = resolve(npcId, 1);
      Object.assign(s, { year: 7, week: 41, isVacation: false, currentEvent: null });
      s.npcs.forEach(n => { n.met = true; n.intimacy = n.id === npcId ? 20 : 100; });
      expect(isDating(s, npcId)).toBe(true);
      assignCurrentEvent(s, event(ROMANCE_ROUTES[npcId].closing), 40);
      const loaded = migrateLoadedState(cloneGameState(s));
      expect(loaded.currentEvent?.choices.some(c => c.relationshipSelect?.decision === decision)).toBe(true);
      useGameStore.setState({ state: loaded });
      useGameStore.getState().resolveEvent(decision === 'together' ? 0 : 1);
      const after = useGameStore.getState().state!;
      expect(after.relationship?.graduation).toBe(decision);
      expect(isDating(after, npcId)).toBe(decision === 'together');
      const stories = calculateEnding(after).npcStories;
      expect(stories[0]).toContain(decision === 'together' ? '졸업 후에도 연인' : '첫 연애는 졸업을 앞두고 끝났다');
      expect(stories).toHaveLength(3);
    }
  });

  it('졸업 대화를 못 본 연애에도 하지 않은 약속을 엔딩에서 지어내지 않는다', () => {
    const s = resolve(npcId, 1);
    const text = resolveNpcClosure(s, npcId, 80)!.text;
    expect(text).toContain('연인이 되었다');
    expect(text).not.toContain('졸업 후에도');
  });

  it('과거 선택 번호·높은 친밀도만 있는 구세이브에는 연애를 만들지 않는다', () => {
    const s = opening(npcId);
    s.currentEvent = null;
    s.events.push({ ...event(ROMANCE_ROUTES[npcId].opening), year: 6, week: 10, resolvedChoice: 1, resolvedFemale: true });
    s.npcs.forEach(n => { n.intimacy = 100; });
    expect(migrateLoadedState(cloneGameState(s)).relationship).toBeUndefined();
    expect(isDating(s, npcId)).toBe(false);
  });
});

describe('분기 조건과 사건 예산', () => {
  it('같은 학년에 비슷한 친밀도로 진입하고 다른 성별 경로에는 선택지가 없다', () => {
    for (const npcId of ['subin', 'jihun'] as const) {
      const s = opening(npcId);
      s.week = 10;
      if (npcId === 'subin') s.events.push({ ...event('subin-hs-momfight'), year: 5, week: 1 });
      const candidate = getReachForWeek(s);
      expect(candidate?.id).toBe(ROMANCE_ROUTES[npcId].opening);
      s.npcs.find(n => n.id === npcId)!.intimacy--;
      expect(romanceEventEligibility(event(ROMANCE_ROUTES[npcId].opening), s).condition!(s)).toBe(false);
      s.gender = s.gender === 'male' ? 'female' : 'male';
      expect(presentEvent(event(ROMANCE_ROUTES[npcId].opening), s).choices.some(c => c.relationshipSelect)).toBe(false);
    }
  });

  it('수빈의 앞 장면이 고2 후반에 열려도 4주 후 고백을 만날 수 있다', () => {
    const s = opening('subin');
    s.events.push({ ...event('subin-hs-momfight'), year: 6, week: 31 });
    s.week = 34;
    s.npcs.find(n => n.id === 'subin')!.weekStartIntimacy = 67;
    expect(getReachForWeek(s)).toBeNull();
    s.week = 35;
    expect(getReachForWeek(s)?.id).toBe('subin-hs-studyboard');
  });

  it('지훈 우정을 택한 뒤 고교 사건의 여주 고백 암시만 제거하고 다른 NPC는 보존한다', () => {
    const s = resolve('jihun', 0);
    const injury = presentEvent(event('jihun-hs-injury'), s);
    expect(injury.choices).toEqual(event('jihun-hs-injury').choices);
    const other = GAME_EVENTS.find(e => e.id.startsWith('minjae-') && e.femaleDescription)!;
    expect(presentEvent(other, s).description).toBe(other.femaleDescription);
  });

  it('졸업 장면은 기존 사건 슬롯을 쓰며 직전 reach 쿨다운에 가려지지 않는다', () => {
    const s = resolve('jihun', 1);
    Object.assign(s, { year: 7, week: 40, isVacation: false });
    s.npcs.find(n => n.id === 'jihun')!.intimacy = 20;
    s.events.push({ ...event('jihun-hs-lastgame'), year: 7, week: 39 });
    expect(getReachForWeek(s)?.id).toBe('jihun-hs-graduation');
    s.events.push({ ...event('subin-hs-after'), reach: { npc: 'yuna', tier: 70, year: 7 }, year: 7, week: 40 });
    expect(getReachForWeek(s)).toBeNull();
    const subin = resolve('subin', 1);
    Object.assign(subin, { year: 7, week: 40, isVacation: false });
    subin.npcs.find(n => n.id === 'subin')!.intimacy = 20;
    expect(event('subin-farewell').condition!(subin)).toBe(true);
    subin.events = GAME_EVENTS.filter(e => e.id !== 'subin-farewell').map(e => ({ ...e, year: 7, week: 39 }));
    expect(getFollowupForWeek(subin)?.id).toBe('subin-farewell');
  });

  it('다른 사건·학년·성별의 관계 선택과 손상된 저장은 적용하지 않는다', () => {
    const s = opening('subin');
    const choice = s.currentEvent!.choices[1];
    applyRelationshipChoice(s, { ...s.currentEvent!, id: 'unrelated' }, choice, 10);
    expect(s.relationship).toBeUndefined();
    s.year = 5;
    applyRelationshipChoice(s, s.currentEvent!, choice, 10);
    expect(s.relationship).toBeUndefined();
    const corrupt = { ...s, relationship: { npcId: 'unknown', status: 'dating', year: 6, week: 10 } };
    expect(migrateLoadedState(corrupt as unknown as typeof s).relationship).toBeUndefined();
  });
});
