// @vitest-environment jsdom
// 이벤트 등장음 **배선** 계약.
//
// sfxDesign.test.ts는 "eventAppearMinor가 더 조용하다"는 소리의 생김새를 잠그지만,
// 그 소리가 실제로 잡사건에서 울리는지는 잠그지 못한다. 배선을 안 잠그면 등급화 코드를
// 통째로 지워도(항상 eventAppear) 전부 그린이 된다 — 이 프로젝트에서 실제로 겪은 실패
// 유형이라(순수함수만 잠근 PR #381) 화면을 렌더해 호출을 직접 관측한다.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { EventScene } from '../EventScene';
import { makeEvent, makeChoice } from '../../test/fixtures';
import { SCHOOL_LIFE_EVENTS, SCHOOL_LIFE_EVENT_IDS } from '../../engine/events/school-life';
import { playSfx } from '../../audio/sfx';

vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));

const played = () => (playSfx as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(c => c[0]);

beforeEach(() => { vi.clearAllMocks(); });

describe('이벤트 등장음 등급 배선', () => {
  it('잡사건(school-life)은 약한 등장음으로 운다', () => {
    render(<EventScene event={makeEvent({ id: SCHOOL_LIFE_EVENTS[0].id })} gender="male" year={1} onChoice={vi.fn()} />);
    expect(played()).toContain('eventAppearMinor');
    expect(played()).not.toContain('eventAppear');
  });

  // 양성 짝 — 잡사건이 아닌 이벤트는 기본 등장음이어야 한다.
  // 이게 없으면 "항상 minor"로 바꿔도 위 테스트만으로는 통과한다.
  it('잡사건이 아닌 이벤트는 기본 등장음으로 운다', () => {
    const id = 'not-a-school-life-event';
    expect(SCHOOL_LIFE_EVENT_IDS.has(id)).toBe(false);
    render(<EventScene event={makeEvent({ id })} gender="male" year={1} onChoice={vi.fn()} />);
    expect(played()).toContain('eventAppear');
    expect(played()).not.toContain('eventAppearMinor');
  });

  it('한 이벤트당 정확히 한 번만 운다 (StrictMode 이중 호출·리마운트 방어)', () => {
    const event = makeEvent({ id: 'once-only', choices: [makeChoice()] });
    const { rerender } = render(<EventScene event={event} gender="male" year={1} onChoice={vi.fn()} />);
    rerender(<EventScene event={event} gender="male" year={1} onChoice={vi.fn()} />);
    expect(played().filter(id => id === 'eventAppear')).toHaveLength(1);
  });
});

describe('잡사건 ID 집합은 풀에서 파생된다', () => {
  // 손으로 나열하면 이벤트 추가 시 조용히 어긋나고, 그러면 새 잡사건만 큰 소리로 울린다.
  it('SCHOOL_LIFE_EVENTS의 모든 id를 담고 크기가 같다', () => {
    expect(SCHOOL_LIFE_EVENT_IDS.size).toBe(SCHOOL_LIFE_EVENTS.length);
    for (const e of SCHOOL_LIFE_EVENTS) expect(SCHOOL_LIFE_EVENT_IDS.has(e.id)).toBe(true);
  });
});
