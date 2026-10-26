// @vitest-environment jsdom
// PR #523 3자 검수 후속 — 화면 쪽. 엔진 쪽은 engine/__tests__/monthReviewFollowup.test.ts.
//   · 루틴 피커가 주 단가가 아니라 "지금 낼 돈"(한 달 등록)으로 고를 수 있는지 본다 — 플래그 꺼짐에도 나가는 경로
//   · 계획 화면: 초대 수락·복사·「지난주처럼」이 낡은 동행 키를 남기지 않는다 / 방학당 횟수는 달 전체로 센다 / 학기 목표
//   · 선택지 부족 문구가 잠금과 같은 값(봉투를 뺀 돈)을 말한다
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p, cgThumbSrc: (p: string) => p }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));

import { GameScreen } from '../GameScreen';
import { MonthPlanScreen } from '../screens/main/MonthPlanScreen';
import { useGameStore } from '../../engine/store';
import { MONTHLY_PLANNING_KEY } from '../../engine/featureFlags';
import { SlotEditPopup } from '../screens/main/SlotEditPopup';
import { EventScene } from '../EventScene';
import { createInitialState } from '../../engine/gameEngine';
import { ACTIVITIES, NPC_COMPANION_ACTIVITIES, getActivityCost, getAvailableActivities } from '../../engine/activities';
import { getRoutineSwitchCost, payMonthStart } from '../../engine/monthlyMoney';
import { validateMonthPlan } from '../../engine/monthPlan';
import { generateMonthInvites, validateInviteAnswers } from '../../engine/monthInvites';
import { canPickSemesterGoal } from '../../engine/semesterGoal';
import { getMonthBlock, getWeekInfo } from '../../engine/weekMath';
import { makeChoice, makeEvent, makeState } from '../../test/fixtures';
import type { GameState, MonthPlan } from '../../engine/types';

const CAT_LABEL: Record<string, string> = {
  study: '공부', exercise: '운동', social: '관계', talent: '자기계발', rest: '휴식', parent: '가족', work: '알바',
};

/** 피커에서 활동 버튼을 찾는다(카테고리를 펼친 뒤). */
function activityButton(id: string): HTMLElement {
  const act = ACTIVITIES.find(a => a.id === id)!;
  const header = screen.getAllByRole('button').find(el => el.getAttribute('aria-expanded') !== null
    && (el.textContent ?? '').includes(CAT_LABEL[act.category]));
  if (!header) throw new Error(`카테고리 헤더 없음: ${act.category}`);
  if (header.getAttribute('aria-expanded') === 'false') fireEvent.click(header);
  const btn = screen.getAllByRole('button').find(el => el.getAttribute('aria-pressed') != null
    && !(el.textContent ?? '').includes('수치') && (el.textContent ?? '').includes(act.name));
  if (!btn) throw new Error(`활동 버튼 없음: ${act.name}`);
  return btn;
}

function pickInto(slotTestId: string, id: string) {
  fireEvent.click(screen.getByTestId(slotTestId));
  fireEvent.click(activityButton(id));
}

beforeEach(() => {
  cleanup();
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  localStorage.setItem('lifetrack_rest_ack', '1');
});

describe('루틴 피커 — 고를 수 있나를 "지금 낼 돈"으로 본다(플래그 꺼짐에도 나가는 경로)', () => {
  /** Y2 W6, 자습(무료)이 이번 달 몫으로 결제된 판. */
  function w6(patch: Partial<GameState> = {}): GameState {
    const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 3 });
    return Object.assign(s, {
      year: 2, week: 6, phase: 'weekday' as const, isVacation: false, routineSlot2: 'self-study', routineSlot3: null,
      monthlyMoney: true, routinePrepaid: { year: 2, month: getMonthBlock(6).index, slot2: 'self-study', slot3: null },
    }, patch);
  }
  function openRoutine(s: GameState) {
    render(<SlotEditPopup editingSlot="routine1" setEditingSlot={vi.fn()} state={s} activities={getAvailableActivities(s)}
      selectedActivities={[]} setSelectedActivities={vi.fn()} npcChoices={{}} maxSlots={2} currentSlots={0}
      availableMoney={s.money} onSetRoutine={vi.fn()} setNpcSelectFor={vi.fn()} setLastReaction={vi.fn()} />);
  }
  const weekly = () => getActivityCost(ACTIVITIES.find(a => a.id === 'academy')!, 2);

  it('잔액이 주 단가는 되고 한 달 몫(남은 3주)은 안 되면 학원을 못 고른다 — 이번 달 금액과 부족 표시', () => {
    const s = w6({ money: weekly() * 2 });
    const monthly = getRoutineSwitchCost(s, 'academy', null);
    expect(monthly, '전제: 남은 3주 × 단가').toBe(weekly() * 3);
    openRoutine(s);
    const btn = activityButton('academy');
    expect(btn.hasAttribute('disabled')).toBe(true);
    expect(btn.textContent).toContain(`이번 달 ${monthly}만`);
    expect(btn.textContent).toContain('부족');
  });

  it('한 달 몫이 있으면 고를 수 있다', () => {
    const s = w6({ money: weekly() * 3 });
    openRoutine(s);
    expect(activityButton('academy').hasAttribute('disabled')).toBe(false);
  });

  it('아직 매주 방식인 구세이브는 예전처럼 주 단가로 본다', () => {
    const s = w6({ money: weekly() * 2, monthlyMoney: undefined, routinePrepaid: undefined });
    openRoutine(s);
    const btn = activityButton('academy');
    expect(btn.hasAttribute('disabled')).toBe(false);
    expect(btn.textContent).not.toContain('이번 달');
  });
});

