// @vitest-environment jsdom
// SlotEditPopup — 주간 계획 슬롯 편집 모달의 계약:
// 헤더 분기·닫기·루틴 필터/자유시간/자동진행, weekend N칸 인접-동일-id 기록,
// 동행 라우팅, 재편집 슬롯 한도, 방학 vacationLimit(pendingVacUse) 합산.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SlotEditPopup } from '../SlotEditPopup';
import {
  ACTIVITIES,
  NPC_COMPANION_ACTIVITIES,
  collapseActivityChoices,
  getAvailableActivities,
} from '../../../../engine/activities';
import { getActivityReaction } from '../../../../engine/dialogues';
import { makeState } from '../../../../test/fixtures';
import type { Activity, GameState } from '../../../../engine/types';

const CAT_LABEL: Record<string, string> = {
  study: '공부',
  exercise: '운동',
  social: '관계',
  talent: '자기계발',
  rest: '휴식',
  parent: '가족',
  work: '알바',
};

function pickActivity(pred: (a: Activity) => boolean, why: string): Activity {
  const found = ACTIVITIES.find(pred);
  if (!found) throw new Error(why);
  return found;
}

function oneSlotNonRest(): Activity {
  return pickActivity(
    a => a.slots === 1 && a.category !== 'rest' && !a.seasonGate && !NPC_COMPANION_ACTIVITIES.includes(a.id),
    'slots=1·비rest·비동행 학기 활동이 없습니다',
  );
}

function oneSlotOtherThan(id: string): Activity {
  return pickActivity(
    a => a.slots === 1 && a.category !== 'rest' && !a.seasonGate && a.id !== id && !NPC_COMPANION_ACTIVITIES.includes(a.id),
    `slots=1 대체 활동이 없습니다 (제외: ${id})`,
  );
}

function multiSlotVacation(slots: number): Activity {
  return pickActivity(
    a => a.slots === slots && a.seasonGate === 'vacation-only' && !NPC_COMPANION_ACTIVITIES.includes(a.id),
    `slots=${slots} 방학 활동이 없습니다`,
  );
}

function vacationWithLimit(limit: number): Activity {
  return pickActivity(
    a => a.seasonGate === 'vacation-only' && a.vacationLimit === limit && a.slots >= 1,
    `vacationLimit=${limit} 방학 활동이 없습니다`,
  );
}

function companionActivity(): Activity {
  const id = NPC_COMPANION_ACTIVITIES[0];
  const found = ACTIVITIES.find(a => a.id === id);
  if (!found) throw new Error(`NPC_COMPANION_ACTIVITIES[0]=${id}가 ACTIVITIES에 없습니다`);
  return found;
}

function expandCategory(category: string) {
  const label = CAT_LABEL[category];
  if (!label) throw new Error(`알 수 없는 카테고리: ${category}`);
  const btn = screen.getAllByRole('button').find(
    el => el.getAttribute('aria-expanded') !== null && (el.textContent ?? '').includes(label),
  );
  if (!btn) throw new Error(`카테고리 헤더를 찾을 수 없습니다: ${label}`);
  if (btn.getAttribute('aria-expanded') === 'false') fireEvent.click(btn);
  return btn;
}

function activityButton(act: Activity) {
  expandCategory(act.category);
  const btn = screen.getAllByRole('button').find(el => {
    if (el.getAttribute('aria-pressed') == null) return false;
    const text = el.textContent ?? '';
    if (text.includes('수치')) return false;
    return text.includes(act.name);
  });
  if (!btn) throw new Error(`활동 버튼을 찾을 수 없습니다: ${act.name}`);
  return btn;
}

function clickActivity(act: Activity) {
  fireEvent.click(activityButton(act));
}

type PopupOverrides = {
  editingSlot?: string;
  state?: GameState;
  activities?: Activity[];
  selectedActivities?: string[];
  npcChoices?: Record<string, string>;
  maxSlots?: number;
  currentSlots?: number;
  availableMoney?: number;
};

