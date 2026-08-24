// @vitest-environment jsdom
// WeekPlanner — 주간 일과 플래너 UI 계약:
// 학기/방학 레이아웃, 슬롯→onEditSlot, 다칸 점유 해제, 동행·비용·콤보·경고 표시.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { WeekPlanner } from '../WeekPlanner';
import { ACTIVITIES, getActivityCost, NPC_COMPANION_ACTIVITIES } from '../../../../engine/activities';
import { makeState, withNpc } from '../../../../test/fixtures';
import type { Activity, GameState } from '../../../../engine/types';

function pickActivity(pred: (a: Activity) => boolean, why: string): Activity {
  const found = ACTIVITIES.find(pred);
  if (!found) throw new Error(why);
  return found;
}

function oneSlotPaid(): Activity {
  return pickActivity(
    a => a.slots === 1 && getActivityCost(a, 1) > 0 && !a.seasonGate,
    '유료 1칸 학기 활동이 없습니다',
  );
}

function oneSlotFree(): Activity {
  return pickActivity(
    a => a.slots === 1 && getActivityCost(a, 1) === 0 && a.category !== 'rest' && !a.seasonGate,
    '무료 1칸 학기 활동이 없습니다',
  );
}

function multiSlotSemOrVac(minSlots = 2): Activity {
  return pickActivity(
    a => a.slots >= minSlots,
    `slots>=${minSlots} 활동이 없습니다`,
  );
}

function companionActivity(): Activity {
  const id = NPC_COMPANION_ACTIVITIES[0];
  const found = ACTIVITIES.find(a => a.id === id);
  if (!found) throw new Error(`동행 활동 ${id}가 없습니다`);
  return found;
}

type PlannerOverrides = {
  state?: GameState;
  selectedActivities?: string[];
  npcChoices?: Record<string, string>;
  routineTooExpensive?: boolean;
  routineCost?: number;
  unaffordable?: Activity[];
  maxComboWeeks?: number;
  slot2ComboWeeks?: number;
  slot3ComboWeeks?: number;
  maxSlots?: number;
};

function renderPlanner(overrides: PlannerOverrides = {}) {
  const onEditSlot = vi.fn();
  const setSelectedActivities = vi.fn();
  const state = overrides.state ?? makeState({ isVacation: false });
  const utils = render(
    <WeekPlanner
      state={state}
      selectedActivities={overrides.selectedActivities ?? []}
      setSelectedActivities={setSelectedActivities}
      npcChoices={overrides.npcChoices ?? {}}
      onEditSlot={onEditSlot}
      routineTooExpensive={overrides.routineTooExpensive ?? false}
      routineCost={overrides.routineCost ?? 0}
      unaffordable={overrides.unaffordable ?? []}
      maxComboWeeks={overrides.maxComboWeeks ?? 0}
      slot2ComboWeeks={overrides.slot2ComboWeeks ?? 0}
      slot3ComboWeeks={overrides.slot3ComboWeeks ?? 0}
      maxSlots={overrides.maxSlots ?? 2}
    />,
  );
  return { ...utils, onEditSlot, setSelectedActivities, state };
}

function slotButton(timeLabel: string) {
  const btn = screen.getAllByRole('button').find(el => (el.textContent ?? '').includes(timeLabel));
  if (!btn) throw new Error(`슬롯 버튼을 찾을 수 없습니다: ${timeLabel}`);
  return btn;
}

