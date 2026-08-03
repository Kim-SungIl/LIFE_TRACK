// @vitest-environment jsdom
// NpcDetailModal — 재적/부재 두 상태의 표시 규칙.
// 회귀 대상: 패널은 "떠난 자리" 잔상으로 그리는데 모달만 컬러 초상·살아있는 게이지·말 걸기를
// 그대로 열어, 같은 화면이 한 친구를 두 상태로 말하던 모순(#331 잔상 처리 누락).
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NpcDetailModal } from '../NpcDetailModal';
import { makeState, makeEvent, withNpc } from '../../../../test/fixtures';
import type { GameState, MemorySlot } from '../../../../engine/types';

const SPLIT = makeEvent({ id: 'doyun-school-split', resolvedChoice: 0, year: 2, week: 2 });

function slot(npcId: string, recallText: string, importance = 7): MemorySlot {
  return {
    id: `m_${npcId}`, category: 'failure', week: 2, year: 2, sourceEventId: 'doyun-school-split',
    choiceIndex: 0, recallText, npcIds: [npcId], importance, phaseTag: 'early', toneTag: 'regret',
  };
}

function renderModal(state: GameState, npcId: string) {
  const npc = state.npcs.find(n => n.id === npcId)!;
  const onTalk = vi.fn();
  render(
    <NpcDetailModal npc={npc} state={state} dialogue="안녕" smalltalk={null}
      onTalk={onTalk} onClose={vi.fn()} />,
  );
  return { onTalk };
}

describe('NpcDetailModal — 재적 중', () => {
  it('말 걸기 버튼과 친밀도 게이지를 보여준다', () => {
    const state = makeState({ year: 6, week: 10 });
    state.npcs = withNpc(state.npcs, 'jihun', { met: true, intimacy: 60 });
    renderModal(state, 'jihun');
    expect(screen.getByRole('button', { name: '말 걸기' })).toBeTruthy();
    expect(screen.getByText(/친밀도 60/)).toBeTruthy();
  });
});

describe('NpcDetailModal — 부재(전출·졸업)', () => {
  it('전출 도윤: 말 걸기 미렌더 + 게이지 숨김 + 부재 문구', () => {
    const state = makeState({ year: 6, week: 10, events: [SPLIT] });
    state.npcs = withNpc(state.npcs, 'doyun', { met: true, intimacy: 45 });
    renderModal(state, 'doyun');
    expect(screen.queryByRole('button', { name: '말 걸기' })).toBeNull();
    expect(screen.getByRole('button', { name: '닫기' })).toBeTruthy();
    expect(screen.queryByText(/친밀도 45/)).toBeNull();
    expect(screen.getByText('다른 학교로 떠난 뒤')).toBeTruthy();
    // '같은 학교 친구' 자막은 떠난 친구에게 문자 그대로 거짓이라 부재 문구로 대체된다.
    expect(screen.queryByText('같은 학교 친구')).toBeNull();
  });

  it('부재 카드는 인사말 대신 이미 얻은 회상 한 줄을 읽어준다 (신규 대사 0)', () => {
    const state = makeState({ year: 6, week: 10, events: [SPLIT] });
    state.npcs = withNpc(state.npcs, 'doyun', { met: true, intimacy: 45 });
    state.memorySlots = [slot('doyun', '답을 고르지 못한 채 닫힌 카톡 창.')];
    renderModal(state, 'doyun');
    expect(screen.getByText('답을 고르지 못한 채 닫힌 카톡 창.')).toBeTruthy();
    expect(screen.queryByText(/안녕/)).toBeNull();
  });

  it('회상 기억이 없으면 그 자리를 비운다 (억지 생성 금지)', () => {
    const state = makeState({ year: 6, week: 10, events: [SPLIT] });
    state.npcs = withNpc(state.npcs, 'doyun', { met: true, intimacy: 45 });
    state.memorySlots = [];
    renderModal(state, 'doyun');
    expect(screen.getByText('다른 학교로 떠난 뒤')).toBeTruthy();
    expect(screen.queryByText(/안녕/)).toBeNull();
  });

  it('하은 Y4(공백)·Y7(졸업)도 같은 잔상 처리를 받고 문구가 서로 다르다', () => {
    const y4 = makeState({ year: 4, week: 10 });
    y4.npcs = withNpc(y4.npcs, 'haeun', { met: true, intimacy: 70 });
    renderModal(y4, 'haeun');
    expect(screen.queryByRole('button', { name: '말 걸기' })).toBeNull();
    expect(screen.getByText('졸업하고 다른 학교로 간 뒤')).toBeTruthy();
  });

  it('하은 Y6(재적)은 말 걸기가 살아 있다', () => {
    const y6 = makeState({ year: 6, week: 10 });
    y6.npcs = withNpc(y6.npcs, 'haeun', { met: true, intimacy: 70 });
    renderModal(y6, 'haeun');
    expect(screen.getByRole('button', { name: '말 걸기' })).toBeTruthy();
  });
});
