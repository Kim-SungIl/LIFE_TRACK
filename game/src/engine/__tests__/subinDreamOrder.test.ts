// subin 고등 사다리의 발동 순서 계약.
//
// 리드인 subin-hs-firstdream(reach t55 Y5)이 "아직 아무한테도 말 안 했는데 / 네가 처음이야"로
// 승무원 고백을 예고하고, 캡스톤 subin-dream(followup t60)이 그 고백을 한다. 그런데 selection의
// 티어 순서는 followup(1) < reach(3.5)라서, 친밀도가 55와 60을 같은 주에 넘으면 캡스톤이
// 리드인을 앞지른다 — 그러면 리드인 대사가 거짓이 된다.
//
// school-festival 매년화로 수빈 친밀도가 오르면서 20/20 런에서 실제로 재현됐다.
// 이 파일은 순수 조건이 아니라 **getEventForWeek 배선**을 통과시켜 순서를 잠근다.
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../gameEngine';
import { getEventForWeek } from '../events/selection';
import { GAME_EVENTS } from '../events';
import type { GameEvent, GameState, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
// 고정주차 이벤트가 없는 학기 주 — 이 주엔 followup/reach 티어까지 내려간다.
const QUIET_WEEK = 27;
// subin followup 중 배열 순서상 subin-dream보다 앞선 것들. 소진시켜야 dream 차례가 온다.
const EARLIER_SUBIN_FOLLOWUPS = ['subin-bridge', 'subin-lonely', 'subin-divorce'];

function findEvent(id: string): GameEvent {
  const ev = GAME_EVENTS.find(e => e.id === id);
  if (!ev) throw new Error(`픽스처 전제 붕괴: ${id} 가 GAME_EVENTS에 없다`);
  return ev;
}

/** 수빈만 만난 상태 + 앞선 수빈 followup 소진 → subin-dream / firstdream 경합만 남긴다. */
function fixture(opts: { year: number; intimacy: number; leadInFired: boolean; leadInWeek?: number }): GameState {
  const s = createInitialState('male', PARENTS, { rngSeed: 42 });
  s.week = QUIET_WEEK;
  s.year = opts.year;
  s.isVacation = false;
  // 다른 NPC의 followup이 끼어들지 않게 전원 미면식으로 만든다(지훈은 기본 met:true).
  for (const n of s.npcs) { n.met = false; }
  const subin = s.npcs.find(n => n.id === 'subin')!;
  subin.met = true;
  subin.intimacy = opts.intimacy;
  s.events = EARLIER_SUBIN_FOLLOWUPS.map(id => ({
    ...findEvent(id), condition: undefined, year: 3, week: 10, resolvedChoice: 0,
  }));
  if (opts.leadInFired) {
    s.events.push({
      ...findEvent('subin-hs-firstdream'), condition: undefined,
      year: 5, week: opts.leadInWeek ?? 5, resolvedChoice: 0,
    });
  }
  return s;
}

describe('subin 고등 사다리 발동 순서', () => {
  it('전제: 리드인은 reach Y5 t55, 캡스톤은 followup t60이다', () => {
    expect(findEvent('subin-hs-firstdream').reach).toEqual({ npc: 'subin', tier: 55, year: 5 });
    // 캡스톤이 followup이 아니면(=reach로 바뀌면) 이 파일이 잠그려는 역전 자체가 성립하지 않는다.
    expect(findEvent('subin-dream').reach, '캡스톤은 reach가 아니어야 이 계약이 의미를 갖는다').toBeUndefined();
  });

  it('Y5에 리드인을 아직 안 봤으면 캡스톤이 먼저 뜨지 않는다', () => {
    const picked = getEventForWeek(fixture({ year: 5, intimacy: 70, leadInFired: false })).event;
    expect(picked?.id, '리드인 전에 캡스톤이 뜨면 "네가 처음이야"가 거짓이 된다').not.toBe('subin-dream');
  });

  it('Y5에 리드인을 아직 안 봤으면 그 자리에 리드인이 뜬다', () => {
    const picked = getEventForWeek(fixture({ year: 5, intimacy: 70, leadInFired: false })).event;
    expect(picked?.id).toBe('subin-hs-firstdream');
  });

  it('리드인을 본 뒤에는 Y5에서도 캡스톤이 뜬다', () => {
    const picked = getEventForWeek(fixture({ year: 5, intimacy: 70, leadInFired: true })).event;
    expect(picked?.id).toBe('subin-dream');
  });

  it('리드인과 같은 주에는 캡스톤이 붙지 않는다 (한 주에 두 고백 방지)', () => {
    // 순서만 맞추면 reach가 본 이벤트로 뜬 뒤 체인이 같은 주에 캡스톤을 붙인다(20/20 실측).
    const picked = getEventForWeek(fixture({ year: 5, intimacy: 70, leadInFired: true, leadInWeek: QUIET_WEEK })).event;
    expect(picked?.id).not.toBe('subin-dream');
  });

  it('리드인 3주 뒤도 아직 이르다 (간격 4주)', () => {
    const picked = getEventForWeek(fixture({ year: 5, intimacy: 70, leadInFired: true, leadInWeek: QUIET_WEEK - 3 })).event;
    expect(picked?.id).not.toBe('subin-dream');
  });

  it('리드인 4주 뒤에는 캡스톤이 뜬다', () => {
    const picked = getEventForWeek(fixture({ year: 5, intimacy: 70, leadInFired: true, leadInWeek: QUIET_WEEK - 4 })).event;
    expect(picked?.id).toBe('subin-dream');
  });

  it('리드인을 놓쳤어도 Y6에는 캡스톤을 받는다 (유실 구제 안전판)', () => {
    const picked = getEventForWeek(fixture({ year: 6, intimacy: 70, leadInFired: false })).event;
    expect(picked?.id).toBe('subin-dream');
  });

  it('친밀도 60 미달이면 어느 해에도 캡스톤이 뜨지 않는다', () => {
    for (const year of [5, 6, 7]) {
      const picked = getEventForWeek(fixture({ year, intimacy: 59, leadInFired: true })).event;
      expect(picked?.id, `Y${year} intimacy 59`).not.toBe('subin-dream');
    }
  });
});
