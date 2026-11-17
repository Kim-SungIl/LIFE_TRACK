// 학년말 옥상(jihun-promise)은 "계속 친구하자"는 장면이라 연인 사이엔 열지 않는다.
// 보통 중1에 소진되지만, 친밀도 70에 늦게 닿은 여주 판은 고2 연애 중에 열려 학년말 회고·엔딩 근황에
// "계속 친구하자고 약속했다"가 남았다(2026-11-17 인게임 검증).
import { describe, expect, it } from 'vitest';
import { GAME_EVENTS } from '../events';
import { makeState, withNpc } from '../../test/fixtures';
import type { GameState } from '../types';

const promise = GAME_EVENTS.find(e => e.id === 'jihun-promise')!;
const at = (patch: Partial<GameState>) => {
  const s = makeState({ gender: 'female', year: 6, week: 41, isVacation: false, ...patch });
  s.npcs = withNpc(s.npcs, 'jihun', { met: true, intimacy: 95 });
  return s;
};

describe('jihun-promise 연애 중 가드', () => {
  it('친구 사이면 열린다(양성 대조)', () => {
    expect(promise.condition!(at({}))).toBe(true);
  });
  it('지훈과 사귀는 중이면 열리지 않는다', () => {
    expect(promise.condition!(at({ relationship: { npcId: 'jihun', status: 'dating', year: 6, week: 26 } }))).toBe(false);
  });
  it('헤어진 뒤엔 다시 열린다 — 그땐 맞는 말이다', () => {
    expect(promise.condition!(at({ relationship: { npcId: 'jihun', status: 'ended', year: 6, week: 26, graduation: 'apart' } }))).toBe(true);
  });
  it('관계가 손상값이면 친구로 본다(연애를 추정하지 않는다)', () => {
    expect(promise.condition!(at({ gender: 'male', relationship: { npcId: 'jihun', status: 'dating', year: 6, week: 26 } }))).toBe(true);
  });
});