describe('WeekPlanner 학기 중 레이아웃·슬롯 탭', () => {
  it('학기 중이면 주중(학교 고정·방과후·저녁)과 주말(토·일)이 렌더되고, 고정 학교 클릭은 onEditSlot 미호출', () => {
    const { onEditSlot } = renderPlanner({ state: makeState({ isVacation: false }) });
    expect(screen.getByText('주중 (월~금)')).toBeInTheDocument();
    expect(screen.getByText('주말 (토~일)')).toBeInTheDocument();
    expect(screen.getAllByText('학교').length).toBeGreaterThanOrEqual(2);

    const morning = slotButton('오전');
    expect(morning).toBeDisabled();
    fireEvent.click(morning);
    expect(onEditSlot).not.toHaveBeenCalled();
  });

  it('방과후→routine1, 저녁→routine2, 토→weekend1, 일→weekend2', () => {
    const act = oneSlotFree();
    const { onEditSlot } = renderPlanner({
      state: makeState({ isVacation: false, routineSlot2: act.id }),
      selectedActivities: [],
    });
    fireEvent.click(slotButton('방과후'));
    expect(onEditSlot).toHaveBeenCalledWith('routine1');

    onEditSlot.mockClear();
    fireEvent.click(slotButton('저녁'));
    expect(onEditSlot).toHaveBeenCalledWith('routine2');

    onEditSlot.mockClear();
    fireEvent.click(slotButton('토요일'));
    expect(onEditSlot).toHaveBeenCalledWith('weekend1');

    onEditSlot.mockClear();
    fireEvent.click(slotButton('일요일'));
    expect(onEditSlot).toHaveBeenCalledWith('weekend2');
  });

  it('빈 선택 슬롯은 "탭하여 활동 선택" 문구와 slot-pulse 클래스를 쓴다', () => {
    renderPlanner({ state: makeState({ isVacation: false, routineSlot2: null }) });
    const emptyLabels = screen.getAllByText('탭하여 활동 선택');
    expect(emptyLabels.length).toBeGreaterThan(0);
    const pulsed = screen.getAllByRole('button').filter(b => b.className.includes('slot-pulse'));
    expect(pulsed.length).toBeGreaterThan(0);
  });

  it('저녁 라벨: routineSlot3 있으면 활동명, 없고 slot2만 있으면 자유시간, 둘 다 없으면 빈 슬롯 문구', () => {
    const slot2 = oneSlotFree();
    const slot3 = pickActivity(
      a => a.slots === 1 && a.category !== 'rest' && !a.seasonGate && a.id !== slot2.id,
      '저녁용 대체 활동이 없습니다',
    );

    const { unmount } = renderPlanner({
      state: makeState({ isVacation: false, routineSlot2: slot2.id, routineSlot3: slot3.id }),
    });
    expect(within(slotButton('저녁')).getByText(slot3.name)).toBeInTheDocument();
    unmount();

    const { unmount: u2 } = renderPlanner({
      state: makeState({ isVacation: false, routineSlot2: slot2.id, routineSlot3: null }),
    });
    expect(within(slotButton('저녁')).getByText('자유시간')).toBeInTheDocument();
    u2();

    renderPlanner({
      state: makeState({ isVacation: false, routineSlot2: null, routineSlot3: null }),
    });
    expect(within(slotButton('저녁')).getByText('탭하여 활동 선택')).toBeInTheDocument();
  });
});

describe('WeekPlanner 다칸 주말·동행·비용', () => {
  it('토요일에 2칸 이상 활동이 있으면 클릭 시 setSelectedActivities([]) 후 onEditSlot(weekend1), 일요일은 연속 활동·disabled', () => {
    const multi = multiSlotSemOrVac(2);
    const { onEditSlot, setSelectedActivities } = renderPlanner({
      state: makeState({ isVacation: false }),
      selectedActivities: Array.from({ length: multi.slots }, () => multi.id),
    });

    fireEvent.click(slotButton('토요일'));
    expect(setSelectedActivities).toHaveBeenCalledWith([]);
    expect(onEditSlot).toHaveBeenCalledWith('weekend1');
    // 호출 순서: 초기화 먼저
    const setOrder = setSelectedActivities.mock.invocationCallOrder[0];
    const editOrder = onEditSlot.mock.invocationCallOrder[0];
    expect(setOrder).toBeLessThan(editOrder);

    onEditSlot.mockClear();
    const sun = slotButton('일요일');
    expect(within(sun).getByText('(연속 활동)')).toBeInTheDocument();
    expect(sun).toBeDisabled();
    fireEvent.click(sun);
    expect(onEditSlot).not.toHaveBeenCalled();
  });

  it('동행 이름은 슬롯 키(id:0)와 레거시(id) 모두에서 "{이름} 동행"으로 뜬다', () => {
    const companion = companionActivity();
    const base = makeState({ isVacation: false });
    const npc = base.npcs.find(n => n.met) ?? base.npcs[0];
    if (!npc) throw new Error('fixture NPC가 필요합니다');
    const state = { ...base, npcs: withNpc(base.npcs, npc.id, { met: true, name: npc.name }) };

    const { unmount } = renderPlanner({
      state,
      selectedActivities: [companion.id],
      npcChoices: { [`${companion.id}:0`]: npc.id },
    });
    expect(screen.getByText(`${npc.name} 동행`)).toBeInTheDocument();
    unmount();

    renderPlanner({
      state,
      selectedActivities: [companion.id],
      npcChoices: { [companion.id]: npc.id },
    });
    expect(screen.getByText(`${npc.name} 동행`)).toBeInTheDocument();
  });

  it('유료 활동 슬롯에 getActivityCost 결과가 "N만원"으로 표시된다', () => {
    const paid = oneSlotPaid();
    const state = makeState({ isVacation: false, year: 1, routineSlot2: paid.id });
    const cost = getActivityCost(paid, state.year);
    renderPlanner({ state });
    expect(within(slotButton('방과후')).getByText(`${cost}만원`)).toBeInTheDocument();
  });
});

