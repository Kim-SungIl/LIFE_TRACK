// 피로식의 **값**을 손으로 적은 표로 잠근다. (2026-10-28 3자 검수 후속)
//
// activityHints.test.ts의 '엔진과 같은 식' 블록은 엔진 값과 기대값이 둘 다 activityFatigueDelta에서 나와서
// "applyActivity가 이 함수를 부른다"(배선)만 잠갔다 — 지침·번아웃 배율, 체력 30·20 문턱, ×1.5를 바꿔도 초록이었다
// (sub-agent 뮤테이션 실측). 여기 기대값은 식을 다시 계산하지 않고 **숫자로** 적는다. 손 계산은 각 행 주석에 남긴다.
// JS Math.round는 .5를 올린다(4.5 → 5, 7.5 → 8).
import { describe, expect, it } from 'vitest';
import { activityFatigueDelta, isTiredEntry } from '../mentalRules';
import type { GameState, ParentStrength } from '../types';

type Row = [mentalState: GameState['mentalState'], health: number, resilience: boolean, fatigue: number, expected: number, why: string];

const ROWS: Row[] = [
  // 체력 저항 구간 — 30 미만 0, 30~59 −1, 60+ −2(최소 1)
  ['normal', 25, false, 9, 9, '보정 없음'],
  ['normal', 29, false, 9, 9, '29는 30 문턱 아래'],
  ['normal', 30, false, 9, 8, '30부터 −1'],
  ['normal', 59, false, 9, 8, '59는 60 문턱 아래'],
  ['normal', 60, false, 9, 7, '60부터 −2'],
  ['normal', 60, false, 1, 1, 'max(1, 1−2) = 1'],
  // 체력 < 20 가중 ×1.5 — 20은 해당 없음(그리고 30 아래라 저항도 없다)
  ['normal', 20, false, 10, 10, '20은 가중 없음'],
  ['normal', 19, false, 10, 15, '10 × 1.5'],
  ['normal', 19, false, 9, 14, '9 × 1.5 = 13.5 → 14'],
  // 지침 ×0.75 · 번아웃 ×0.5 (체력 보정 전)
  ['tired', 25, false, 12, 9, '12 × 0.75'],
  ['tired', 25, false, 9, 7, '9 × 0.75 = 6.75 → 7'],
  ['burnout', 25, false, 12, 6, '12 × 0.5'],
  ['burnout', 25, false, 9, 5, '9 × 0.5 = 4.5 → 5'],
  ['tired', 60, false, 12, 7, '12 × 0.75 = 9, −2'],
  ['burnout', 19, false, 9, 8, '9 × 0.5 = 4.5 → 5, × 1.5 = 7.5 → 8'],
  // resilience 부모 ×0.85 (마지막, 최소 1)
  ['normal', 25, true, 9, 8, '9 × 0.85 = 7.65 → 8'],
  ['normal', 25, true, 12, 10, '12 × 0.85 = 10.2 → 10'],
  ['tired', 60, true, 12, 6, '12 × 0.75 = 9, −2 = 7, × 0.85 = 5.95 → 6'],
  // 피로를 안 올리는 활동은 그대로
  ['burnout', 19, true, 0, 0, '0은 어떤 보정도 안 탄다'],
  ['normal', 25, false, -5, -5, '회복 활동(음수)은 그대로'],
];

describe('activityFatigueDelta — 손으로 적은 값', () => {
  it.each(ROWS)('%s · 체력 %i · resilience=%s · 활동 피로 %i → %i (%s)', (mentalState, health, resilience, fatigue, expected) => {
    const parents: [ParentStrength, ParentStrength] = resilience ? ['resilience', 'info'] : ['info', 'wealth'];
    const state = { mentalState, parents, stats: { academic: 50, social: 50, talent: 50, mental: 50, health } };
    const r = activityFatigueDelta(state, { fatigue });
    expect(r.delta).toBe(expected);
    // 체질 칩은 resilience이고 보정 분기에 들어갔을 때만(양수 피로).
    expect(r.resilienceApplied).toBe(resilience && fatigue > 0);
  });
});

describe('isTiredEntry — 경계 양방향', () => {
  it.each([
    [39, 46, true, '멘탈 40 미만 + 피로 45 초과'],
    [40, 46, false, '멘탈 40은 여유'],
    [39, 45, false, '피로 45는 초과가 아니다'],
    [60, 85, true, '피로 85는 멘탈과 무관'],
    [60, 84, false, '84는 단독 문턱 아래'],
  ] as [number, number, boolean, string][])('멘탈 %i · 피로 %i → %s (%s)', (mental, fatigue, want) => {
    expect(isTiredEntry(mental, fatigue)).toBe(want);
  });
});
