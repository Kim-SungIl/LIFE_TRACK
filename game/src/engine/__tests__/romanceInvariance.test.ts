// main 6cccad4에서 생성한 기준. 의도적인 연애 선택 없이 동일한 입력으로 7년을 완주한다.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import { calculateEnding } from '../ending';
import { resolveEventLikeStore } from '../../../scripts/lib/y1-sim-resolve';
import type { Gender, Stats } from '../types';

const baseline = JSON.parse(readFileSync(new URL('./romance-main-baseline.json', import.meta.url), 'utf8')) as {
  sourceCommit: string;
  runs: { gender: Gender; plan: string; seed: number; stats: Stats; endingHash: string }[];
};

describe('비연애 완주 결과 — main 바이트 불변', () => {
  for (const expected of baseline.runs) {
    it(`${expected.gender}/${expected.plan}/seed${expected.seed}`, { timeout: 30_000 }, () => {
      let s = createInitialState(expected.gender, ['wealth', 'freedom'], { rngSeed: expected.seed });
      [s.routineSlot2, s.routineSlot3] = expected.plan === 'paid' ? ['academy', 'gym'] : ['self-study', 'light-exercise'];
      for (let w = 0; w < 420; w++) {
        s.weekendChoices = ['self-study', 'club'];
        s.vacationChoices = ['self-study', 'creative', 'rest'];
        s = processWeek(s, undefined);
        let guard = 0;
        while (s.currentEvent && guard++ < 20) {
          const choices = s.gender === 'female' && s.currentEvent.femaleChoices ? s.currentEvent.femaleChoices : s.currentEvent.choices;
          s = resolveEventLikeStore(s, choices.findIndex(c => !c.relationshipSelect && !c.romanceConversation));
        }
        if (s.phase === 'year-end') { s.week = 1; s.year++; s.phase = 'weekday'; }
        if (s.phase === 'ending') break;
      }
      expect(s.phase).toBe('ending');
      expect(s.relationship).toBeUndefined();
      expect(s.stats).toEqual(expected.stats);
      expect(createHash('sha256').update(JSON.stringify(calculateEnding(s))).digest('hex')).toBe(expected.endingHash);
    });
  }
});
