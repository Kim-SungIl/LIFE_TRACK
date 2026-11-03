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
import { ACTIVITIES } from '../../engine/activities';
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
const CAT_LABEL: Record<string, string> = { study: '공부', exercise: '운동', social: '관계', talent: '자기계발', rest: '휴식', parent: '가족', work: '알바' };
/** 계획 화면 칸에 활동 하나 넣기(moneyBlockedMonth.test와 같은 경로 — 칸 → 카테고리 → 활동). */
function pickInto(slotTestId: string, id: string) {
  const act = ACTIVITIES.find(a => a.id === id)!;
  fireEvent.click(screen.getByTestId(slotTestId));
  const header = screen.getAllByRole('button').find(el => el.getAttribute('aria-expanded') !== null
    && (el.textContent ?? '').includes(CAT_LABEL[act.category]));
  if (!header) throw new Error(`카테고리 헤더 없음: ${act.category}`);
  if (header.getAttribute('aria-expanded') === 'false') fireEvent.click(header);
  const btn = screen.getAllByRole('button').find(el => el.getAttribute('aria-pressed') != null
    && !(el.textContent ?? '').includes('수치') && (el.textContent ?? '').includes(act.name));
  if (!btn) throw new Error(`활동 버튼 없음: ${act.name}`);
  fireEvent.click(btn);
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

describe('3자 검수 후속 — 다시 열어도 약속 칸, 돈이 모자라면 [좋아] 잠금, 2칸 활동 위 수락', () => {
  it('week_card_remount: 수락한 뒤 화면을 다시 열면(새로고침·이어하기) 약속 칸이 되살아나 그대로 지킨다', () => {
    const { s, inv } = withInviteThisWeek();
    useGameStore.setState({ state: s, npcActivityMap: {} });
    const first = render(<GameScreen />);
    fireEvent.click(within(card()).getByRole('button', { name: /^좋아/ }));
    first.unmount();
    render(<GameScreen />);
    expect(within(card()).getByRole('button', { name: /^좋아/ }).getAttribute('aria-pressed'), '답은 남았다').toBe('true');
    fireEvent.click(screen.getByTestId('week-confirm'));
    expect(now().lastWeekendPlan?.activities[inv.slotIdx], 'week_card_remount: 칸이 되살아났다').toBe(inv.activityId);
    expect(now().weekLog?.messages.some(m => m.startsWith('📌')), '약속을 지켰다').toBe(true);
    expect(now().weekLog?.messages.some(m => m.startsWith('💔')), '−2가 없다').toBe(false);
  });

  it('week_card_no_money: 수락하면 돈 때문에 확정이 잠기는 판엔 [좋아]가 잠기고 이유가 보인다 — [다음에]는 된다', () => {
    const { s, inv } = withInviteThisWeek();
    expect(inv.activityId, '전제: 유료 초대(친구와 놀기)').toBe('hang-out');
    s.money = 0;
    useGameStore.setState({ state: s, npcActivityMap: {} });
    render(<GameScreen />);
    expect((screen.getByTestId('week-confirm') as HTMLButtonElement).disabled, '전제: 수락 전엔 확정할 수 있다').toBe(false);
    const yes = within(card()).getByRole('button', { name: /^좋아/ }) as HTMLButtonElement;
    expect(yes.disabled, 'week_card_no_money: 잠금').toBe(true);
    expect(within(card()).getByTestId('invite-accept-blocked').textContent).toContain('돈이 모자라');
    fireEvent.click(yes);
    expect(now().weekInviteAnswers, '눌러도 답이 안 남는다').toBeUndefined();
    expect((within(card()).getByRole('button', { name: '다음에' }) as HTMLButtonElement).disabled, '[다음에]는 된다').toBe(false);
  });

  it('week_card_money_ok: 돈이 넉넉하면 잠금 줄이 없다(양성 짝)', () => {
    const { s } = withInviteThisWeek();
    useGameStore.setState({ state: s, npcActivityMap: {} });
    render(<GameScreen />);
    expect(within(card()).queryByTestId('invite-accept-blocked')).toBeNull();
    expect((within(card()).getByRole('button', { name: /^좋아/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('week_card_over_multi: 「지난주처럼」으로 푹 쉬기(2칸)가 깔린 주말에 수락하면 푹 쉬기를 비우고 약속 칸만 남긴다', () => {
    const { s, inv } = withInviteThisWeek();
    s.lastWeekendPlan = { activities: ['deep-rest', 'deep-rest'], npcChoices: {}, isVacation: false };
    useGameStore.setState({ state: s, npcActivityMap: {} });
    render(<GameScreen />);
    fireEvent.click(screen.getByRole('button', { name: /지난주처럼 채우기/ }));
    fireEvent.click(within(card()).getByRole('button', { name: /^좋아/ }));
    fireEvent.click(screen.getByTestId('week-confirm'));
    const played = now().lastWeekendPlan!.activities;
    expect(played[inv.slotIdx], '약속 칸').toBe(inv.activityId);
    expect(played.includes('deep-rest'), 'week_card_over_multi: 2칸 활동이 남지 않는다').toBe(false);
  });

  it('plan_pin_over_multi: 계획 화면에서 약속 주에 2칸 활동을 고르면 약속 칸이 이기고 2칸 활동은 남지 않는다', async () => {
    const { s, inv } = withInviteThisWeek();
    useGameStore.setState({ state: s, npcActivityMap: {} });
    render(<GameScreen />);
    fireEvent.click(within(card()).getByRole('button', { name: /^좋아/ }));
    fireEvent.click(screen.getByTestId('month-plan-open'));
    await waitFor(() => screen.getByTestId('month-plan'));
    pickInto(`slot-5-${1 - inv.slotIdx}`, 'deep-rest');
    for (const other of screen.queryAllByTestId(/^invite-/).filter(el => el !== screen.getByTestId(`invite-${inv.npcId}`))) {
      fireEvent.click(within(other).getByRole('button', { name: '다음에' }));
    }
    fireEvent.click(screen.getByRole('button', { name: '계획 저장' }));
    await waitFor(() => screen.getByTestId('month-plan-strip'));
    const w5 = now().monthPlan!.weeks.find(w => w.week === 5)!.activities;
    expect(w5[inv.slotIdx], '약속 칸').toBe(inv.activityId);
    expect(w5.includes('deep-rest'), 'plan_pin_over_multi').toBe(false);
  });
});
