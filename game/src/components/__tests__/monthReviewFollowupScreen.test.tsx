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
  /** 주간 화면이 넘기는 값과 같은 꼴: 쓸 수 있는 돈 − 지금 루틴비(0, 자습 선불) − 이번 주 주말에 고른 비용. */
  function openRoutine(s: GameState, weekendCost = 0) {
    render(<SlotEditPopup editingSlot="routine1" setEditingSlot={vi.fn()} state={s} activities={getAvailableActivities(s)}
      selectedActivities={[]} setSelectedActivities={vi.fn()} npcChoices={{}} maxSlots={2} currentSlots={0}
      availableMoney={s.money - weekendCost} onSetRoutine={vi.fn()} setNpcSelectFor={vi.fn()} setLastReaction={vi.fn()} />);
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

  it('이번 주 주말에 고른 비용은 빼고 잰다 — 잔액으로는 한 달 몫이 되어도 주말 몫을 쓰면 안 되면 못 고른다', () => {
    // 잔액 전체로 재던 1차 수정의 회귀(3자 재검수): 주말 과외비까지 학원비로 내고, 과외는 확정에서 돈 부족으로 빠졌다.
    const s = w6({ money: weekly() * 4 });
    openRoutine(s, weekly() * 2);
    expect(activityButton('academy').hasAttribute('disabled')).toBe(true);
    cleanup();
    openRoutine(s, weekly());
    expect(activityButton('academy').hasAttribute('disabled'), '경계: 남은 돈 = 한 달 몫').toBe(false);
  });

  it('지금 낼 루틴비가 있는 칸을 바꿀 때는 그 몫을 되돌려 놓고 잰다(바꾸면 옛 몫 대신 새 몫을 낸다)', () => {
    // 학원(미납)을 인강으로 바꾸는 판 — 주간 화면이 넘기는 돈은 학원 몫을 이미 뺀 값이다.
    const s = w6({ routineSlot2: 'academy', routinePrepaid: undefined, money: weekly() * 3 });
    const academyDue = weekly() * 3;
    render(<SlotEditPopup editingSlot="routine1" setEditingSlot={vi.fn()} state={s} activities={getAvailableActivities(s)}
      selectedActivities={[]} setSelectedActivities={vi.fn()} npcChoices={{}} maxSlots={2} currentSlots={0}
      availableMoney={s.money - academyDue} onSetRoutine={vi.fn()} setNpcSelectFor={vi.fn()} setLastReaction={vi.fn()} />);
    expect(activityButton('internet-lecture').hasAttribute('disabled')).toBe(false);
  });

  it('저녁 칸에 있던 활동을 방과후로 옮기면 저녁 칸은 비므로 한 칸 몫만 잰다', () => {
    // routine1에 저녁 칸 활동을 고르면 onToggle이 저녁 칸을 비운다 — 비용도 그 상태로 재야 한다.
    const gym = getActivityCost(ACTIVITIES.find(a => a.id === 'gym')!, 2);
    const s = w6({ routineSlot3: 'gym', money: gym * 3 + 1 });
    const currentDue = gym * 3; // 저녁 헬스 미납
    render(<SlotEditPopup editingSlot="routine1" setEditingSlot={vi.fn()} state={s} activities={getAvailableActivities(s)}
      selectedActivities={[]} setSelectedActivities={vi.fn()} npcChoices={{}} maxSlots={2} currentSlots={0}
      availableMoney={s.money - currentDue} onSetRoutine={vi.fn()} setNpcSelectFor={vi.fn()} setLastReaction={vi.fn()} />);
    expect(getRoutineSwitchCost(s, 'gym', null), '전제').toBe(gym * 3);
    expect(activityButton('gym').hasAttribute('disabled')).toBe(false);
  });

  it('계획 화면 — 주말 초안에 잡은 돈은 루틴에 못 쓴다', () => {
    const s = w6({ money: weekly() * 3 + getActivityCost(ACTIVITIES.find(a => a.id === 'art-lesson')!, 2) - 1 });
    render(<MonthPlanScreen state={s} onSetRoutine={vi.fn()} onStart={vi.fn(() => null)} />);
    for (const b of screen.queryAllByRole('button', { name: '다음에' })) fireEvent.click(b);
    pickInto('slot-6-0', 'art-lesson');
    fireEvent.click(screen.getAllByRole('button').find(b => (b.textContent ?? '').includes('①'))!);
    expect(activityButton('academy').hasAttribute('disabled')).toBe(true);
  });

  it('아직 안 받은 주말 알바 수입으로는 학원비를 못 낸다 — 지금 잔액으로 낼 수 있어야 고를 수 있다', () => {
    // 주간 화면이 넘기는 돈은 주말 알바(음수 비용)만큼 커진다. 그 돈은 주말에야 들어오는데 학원비는 고르는 순간 낸다.
    const s = w6({ money: weekly() * 2 });
    openRoutine(s, -weekly() * 2); // 주말 알바 수입 몫만큼 커진 availableMoney
    expect(activityButton('academy').hasAttribute('disabled')).toBe(true);
  });

  it('방과후 학원비를 못 내는 판에서도 저녁 칸에 무료 활동은 고를 수 있다(내야 할 돈이 늘지 않는다)', () => {
    const s = w6({ routineSlot2: 'academy', routinePrepaid: undefined, money: 1 });
    const academyDue = weekly() * 3;
    render(<SlotEditPopup editingSlot="routine2" setEditingSlot={vi.fn()} state={s} activities={getAvailableActivities(s)}
      selectedActivities={[]} setSelectedActivities={vi.fn()} npcChoices={{}} maxSlots={2} currentSlots={0}
      availableMoney={s.money - academyDue} onSetRoutine={vi.fn()} setNpcSelectFor={vi.fn()} setLastReaction={vi.fn()} />);
    const reading = activityButton('reading');
    expect(reading.hasAttribute('disabled')).toBe(false);
    expect(reading.textContent).not.toContain('부족');
    expect(activityButton('internet-lecture').hasAttribute('disabled'), '유료 저녁은 여전히 막힌다').toBe(true);
  });

  it('잠기지 않은 판에서 저녁 알바를 무료 활동으로 바꿔 그 주 수입이 사라지면 주말 몫이 모자라 막는다', () => {
    // 학원(미납) 몫은 잔액으로 낼 수 있고, 주말 미술 레슨은 저녁 알바 수입으로 낸다. 독서로 바꾸면 내야 할 돈은 같지만
    // 수입이 사라져 레슨이 돈 부족으로 빠진다 — "늘지 않는 전환" 예외가 이 판까지 열면 고르게 해 놓고 잠근다(4차 검수).
    const job = ACTIVITIES.find(a => a.id === 'part-time')!;
    expect(getActivityCost(job, 4) < 0, '전제: 알바는 수입(음수 비용)').toBe(true);
    const art = getActivityCost(ACTIVITIES.find(a => a.id === 'art-lesson')!, 4);
    const academy4 = getActivityCost(ACTIVITIES.find(a => a.id === 'academy')!, 4);
    const s = w6({ year: 4, routineSlot2: 'academy', routineSlot3: 'part-time', routinePrepaid: undefined });
    const due = academy4 * 3;
    s.money = due;
    const available = s.money - due - art; // 주간 화면 식: 쓸 수 있는 돈 − 지금 루틴비 − 주말(레슨)
    render(<SlotEditPopup editingSlot="routine2" setEditingSlot={vi.fn()} state={s} activities={getAvailableActivities(s)}
      selectedActivities={[]} setSelectedActivities={vi.fn()} npcChoices={{}} maxSlots={2} currentSlots={0}
      availableMoney={available} onSetRoutine={vi.fn()} setNpcSelectFor={vi.fn()} setLastReaction={vi.fn()} />);
    expect(getRoutineSwitchCost(s, 'academy', 'reading'), '전제: 내야 할 돈은 같다').toBe(due);
    expect(activityButton('reading').hasAttribute('disabled')).toBe(true);
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
    // 두 칸 다 같은 동행 활동 — 키가 "칸의 활동"이 아니라 "어느 칸에든 있는 활동"과 맞는지만 보면 옛 키가 산다.
    const acts = [other, other];
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

describe('계획 화면 — 방학 횟수는 편집 중인 주를 두 번 세지 않는다', () => {
  it('방학당 2회 「학원 단기특강」을 8월 1주에 하나 넣고, 같은 주 다른 칸에서 다시 고를 수 있다', () => {
    const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 5 });
    Object.assign(s, { year: 2, week: 21, phase: 'weekday' as const, isVacation: true, routineSlot2: 'self-study', money: 200 });
    payMonthStart(s);
    expect(ACTIVITIES.find(a => a.id === 'intensive-academy')!.vacationLimit, '전제: 방학당 2회').toBe(2);
    render(<MonthPlanScreen state={s} onSetRoutine={vi.fn()} onStart={vi.fn(() => null)} />);
    pickInto('slot-21-0', 'intensive-academy');
    fireEvent.click(screen.getByTestId('slot-21-2'));
    expect(activityButton('intensive-academy').hasAttribute('disabled')).toBe(false);
  });
});

describe('계획 화면 — 복사·「지난주처럼」도 방학당 횟수를 넘기지 않는다', () => {
  it('8월 1주의 「시골/할머니댁」을 「모든 주 똑같이」로 복사하면 2~4주는 비고, 계획이 엔진 검증을 통과한다', () => {
    // 피커의 한도 판정만으로는 복사 경로를 못 막았다 — 4주 모두 저장되고 재생이 2~4주를 건너뛰었다(3자 재검수).
    const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 5 });
    Object.assign(s, { year: 2, week: 21, phase: 'weekday' as const, isVacation: true, routineSlot2: 'self-study', money: 200 });
    payMonthStart(s);
    const onStart = vi.fn<(p: MonthPlan) => string | null>(() => null);
    render(<MonthPlanScreen state={s} onSetRoutine={vi.fn()} onStart={onStart} />);
    pickInto('slot-21-0', 'countryside');
    fireEvent.click(screen.getByRole('button', { name: '모든 주 똑같이' }));
    for (const b of screen.queryAllByRole('button', { name: '다음에' })) fireEvent.click(b); // 초대는 거절(이 테스트의 축이 아니다)
    fireEvent.click(screen.getByRole('button', { name: '이번 달 시작' }));
    const plan = onStart.mock.calls[0][0];
    const uses = plan.weeks.filter(w => w.activities.includes('countryside')).map(w => w.week);
    expect(uses).toEqual([21]);
    expect(validateMonthPlan(s, plan)).toBeNull();
  });
});

