// @vitest-environment jsdom
// 주말을 비운 채 주를 확정하는 흐름의 계약.
//
// 배경: 실측상 주말을 비우는 게 최적해인 구간이 있다(피로가 학업 총량을 깎는 구조 —
// 주말에 공부를 더 넣으면 19주 학업 총증가가 16.6 → 14.0으로 떨어진다). 그런데 예전 UI는
// 비어 있으면 경고를 띄우고 확정할 때마다 "정말?"이라고 되물어, 최적 플레이에만 336주 내내
// 마찰을 붙였다. 여기서 잠그는 건 두 가지다 — 되묻기는 1회로 끝날 것, 톤은 중립일 것.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MainWeekScreen } from '../MainWeekScreen';
import { makeState } from '../../../../test/fixtures';
import { getBackground } from '../../../../engine/backgrounds';
import { ACTIVITIES, getActivityCost } from '../../../../engine/activities';
import type { GameState } from '../../../../engine/types';

const REST_ACK = 'lifetrack_rest_ack';

function freeRoutineActivityId(): string {
  const a = ACTIVITIES.find(x => x.slots === 1 && getActivityCost(x, 1) === 0 && x.category !== 'rest' && !x.seasonGate);
  if (!a) throw new Error('무료 1칸 학기 활동이 없습니다');
  return a.id;
}

function renderScreen(patch: Partial<GameState> = {}) {
  const onConfirmWeek = vi.fn();
  const routine = freeRoutineActivityId();
  const state = makeState({
    isVacation: false, week: 3,
    routineSlot2: routine, routineSlot3: routine,
    ...patch,
  });
  render(
    <MainWeekScreen
      state={state}
      bgProps={{
        bg: getBackground(state.week, state.isVacation, state.mentalState, state.year),
        bgImgError: true, onImgError: () => {},
      }}
      onSetRoutine={() => {}}
      onTalkNpc={() => ({ kind: 'smalltalk', line: '' })}
      onTalkHome={() => ({ kind: 'smalltalk', line: '' })}
      onResolveParentChoice={() => {}}
      onBuyItem={() => {}}
      onConfirmWeek={onConfirmWeek}
    />,
  );
  return { onConfirmWeek };
}

beforeEach(() => {
  localStorage.clear();
  // 튜토리얼 오버레이가 확정 버튼을 가리지 않게 — 반복 플레이어 상태로 고정
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
});

describe('주말 비우고 확정', () => {
  it('처음 한 번은 확인을 묻고, 확인하면 진행 + 플래그가 남는다', () => {
    const { onConfirmWeek } = renderScreen();

    fireEvent.click(screen.getByRole('button', { name: '주말은 쉰다' }));
    expect(onConfirmWeek).not.toHaveBeenCalled();
    expect(screen.getByText('이번 주말은 쉬어요')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '쉬어갈게요' }));
    expect(onConfirmWeek).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(REST_ACK)).toBe('1');
  });

  it('플래그가 이미 있으면 되묻지 않고 바로 확정한다 (336주 마찰 제거)', () => {
    localStorage.setItem(REST_ACK, '1');
    const { onConfirmWeek } = renderScreen();

    fireEvent.click(screen.getByRole('button', { name: '주말은 쉰다' }));
    expect(screen.queryByText('이번 주말은 쉬어요')).not.toBeInTheDocument();
    expect(onConfirmWeek).toHaveBeenCalledTimes(1);
  });

  it('취소하면 진행하지 않고 플래그도 남기지 않는다', () => {
    const { onConfirmWeek } = renderScreen();

    fireEvent.click(screen.getByRole('button', { name: '주말은 쉰다' }));
    fireEvent.click(screen.getByRole('button', { name: '활동 고를래요' }));
    expect(onConfirmWeek).not.toHaveBeenCalled();
    expect(localStorage.getItem(REST_ACK)).toBeNull();
  });

  it('확인 문구가 쉬는 선택을 실수로 취급하지 않는다', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: '주말은 쉰다' }));
    // 플래너 힌트에도 같은 문장이 있으므로 다이얼로그로 범위를 좁힌다.
    const dialog = within(screen.getByRole('dialog'));
    // '정말 ~할까요?' / '선택하지 않았어요' 같은 되돌리기 유도 어휘 금지
    expect(dialog.queryByText(/정말|선택하지 않았어요/)).not.toBeInTheDocument();
    expect(dialog.getByText(/쉬는 것도 한 주의 선택/)).toBeInTheDocument();
  });
});
