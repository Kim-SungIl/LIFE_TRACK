/**
 * 성취 등급의 **도달 가능성** 락 — 픽스처가 아니라 7년을 실제로 살려서 등급을 확인한다.
 *
 * 왜 필요한가: `ending.test.ts`의 경계 테스트는 `achievementFixture`로 스탯을 직접 주입하므로
 * **함수 매핑만** 잠근다. 그 상태에서 `gameEngine`의 학업 노브를 흔들어도(자동 수업 2배,
 * 고등 감쇠 4배) 전체 스위트가 통과했다 — 등급이 실플레이에서 어디에 착지하는지를 보는 눈이
 * 리포에 하나도 없었다. 같은 계열 선례가 #409("픽 가능성만 잠그면 도달 가능성이 통째로 빠진다").
 *
 * 두 프로필은 양성/음성 짝이다. 최소투입은 C에, 성실 대조군은 S에 착지해야 한다 —
 * 한쪽만 두면 "전부 C가 되는" 회귀도 그린이 된다.
 *
 * 비용: 완주 1판 약 0.6초. 아래 4판으로 약 2.5초.
 */
import { describe, expect, it } from 'vitest';
import { calculateEnding } from '../ending';
import { createInitialState, processWeek } from '../gameEngine';
import { resolveEventLikeStore } from '../../../scripts/lib/y1-sim-resolve';
import type { EventChoice, GameState, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['freedom', 'freedom'];

// 성취에 적대적인 선택 정책 — bestAxis = max(학업, 특기, 생활)을 낮추는 쪽.
// **'effects 합 최소'로는 안 된다**: 그 정책은 멘탈·사회성에 큰 음수가 붙은 *학업 양수*
// 선택지를 집어서 오히려 학업을 78~85로 올린다. 축 기준으로 재야 40대로 내려간다.
function axisMin(choices: EventChoice[]): number {
  let best = 0, bestScore = Infinity;
  choices.forEach((c, i) => {
    const e = (c.effects ?? {}) as Record<string, number>;
    const score = (e.academic ?? 0) + (e.talent ?? 0)
      + ((e.mental ?? 0) + (e.health ?? 0) + (e.social ?? 0)) / 3;
    if (score < bestScore) { bestScore = score; best = i; }
  });
  return best;
}

type Plan = {
  routine: [string, string];
  weekend: string[];
  vacation: string[];
  pick: (c: EventChoice[]) => number;
};

function playSevenYears(plan: Plan, rngSeed: number) {
  let s: GameState = createInitialState('male', PARENTS, { rngSeed });
  s.routineSlot2 = plan.routine[0];
  s.routineSlot3 = plan.routine[1];
  // 학년당 49회 진행이라 7년에 343주+ 필요 — 상한은 넉넉히(sim 하네스와 동일).
  for (let w = 0; w < 420; w++) {
    s.weekendChoices = plan.weekend;
    s.vacationChoices = plan.vacation;
    s = processWeek(s, undefined);
    let guard = 0;
    while (s.currentEvent && guard++ < 20) {
      const ev = s.currentEvent;
      const choices = s.gender === 'female' && ev.femaleChoices ? ev.femaleChoices : ev.choices;
      s = resolveEventLikeStore(s, plan.pick(choices));
    }
    // 하네스가 학년을 스스로 못 넘긴다 — 이벤트 해결과 학년 전환은 별개의 두 걸음이다.
    if (s.phase === 'year-end') { s.week = 1; s.year++; s.phase = 'weekday'; }
    if (s.phase === 'ending') break;
  }
  const life = (s.stats.mental + s.stats.health + s.stats.social) / 3;
  return {
    state: s,
    ending: calculateEnding(s),
    academic: s.stats.academic,
    talent: s.stats.talent,
    life,
    bestAxis: Math.max(s.stats.academic, s.stats.talent, life),
  };
}

// 제품에서 만들 수 있는 최소 투입. 학기 중 루틴 슬롯2는 비울 수 없고(MainWeekScreen)
// 루틴 슬롯엔 rest 계열을 넣을 수 없으므로(SlotEditPopup), 슬롯2는 가장 이득이 적은
// 비휴식(sns, 피로 2 · social +1 · mental −1)으로 채우고 슬롯3·주말·방학만 비운다.
const MIN_INPUT: Plan = { routine: ['sns-activity', ''], weekend: [], vacation: [], pick: axisMin };
const DILIGENT: Plan = {
  routine: ['self-study', 'light-exercise'],
  weekend: ['self-study', 'club'],
  vacation: ['self-study', 'creative', 'rest'],
  pick: () => 0,
};

describe('성취 등급 도달 가능성 (7년 완주)', () => {
  it('최소투입 플레이는 C에 착지한다', { timeout: 30_000 }, () => {
    // 시드마다 착지값을 먼저 못박는다 — 등급만 단언하면 경계 근처로 밀려도(예: 학업 49.9)
    // 여전히 C라서 통과하고, 임계가 조용히 이동한 것을 놓친다.
    const landings: Record<number, number> = { 1: 40.7, 7: 40.0 };
    for (const [seed, academic] of Object.entries(landings)) {
      const r = playSevenYears(MIN_INPUT, Number(seed));
      expect(r.state.year, `seed ${seed} 완주`).toBe(8);
      expect(r.state.phase).toBe('ending');
      expect(r.academic, `seed ${seed} 학업 착지값`).toBeCloseTo(academic, 4);
      expect(r.talent, '특기는 바닥(5)').toBeCloseTo(5, 4);
      expect(r.bestAxis, '학업이 지배 축').toBeCloseTo(academic, 4);
      expect(r.bestAxis, 'C 구간(30~50)').toBeLessThan(50);
      expect(r.ending.achievement, `seed ${seed}`).toBe('C');
      // 특기 5는 붕괴(<10)이므로 문장이 붙는다 — 등급은 깎이지 않는다.
      expect(r.ending.achievementNote).not.toBeNull();
    }
  });

  it('성실 대조군은 같은 하네스에서 S에 착지한다 (양성 짝)', { timeout: 30_000 }, () => {
    const landings: Record<number, number> = { 1: 85.6, 7: 85.4 };
    for (const [seed, best] of Object.entries(landings)) {
      const r = playSevenYears(DILIGENT, Number(seed));
      expect(r.state.year, `seed ${seed} 완주`).toBe(8);
      expect(r.bestAxis, `seed ${seed} bestAxis 착지값`).toBeCloseTo(best, 4);
      expect(r.bestAxis, 'S 구간(85+)').toBeGreaterThanOrEqual(85);
      expect(r.ending.achievement, `seed ${seed}`).toBe('S');
      expect(r.ending.achievementNote, '부서진 축 없음').toBeNull();
    }
  });
});