describe('계획 화면 — 「지난주처럼」·이미 쓴 방학 횟수도 센다', () => {
  function august(patch: Partial<GameState> = {}): GameState {
    const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 5 });
    Object.assign(s, { year: 2, week: 21, phase: 'weekday' as const, isVacation: true, routineSlot2: 'self-study', money: 200 }, patch);
    payMonthStart(s);
    return s;
  }
  function startWith(s: GameState, act: () => void): MonthPlan {
    const onStart = vi.fn<(p: MonthPlan) => string | null>(() => null);
    render(<MonthPlanScreen state={s} onSetRoutine={vi.fn()} onStart={onStart} />);
    act();
    for (const b of screen.queryAllByRole('button', { name: '다음에' })) fireEvent.click(b);
    fireEvent.click(screen.getByRole('button', { name: '이번 달 시작' }));
    return onStart.mock.calls[0][0];
  }
  const weeksWith = (p: MonthPlan, id: string) => p.weeks.filter(w => w.activities.includes(id)).map(w => w.week);

  it('「지난주처럼」(방학 스냅샷에 시골)도 첫 주 한 번만 남긴다', () => {
    const s = august({ lastWeekendPlan: { activities: ['countryside', 'countryside', 'countryside', 'rest', 'rest'], npcChoices: {}, isVacation: true } });
    expect(weeksWith(startWith(s, () => fireEvent.click(screen.getByRole('button', { name: '지난주처럼 채우기' }))), 'countryside')).toEqual([21]);
  });

  it('이번 방학에 이미 시골을 다녀왔으면(vacationActivityCounts) 복사해도 한 주도 남지 않는다', () => {
    const s = august({
      vacationActivityCounts: { countryside: 1 },
      lastWeekendPlan: { activities: ['countryside', 'countryside', 'countryside', 'rest', 'rest'], npcChoices: {}, isVacation: true },
    });
    expect(weeksWith(startWith(s, () => fireEvent.click(screen.getByRole('button', { name: '지난주처럼 채우기' }))), 'countryside')).toEqual([]);
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
    // W6~W8 중 W6에 그 금액만큼 유료 활동을 예약한 계획(같은 활동을 칸 수만큼).
    const paid = ACTIVITIES.find(a => a.id === 'art-lesson')!;
    const n = Math.round(reserve / getActivityCost(paid, 2));
    return {
      year: 2, month: getMonthBlock(6).index, invites: [],
      // 이번 주(W6)에 잡은 예약 — 잠금(canSpend)은 이번 주 예약까지 뺀다. 문구 조건이 "다음 주부터"만 보면 여기서 갈린다.
      weeks: [6, 7, 8].map(week => ({ week, activities: week === 6 ? Array(n).fill('art-lesson') : ['rest', 'rest'], npcChoices: {} })),
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
