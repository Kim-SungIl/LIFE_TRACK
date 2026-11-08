import { beforeEach, expect, it } from 'vitest';
import { createInitialState } from '../gameEngine';
import { GAME_EVENTS } from '../events';
import { assignCurrentEvent } from '../eventPresentation';
import { useGameStore } from '../store';
import { clearArchive, loadArchive } from '../archive';
import { albumFor, filledPath, slotPath } from '../npcAlbum';
import { resolveEventCgRelPaths } from '../eventCg';

const routes = [
  { npc: 'subin', gender: 'male', event: 'subin-farewell', index: 2, file: 'high/subin-farewell_c2_m.png' },
  { npc: 'jihun', gender: 'female', event: 'jihun-hs-graduation', index: 3, file: 'high/jihun-hs-graduation_c3_f.png' },
] as const;

beforeEach(() => { localStorage.clear(); clearArchive(); });

for (const route of routes) {
  it(`${route.npc} 졸업 약속 CG는 해당 성별 고3 앨범에 한 번만 등록된다`, () => {
    const slots = albumFor(route.npc, route.gender).flatMap(b => b.slots);
    expect(slots.filter(s => slotPath(s, route.gender) === route.file)).toHaveLength(1);
    const bucket = albumFor(route.npc, route.gender).find(b => b.slots.some(s => slotPath(s, route.gender) === route.file));
    expect(bucket?.key).toBe('y7');
    const other = route.gender === 'male' ? 'female' : 'male';
    expect(albumFor(route.npc, other).flatMap(b => b.slots).some(s => slotPath(s, other) === route.file)).toBe(false);
    expect(resolveEventCgRelPaths(route.event, route.index, other, 7)).not.toContain(route.file);
    expect(resolveEventCgRelPaths(route.event, -1, route.gender, 7)).not.toContain(route.file);
    for (let choice = 0; choice < route.index; choice++) {
      expect(resolveEventCgRelPaths(route.event, choice, route.gender, 7)).not.toContain(route.file);
    }
  });

  it.each(['together', 'apart', 'friend'] as const)(`${route.npc} 졸업 선택 %s의 실제 결과와 CG 수집`, decision => {
    const s = createInitialState(route.gender, ['emotional', 'info'], { rngSeed: 42 });
    Object.assign(s, { year: 7, week: 46, isVacation: false, phase: 'weekday', currentEvent: null });
    s.npcs.forEach(n => { n.met = n.id === route.npc; n.intimacy = n.id === route.npc ? 99 : 0; });
    if (decision !== 'friend') s.relationship = { npcId: route.npc, status: 'dating', year: 6, week: 30 };
    assignCurrentEvent(s, GAME_EVENTS.find(e => e.id === route.event)!, 46);
    useGameStore.setState({ state: s });
    const presented = s.currentEvent!;
    const choices = route.gender === 'female' && presented.femaleChoices ? presented.femaleChoices : presented.choices;
    const index = decision === 'friend' ? 0 : choices.findIndex(c => c.relationshipSelect?.decision === decision);
    expect(index).toBe(decision === 'together' ? route.index : decision === 'apart' ? route.index + 1 : 0);
    expect(loadArchive().cgFiles).not.toContain(route.file);
    useGameStore.getState().resolveEvent(index);
    const seen = loadArchive().cgFiles;
    const slot = albumFor(route.npc, route.gender).flatMap(b => b.slots).find(c => slotPath(c, route.gender) === route.file)!;
    if (decision === 'together') {
      expect(useGameStore.getState().state!.relationship?.graduation).toBe('together');
      expect(resolveEventCgRelPaths(route.event, index, route.gender, 7)[0]).toBe(route.file);
      expect(seen.filter(p => p === route.file)).toHaveLength(1);
      expect(filledPath(slot, seen, route.gender)).toBe(route.file);
    } else {
      expect(resolveEventCgRelPaths(route.event, index, route.gender, 7)).not.toContain(route.file);
      expect(seen).not.toContain(route.file);
      expect(filledPath(slot, seen, route.gender)).toBeNull();
      expect(useGameStore.getState().state!.relationship?.status).toBe(decision === 'apart' ? 'ended' : undefined);
    }
  });
}
