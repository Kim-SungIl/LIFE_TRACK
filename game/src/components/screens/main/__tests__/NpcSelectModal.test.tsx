// @vitest-environment jsdom
// NpcSelectModal — 주말 동행 상대 선택 모달:
// 활동별 문구, 후보 목록(부모가 met+재적 필터 책임), 선택/취소 콜백, 친밀도 반올림 표시.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NpcSelectModal } from '../NpcSelectModal';
import { NpcState } from '../../../../engine/types';

const npcs: NpcState[] = [
  { id: 'jihun', name: '지훈', intimacy: 55.6, description: '소꿉친구', emoji: '😄', met: true },
  { id: 'yuna', name: '유나', intimacy: 20, description: '같은 반 친구', emoji: '🌟', met: true },
];

function renderModal(overrides?: Partial<Parameters<typeof NpcSelectModal>[0]>) {
  const onSelect = vi.fn();
  const onCancel = vi.fn();
  render(
    <NpcSelectModal
      metNpcs={npcs}
      year={2}
      npcSelectFor="slot:0:hang-out"
      onSelect={onSelect}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onSelect, onCancel };
}

describe('NpcSelectModal', () => {
  it('활동별 문구: hang-out=놀까, study-group=공부할까, 그 외=활동할까', () => {
    const { unmount } = render(
      <NpcSelectModal metNpcs={npcs} year={2} npcSelectFor="slot:0:hang-out" onSelect={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText('누구와 놀까?')).toBeInTheDocument();
    unmount();

    // 레거시(activityId 단독) 형식도 같은 파서를 탄다
    const { unmount: unmount2 } = render(
      <NpcSelectModal metNpcs={npcs} year={2} npcSelectFor="study-group" onSelect={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText('누구와 공부할까?')).toBeInTheDocument();
    unmount2();

    render(
      <NpcSelectModal metNpcs={npcs} year={2} npcSelectFor="slot:1:club" onSelect={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText('누구와 활동할까?')).toBeInTheDocument();
  });

  it('전달받은 후보를 이름·설명·반올림된 친밀도와 함께 나열한다', () => {
    renderModal();
    expect(screen.getByText('지훈')).toBeInTheDocument();
    expect(screen.getByText('소꿉친구')).toBeInTheDocument();
    // 55.6 → 56 (소수 노출 금지)
    expect(screen.getByText('친밀 56')).toBeInTheDocument();
    expect(screen.getByText('친밀 20')).toBeInTheDocument();
  });

  it('후보 클릭 시 onSelect(npcId)를 호출한다', () => {
    const { onSelect } = renderModal();
    fireEvent.click(screen.getByText('유나'));
    expect(onSelect).toHaveBeenCalledWith('yuna');
  });

  it('취소 버튼과 Escape 모두 onCancel로 이어진다', () => {
    const { onCancel } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
