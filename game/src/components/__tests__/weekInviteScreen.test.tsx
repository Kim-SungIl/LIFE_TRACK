// @vitest-environment jsdom
// 주간 화면의 친구 초대 — 배선(엔진 판정은 engine/__tests__/weekInvites.test.ts).
// 계획을 안 짠 달에 이번 주 초대 카드가 플래너 위에 뜨고, [좋아]면 그 칸에 활동과 동행이 들어가 확정까지 간다.
// 그 뒤 계획 화면을 열면 그 초대는 답이 고정된(잠긴) 카드로 보인다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p, cgThumbSrc: (p: string) => p }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));

import { GameScreen } from '../GameScreen';
import { useGameStore } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { MONTHLY_PLANNING_KEY } from '../../engine/featureFlags';
import { generateMonthInvites } from '../../engine/monthInvites';
import { getWeekInfo } from '../../engine/weekMath';
import type { GameState, MonthInvite } from '../../engine/types';

const now = () => useGameStore.getState().state!;

/** Y2 4월 첫 주 — 지훈 40·수빈 35·민재 32(초대 후보). 루틴 있음, 돈 넉넉. */
function april(rngSeed: number): GameState {
  const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 3 });
  Object.assign(s, { year: 2, week: 5, rngSeed, phase: 'weekday' as const, currentEvent: null, isVacation: getWeekInfo(5).isVacation, routineSlot2: 'self-study', routineSlot3: null, money: 50, monthlyMoney: true });
  for (const [id, v] of [['jihun', 40], ['subin', 35], ['minjae', 32]] as const) {
    const n = s.npcs.find(x => x.id === id)!;
    n.met = true;
    n.intimacy = v;
  }
  return s;
}
/** 이번 주(W5)에 초대가 잡힌 판. */
function withInviteThisWeek(): { s: GameState; inv: MonthInvite } {
  for (let seed = 0; seed < 2000; seed++) {
    const s = april(seed);
    const inv = generateMonthInvites(s).find(i => i.week === 5);
    if (inv) return { s, inv };
  }
  throw new Error('W5 초대가 있는 시드가 없다');
}
const card = () => screen.getByTestId('week-invite');
const npcName = (id: string) => now().npcs.find(n => n.id === id)!.name;

beforeEach(() => {
  cleanup();
  localStorage.clear();
  localStorage.setItem(MONTHLY_PLANNING_KEY, '1');
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  localStorage.setItem('lifetrack_month_tutorial_seen', '1');
  localStorage.setItem('lifetrack_rest_ack', '1');
  useGameStore.setState({ state: null, npcActivityMap: {} });
});

describe('계획을 안 짠 달 — 주간 화면에 이번 주 초대', () => {
  it('week_card_accept: 카드가 뜨고, [좋아]면 그 칸·동행으로 확정된다', () => {
    const { s, inv } = withInviteThisWeek();
    useGameStore.setState({ state: s, npcActivityMap: {} });
    render(<GameScreen />);
    expect(card().textContent, 'week_card_accept: 초대한 친구').toContain(`${npcName(inv.npcId)}의 초대`);
    fireEvent.click(within(card()).getByRole('button', { name: /^좋아/ }));
    expect(within(card()).getByRole('button', { name: /^좋아/ }).getAttribute('aria-pressed')).toBe('true');
    expect((within(card()).getByRole('button', { name: '다음에' }) as HTMLButtonElement).disabled, '답은 바로 확정 — 못 바꾼다').toBe(true);
    fireEvent.click(screen.getByTestId('week-confirm'));
    expect(now().lastWeekendPlan?.activities[inv.slotIdx], 'week_card_accept: 그 칸').toBe(inv.activityId);
    expect(now().lastWeekendPlan?.npcChoices[`${inv.activityId}:${inv.slotIdx}`], 'week_card_accept: 동행').toBe(inv.npcId);
    expect(now().weekLog?.messages.some(m => m.startsWith('📌')), '약속을 지켰다').toBe(true);
  });

  it('week_card_decline: [다음에]면 친밀도 −1, 칸은 그대로', () => {
    const { s, inv } = withInviteThisWeek();
    const before = s.npcs.find(n => n.id === inv.npcId)!.intimacy;
    useGameStore.setState({ state: s, npcActivityMap: {} });
    render(<GameScreen />);
    fireEvent.click(within(card()).getByRole('button', { name: '다음에' }));
    expect(now().npcs.find(n => n.id === inv.npcId)!.intimacy, 'week_card_decline').toBe(before - 1);
    expect(within(card()).getByRole('button', { name: '다음에' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('week_card_then_plan: 주간에서 답한 초대는 계획 화면에서 잠긴 채 그 답으로 보이고, 그대로 저장된다', async () => {
    const { s, inv } = withInviteThisWeek();
    useGameStore.setState({ state: s, npcActivityMap: {} });
    render(<GameScreen />);
    fireEvent.click(within(card()).getByRole('button', { name: /^좋아/ }));
    fireEvent.click(screen.getByTestId('month-plan-open'));
    await waitFor(() => screen.getByTestId('month-plan'));
    const planCard = screen.getByTestId(`invite-${inv.npcId}`);
    const yes = within(planCard).getByRole('button', { name: /^좋아/ }) as HTMLButtonElement;
    expect(yes.getAttribute('aria-pressed'), 'week_card_then_plan: 답 고정').toBe('true');
    expect(yes.disabled, 'week_card_then_plan: 잠김').toBe(true);
    // 다른 초대가 있으면 답해야 저장된다 — 그 카드만 새로 답한다.
    for (const other of screen.queryAllByTestId(/^invite-/).filter(el => el !== planCard)) {
      fireEvent.click(within(other).getByRole('button', { name: '다음에' }));
    }
    fireEvent.click(screen.getByRole('button', { name: '계획 저장' }));
    await waitFor(() => screen.getByTestId('month-plan-strip'));
    const saved = now().monthPlan!;
    expect(saved.invites?.find(a => a.npcId === inv.npcId)?.accepted).toBe(true);
    expect(saved.weeks.find(w => w.week === 5)!.activities[inv.slotIdx], '수락한 약속이 그 칸에 박혔다').toBe(inv.activityId);
    expect(screen.queryByTestId('week-invite'), '계획이 생기면 주간 카드는 내려간다').toBeNull();
  });

  it('week_card_none: 이번 주에 초대가 없으면 카드가 없다', () => {
    const s = april(0);
    for (const n of s.npcs) n.intimacy = Math.min(n.intimacy, 10);
    useGameStore.setState({ state: s, npcActivityMap: {} });
    render(<GameScreen />);
    expect(screen.queryByTestId('week-invite')).toBeNull();
  });
});