describe('계획 화면 — 동행 키는 칸의 활동과 늘 맞는다', () => {
  function aprilWithInvite(): GameState {
    for (let seed = 0; seed < 2000; seed++) {
      const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: seed });
      Object.assign(s, { year: 2, week: 5, phase: 'weekday' as const, isVacation: false, routineSlot2: 'self-study', routineSlot3: null, money: 40 });
      payMonthStart(s);
      for (const [id, v] of [['jihun', 40], ['subin', 35]] as const) {
        const npc = s.npcs.find(x => x.id === id)!;
        npc.met = true;
        npc.intimacy = v;
      }
      if (generateMonthInvites(s).length === 1) return s;
    }
    throw new Error('시드 없음');
  }

  it('「지난주처럼」으로 다른 동행 활동을 채운 칸 위로 초대를 수락하고 복사해도 — 계획이 엔진 검증을 통과한다', () => {
    const s = aprilWithInvite();
    const [inv] = generateMonthInvites(s);
    const other = NPC_COMPANION_ACTIVITIES.find(id => id !== inv.activityId)!;
    const friend = inv.npcId === 'jihun' ? 'subin' : 'jihun';
    const acts = ['rest', 'rest'];
    acts[inv.slotIdx] = other;
    s.lastWeekendPlan = { activities: acts, npcChoices: { [`${other}:${inv.slotIdx}`]: friend }, isVacation: false };
    const onStart = vi.fn<(p: MonthPlan) => string | null>(() => null);
    render(<MonthPlanScreen state={s} onSetRoutine={vi.fn()} onStart={onStart} />);

    fireEvent.click(screen.getByRole('button', { name: '지난주처럼 채우기' }));
    fireEvent.click(within(screen.getByTestId(`invite-${inv.npcId}`)).getByRole('button', { name: /좋아/ }));
    fireEvent.click(screen.getByRole('button', { name: '모든 주 똑같이' }));
    fireEvent.click(screen.getByRole('button', { name: '이번 달 시작' }));

    const plan = onStart.mock.calls[0][0];
    const wk = plan.weeks.find(w => w.week === inv.week)!;
    expect(wk.activities[inv.slotIdx]).toBe(inv.activityId);
    expect(wk.npcChoices).toEqual(expect.objectContaining({ [`${inv.activityId}:${inv.slotIdx}`]: inv.npcId }));
    expect(Object.keys(wk.npcChoices), '그 칸을 가리키던 옛 동행 키가 남았다').not.toContain(`${other}:${inv.slotIdx}`);
    expect(validateMonthPlan(s, plan), '화면이 만든 계획을 엔진이 거부했다').toBeNull();
    expect(validateInviteAnswers(s, plan)).toBeNull();
  });
});

describe('계획 화면 — 방학당 횟수 제한은 달 전체를 센다', () => {
  it('8월 1주에 「시골/할머니댁」(방학당 1회)을 넣으면 2주 칸에서는 고를 수 없다', () => {
    const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 5 });
    Object.assign(s, { year: 2, week: 21, phase: 'weekday' as const, isVacation: getWeekInfo(21).isVacation, routineSlot2: 'self-study', money: 200 });
    payMonthStart(s);
    expect(s.isVacation, '전제: 8월은 방학').toBe(true);
    render(<MonthPlanScreen state={s} onSetRoutine={vi.fn()} onStart={vi.fn(() => null)} />);
    pickInto('slot-21-0', 'countryside');
    fireEvent.click(screen.getAllByRole('button', { expanded: false }).find(b => b.textContent?.startsWith('2주'))!);
    fireEvent.click(screen.getByTestId('slot-22-0'));
    const btn = activityButton('countryside');
    expect(btn.hasAttribute('disabled')).toBe(true);
    expect(btn.textContent).toContain('이번 방학 한도 도달');
  });
});

