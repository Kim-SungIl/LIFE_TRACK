// @vitest-environment jsdom
// "지난주처럼" 버튼의 **렌더 배선** 계약 — 판정(weekendPlan.test.ts)과는 다른 층이다.
//
// 판정 함수만 잠그면 "버튼을 아무도 안 그리는" 상태가 그대로 초록이다(#397: useAudioUnlock
// 호출을 지워도 547개가 전부 통과 = 게임 전체 무음). 그래서 여기서는 실제로 그려지는지,
// 눌렀을 때 슬롯이 차는지, 그리고 **확정은 안 되는지**를 본다.
//
// 확정 금지가 이 기능의 핵심 제약이다 — 유료 주말 활동이 1탭으로 확정되면 플레이어가
// 모르는 사이에 돈이 나간다.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MainWeekScreen } from '../MainWeekScreen';
import { makeState } from '../../../../test/fixtures';
import { getBackground } from '../../../../engine/backgrounds';
import { ACTIVITIES, getActivityCost } from '../../../../engine/activities';
import { getRepeatablePlan, getWeekSlotCount } from '../../../../engine/weekendPlan';
import type { GameState, WeekendPlanSnapshot } from '../../../../engine/types';
import type { TalkActionResult } from '../../../../engine/store';

const NAME = (id: string) => ACTIVITIES.find(a => a.id === id)!.name;
const COST = (id: string, year = 1) => getActivityCost(ACTIVITIES.find(a => a.id === id)!, year);

type ConfirmFn = (activities: string[], npcChoices: Record<string, string>) => void;

function screenProps(state: GameState, onConfirmWeek: ConfirmFn) {
  return {
    state,
    bgProps: {
      bg: getBackground(state.week, state.isVacation, state.mentalState, state.year),
      bgImgError: true, onImgError: () => {},
    },
    onSetRoutine: () => {},
    onTalkNpc: (): TalkActionResult => ({ kind: 'smalltalk', line: '' }),
    onTalkHome: (): TalkActionResult => ({ kind: 'smalltalk', line: '' }),
    onResolveParentChoice: () => {},
    onBuyItem: () => {},
    onConfirmWeek,
  };
}

const PLAN: WeekendPlanSnapshot = {
  activities: ['reading', 'library'],
  npcChoices: {},
  isVacation: false,
};

function renderScreen(patch: Partial<GameState> = {}) {
  const onConfirmWeek = vi.fn<ConfirmFn>();
  const state = makeState({
    isVacation: false, week: 3, year: 1, money: 10,
    routineSlot2: 'self-study', routineSlot3: 'self-study',
    lastWeekendPlan: PLAN,
    ...patch,
  });
  render(<MainWeekScreen {...screenProps(state, onConfirmWeek)} />);
  return { onConfirmWeek, state };
}

const repeatButton = () => screen.queryByRole('button', { name: /지난주처럼/ });
/** 플래너에 그 활동이 슬롯으로 잡혀 있는가 — 슬롯 라벨 카드 안의 이름으로 본다. */
const plannerHas = (id: string) => screen.queryAllByText(NAME(id)).length > 0;

beforeEach(() => {
  localStorage.clear();
  // 튜토리얼 오버레이는 클릭을 조용히 먹는다 — 반복 플레이어 상태로 고정.
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
});

describe('"지난주처럼" — 그려지는가', () => {
  it('지난주 계획이 지금도 가능하면 버튼이 뜬다', () => {
    const { state } = renderScreen();
    expect(getRepeatablePlan(state), '전제가 깨졌다 — 판정이 이미 null이다').not.toBeNull();
    expect(repeatButton(), '판정은 유효한데 화면에 버튼이 없다').toBeTruthy();
  });

  it('지난주 계획이 없으면(구세이브·첫 주) 안 뜬다', () => {
    renderScreen({ lastWeekendPlan: undefined });
    expect(repeatButton()).toBeNull();
  });

  it('지금은 감당 못 하는 계획이면 안 뜬다 (잔액 부족)', () => {
    const paid: WeekendPlanSnapshot = { activities: ['art-lesson'], npcChoices: {}, isVacation: false };
    expect(COST('art-lesson'), '전제가 깨졌다 — 유료 활동이 공짜다').toBeGreaterThan(0);
    renderScreen({ lastWeekendPlan: paid, money: COST('art-lesson') - 0.5 });
    expect(repeatButton(), '못 할 계획을 채우겠다고 약속하고 있다').toBeNull();
  });

  it('잔액이 차면 같은 계획이 다시 뜬다 (위 케이스의 반대 방향)', () => {
    const paid: WeekendPlanSnapshot = { activities: ['art-lesson'], npcChoices: {}, isVacation: false };
    renderScreen({ lastWeekendPlan: paid, money: COST('art-lesson') });
    expect(repeatButton()).toBeTruthy();
  });

  it('방학 스냅샷은 학기 주말에 안 뜬다 — 슬롯 구조가 다르다', () => {
    renderScreen({ lastWeekendPlan: { activities: ['vacation-library'], npcChoices: {}, isVacation: true } });
    expect(repeatButton()).toBeNull();
  });
});