describe('WeekPlanner 경고·콤보·주말 미선택', () => {
  it('routineTooExpensive면 현재 금액·필요 금액을 표시하고, 소수 money는 toFixed(1)', () => {
    const { unmount } = renderPlanner({
      state: makeState({ money: 3.5 }),
      routineTooExpensive: true,
      routineCost: 10,
    });
    expect(screen.getByText(/현재 3\.5만원, 필요 10만원/)).toBeInTheDocument();
    unmount();

    renderPlanner({
      state: makeState({ money: 4 }),
      routineTooExpensive: true,
      routineCost: 7,
    });
    expect(screen.getByText(/현재 4만원, 필요 7만원/)).toBeInTheDocument();
  });

  it('routine 슬롯 콤보 배지는 구간별 접두(3~5✨ / 6~7⭐ / 8+🔥)를 쓰고, 학기 중 maxComboWeeks>=3이면 헤더 활성·방학이면 없음', () => {
    const act = oneSlotFree();
    const { unmount } = renderPlanner({
      state: makeState({ isVacation: false, routineSlot2: act.id }),
      slot2ComboWeeks: 3,
      maxComboWeeks: 3,
    });
    expect(screen.getByText(/✨\s*3주 연속/)).toBeInTheDocument();
    expect(screen.getByText(/루틴 보너스 활성/)).toBeInTheDocument();
    unmount();

    const { unmount: u2 } = renderPlanner({
      state: makeState({ isVacation: false, routineSlot2: act.id }),
      slot2ComboWeeks: 6,
      maxComboWeeks: 6,
    });
    expect(screen.getByText(/⭐\s*6주 연속/)).toBeInTheDocument();
    u2();

    const { unmount: u3 } = renderPlanner({
      state: makeState({ isVacation: false, routineSlot2: act.id }),
      slot2ComboWeeks: 8,
      maxComboWeeks: 8,
    });
    expect(screen.getByText(/🔥\s*8주 연속/)).toBeInTheDocument();
    u3();

    renderPlanner({
      state: makeState({ isVacation: true, week: 21 }),
      maxComboWeeks: 5,
      maxSlots: 4,
    });
    expect(screen.queryByText(/루틴 보너스 활성/)).not.toBeInTheDocument();
  });

  it('주말 미선택 안내는 selectedActivities가 비고 routineSlot2가 있을 때만 뜬다', () => {
    const act = oneSlotFree();
    const { unmount } = renderPlanner({
      state: makeState({ isVacation: false, routineSlot2: act.id }),
      selectedActivities: [],
    });
    expect(screen.getByText('이번 주말은 비워뒀어요')).toBeInTheDocument();
    unmount();

    const { unmount: u2 } = renderPlanner({
      state: makeState({ isVacation: false, routineSlot2: null }),
      selectedActivities: [],
    });
    expect(screen.queryByText('이번 주말은 비워뒀어요')).not.toBeInTheDocument();
    u2();

    renderPlanner({
      state: makeState({ isVacation: false, routineSlot2: act.id }),
      selectedActivities: [act.id],
    });
    expect(screen.queryByText('이번 주말은 비워뒀어요')).not.toBeInTheDocument();
  });

  // 실측상 주말을 비우는 게 최적해인 구간이 있다(피로가 학업 총량을 깎는 구조).
  // 예전 문구는 노란 경고가 맥박치며 "비어있어요! 채우세요"라고 재촉해 최적 플레이를 말렸다.
  // 안내는 남기되 압박은 없어야 한다 — 경고 어휘·경고색·맥박 애니메이션 금지.
  it('주말 미선택 안내가 재촉 톤으로 돌아가지 않는다 (경고 어휘·경고색·맥박 없음)', () => {
    const act = oneSlotFree();
    renderPlanner({
      state: makeState({ isVacation: false, routineSlot2: act.id }),
      selectedActivities: [],
    });
    // 재촉 어휘가 없다
    expect(screen.queryByText(/비어있어요|채우세요|선택하세요/)).not.toBeInTheDocument();
    // 쉬는 것이 유효한 선택임을 알린다
    expect(screen.getByText(/쉬는 것도 한 주의 선택/)).toBeInTheDocument();

    const box = screen.getByText('이번 주말은 비워뒀어요').parentElement as HTMLElement;
    // 정확 일치로 잠근다 — not.toContain('--yellow')는 "그 문자열 금지"일 뿐이라
    // 같은 경고색을 hex 리터럴(#e0b354)로 쓰면 그대로 통과한다(뮤테이션에서 실증됨).
    expect(box.style.color).toBe('var(--text-secondary)');
    // 맥박은 인라인·클래스 양쪽 다 막는다 — CSS 클래스로 옮기는 우회를 차단.
    expect(box.style.animation).toBe('');
    expect(box.className).toBe('');
    // 이 카드는 rgba(42,34,48,0.85)라 배경 사진이 비쳐 올라온다. 서브라인에 opacity를 얹으면
    // 실배경 대비가 4.27~4.64로 떨어져 WCAG AA(4.5) 미달 — 위계는 폰트 크기로만 준다.
    const sub = screen.getByText(/쉬는 것도 한 주의 선택/) as HTMLElement;
    expect(sub.style.opacity).toBe('');
  });
});