function renderPopup(overrides: PopupOverrides = {}) {
  const setEditingSlot = vi.fn();
  const setSelectedActivities = vi.fn();
  const onSetRoutine = vi.fn();
  const setNpcSelectFor = vi.fn();
  const setLastReaction = vi.fn();
  const state = overrides.state ?? makeState();
  const activities = overrides.activities ?? getAvailableActivities(state);
  render(
    <SlotEditPopup
      editingSlot={overrides.editingSlot ?? 'weekend1'}
      setEditingSlot={setEditingSlot}
      state={state}
      activities={activities}
      selectedActivities={overrides.selectedActivities ?? []}
      setSelectedActivities={setSelectedActivities}
      npcChoices={overrides.npcChoices ?? {}}
      maxSlots={overrides.maxSlots ?? 2}
      currentSlots={overrides.currentSlots ?? 0}
      availableMoney={overrides.availableMoney ?? 999}
      onSetRoutine={onSetRoutine}
      setNpcSelectFor={setNpcSelectFor}
      setLastReaction={setLastReaction}
    />,
  );
  return {
    setEditingSlot,
    setSelectedActivities,
    onSetRoutine,
    setNpcSelectFor,
    setLastReaction,
    state,
    activities,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SlotEditPopup 헤더·닫기', () => {
  it('editingSlot에 따라 헤더·서브문구가 routine1/routine2/weekend로 갈린다', () => {
    const { unmount } = render(
      <SlotEditPopup
        editingSlot="routine1"
        setEditingSlot={vi.fn()}
        state={makeState()}
        activities={ACTIVITIES}
        selectedActivities={[]}
        setSelectedActivities={vi.fn()}
        npcChoices={{}}
        maxSlots={2}
        currentSlots={0}
        availableMoney={999}
        onSetRoutine={vi.fn()}
        setNpcSelectFor={vi.fn()}
        setLastReaction={vi.fn()}
      />,
    );
    expect(screen.getByText('📚 방과후 활동')).toBeInTheDocument();
    expect(screen.getByText('매주 반복되는 루틴을 골라주세요')).toBeInTheDocument();
    unmount();

    const { unmount: u2 } = render(
      <SlotEditPopup
        editingSlot="routine2"
        setEditingSlot={vi.fn()}
        state={makeState({ routineSlot2: oneSlotNonRest().id })}
        activities={ACTIVITIES}
        selectedActivities={[]}
        setSelectedActivities={vi.fn()}
        npcChoices={{}}
        maxSlots={2}
        currentSlots={0}
        availableMoney={999}
        onSetRoutine={vi.fn()}
        setNpcSelectFor={vi.fn()}
        setLastReaction={vi.fn()}
      />,
    );
    expect(screen.getByText('🌙 저녁 활동')).toBeInTheDocument();
    expect(screen.getByText('매주 반복되는 루틴을 골라주세요')).toBeInTheDocument();
    u2();

    renderPopup({ editingSlot: 'weekend1' });
    expect(screen.getByText('☀️ 주말 활동')).toBeInTheDocument();
    expect(screen.getByText('이번 주말에 할 활동을 골라주세요')).toBeInTheDocument();
  });

  it('✕ 닫기 버튼과 Escape(Dialog) 모두 setEditingSlot(null)을 호출한다', () => {
    const { setEditingSlot } = renderPopup({ editingSlot: 'routine1' });
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(setEditingSlot).toHaveBeenCalledWith(null);

    setEditingSlot.mockClear();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(setEditingSlot).toHaveBeenCalledWith(null);
  });
});

describe('SlotEditPopup routine 목록 필터', () => {
  it('routine1/2에서는 slots===1 && category!==rest만 노출되고, rest·다칸 활동은 없다', () => {
    const multi = pickActivity(
      a => a.slots >= 2 && a.category !== 'rest',
      '다칸·비rest 활동이 없습니다',
    );
    const restAct = pickActivity(a => a.category === 'rest' && a.slots === 1, 'rest 1칸 활동이 없습니다');
    const state = makeState();
    renderPopup({
      editingSlot: 'routine1',
      state,
      activities: [...getAvailableActivities(state), multi, restAct],
    });

    expect(
      screen.getAllByRole('button').some(
        el => el.getAttribute('aria-expanded') !== null && (el.textContent ?? '').includes(CAT_LABEL.rest),
      ),
    ).toBe(false);

    expandCategory(oneSlotNonRest().category);
    expect(screen.queryByRole('button', { name: (_n, el) => {
      if (el?.getAttribute('aria-pressed') == null) return false;
      return (el.textContent ?? '').includes(multi.name);
    } })).not.toBeInTheDocument();
  });

  it('routine2에서는 state.routineSlot2와 같은 id가 목록에서 제외된다', () => {
    const occupied = oneSlotNonRest();
    const other = oneSlotOtherThan(occupied.id);
    const state = makeState({ routineSlot2: occupied.id });
    renderPopup({
      editingSlot: 'routine2',
      state,
      activities: getAvailableActivities(state),
    });

    expandCategory(occupied.category);
    const occupiedBtn = screen.queryAllByRole('button').find(el => {
      if (el.getAttribute('aria-pressed') == null) return false;
      if ((el.textContent ?? '').includes('수치')) return false;
      return (el.textContent ?? '').includes(occupied.name);
    });
    expect(occupiedBtn).toBeUndefined();

    // 다른 활동은 노출
    expect(activityButton(other)).toBeTruthy();
  });
});

