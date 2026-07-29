import { describe, expect, it } from 'vitest';
import { createInitialState } from '../gameEngine';
import { relationshipSignal } from '../relationshipSignals';
import { absWeek } from '../weekMath';
import type { GameState, NpcState, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const RNG_SEED = 42;

// relationshipSignals.ts 신호 임계 — 소스 분기와 동일한 계약 상수.
// (소스 주석 문자열을 파싱하지 않음 — 값 변경 시 이 상수·케이스를 함께 갱신)
const IMMINENT_WINDOW = 5; // intimacy >= th - 5 && intimacy < th
const NEGLECT_WEEKS = 8;
const RECENT_WEEKS = 2;
const NEGLECT_INTIMACY_FLOOR = 20; // intimacy > 20

// Y1·male·jihun·미발동 mini(talk_jihun_*) intimacyMin=30 → nextIntimacyThreshold = 30
// (데이터 계약 스냅샷 — mini/reach 데이터 변경 시 이 값·케이스를 함께 갱신)
const Y1_JIHUN_NEXT_THRESHOLD = 30;

function fixture(overrides: Partial<GameState> = {}): GameState {
  return Object.assign(createInitialState('male', PARENTS, { rngSeed: RNG_SEED }), overrides);
}

function jihunAt(
  state: GameState,
  intimacy: number,
  lastInteractionWeek?: number,
): NpcState {
  const npc = state.npcs.find(n => n.id === 'jihun');
  if (!npc) throw new Error('jihun not found');
  npc.intimacy = intimacy;
  npc.met = true;
  if (lastInteractionWeek !== undefined) npc.lastInteractionWeek = lastInteractionWeek;
  else delete npc.lastInteractionWeek;
  return npc;
}

describe('relationshipSignal', () => {
  const year = 1;
  const week = 10;
  const nowAbs = absWeek(year, week); // 10

  it('locks imminent signal in [th-IMMINENT_WINDOW, th) for Y1 jihun mini threshold 30', () => {
    const state = fixture({ year, week });
    // 25 = 30-5 → 임박, 24 = 창 밖 → null, 30 = 임계 도달 → 임박 아님
    expect(relationshipSignal(jihunAt(state, Y1_JIHUN_NEXT_THRESHOLD - IMMINENT_WINDOW), state)).toEqual({
      text: '✨ 곧 더 가까워질 듯',
      tone: 'good',
    });
    expect(relationshipSignal(jihunAt(state, Y1_JIHUN_NEXT_THRESHOLD - IMMINENT_WINDOW - 1), state)).toBeNull();
    expect(relationshipSignal(jihunAt(state, Y1_JIHUN_NEXT_THRESHOLD - 1), state)).toEqual({
      text: '✨ 곧 더 가까워질 듯',
      tone: 'good',
    });
    expect(relationshipSignal(jihunAt(state, Y1_JIHUN_NEXT_THRESHOLD), state)).toBeNull();
  });

  it('locks neglect at weeksSince >= NEGLECT_WEEKS when intimacy > floor', () => {
    const state = fixture({ year, week });
    // intimacy 40은 Y1 nextTh=50이라 임박 창(45..49) 밖 → 방치만 본다
    expect(
      relationshipSignal(jihunAt(state, 40, nowAbs - NEGLECT_WEEKS), state),
    ).toEqual({ text: '🍂 요즘 뜸하다', tone: 'warn' });
    // 7주는 방치 미달
    expect(relationshipSignal(jihunAt(state, 40, nowAbs - (NEGLECT_WEEKS - 1)), state)).toBeNull();
    // intimacy > 20 경계: 20이면 방치 아님, 21이면 방치
    expect(
      relationshipSignal(jihunAt(state, NEGLECT_INTIMACY_FLOOR, nowAbs - NEGLECT_WEEKS), state),
    ).toBeNull();
    expect(
      relationshipSignal(jihunAt(state, NEGLECT_INTIMACY_FLOOR + 1, nowAbs - NEGLECT_WEEKS), state),
    ).toEqual({ text: '🍂 요즘 뜸하다', tone: 'warn' });
  });

  it('locks recent signal at weeksSince <= RECENT_WEEKS', () => {
    const state = fixture({ year, week });
    expect(
      relationshipSignal(jihunAt(state, 40, nowAbs - RECENT_WEEKS), state),
    ).toEqual({ text: '💛 최근 함께함', tone: 'good' });
    expect(relationshipSignal(jihunAt(state, 40, nowAbs - (RECENT_WEEKS + 1)), state)).toBeNull();
    expect(relationshipSignal(jihunAt(state, 40, nowAbs), state)).toEqual({
      text: '💛 최근 함께함',
      tone: 'good',
    });
  });

  it('prefers imminent over neglect when both would match', () => {
    const state = fixture({ year, week });
    // intimacy 28 → 임박(th=30), weeksSince 10 → 방치 조건도 충족 — 임박 우선
    expect(
      relationshipSignal(jihunAt(state, 28, nowAbs - 10), state),
    ).toEqual({ text: '✨ 곧 더 가까워질 듯', tone: 'good' });
  });

  it('returns null without lastInteractionWeek when not imminent', () => {
    const state = fixture({ year, week });
    expect(relationshipSignal(jihunAt(state, 40), state)).toBeNull();
  });
});
