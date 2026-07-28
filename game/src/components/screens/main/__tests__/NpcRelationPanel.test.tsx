// @vitest-environment jsdom
// NpcRelationPanel — 관계 패널의 표시 규칙:
// met 필터, 친밀도 라벨 3단계, 전출 잔상(#331: 흑백·정렬 뒤·게이지 대신 한 줄), 관계 신호.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NpcRelationPanel } from '../NpcRelationPanel';
import { absWeek } from '../../../../engine/relationshipSignals';
import { NpcState } from '../../../../engine/types';
import { makeState, makeEvent, withNpc } from '../../../../test/fixtures';

// 실존 NPC id는 reach/mini 데이터의 "곧 더 가까워질 듯" 임계에 걸릴 수 있어,
// 신호 테스트는 데이터에 없는 가상 id로 임박 분기를 차단한다.
function testNpc(patch: Partial<NpcState> & { id: string; name: string }): NpcState {
  return { intimacy: 30, description: '', emoji: '😀', met: true, ...patch };
}

describe('NpcRelationPanel 노출 규칙', () => {
  it('만난 친구만 카드로 보여준다', () => {
    const state = makeState();
    state.npcs = withNpc(withNpc(state.npcs, 'jihun', { met: true }), 'subin', { met: false });
    render(<NpcRelationPanel state={state} onSelect={() => {}} />);
    expect(screen.getByText('지훈')).toBeInTheDocument();
    expect(screen.queryByText('수빈')).not.toBeInTheDocument();
  });

  it('만난 친구가 없으면 아무것도 렌더하지 않는다', () => {
    const state = makeState();
    state.npcs = state.npcs.map(n => ({ ...n, met: false }));
    const { container } = render(<NpcRelationPanel state={state} onSelect={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('친밀도 구간별 라벨: 아는 사이(<40) / 친구(40~69) / 절친(70+)', () => {
    const state = makeState();
    state.npcs = [
      testNpc({ id: 't-low', name: '낮음이', intimacy: 15 }),
      testNpc({ id: 't-mid', name: '중간이', intimacy: 45 }),
      testNpc({ id: 't-high', name: '높음이', intimacy: 75 }),
    ];
    render(<NpcRelationPanel state={state} onSelect={() => {}} />);
    expect(screen.getByText('아는 사이')).toBeInTheDocument();
    expect(screen.getByText('친구')).toBeInTheDocument();
    expect(screen.getByText('절친')).toBeInTheDocument();
  });

  it('카드 클릭 시 onSelect(npcId)를 호출한다', () => {
    const state = makeState();
    state.npcs = withNpc(state.npcs, 'jihun', { met: true });
    const onSelect = vi.fn();
    render(<NpcRelationPanel state={state} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: '지훈 상세 보기' }));
    expect(onSelect).toHaveBeenCalledWith('jihun');
  });
});

describe('NpcRelationPanel 전출 잔상', () => {
  function departedState() {
    const state = makeState();
    state.npcs = withNpc(withNpc(state.npcs, 'doyun', { met: true, intimacy: 60 }), 'jihun', { met: true });
    // 전출 판정 SSOT = state.events에 작별 이벤트 id 존재
    state.events = [...state.events, makeEvent({ id: 'doyun-school-split' })];
    return state;
  }

  it('떠난 친구는 게이지 대신 "떠난 자리" 한 줄을 보여준다', () => {
    render(<NpcRelationPanel state={departedState()} onSelect={() => {}} />);
    expect(screen.getByText('다른 학교로 떠난 뒤')).toBeInTheDocument();
    // 도윤 카드에는 친밀도 라벨이 없어야 한다 (살아있는 관계로 위장 금지)
    const doyunCard = screen.getByRole('button', { name: '도윤 상세 보기' });
    expect(doyunCard).not.toHaveTextContent(/절친|친구|아는 사이/);
  });

  it('떠난 친구는 있는 친구들 뒤로 정렬된다', () => {
    render(<NpcRelationPanel state={departedState()} onSelect={() => {}} />);
    const cards = screen.getAllByRole('button');
    expect(cards[cards.length - 1]).toHaveTextContent('도윤');
    expect(cards[0]).toHaveTextContent('지훈');
  });
});

describe('NpcRelationPanel 관계 신호', () => {
  it('최근(2주 이내) 상호작용은 💛, 8주 이상 방치는 🍂 신호를 띄운다', () => {
    const state = makeState();
    const now = absWeek(state.year, state.week);
    state.npcs = [
      testNpc({ id: 't-recent', name: '최근이', lastInteractionWeek: now - 1 }),
      testNpc({ id: 't-idle', name: '뜸함이', lastInteractionWeek: now - 10 }),
    ];
    render(<NpcRelationPanel state={state} onSelect={() => {}} />);
    expect(screen.getByText('💛 최근 함께함')).toBeInTheDocument();
    expect(screen.getByText('🍂 요즘 뜸하다')).toBeInTheDocument();
  });

  it('상호작용 기록이 없으면 신호를 띄우지 않는다', () => {
    const state = makeState();
    state.npcs = [testNpc({ id: 't-none', name: '무기록이' })];
    render(<NpcRelationPanel state={state} onSelect={() => {}} />);
    expect(screen.queryByText(/최근 함께함|요즘 뜸하다/)).not.toBeInTheDocument();
  });
});