describe('SlotEditPopup routine2 자유시간', () => {
  it('routine2에서 자유시간 클릭 → onSetRoutine(routineSlot2, null) + 닫기', () => {
    const slot2 = oneSlotNonRest();
    const { onSetRoutine, setEditingSlot } = renderPopup({
      editingSlot: 'routine2',
      state: makeState({ routineSlot2: slot2.id }),
    });
    fireEvent.click(screen.getByRole('button', { name: /자유시간/ }));
    expect(onSetRoutine).toHaveBeenCalledTimes(1);
    expect(onSetRoutine).toHaveBeenCalledWith(slot2.id, null);
    expect(setEditingSlot).toHaveBeenCalledWith(null);
  });

  it('routine1·weekend에서는 자유시간 버튼이 없다', () => {
    renderPopup({ editingSlot: 'routine1', state: makeState({ routineSlot2: oneSlotNonRest().id }) });
    expect(screen.queryByRole('button', { name: /자유시간/ })).not.toBeInTheDocument();
    cleanup();
    renderPopup({ editingSlot: 'weekend1' });
    expect(screen.queryByRole('button', { name: /자유시간/ })).not.toBeInTheDocument();
  });

  // 발주: routineSlot2 없으면 버튼 미렌더 — 실코드는 editingSlot==='routine2'이면 항상 렌더.
  it('routine2이면 routineSlot2가 없어도 자유시간 버튼은 렌더되고, 클릭 시 onSetRoutine은 생략·닫기만 한다', () => {
    const { onSetRoutine, setEditingSlot } = renderPopup({
      editingSlot: 'routine2',
      state: makeState({ routineSlot2: null, routineSlot3: null }),
    });
    const free = screen.getByRole('button', { name: /자유시간/ });
    fireEvent.click(free);
    expect(onSetRoutine).not.toHaveBeenCalled();
    expect(setEditingSlot).toHaveBeenCalledWith(null);
  });
});

describe('SlotEditPopup routine 선택', () => {
  it('routine1 선택 후 routineSlot3가 비어 있으면 onSetRoutine(id, slot3) + setEditingSlot(routine2)', () => {
    const act = oneSlotNonRest();
    const { onSetRoutine, setEditingSlot } = renderPopup({
      editingSlot: 'routine1',
      state: makeState({ routineSlot2: null, routineSlot3: null }),
    });
    clickActivity(act);
    expect(onSetRoutine).toHaveBeenCalledWith(act.id, null);
    expect(setEditingSlot).toHaveBeenCalledWith('routine2');
  });

  it('routine1 선택 시 routineSlot3가 이미 있으면 닫힌다', () => {
    const act = oneSlotNonRest();
    const other = oneSlotOtherThan(act.id);
    const { onSetRoutine, setEditingSlot } = renderPopup({
      editingSlot: 'routine1',
      state: makeState({ routineSlot3: other.id }),
    });
    clickActivity(act);
    expect(onSetRoutine).toHaveBeenCalledWith(act.id, other.id);
    expect(setEditingSlot).toHaveBeenCalledWith(null);
  });

  it('routine1에서 고른 id가 routineSlot3와 같으면 두 번째 인자는 null로 내려간다', () => {
    const act = oneSlotNonRest();
    const { onSetRoutine, setEditingSlot } = renderPopup({
      editingSlot: 'routine1',
      state: makeState({ routineSlot3: act.id }),
    });
    clickActivity(act);
    expect(onSetRoutine).toHaveBeenCalledWith(act.id, null);
    // 자동 오픈 판정은 기존 state.routineSlot3(truthy) 기준 → 닫힘
    expect(setEditingSlot).toHaveBeenCalledWith(null);
  });

  it('routine2 선택 → onSetRoutine(routineSlot2, id) + 닫기', () => {
    const slot2 = oneSlotNonRest();
    const pick = oneSlotOtherThan(slot2.id);
    const { onSetRoutine, setEditingSlot } = renderPopup({
      editingSlot: 'routine2',
      state: makeState({ routineSlot2: slot2.id }),
    });
    clickActivity(pick);
    expect(onSetRoutine).toHaveBeenCalledWith(slot2.id, pick.id);
    expect(setEditingSlot).toHaveBeenCalledWith(null);
  });
});

