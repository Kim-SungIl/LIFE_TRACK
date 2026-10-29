// @vitest-environment jsdom
// 초대 카드가 그 친구의 말투(talkData/inviteVoices.ts)로 그려진다 — 표만 잠그면 화면이 공용 줄을 계속 써도 초록이다.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));

import { MonthPlanScreen } from '../screens/main/MonthPlanScreen';
import { createInitialState } from '../../engine/gameEngine';
import { generateMonthInvites } from '../../engine/monthInvites';
import { INVITE_VOICES, inviteLine } from '../../engine/talkData/inviteVoices';
import { getWeekOfMonth } from '../../engine/weekMath';

describe('초대 카드 말투', () => {
  it('초대 한 줄과 거절 반응이 그 친구 것이다', () => {
    localStorage.setItem('lifetrack_month_tutorial_seen', '1');
    const s = Object.assign(createInitialState('male', ['emotional', 'info'], { rngSeed: 42 }), { phase: 'weekday' as const, currentEvent: null });
    const [inv] = generateMonthInvites(s);
    expect(inv, '전제: 새 판 3월엔 지훈 초대가 뜬다').toBeTruthy();
    render(<MonthPlanScreen state={s} onSetRoutine={() => {}} onStart={() => null} />);
    const card = screen.getByTestId(`invite-${inv.npcId}`);
    const when = `${getWeekOfMonth(inv.week)}주차 ${inv.slotIdx === 0 ? '토요일' : '일요일'}`;
    expect(card.textContent).toContain(inviteLine(inv.npcId, inv.activityId, inv.week, when));
    fireEvent.click(within(card).getByRole('button', { name: '다음에' }));
    expect(card.textContent).toContain(INVITE_VOICES[inv.npcId].decline);
  });
});