describe('계획 화면 — 학기 목표를 여기서 고른다(재생이 고르기 창 두 주를 카드로 지나가므로)', () => {
  it('학기 첫 주(W1)에 목표 칩이 뜨고, 고르면 onChooseGoal로 간다 · 핸들러가 없으면 안 뜬다', () => {
    const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 9 });
    Object.assign(s, { year: 2, week: 1, phase: 'weekday' as const, isVacation: false, routineSlot2: 'self-study', money: 40 });
    expect(canPickSemesterGoal(s), '전제: W1은 고르기 창').toBe(true);
    const onChooseGoal = vi.fn(() => true);
    const { unmount } = render(<MonthPlanScreen state={s} onSetRoutine={vi.fn()} onStart={vi.fn(() => null)} onChooseGoal={onChooseGoal} />);
    expect(screen.getByTestId('semester-goal-chip')).toBeTruthy();
    fireEvent.click(screen.getByTestId('semester-goal-chip'));
    // 후보는 role="listitem" 버튼이다 — testid로 찾는다.
    const offers = screen.getAllByTestId(/^semester-goal-offer-/);
    expect(offers.length, '목표 후보가 없다').toBeGreaterThan(0);
    fireEvent.click(offers[0]);
    expect(onChooseGoal).toHaveBeenCalledTimes(1);
    unmount();
    render(<MonthPlanScreen state={s} onSetRoutine={vi.fn()} onStart={vi.fn(() => null)} />);
    expect(screen.queryByTestId('semester-goal-chip')).toBeNull();
  });

  it('배선 — 플래그를 켠 게임 화면의 계획 화면에서 목표를 고르면 store에 학기 목표가 생긴다', () => {
    localStorage.setItem(MONTHLY_PLANNING_KEY, '1');
    const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 9 });
    Object.assign(s, { year: 2, week: 1, phase: 'weekday' as const, isVacation: false, routineSlot2: 'self-study', money: 40, monthlyMoney: true });
    useGameStore.setState({ state: s, npcActivityMap: {} });
    render(<GameScreen />);
    expect(screen.getByTestId('month-plan')).toBeTruthy();
    fireEvent.click(within(screen.getByTestId('month-plan')).getByTestId('semester-goal-chip'));
    fireEvent.click(screen.getAllByTestId(/^semester-goal-offer-/)[0]);
    expect(useGameStore.getState().state!.semesterGoal).toBeTruthy();
  });
});

describe('선택지 부족 문구 — 잠금과 같은 값을 말한다', () => {
  function planned(reserve: number): MonthPlan {
    // W6~W8 중 W7에 그 금액만큼 유료 활동을 예약한 계획(같은 활동을 칸 수만큼).
    const paid = ACTIVITIES.find(a => a.id === 'art-lesson')!;
    const n = Math.round(reserve / getActivityCost(paid, 2));
    return {
      year: 2, month: getMonthBlock(6).index, invites: [],
      weeks: [6, 7, 8].map(week => ({ week, activities: week === 7 ? Array(n).fill('art-lesson') : ['rest', 'rest'], npcChoices: {} })),
    };
  }

  it('한 달 계획에 떼어 둔 돈이 있으면 "쓸 수 있는 돈"으로 말한다', () => {
    const state = makeState({ year: 2, week: 6, money: 20 });
    state.monthPlan = planned(getActivityCost(ACTIVITIES.find(a => a.id === 'art-lesson')!, 2) * 2);
    render(<EventScene event={makeEvent({ choices: [makeChoice({ text: '선물을 산다', moneyEffect: -18 }), makeChoice({ text: '그냥 간다' })] })}
      gender="male" year={2} onChoice={vi.fn()} state={state} />);
    expect(screen.getByText('선물을 산다').closest('button')).toBeDisabled();
    expect(screen.getByText(/쓸 수 있는 돈 \d+만 \/ 필요 18만/)).toBeInTheDocument();
    expect(screen.queryByText(/보유 20만/)).toBeNull();
  });

  it('계획이 없으면 예전 문구 그대로(보유 잔액)', () => {
    render(<EventScene event={makeEvent({ choices: [makeChoice({ text: '한턱 쏜다', moneyEffect: -50 }), makeChoice({ text: '구경만 한다' })] })}
      gender="male" year={1} onChoice={vi.fn()} state={makeState({ money: 10 })} />);
    expect(screen.getByText(/돈이 부족합니다 \(보유 10만 \/ 필요 50만\)/)).toBeInTheDocument();
  });
});
