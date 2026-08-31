import { describe, expect, it } from 'vitest';
import { GAME_EVENTS } from '../events';

describe('yuna high-school music room background', () => {
  it('yuna-hs-piano and yuna-hs-recital use music_room, not the middle-school plate', () => {
    const piano = GAME_EVENTS.find(e => e.id === 'yuna-hs-piano');
    const recital = GAME_EVENTS.find(e => e.id === 'yuna-hs-recital');
    expect(piano, 'yuna-hs-piano must exist').toBeTruthy();
    expect(recital, 'yuna-hs-recital must exist').toBeTruthy();
    expect(piano!.background).toBe('music_room');
    expect(recital!.background).toBe('music_room');
    expect(piano!.reach?.year).toBe(5);
    expect(recital!.reach?.year).toBe(6);
  });

  it('yuna-hobby (school-agnostic) also uses music_room — same asset, positive floor', () => {
    const hobby = GAME_EVENTS.find(e => e.id === 'yuna-hobby');
    expect(hobby, 'yuna-hobby must exist').toBeTruthy();
    expect(hobby!.background).toBe('music_room');
  });
});