describe('SlotEditPopup weekend 1칸·인덱스', () => {
  it('1칸 활동은 해당 인덱스만 교체하고 setLastReaction 후 닫힌다 (weekend1→0, weekend3→2)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const act = oneSlotNonRest();
    const filler = oneSlotOtherThan(act.id);
    const selected = [filler.id, filler.id, filler.id];

    const r1 = renderPopup({
      editingSlot: 'weekend1',
      selectedActivities: selected,
      maxSlots: 4,
      currentSlots: 3,
      activities: ACTIVITIES,
    });
    clickActivity(act);
    expect(r1.setSelectedActivities).toHaveBeenCalledTimes(1);
    expect(r1.setSelectedActivities).toHaveBeenCalledWith([act.id, filler.id, filler.id]);
    expect(r1.setLastReaction).toHaveBeenCalledWith(getActivityReaction(act.id));
    expect(r1.setEditingSlot).toHaveBeenCalledWith(null);
    cleanup();

    // weekend3 → idx 2
    const { setSelectedActivities, setLastReaction, setEditingSlot } = renderPopup({
      editingSlot: 'weekend3',
      selectedActivities: [filler.id, filler.id, filler.id],
      maxSlots: 4,
      currentSlots: 3,
      activities: ACTIVITIES,
    });
    clickActivity(act);
    expect(setSelectedActivities).toHaveBeenCalledWith([filler.id, filler.id, act.id]);
    expect(setLastReaction).toHaveBeenCalledWith(getActivityReaction(act.id));
    expect(setEditingSlot).toHaveBeenCalledWith(null);
  });
});

describe('SlotEditPopup weekend N칸 (collapse 전제)', () => {
  // collapseActivityChoices의 인접-동일-id 전제를 잠근다.
  it('maxSlots=4·빈 배열·weekend1에서 3칸 활동 → [id,id,id] (slice maxSlots)', () => {
    const act = multiSlotVacation(3);
    const state = makeState({ isVacation: true, money: 999 });
    const { setSelectedActivities, setEditingSlot } = renderPopup({
      editingSlot: 'weekend1',
      state,
      activities: getAvailableActivities(state),
      selectedActivities: [],
      maxSlots: 4,
      currentSlots: 0,
      availableMoney: 999,
    });
    clickActivity(act);
    const expected = [act.id, act.id, act.id];
    expect(setSelectedActivities).toHaveBeenCalledWith(expected);
    expect(collapseActivityChoices(expected)).toEqual([act.id]);
    expect(setEditingSlot).toHaveBeenCalledWith(null);
  });

  // collapseActivityChoices의 인접-동일-id 전제를 잠근다.
  it('maxSlots=4·weekend4에서 3칸 활동 → startIdx=min(3,1)=1 → [empty,id,id,id]', () => {
    const act = multiSlotVacation(3);
    const state = makeState({ isVacation: true, money: 999 });
    const { setSelectedActivities } = renderPopup({
      editingSlot: 'weekend4',
      state,
      activities: getAvailableActivities(state),
      selectedActivities: [],
      maxSlots: 4,
      currentSlots: 0,
      availableMoney: 999,
    });
    clickActivity(act);
    const expected = [] as string[];
    expected[1] = act.id;
    expected[2] = act.id;
    expected[3] = act.id;
    // newArr starts as [...[]] then assigns indices; slice(0,4) keeps length with holes → dense after assign
    // 실코드: const newArr = [...selectedActivities]; for i fill; slice(0, maxSlots)
    // selectedActivities=[] → newArr=[], then newArr[1]=id etc → sparse array length 4
    expect(setSelectedActivities).toHaveBeenCalledTimes(1);
    const got = setSelectedActivities.mock.calls[0][0] as string[];
    expect(got.length).toBe(4);
    expect(got[0]).toBeUndefined();
    expect(got[1]).toBe(act.id);
    expect(got[2]).toBe(act.id);
    expect(got[3]).toBe(act.id);
    // collapse는 빈 칸 skip 후 인접 동일 id 1인스턴스
    expect(collapseActivityChoices(got.filter(Boolean))).toEqual([act.id]);
  });
});

