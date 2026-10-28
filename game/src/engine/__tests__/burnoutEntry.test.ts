// 번아웃 진입 — 두 입구(게이트 판정 · 24주 연속 tired 강제 붕괴)가 같은 일을 한다(gameEngine.enterBurnout).
// 루틴 연속 주수 초기화는 그동안 아무 테스트도 안 잡았다(3자 검수: 두 줄을 지워도 전 스위트 초록).
// 번아웃은 "쌓아 온 루틴의 관성이 끊기는 순간"이라 루틴 보너스 단계도 처음부터다 — 그걸 잠근다.
import { describe, expect, it } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import type { GameState } from '../types';

function tiredState(patch: Partial<GameState>): GameState {
  const s = createInitialState('male', ['info', 'wealth'], { rngSeed: 3 });
  s.week = 10;
  s.mentalState = 'tired';
  s.burnoutCooldown = 0;
  s.routineSlot2 = 'self-study';
  s.routineSlot3 = 'light-exercise';
  s.routineSlot2Weeks = 12;
  s.routineSlot3Weeks = 7;
  return Object.assign(s, patch);
}

describe('번아웃 진입은 두 입구 모두 같은 장부를 쓴다', () => {
  it.each([
    ['게이트 — tired + 멘탈 바닥', { stats: { academic: 40, social: 40, talent: 30, mental: 5, health: 40 }, fatigue: 80 }, '번아웃! —'],
    ['만성 — 24주 연속 tired', { stats: { academic: 40, social: 40, talent: 30, mental: 30, health: 40 }, fatigue: 50, consecutiveTiredWeeks: 30 }, '한계였다'],
  ] as const)('%s', (_why, patch, marker) => {
    const before = tiredState(patch as Partial<GameState>);
    const after = processWeek(before);
    // 전제 — 정말 그 입구로 들어갔다(메시지가 입구를 가른다).
    expect(after.weekLog!.messages.some(m => m.includes(marker)), `입구 메시지 「${marker}」`).toBe(true);
    expect(after.mentalState).toBe('burnout');
    expect(after.burnoutCount).toBe(before.burnoutCount + 1);
    expect(after.routineSlot2Weeks, '루틴 2 연속 주수 초기화').toBe(0);
    expect(after.routineSlot3Weeks, '루틴 3 연속 주수 초기화').toBe(0);
  });

  it('양성 짝: 번아웃에 안 들어간 주는 루틴 연속 주수가 이어진다', () => {
    const before = tiredState({ stats: { academic: 40, social: 40, talent: 30, mental: 30, health: 40 }, fatigue: 50, consecutiveTiredWeeks: 2 });
    const after = processWeek(before);
    expect(after.mentalState).not.toBe('burnout');
    expect(after.routineSlot2Weeks).toBeGreaterThan(0);
  });
});