describe('WeekPlanner 방학', () => {
  it('방학이면 활동 1..maxSlots 자유 슬롯만 렌더되고 주중/주말 2단은 없다', () => {
    renderPlanner({
      state: makeState({ isVacation: true, week: 21 }),
      maxSlots: 4,
    });
    expect(screen.queryByText('주중 (월~금)')).not.toBeInTheDocument();
    expect(screen.queryByText('주말 (토~일)')).not.toBeInTheDocument();
    expect(slotButton('활동 1')).toBeTruthy();
    expect(slotButton('활동 4')).toBeTruthy();
    expect(screen.queryByText('활동 5')).not.toBeInTheDocument();
  });

  it('방학 안내문은 시작(20/43)·마무리(24/48)만, 학교급(yr1/≤4/그외)과 시작·마무리 문장이 서로 다르다', () => {
    const startMsgs: string[] = [];
    for (const year of [1, 3, 6] as const) {
      const { unmount } = renderPlanner({
        state: makeState({ isVacation: true, week: 20, year }),
        maxSlots: 4,
      });
      expect(screen.getByText('🏖️ 방학 시작')).toBeInTheDocument();
      const box = screen.getByText('🏖️ 방학 시작').parentElement;
      if (!box) throw new Error('시작 안내문 컨테이너 없음');
      const msgEl = box.querySelector('div:last-child');
      const msg = msgEl?.textContent ?? '';
      expect(msg.length).toBeGreaterThan(0);
      startMsgs.push(msg);
      unmount();
    }
    expect(new Set(startMsgs).size).toBe(3);

    const { unmount: uEnd } = renderPlanner({
      state: makeState({ isVacation: true, week: 24, year: 3 }),
      maxSlots: 4,
    });
    expect(screen.getByText('🍂 방학 마무리')).toBeInTheDocument();
    const endBox = screen.getByText('🍂 방학 마무리').parentElement;
    const endMsg = endBox?.querySelector('div:last-child')?.textContent ?? '';
    expect(endMsg).not.toBe(startMsgs[1]);
    uEnd();

    renderPlanner({
      state: makeState({ isVacation: true, week: 21, year: 3 }),
      maxSlots: 4,
    });
    expect(screen.queryByText('🏖️ 방학 시작')).not.toBeInTheDocument();
    expect(screen.queryByText('🍂 방학 마무리')).not.toBeInTheDocument();
  });

  it('방학 슬롯에서 2칸 이상 활동 클릭 시 해당 id를 배열에서 전부 제거한 뒤 onEditSlot(weekendN)', () => {
    const multi = multiSlotSemOrVac(2);
    const other = oneSlotFree();
    const selected = [multi.id, multi.id, other.id];
    const { onEditSlot, setSelectedActivities } = renderPlanner({
      state: makeState({ isVacation: true, week: 21 }),
      selectedActivities: selected,
      maxSlots: 3,
    });

    fireEvent.click(slotButton('활동 1'));
    expect(setSelectedActivities).toHaveBeenCalledWith([other.id]);
    expect(onEditSlot).toHaveBeenCalledWith('weekend1');
  });
});