describe('"지난주처럼" — 눌렀을 때', () => {
  it('슬롯을 채운다', () => {
    renderScreen();
    expect(plannerHas('reading'), '누르기 전인데 이미 차 있다').toBe(false);
    fireEvent.click(repeatButton()!);
    expect(plannerHas('reading'), '토요일 칸이 안 찼다').toBe(true);
    expect(plannerHas('library'), '일요일 칸이 안 찼다').toBe(true);
  });

  it('**확정하지 않는다** — 주를 넘기는 건 기존 CTA뿐이다', () => {
    const { onConfirmWeek } = renderScreen();
    fireEvent.click(repeatButton()!);
    expect(onConfirmWeek, '1탭 복사가 주를 확정해 버렸다 — 돈이 조용히 나간다').not.toHaveBeenCalled();
  });

  it('채운 계획은 기존 CTA로 그대로 확정된다', () => {
    const { onConfirmWeek } = renderScreen();
    fireEvent.click(repeatButton()!);
    fireEvent.click(screen.getByRole('button', { name: /이번 주 확정/ }));
    expect(onConfirmWeek).toHaveBeenCalledTimes(1);
    expect(onConfirmWeek.mock.calls[0][0]).toEqual(PLAN.activities);
    expect(onConfirmWeek.mock.calls[0][1]).toEqual(PLAN.npcChoices);
  });

  it('채우고 나면 버튼이 사라진다 — 계획을 건드린 주엔 크롬을 안 남긴다', () => {
    renderScreen();
    fireEvent.click(repeatButton()!);
    expect(repeatButton()).toBeNull();
  });

  it('방학 자유 슬롯에서도 같은 버튼이 있다 — 두 갈래를 각각 그린다', () => {
    // 방학 주는 WeekPlanner의 다른 가지라, 학기 쪽만 잠그면 이쪽이 조용히 지워진다.
    const vacPlan: WeekendPlanSnapshot = {
      activities: ['vacation-library', 'creative-project'], npcChoices: {}, isVacation: true,
    };
    renderScreen({ isVacation: true, week: 21, lastWeekendPlan: vacPlan });
    fireEvent.click(repeatButton()!);
    expect(plannerHas('vacation-library'), '방학 슬롯이 안 찼다').toBe(true);
    expect(plannerHas('creative-project')).toBe(true);
  });

  it('동행 친구까지 같이 복구한다', () => {
    const companion: WeekendPlanSnapshot = {
      activities: ['hang-out'], npcChoices: { 'hang-out:0': 'jihun' }, isVacation: false,
    };
    const { onConfirmWeek } = renderScreen({ lastWeekendPlan: companion, money: 10 });
    fireEvent.click(repeatButton()!);
    expect(screen.getByText(/지훈 동행/), '동행이 빠진 채로 채워졌다').toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /이번 주 확정/ }));
    expect(onConfirmWeek.mock.calls[0][1]).toEqual(companion.npcChoices);
  });
});

describe('슬롯 수는 weekendPlan의 SSOT를 따른다', () => {
  // 두 케이스 모두 **화면이 그리는 칸 수**에서 기대값을 뽑는다. 상수에서 파생시키면
  // 상수를 바꿔도 테스트가 같이 따라가 값 회귀를 못 잡는다(#438).
  it('방학 자유 슬롯 개수가 getWeekSlotCount와 같다 — 화면이 같은 표를 또 적으면 어긋난다', () => {
    const { state } = renderScreen({ isVacation: true, week: 21, lastWeekendPlan: undefined });
    expect(screen.getAllByText(/^활동 \d+$/).length).toBe(getWeekSlotCount(state));
  });

  it('학기 주말 칸 수(토·일)와 getWeekSlotCount가 같다', () => {
    const { state } = renderScreen({ lastWeekendPlan: undefined });
    const column = screen.getByText('주말 (토~일)').parentElement!;
    expect(within(column).getAllByRole('button').length).toBe(getWeekSlotCount(state));
  });
});