describe('SlotEditPopup 동행 라우팅', () => {
  it('weekend에서 동행 활동 선택 → setNpcSelectFor(slot:idx:id), selected/reaction 미호출', () => {
    const companion = companionActivity();
    const { setNpcSelectFor, setSelectedActivities, setLastReaction, setEditingSlot } = renderPopup({
      editingSlot: 'weekend2',
      selectedActivities: [],
      maxSlots: 2,
      activities: ACTIVITIES,
    });
    clickActivity(companion);
    expect(setNpcSelectFor).toHaveBeenCalledWith(`slot:1:${companion.id}`);
    expect(setSelectedActivities).not.toHaveBeenCalled();
    expect(setLastReaction).not.toHaveBeenCalled();
    expect(setEditingSlot).toHaveBeenCalledWith(null);
  });

  it('routine 슬롯은 동행 활동을 골라도 setNpcSelectFor 없이 onSetRoutine으로 간다', () => {
    const companion = companionActivity();
    const { setNpcSelectFor, onSetRoutine, setEditingSlot } = renderPopup({
      editingSlot: 'routine1',
      state: makeState({ routineSlot3: null }),
      activities: ACTIVITIES,
    });
    clickActivity(companion);
    expect(setNpcSelectFor).not.toHaveBeenCalled();
    expect(onSetRoutine).toHaveBeenCalledWith(companion.id, null);
    expect(setEditingSlot).toHaveBeenCalledWith('routine2');
  });
});

describe('SlotEditPopup 재편집·방학 한도', () => {
  it('꽉 찬 슬롯 재편집 시 편집 중 활동 slots가 빠진 currentSlots로 다른 N칸 활동이 선택 가능해진다', () => {
    const three = multiSlotVacation(3);
    const otherThree = pickActivity(
      a => a.slots === 3 && a.seasonGate === 'vacation-only' && a.id !== three.id,
      '대체 3칸 방학 활동이 없습니다',
    );
    const state = makeState({ isVacation: true, money: 999 });
    const selected = [three.id, three.id, three.id, oneSlotNonRest().id];
    renderPopup({
      editingSlot: 'weekend1',
      state,
      activities: getAvailableActivities(state),
      selectedActivities: selected,
      maxSlots: 4,
      currentSlots: 4,
      availableMoney: 999,
    });
    // 편집 중 3칸 제외 → currentSlots=1 → otherThree(3)는 1+3<=4 로 선택 가능
    const btn = activityButton(otherThree);
    expect(btn).not.toBeDisabled();
  });

  it('vacationLimit 합산: 다른 슬롯에 이미 배치된 인스턴스는 disabled, 편집 중 슬롯의 1인스턴스는 제외되어 가능', () => {
    const limited = vacationWithLimit(1);
    const state = makeState({ isVacation: true, money: 999, vacationActivityCounts: {} });
    const placed = Array.from({ length: limited.slots }, () => limited.id);
    // 슬롯0부터 배치, 남는 칸이 있으면 빈 채움
    const selected = [...placed];
    while (selected.length < 4) selected.push('');
    // 빈 문자열은 collapse에서 skip — ActivityPicker selected 하이라이트용으로는 id만

    // 다른 슬롯(비어 있는 weekend4) 편집 → pendingUse=1 → disabled
    const { unmount } = render(
      <SlotEditPopup
        editingSlot={`weekend${placed.length + 1}`}
        setEditingSlot={vi.fn()}
        state={state}
        activities={getAvailableActivities(state)}
        selectedActivities={placed}
        setSelectedActivities={vi.fn()}
        npcChoices={{}}
        maxSlots={4}
        currentSlots={placed.length}
        availableMoney={999}
        onSetRoutine={vi.fn()}
        setNpcSelectFor={vi.fn()}
        setLastReaction={vi.fn()}
      />,
    );
    const disabledBtn = activityButton(limited);
    expect(disabledBtn).toBeDisabled();
    unmount();

    // 편집 중 슬롯(weekend1) 재선택 → 인스턴스 제외 → disabled 아님
    renderPopup({
      editingSlot: 'weekend1',
      state,
      activities: getAvailableActivities(state),
      selectedActivities: placed,
      maxSlots: 4,
      currentSlots: placed.length,
      availableMoney: 999,
    });
    expect(activityButton(limited)).not.toBeDisabled();
  });
});
