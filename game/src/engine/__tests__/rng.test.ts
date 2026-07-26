import { describe, expect, it } from 'vitest';
import { deriveTalkSeed, seededRandom, seededRandomTalk } from '../rng';
import type { GameState } from '../types';

/** seededRandom / seededRandomTalk는 rngSeed·talkRngSeed만 읽는다. */
function rngState(rngSeed: number, talkRngSeed = 0): GameState {
  return { rngSeed, talkRngSeed } as GameState;
}

describe('seededRandom', () => {
  it('returns values in [0, 1)', () => {
    const state = rngState(12345);
    for (let i = 0; i < 200; i++) {
      const v = seededRandom(state);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('mutates rngSeed and is deterministic for the same starting seed', () => {
    const a = rngState(42);
    const b = rngState(42);
    const seqA: number[] = [];
    const seedsA: number[] = [];
    const seqB: number[] = [];

    for (let i = 0; i < 16; i++) {
      const before = a.rngSeed;
      const v = seededRandom(a);
      expect(a.rngSeed).not.toBe(before);
      seqA.push(v);
      seedsA.push(a.rngSeed);
      seqB.push(seededRandom(b));
    }

    expect(seqA).toEqual(seqB);
    expect(seedsA).toEqual(
      Array.from({ length: 16 }, (_, i) => {
        const s = rngState(42);
        for (let j = 0; j <= i; j++) seededRandom(s);
        return s.rngSeed;
      }),
    );
  });

  it('diverges from seededRandomTalk on the same initial rngSeed', () => {
    const progress = rngState(99);
    const talk = rngState(99);
    const progressVals = Array.from({ length: 8 }, () => seededRandom(progress));
    const talkVals = Array.from({ length: 8 }, () => seededRandomTalk(talk));
    expect(progressVals).not.toEqual(talkVals);
    // talk 스트림은 rngSeed를 건드리지 않는다
    expect(talk.rngSeed).toBe(99);
    expect(talk.talkRngSeed).not.toBe(0);
    // progress 스트림은 talkRngSeed를 건드리지 않는다
    expect(progress.talkRngSeed).toBe(0);
    expect(progress.rngSeed).not.toBe(99);
  });
});

describe('deriveTalkSeed', () => {
  it('is deterministic for a given rngSeed', () => {
    expect(deriveTalkSeed(1)).toBe(deriveTalkSeed(1));
    expect(deriveTalkSeed(0xdeadbeef)).toBe(deriveTalkSeed(0xdeadbeef));
    expect(deriveTalkSeed(1)).not.toBe(deriveTalkSeed(2));
  });

  it('never returns 0 (LCG zero-lock guard)', () => {
    // ((seed ^ 0x9e3779b9) >>> 0) === 0 인 입력 → || 1
    const zeroingSeed = 0x9e3779b9;
    expect((zeroingSeed ^ 0x9e3779b9) >>> 0).toBe(0);
    expect(deriveTalkSeed(zeroingSeed)).toBe(1);
  });
});

describe('seededRandomTalk', () => {
  it('returns values in [0, 1) and mutates talkRngSeed only', () => {
    const state = rngState(7);
    const initialRng = state.rngSeed;
    for (let i = 0; i < 50; i++) {
      const beforeTalk = state.talkRngSeed;
      const v = seededRandomTalk(state);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(state.talkRngSeed).not.toBe(beforeTalk);
      expect(state.rngSeed).toBe(initialRng);
    }
  });

  it('lazily seeds talkRngSeed from current rngSeed on first call', () => {
    const state = rngState(50, 0);
    seededRandom(state); // rngSeed advances before talk init
    const rngAfterProgress = state.rngSeed;
    expect(state.talkRngSeed).toBe(0);

    seededRandomTalk(state);
    expect(state.talkRngSeed).toBe(
      (() => {
        const expectedStart = deriveTalkSeed(rngAfterProgress);
        const probe = rngState(0, expectedStart);
        seededRandomTalk(probe);
        return probe.talkRngSeed;
      })(),
    );
  });
});
