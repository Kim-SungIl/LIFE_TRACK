import { beforeEach, expect, it } from 'vitest';
import { resolveEventCgRelPaths } from '../eventCg';
import { createInitialState } from '../gameEngine';
import { GAME_EVENTS } from '../events';
import { assignCurrentEvent } from '../eventPresentation';
import { useGameStore } from '../store';
import { clearArchive, loadArchive } from '../archive';
import { albumFor, filledPath, slotPath } from '../npcAlbum';

const files = {
  subin: 'high/subin-hs-confess_c0_m.png',
  jihun: 'high/jihun-hs-unsaid_c3_f.png',
};
beforeEach(() => { localStorage.clear(); clearArchive(); });

it.each(['subin', 'jihun'] as const)('%s 고백 CG는 해당 성별 앨범에 한 칸만 있고 수집 후 열린다', npc => {
  const gender = npc === 'subin' ? 'male' : 'female';
  const slots = albumFor(npc, gender).flatMap(b => b.slots).filter(s => slotPath(s, gender) === files[npc]);
  expect(slots).toHaveLength(1);
  expect(filledPath(slots[0], [], gender)).toBeNull();
  expect(filledPath(slots[0], [files[npc]], gender)).toBe(files[npc]);
  const other = gender === 'male' ? 'female' : 'male';
  expect(albumFor(npc, other).flatMap(b => b.slots).some(s => slotPath(s, other) === files[npc])).toBe(false);
});

it.each(['subin', 'jihun'] as const)('%s 수락만 새 CG를 가리키고 재고백은 같은 자산을 쓴다', npc => {
  const gender = npc === 'subin' ? 'male' : 'female';
  const opening = npc === 'subin' ? 'subin-hs-confess' : 'jihun-hs-unsaid';
  const accepted = npc === 'subin' ? 0 : 3;
  expect(resolveEventCgRelPaths(opening, accepted, gender, 6)[0]).toBe(files[npc]);
  for (const year of [6, 7]) {
    expect(resolveEventCgRelPaths(`${npc}-romance-revisit`, 0, gender, year)[0]).toBe(files[npc]);
    expect(resolveEventCgRelPaths(`${npc}-romance-revisit`, 1, gender, year)).not.toContain(files[npc]);
  }
  for (const choice of npc === 'subin' ? [1, 2] : [0, 1, 2])
    expect(resolveEventCgRelPaths(opening, choice, gender, 6)).not.toContain(files[npc]);
  expect(resolveEventCgRelPaths(`${npc}-romance-revisit`, 0, gender === 'male' ? 'female' : 'male', 6)).not.toContain(files[npc]);
  expect(resolveEventCgRelPaths(`${npc}-romance-revisit`, 0, gender, 5)).not.toContain(files[npc]);
});

it.each([['subin', false], ['subin', true], ['jihun', false], ['jihun', true]] as const)('%s 수락 후 한 번 적립 (재고백=%s)', (npc, retry) => {
  const s = createInitialState(npc === 'subin' ? 'male' : 'female', ['emotional', 'info'], { rngSeed: 42 });
  Object.assign(s, { year: 6, week: 30, isVacation: false, phase: 'weekday', currentEvent: null });
  s.npcs.forEach(n => { n.met = n.id === npc; n.intimacy = n.id === npc ? 95 : 0; });
  const id = npc === 'subin' ? 'subin-hs-studyboard' : 'jihun-hs-unsaid';
  assignCurrentEvent(s, GAME_EVENTS.find(e => e.id === id)!, 30);
  useGameStore.setState({ state: s });
  expect(loadArchive().cgFiles).not.toContain(files[npc]);
  if (npc === 'subin') {
    useGameStore.getState().resolveEvent(3);
    expect(useGameStore.getState().state!.currentEvent?.id).toBe('subin-hs-confess');
    expect(loadArchive().cgFiles).not.toContain(files[npc]);
  }
  if (!retry) {
    useGameStore.getState().resolveEvent(npc === 'subin' ? 0 : 3);
    expect(useGameStore.getState().state!.relationship?.status).toBe('dating');
    expect(loadArchive().cgFiles.filter(f => f === files[npc])).toHaveLength(1);
    return;
  }
  // 첫 고백은 보류하고, 4주 뒤 실제 재고백에서 수락한다.
  useGameStore.getState().resolveEvent(npc === 'subin' ? 1 : 0);
  expect(loadArchive().cgFiles).not.toContain(files[npc]);
  useGameStore.setState({ state: { ...useGameStore.getState().state!, week: 34, phase: 'weekday', currentEvent: null } });
  expect(useGameStore.getState().startRomanceRetry(npc)).toBe(true);
  useGameStore.getState().resolveEvent(0);
  expect(useGameStore.getState().state!.relationship?.status).toBe('dating');
  expect(loadArchive().cgFiles.filter(f => f === files[npc])).toHaveLength(1);
  expect(useGameStore.getState().startRomanceRetry(npc)).toBe(false);
});
