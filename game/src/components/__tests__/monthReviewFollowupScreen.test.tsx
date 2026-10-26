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
import { createInitialState, predictWeekOutcome } from '../../engine/gameEngine';
import { getConfirmGate } from '../../engine/weekendPlan';
import { ACTIVITIES, NPC_COMPANION_ACTIVITIES, getActivityCost, getAvailableActivities } from '../../engine/activities';
import { getRoutineSwitchCost, payMonthStart } from '../../engine/monthlyMoney';
import { validateMonthPlan } from '../../engine/monthPlan';
import { generateMonthInvites, validateInviteAnswers } from '../../engine/monthInvites';
import { canPickSemesterGoal } from '../../engine/semesterGoal';
import { getMonthBlock, getWeekInfo } from '../../engine/weekMath';
import { makeChoice, makeEvent, makeState } from '../../test/fixtures';
import type { GameState, MonthPlan } from '../../engine/types';

const ART_ID = 'art-lesson';
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

describe('루틴 피커 — 이 선택 때문에 이번 주를 확정할 수 없게 되면 막는다(엔진 판정, 플래그 꺼짐에도 나가는 경로)', () => {
  // 판정은 weekendPlan.makeRoutineChangeCheck — 바꾼 복제본에 setRoutine과 같은 결제를 하고 그 주 미리보기로 확정 잠금을 본다.
  // 화면 쪽 예산식은 3자 검수 3~5차에서 매번 새 어긋남이 나와(한 달 등록·루틴 알바 수입·주말 알바 수입·봉투) 버렸다.
  /** Y2 W6, 자습(무료)이 이번 달 몫으로 결제된 판. */
  function w6(patch: Partial<GameState> = {}): GameState {
    const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 3 });
    return Object.assign(s, {
      year: 2, week: 6, phase: 'weekday' as const, isVacation: false, routineSlot2: 'self-study', routineSlot3: null,
      monthlyMoney: true, routinePrepaid: { year: 2, month: getMonthBlock(6).index, slot2: 'self-study', slot3: null },
    }, patch);
  }
  /** 루틴 칸을 연다 — 주말은 그 주에 실제로 고른 칸(selectedActivities)이고, 판정은 그걸로 엔진을 돌린다. */
  function openRoutine(s: GameState, weekend: string[] = ['rest', 'rest'], slot: 'routine1' | 'routine2' = 'routine1') {
    render(<SlotEditPopup editingSlot={slot} setEditingSlot={vi.fn()} state={s} activities={getAvailableActivities(s)}
      selectedActivities={weekend} setSelectedActivities={vi.fn()} npcChoices={{}} maxSlots={2} currentSlots={0}
      availableMoney={s.money} onSetRoutine={vi.fn()} setNpcSelectFor={vi.fn()} setLastReaction={vi.fn()} />);
  }
  const cost = (id: string, year = 2) => getActivityCost(ACTIVITIES.find(a => a.id === id)!, year);
  const weekly = () => cost('academy');

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
    openRoutine(w6({ money: weekly() * 3 }));
    expect(activityButton('academy').hasAttribute('disabled')).toBe(false);
  });

  it('이번 주 주말에 고른 유료 활동 몫까지 학원비로 쓰게 되면 막는다 · 둘 다 되는 잔액이면 연다', () => {
    const art = cost(ART_ID);
    openRoutine(w6({ money: weekly() * 3 + art - 1 }), [ART_ID, 'rest']);
    expect(activityButton('academy').hasAttribute('disabled'), '학원을 내면 레슨이 돈 부족으로 빠진다').toBe(true);
    cleanup();
    openRoutine(w6({ money: weekly() * 3 + art }), [ART_ID, 'rest']);
    expect(activityButton('academy').hasAttribute('disabled'), '경계: 학원 + 레슨 = 잔액').toBe(false);
  });

  it('미납 학원을 인강으로 바꾸면 학원 몫 대신 인강 몫을 낸다 — 인강 몫이 되면 고를 수 있다', () => {
    openRoutine(w6({ routineSlot2: 'academy', routinePrepaid: undefined, money: cost('internet-lecture') * 3 }));
    expect(activityButton('internet-lecture').hasAttribute('disabled')).toBe(false);
  });

  it('저녁 칸에 있던 활동을 방과후로 옮기면 저녁 칸은 비므로 한 칸 몫만 잰다', () => {
    const gym = cost('gym');
    const s = w6({ routineSlot3: 'gym', money: gym * 3 });
    expect(getRoutineSwitchCost(s, 'gym', null), '전제').toBe(gym * 3);
    openRoutine(s);
    expect(activityButton('gym').hasAttribute('disabled')).toBe(false);
  });

  it('지금 잔액으로 못 내면 막는다 — 주말에 들어올 수입으로는 고르는 순간 내는 학원비를 못 낸다', () => {
    // 학원비는 고르는 순간(setRoutine) 낸다. 주말 수입이 넘겨받는 돈을 키워도 결제는 지금 잔액에서 거부된다.
    openRoutine(w6({ money: weekly() * 2 }));
    expect(activityButton('academy').hasAttribute('disabled')).toBe(true);
  });

  it('방과후 학원비를 못 내 이미 잠긴 판에서 저녁 칸 독서는 고를 수 있고 "부족"이라 하지 않는다', () => {
    const s = w6({ routineSlot2: 'academy', routinePrepaid: undefined, money: 1 });
    openRoutine(s, ['rest', 'rest'], 'routine2');
    const reading = activityButton('reading');
    expect(reading.hasAttribute('disabled')).toBe(false);
    expect(reading.textContent).not.toContain('부족');
  });

  it('이미 잠긴 판(주말 활동 값이 모자람)에 루틴 돈만 내고 끝나는 전환은 막는다 · 돈을 안 내는 전환은 연다', () => {
    // 잠금 사유는 주말의 비싼 활동. 헬스로 바꾸면 헬스비는 지금 내지는데 주말은 여전히 못 한다 — 돈만 빠지고 잠금은 그대로.
    // 달 마지막 주(W8)라 헬스는 한 주치만 낸다. 주말 레슨 둘은 잔액(헬스 한 주치)보다 비싸 바꾸기 전에 이미 잠겼다.
    const gym = cost('gym');
    const base = w6({ week: 8, money: gym });
    const weekend = [ART_ID, ART_ID];
    expect(cost(ART_ID) * 2 > gym, '전제: 레슨 둘 > 잔액').toBe(true);
    expect(getRoutineSwitchCost(base, 'self-study', 'gym'), '전제: 헬스 한 주치').toBe(gym);
    expect(getConfirmGate(base, predictWeekOutcome(base, weekend, {})).moneyBlocked, '전제: 바꾸기 전에 이미 잠김').toBe(true);
    openRoutine(base, weekend, 'routine2');
    expect(activityButton('gym').hasAttribute('disabled'), '헬스비를 내고도 잠긴 채').toBe(true);
    expect(activityButton('reading').hasAttribute('disabled'), '돈을 안 내는 전환').toBe(false);
  });

  it('주말 때문에 잠긴 판에서 저녁만 바꾸면(미납 방과후 학원비는 어차피 낸다) 막지 않는다', () => {
    // 5차 sub-agent: 저녁 독서를 고르면 setRoutine이 미납 학원비를 같이 내 "돈을 낸다"로 보였다 — 확정 때도 내는 돈이다.
    const art = cost(ART_ID);
    const due = weekly() * 3;
    const s = w6({ routineSlot2: 'academy', routinePrepaid: undefined, money: due + art - 1 });
    expect(getConfirmGate(s, predictWeekOutcome(s, [ART_ID, 'rest'], {})).moneyBlocked, '전제: 주말 레슨 때문에 잠김').toBe(true);
    openRoutine(s, [ART_ID, 'rest'], 'routine2');
    const reading = activityButton('reading');
    expect(reading.hasAttribute('disabled')).toBe(false);
    expect(reading.textContent).not.toContain('부족');
  });

  it('주말 때문에 잠긴 판에서 저녁 알바를 넣어 그 수입으로 풀리면 연다', () => {
    const due = cost('academy', 4) * 3;
    const s = w6({ year: 4, routineSlot2: 'academy', routinePrepaid: undefined, money: due + 1 });
    expect(getConfirmGate(s, predictWeekOutcome(s, [ART_ID, ART_ID], {})).moneyBlocked, '전제: 레슨 둘 때문에 잠김').toBe(true);
    openRoutine(s, [ART_ID, ART_ID], 'routine2');
    expect(activityButton('part-time').hasAttribute('disabled')).toBe(false);
  });

  it('잠기지 않은 판에서 저녁 알바를 독서로 바꿔 그 주 수입이 사라지면 주말 레슨이 빠지므로 막는다', () => {
    const job = cost('part-time', 4);
    expect(job < 0, '전제: 알바는 수입(음수 비용)').toBe(true);
    const due = cost('academy', 4) * 3;
    const s = w6({ year: 4, routineSlot2: 'academy', routineSlot3: 'part-time', routinePrepaid: undefined, money: due });
    openRoutine(s, [ART_ID, 'rest'], 'routine2');
    expect(activityButton('reading').hasAttribute('disabled')).toBe(true);
  });

  it('내야 할 돈이 0이어도(방과후 선불 완료) 저녁 알바를 독서로 바꿔 수입이 사라지면 막는다', () => {
    // 5차 cursor: "내야 할 돈"만 보는 식은 이 전환을 늘 열었다 — 돈은 안 내지만 그 주 수입이 사라진다.
    const s = w6({ year: 4, routineSlot3: 'part-time', money: 0 });
    expect(getRoutineSwitchCost(s, 'self-study', 'reading'), '전제: 내야 할 돈 0').toBe(0);
    expect(getConfirmGate(s, predictWeekOutcome(s, [ART_ID, 'rest'], {})).moneyBlocked, '전제: 알바 수입으로 레슨이 된다').toBe(false);
    openRoutine(s, [ART_ID, 'rest'], 'routine2');
    expect(activityButton('reading').hasAttribute('disabled')).toBe(true);
  });

  it('저녁 알바를 둔 채 방과후를 더 싼 루틴으로 바꾸면 알바 수입이 주말 전에 들어와 레슨까지 된다 — 연다', () => {
    // 5차 검수: 예산식은 루틴 알바 수입을 몰라 이 전환을 막았다.
    const s = w6({ year: 4, week: 8, routineSlot2: 'academy', routineSlot3: 'part-time', routinePrepaid: undefined, money: cost('academy', 4) });
    expect(getRoutineSwitchCost(s, 'gym', 'part-time'), '전제: 헬스 한 주치(W8)').toBe(cost('gym', 4));
    openRoutine(s, [ART_ID, 'rest']);
    expect(activityButton('gym').hasAttribute('disabled')).toBe(false);
  });

  it('계획 화면 — 다음 주 초안에 잡은 돈(아직 저장 전 봉투)은 루틴에 못 쓴다', () => {
    // 이번 주(W6) 초안은 판정이 주말 칸으로 직접 본다. 다음 주 초안은 저장 전이라 state.monthPlan에 없다 —
    // 초안을 계획으로 넣은 판(draftState)으로 재야 결제가 그 몫을 피한다.
    const s = w6({ money: weekly() * 3 + cost(ART_ID) - 1 });
    render(<MonthPlanScreen state={s} onSetRoutine={vi.fn()} onStart={vi.fn(() => null)} />);
    for (const b of screen.queryAllByRole('button', { name: '다음에' })) fireEvent.click(b);
    fireEvent.click(screen.getAllByRole('button', { expanded: false }).find(b => b.textContent?.startsWith('3주'))!);
    pickInto('slot-7-0', ART_ID);
    fireEvent.click(screen.getAllByRole('button').find(b => (b.textContent ?? '').includes('①'))!);
    expect(activityButton('academy').hasAttribute('disabled')).toBe(true);
  });

  it('아직 매주 방식인 구세이브는 예전처럼 주 단가로 본다', () => {
    openRoutine(w6({ money: weekly() * 2, monthlyMoney: undefined, routinePrepaid: undefined }));
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
