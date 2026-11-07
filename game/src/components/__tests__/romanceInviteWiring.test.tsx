// @vitest-environment jsdom
// 연인 말투가 실제 화면에 나간다 — 표·함수만 잠그면 화면이 dating을 안 넘겨도 초록이다.
// 주간 화면(계획 없는 달의 이번 주 초대)·월 계획 화면 두 경로와 친구 카드의 재고백 표시를 본다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p, cgThumbSrc: (p: string) => p }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
import { GameScreen } from '../GameScreen';
import { MonthPlanScreen } from '../screens/main/MonthPlanScreen';
import { NpcRelationPanel } from '../screens/main/NpcRelationPanel';
import { useGameStore } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { generateMonthInvites } from '../../engine/monthInvites';
import { ROMANCE_INVITE_VOICES, inviteVoice } from '../../engine/talkData/inviteVoices';
import { canStartRomanceRetry } from '../../engine/romance';
import { GAME_EVENTS } from '../../engine/events';
import type { GameEvent, GameState } from '../../engine/types';

beforeEach(() => {
  cleanup(); localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  localStorage.setItem('lifetrack_month_tutorial_seen', '1');
  localStorage.setItem('lifetrack_monthly_planning', '0');
  localStorage.setItem('lifetrack_rest_ack', '1');
  useGameStore.setState({ state: null, npcActivityMap: {}, runDelta: null });
});

const WEEK = 29; // Y6 2학기, 달 첫 주
/** 지훈만 만난 Y6 여주 판 — 이번 주(W29)에 지훈 초대가 잡히는 시드를 찾는다. */
function jihunInviteState(dating: boolean): GameState {
  for (let seed = 1; seed < 3000; seed++) {
    const s = createInitialState('female', ['emotional', 'info'], { rngSeed: seed });
    Object.assign(s, { year: 6, week: WEEK, phase: 'weekday', currentEvent: null, isVacation: false, money: 100,
      routineSlot2: 'self-study', routineSlot3: 'self-study',
      relationship: dating ? { npcId: 'jihun', status: 'dating', year: 6, week: 20 } : undefined });
    s.npcs.forEach(n => { n.met = n.id === 'jihun'; n.intimacy = n.id === 'jihun' ? 95 : 0; });
    if (generateMonthInvites(s).some(i => i.npcId === 'jihun' && i.week === WEEK)) return s;
  }
  throw new Error('W29 지훈 초대 시드가 없다');
}
const romanceHangOut = ROMANCE_INVITE_VOICES.jihun.hangOut.concat(ROMANCE_INVITE_VOICES.jihun.study).map(l => l.split('{when}')[1]);
const generalHangOut = inviteVoice('jihun').hangOut.concat(inviteVoice('jihun').study).map(l => l.split('{when}')[1]);
const has = (text: string, tails: string[]) => tails.some(t => text.includes(t));

describe('주간 화면 초대 카드', () => {
  it.each([true, false])('연애 중(%s)이면 연인 초대·거절 줄, 아니면 원래 줄', dating => {
    // 초대는 월 단위 모드의 주간 화면에 뜬다(weekInviteScreen.test.tsx와 같은 설정).
    localStorage.setItem('lifetrack_monthly_planning', '1');
    useGameStore.setState({ state: { ...jihunInviteState(dating), monthlyMoney: true } });
    render(<GameScreen />);
    const card = within(screen.getByTestId('week-invite')).getByTestId('invite-jihun');
    expect(has(card.textContent!, romanceHangOut), '연인 초대 줄').toBe(dating);
    expect(has(card.textContent!, generalHangOut), '원래 초대 줄').toBe(!dating);
    fireEvent.click(within(card).getByRole('button', { name: '다음에' }));
    expect(ROMANCE_INVITE_VOICES.jihun.decline.some(l => card.textContent!.includes(l)), '연인 거절 줄').toBe(dating);
    expect(card.textContent!.includes(inviteVoice('jihun').decline), '원래 거절 줄').toBe(!dating);
  });
});

describe('월 계획 화면 초대 카드', () => {
  it.each([true, false])('연애 중(%s)이면 연인 초대 줄', dating => {
    render(<MonthPlanScreen state={jihunInviteState(dating)} onSetRoutine={() => {}} onStart={() => null} />);
    const card = screen.getByTestId('invite-jihun');
    expect(has(card.textContent!, romanceHangOut)).toBe(dating);
    expect(has(card.textContent!, generalHangOut)).toBe(!dating);
  });
});

describe('친구 카드 재고백 표시', () => {
  /** 지훈 고백을 보류(선택 1)하고 몇 주 뒤의 판. */
  function deferred(weeksAfter: number): GameState {
    const s = createInitialState('female', ['emotional', 'info'], { rngSeed: 42 });
    Object.assign(s, { year: 6, week: 30 + weeksAfter, phase: 'weekday', currentEvent: null, isVacation: false });
    s.npcs.forEach(n => { n.met = n.id === 'jihun'; n.intimacy = n.id === 'jihun' ? 95 : 0; });
    const opening = GAME_EVENTS.find(e => e.id === 'jihun-hs-unsaid')!;
    s.events = [...s.events, { ...opening, year: 6, week: 30, resolvedChoice: 1 } as GameEvent];
    return s;
  }
  const hint = () => screen.queryByTestId('npc-romance-retry-jihun');

  it('재고백할 수 있으면 표시, 버튼이 이어져 있지 않으면 표시하지 않는다', () => {
    const s = deferred(4);
    expect(canStartRomanceRetry(s, 'jihun'), '전제: 4주 지남').toBe(true);
    const { rerender } = render(<NpcRelationPanel state={s} onSelect={() => {}} romanceRetryAvailable />);
    expect(hint()?.textContent).toBe('그때 이야기를 다시 꺼낼 수 있어요');
    rerender(<NpcRelationPanel state={s} onSelect={() => {}} />);
    expect(hint()).toBeNull();
  });

  it('4주가 안 지났으면 표시하지 않는다', () => {
    const s = deferred(3);
    expect(canStartRomanceRetry(s, 'jihun')).toBe(false);
    render(<NpcRelationPanel state={s} onSelect={() => {}} romanceRetryAvailable />);
    expect(hint()).toBeNull();
  });

  it('주간 화면의 친구 시트에 실제로 나간다', () => {
    useGameStore.setState({ state: { ...deferred(4), routineSlot2: 'self-study', routineSlot3: 'self-study', money: 100 } });
    render(<GameScreen />);
    fireEvent.click(screen.getByRole('button', { name: /친구 1명/ }));
    expect(hint()).not.toBeNull();
  });
});
