// @vitest-environment jsdom
// ActivityPicker — 가격·잔액·슬롯 용량·방학 한도·전략 태그·학교급 배지 계약.
// disabled는 사유별로 나머지 두 사유를 배제한 props로만 검증한다(T10 오탐 방지).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { ActivityPicker } from '../ActivityPicker';
import { ACTIVITIES, NPC_COMPANION_ACTIVITIES, getActivityCost } from '../../engine/activities';
import { activityHints } from '../../engine/activityHints';
import { makeState } from '../../test/fixtures';
import { STAT_LABELS, type Activity, type GameState, type StatKey } from '../../engine/types';

const CAT_ORDER = ['study', 'exercise', 'social', 'talent', 'rest', 'parent', 'work'] as const;
const CAT_LABEL: Record<(typeof CAT_ORDER)[number], string> = {
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

/** 경계 검증 전용 — id/name은 test-* */
function testActivity(
  patch: Partial<Activity> & Pick<Activity, 'id' | 'name' | 'category'>,
): Activity {
  return {
    slots: 1,
    fatigue: 0,
    effects: {},
    moneyCost: 0,
    description: 'test-desc',
    flavor: 'test-flavor',
    tags: [],
    ...patch,
  };
}

type RenderOpts = {
  activities?: Activity[];
  selected?: string[];
  onToggle?: (id: string) => void;
  maxSlots?: number;
  currentSlots?: number;
  state?: GameState;
  npcChoices?: Record<string, string>;
  compact?: boolean;
  availableMoney?: number;
  companionEligible?: boolean;
  pendingVacUse?: Record<string, number>;
};

function renderPicker(opts: RenderOpts = {}) {
  const onToggle = opts.onToggle ?? vi.fn();
  const state = opts.state ?? makeState({ money: 999 });
  const activities = opts.activities ?? [pickActivity(a => a.id === 'self-study', 'self-study 없음')];
  const utils = render(
    <ActivityPicker
      activities={activities}
      selected={opts.selected ?? []}
      onToggle={onToggle}
      maxSlots={opts.maxSlots ?? 10}
      currentSlots={opts.currentSlots ?? 0}
      state={state}
      npcChoices={opts.npcChoices}
      compact={opts.compact}
      availableMoney={opts.availableMoney}
      companionEligible={opts.companionEligible}
      pendingVacUse={opts.pendingVacUse}
    />,
  );
  return { ...utils, onToggle, state, activities };
}

function categoryHeaders(): HTMLElement[] {
  return screen.getAllByRole('button').filter(el => el.getAttribute('aria-expanded') !== null);
}

function expandCategory(category: string) {
  const label = CAT_LABEL[category as keyof typeof CAT_LABEL];
  if (!label) throw new Error(`알 수 없는 카테고리: ${category}`);
  const btn = categoryHeaders().find(el => (el.textContent ?? '').includes(label));
  if (!btn) throw new Error(`카테고리 헤더 없음: ${label}`);
  if (btn.getAttribute('aria-expanded') === 'false') fireEvent.click(btn);
  return btn;
}

function activityButton(act: Activity): HTMLElement {
  expandCategory(act.category);
  const btn = screen.getAllByRole('button').find(el => {
    if (el.getAttribute('aria-pressed') == null) return false;
    const text = el.textContent ?? '';
    if (text.includes('수치')) return false;
    return text.includes(act.name);
  });
  if (!btn) throw new Error(`활동 버튼 없음: ${act.name}`);
  return btn;
}

afterEach(() => {
  cleanup();
});

describe('ActivityPicker 카테고리 렌더', () => {
  it('study→work 순서로 헤더를 렌더하고, 활동 0개인 카테고리 헤더는 생략한다', () => {
    const onePerCat = CAT_ORDER.map(cat =>
      testActivity({ id: `test-${cat}`, name: `테스트${CAT_LABEL[cat]}`, category: cat }),
    );
    renderPicker({ activities: onePerCat });
    const labels = categoryHeaders().map(h => {
      for (const cat of CAT_ORDER) {
        if ((h.textContent ?? '').includes(CAT_LABEL[cat])) return CAT_LABEL[cat];
      }
      return '?';
    });
    expect(labels).toEqual(CAT_ORDER.map(c => CAT_LABEL[c]));

    // 양성/음성 짝 — study만 있으면 공부만, 운동 헤더 없음
    cleanup();
    renderPicker({
      activities: [testActivity({ id: 'test-only-study', name: '테스트공부만', category: 'study' })],
    });
    expect(screen.getByText('공부')).toBeInTheDocument();
    expect(screen.queryByText('운동')).not.toBeInTheDocument();
  });
});

describe('ActivityPicker 아코디언', () => {
  it('헤더 클릭으로 aria-expanded가 전환되고, 단일 확장·재클릭 닫힘을 보장한다', () => {
    const acts = [
      testActivity({ id: 'test-acc-study', name: '아코디언공부', category: 'study' }),
      testActivity({ id: 'test-acc-rest', name: '아코디언휴식', category: 'rest' }),
    ];
    renderPicker({ activities: acts });
    const [studyH, restH] = categoryHeaders();
    expect(studyH).toHaveAttribute('aria-expanded', 'false');
    expect(restH).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(studyH);
    expect(studyH).toHaveAttribute('aria-expanded', 'true');
    expect(restH).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(restH);
    expect(studyH).toHaveAttribute('aria-expanded', 'false');
    expect(restH).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(restH);
    expect(restH).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('ActivityPicker 선택 요약', () => {
  it('카테고리 헤더에 선택된 활동을 ✓ 이름(복수면 쉼표)으로 표시한다', () => {
    const a = pickActivity(a => a.id === 'self-study', 'self-study');
    const b = pickActivity(a => a.id === 'reading', 'reading');
    expect(a.category).toBe('study');
    expect(b.category).toBe('study');
    renderPicker({ activities: [a, b], selected: [a.id, b.id] });
    const header = categoryHeaders().find(h => (h.textContent ?? '').includes('공부'));
    expect(header).toBeTruthy();
    expect(within(header!).getByText(`✓ ${a.name}, ${b.name}`)).toBeInTheDocument();

    cleanup();
    renderPicker({ activities: [a, b], selected: [a.id] });
    const header2 = categoryHeaders().find(h => (h.textContent ?? '').includes('공부'));
    expect(within(header2!).getByText(`✓ ${a.name}`)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(`✓ ${a.name},`))).not.toBeInTheDocument();
  });
});

describe('ActivityPicker disabled — 용량', () => {
  it('미선택·slots<maxSlots·currentSlots+slots>maxSlots이면 disabled다', () => {
    // 잔액·방학 배제: 무료·비방학 / maxSlots 예외(slots>=maxSlots)에 안 걸리게 slots=1
    const act = pickActivity(
      a => a.slots === 1 && a.moneyCost === 0 && !a.requires && !a.vacationLimit && a.category === 'study',
      '용량 검증용 무료 1칸 활동 없음',
    );
    const { onToggle } = renderPicker({
      activities: [act],
      maxSlots: 2,
      currentSlots: 2,
      selected: [],
      state: makeState({ money: 999, isVacation: false }),
      availableMoney: 999,
    });
    const btn = activityButton(act);
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('slots>=maxSlots 예외면 용량 초과여도 선택 가능하다', () => {
    // 잔액·방학 배제. currentSlots+slots>maxSlots이되 slots>=maxSlots인 deep-rest
    const act = pickActivity(a => a.id === 'deep-rest', 'deep-rest 없음');
    expect(act.slots).toBe(2);
    const { onToggle } = renderPicker({
      activities: [act],
      maxSlots: 2,
      currentSlots: 1,
      selected: [],
      state: makeState({ money: 999, isVacation: false }),
      availableMoney: 999,
    });
    const btn = activityButton(act);
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(act.id);
  });
});

describe('ActivityPicker disabled — 잔액', () => {
  it('cost>0·money<cost이면 disabled+💰부족이고, state.money 경로를 쓴다', () => {
    // 용량·방학·requires 배제: hang-out(requires 없음)·maxSlots 넉넉·비방학
    // ※ academy는 requires(state.money)가 겹쳐 money>=cost→true 뮤테이션을 놓친다
    const act = pickActivity(a => a.id === 'hang-out', 'hang-out 없음');
    const cost = getActivityCost(act, 1);
    expect(cost).toBeGreaterThan(0);
    renderPicker({
      activities: [act],
      maxSlots: 10,
      currentSlots: 0,
      state: makeState({ money: cost - 1, year: 1, isVacation: false }),
    });
    const btn = activityButton(act);
    expect(btn).toBeDisabled();
    expect(within(btn).getByText('💰부족')).toBeInTheDocument();

    cleanup();
    renderPicker({
      activities: [act],
      maxSlots: 10,
      currentSlots: 0,
      state: makeState({ money: cost, year: 1, isVacation: false }),
    });
    expect(activityButton(act)).not.toBeDisabled();
    expect(screen.queryByText('💰부족')).not.toBeInTheDocument();
  });

  it('availableMoney가 있으면 state.money가 넉넉해도 그쪽을 따른다', () => {
    // 용량·방학·requires 배제 — hang-out
    const act = pickActivity(a => a.id === 'hang-out', 'hang-out 없음');
    const cost = getActivityCost(act, 1);
    renderPicker({
      activities: [act],
      maxSlots: 10,
      currentSlots: 0,
      state: makeState({ money: 999, year: 1, isVacation: false }),
      availableMoney: 0,
    });
    const btn = activityButton(act);
    expect(btn).toBeDisabled();
    expect(within(btn).getByText('💰부족')).toBeInTheDocument();
    expect(cost).toBeGreaterThan(0);
  });
});

describe('ActivityPicker disabled — requires', () => {
  it('requires 불충족이면 disabled이되 💰부족 배지는 없다', () => {
    // 용량·잔액 배제: 무료·maxSlots 넉넉 / emotional 없는 부모로 requires만 실패
    const act = pickActivity(a => a.id === 'study-with-parent', 'study-with-parent 없음');
    renderPicker({
      activities: [act],
      maxSlots: 10,
      currentSlots: 0,
      availableMoney: 999,
      state: makeState({ money: 999, parents: ['info', 'wealth'], isVacation: false }),
    });
    const btn = activityButton(act);
    expect(btn).toBeDisabled();
    expect(within(btn).queryByText('💰부족')).not.toBeInTheDocument();

    cleanup();
    // 양성 짝 — emotional이면 enabled
    renderPicker({
      activities: [act],
      maxSlots: 10,
      currentSlots: 0,
      availableMoney: 999,
      state: makeState({ money: 999, parents: ['emotional', 'info'], isVacation: false }),
    });
    expect(activityButton(act)).not.toBeDisabled();
  });
});

describe('ActivityPicker disabled — 방학 한도', () => {
  it('미선택·한도 도달이면 disabled+이번 방학 한도 도달, 미달이면 used 합산 표기', () => {
    // 용량·잔액 배제: maxSlots 넉넉·availableMoney 큼. countryside vacationLimit=1
    const act = pickActivity(
      a => a.id === 'countryside',
      'countryside(vacationLimit) 없음',
    );
    expect(act.vacationLimit).toBe(1);

    // 한도 도달: counts + pending = 1
    renderPicker({
      activities: [act],
      maxSlots: 10,
      currentSlots: 0,
      availableMoney: 999,
      selected: [],
      pendingVacUse: { [act.id]: 0 },
      state: makeState({
        money: 999,
        isVacation: true,
        vacationActivityCounts: { [act.id]: 1 },
      }),
    });
    const reached = activityButton(act);
    expect(reached).toBeDisabled();
    expect(within(reached).getByText('이번 방학 한도 도달')).toBeInTheDocument();

    cleanup();
    // 한도 미달: counts(0)+pending(0)=0 — used 표기
    renderPicker({
      activities: [act],
      maxSlots: 10,
      currentSlots: 0,
      availableMoney: 999,
      selected: [],
      pendingVacUse: { [act.id]: 0 },
      state: makeState({
        money: 999,
        isVacation: true,
        vacationActivityCounts: {},
      }),
    });
    const open = activityButton(act);
    expect(open).not.toBeDisabled();
    expect(
      within(open).getByText(`방학당 ${act.vacationLimit}회 (0/${act.vacationLimit})`),
    ).toBeInTheDocument();

    cleanup();
    // pendingVacUse 합산: counts=0 + pending=1 → 한도 도달
    renderPicker({
      activities: [act],
      maxSlots: 10,
      currentSlots: 0,
      availableMoney: 999,
      selected: [],
      pendingVacUse: { [act.id]: 1 },
      state: makeState({
        money: 999,
        isVacation: true,
        vacationActivityCounts: {},
      }),
    });
    expect(within(activityButton(act)).getByText('이번 방학 한도 도달')).toBeInTheDocument();

    cleanup();
    // used = counts + pending (미달 표기)
    renderPicker({
      activities: [pickActivity(a => a.id === 'intensive-academy', 'intensive-academy')],
      maxSlots: 10,
      currentSlots: 0,
      availableMoney: 999,
      selected: [],
      pendingVacUse: { 'intensive-academy': 1 },
      state: makeState({
        money: 999,
        isVacation: true,
        vacationActivityCounts: { 'intensive-academy': 0 },
      }),
    });
    const limited = pickActivity(a => a.id === 'intensive-academy', 'intensive-academy');
    expect(
      within(activityButton(limited)).getByText(
        `방학당 ${limited.vacationLimit}회 (1/${limited.vacationLimit})`,
      ),
    ).toBeInTheDocument();
  });
});

describe('ActivityPicker isSel 예외', () => {
  it('이미 선택된 활동은 용량 초과·한도 도달이어도 disabled가 아니다', () => {
    const cap = pickActivity(
      a => a.slots === 1 && a.moneyCost === 0 && !a.requires && a.id === 'self-study',
      'self-study',
    );
    renderPicker({
      activities: [cap],
      selected: [cap.id],
      maxSlots: 2,
      currentSlots: 2,
      availableMoney: 999,
      state: makeState({ money: 999, isVacation: false }),
    });
    expect(activityButton(cap)).not.toBeDisabled();
    expect(activityButton(cap)).toHaveAttribute('aria-pressed', 'true');

    cleanup();
    const vac = pickActivity(a => a.id === 'countryside', 'countryside');
    renderPicker({
      activities: [vac],
      selected: [vac.id],
      maxSlots: 10,
      currentSlots: 0,
      availableMoney: 999,
      pendingVacUse: { [vac.id]: 0 },
      state: makeState({
        money: 999,
        isVacation: true,
        vacationActivityCounts: { [vac.id]: 1 },
      }),
    });
    // !isSel 제거 뮤테이션이면 여기서 disabled가 된다
    expect(activityButton(vac)).not.toBeDisabled();
  });
});

describe('ActivityPicker onToggle·aria-pressed', () => {
  it('enabled 클릭은 onToggle(id) 1회, disabled 클릭은 미호출, aria-pressed가 선택을 따른다', () => {
    const act = pickActivity(a => a.id === 'self-study', 'self-study');
    const onToggle = vi.fn();
    renderPicker({
      activities: [act],
      selected: [],
      onToggle,
      maxSlots: 10,
      currentSlots: 0,
      availableMoney: 999,
      state: makeState({ money: 999 }),
    });
    const btn = activityButton(act);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(act.id);

    cleanup();
    const onToggle2 = vi.fn();
    renderPicker({
      activities: [act],
      selected: [act.id],
      onToggle: onToggle2,
      maxSlots: 10,
      currentSlots: 0,
      availableMoney: 999,
    });
    expect(activityButton(act)).toHaveAttribute('aria-pressed', 'true');

    cleanup();
    const poor = pickActivity(a => a.id === 'hang-out', 'hang-out');
    const onToggle3 = vi.fn();
    renderPicker({
      activities: [poor],
      onToggle: onToggle3,
      maxSlots: 10,
      currentSlots: 0,
      state: makeState({ money: 0 }),
    });
    fireEvent.click(activityButton(poor));
    expect(onToggle3).not.toHaveBeenCalled();
  });
});

describe('ActivityPicker 수치 보기 토글', () => {
  it('기본은 서술형, 토글 시 수치 ON·원시 수치·aria-pressed를 보장한다', () => {
    // ACTIVITIES 파생 — self-study effects.academic=1.5, fatigue=5
    const act = pickActivity(a => a.id === 'self-study', 'self-study');
    renderPicker({ activities: [act], availableMoney: 999, maxSlots: 10 });
    expandCategory('study');
    const toggle = screen.getByRole('button', { name: '수치 보기' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    // 서술형 (1.5 → 소폭 상승)
    expect(screen.getByText(`${STAT_LABELS.academic} 소폭 상승`)).toBeInTheDocument();
    expect(screen.queryByText(/학업\+/)).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: '수치 ON' })).toHaveAttribute('aria-pressed', 'true');
    const academicVal = act.effects.academic as number;
    expect(screen.getByText(`${STAT_LABELS.academic}+${academicVal}`)).toBeInTheDocument();
    expect(screen.getByText(`피로+${act.fatigue}`)).toBeInTheDocument();
    expect(screen.queryByText(`${STAT_LABELS.academic} 소폭 상승`)).not.toBeInTheDocument();
  });
});

describe('ActivityPicker 서술형 변환 경계', () => {
  function expectDescTags(effects: Partial<Record<StatKey, number>>, fatigue: number, expected: string[]) {
    cleanup();
    const act = testActivity({
      id: `test-desc-${fatigue}-${Object.values(effects).join('-')}`,
      name: `서술경계${fatigue}`,
      category: 'study',
      effects,
      fatigue,
    });
    renderPicker({ activities: [act], availableMoney: 999, maxSlots: 10 });
    const btn = activityButton(act);
    for (const t of expected) {
      expect(within(btn).getByText(t)).toBeInTheDocument();
    }
  }

  it('describeEffect 양수 경계 1·2·3·4를 양쪽에서 잠근다', () => {
    expectDescTags({ academic: 1 }, 0, ['학업 소폭 상승', '피로 회복']);
    expectDescTags({ academic: 2 }, 0, ['학업에 좋음', '피로 회복']);
    expectDescTags({ academic: 3 }, 0, ['학업에 좋음', '피로 회복']);
    expectDescTags({ academic: 4 }, 0, ['학업 크게 상승', '피로 회복']);
  });

  it('describeEffect 음수 경계 -1·-2·-3을 양쪽에서 잠근다', () => {
    expectDescTags({ mental: -1 }, 0, ['멘탈 소폭 하락', '피로 회복']);
    expectDescTags({ mental: -2 }, 0, ['멘탈 하락', '피로 회복']);
    expectDescTags({ mental: -3 }, 0, ['멘탈 크게 하락', '피로 회복']);
  });

  it('describeFatigue 경계 양쪽(3/4, 6/7, 9/10, -4/-5, -11/-12)을 잠근다', () => {
    expectDescTags({}, 1, ['약간 피곤함']);
    expectDescTags({}, 3, ['약간 피곤함']);
    expectDescTags({}, 4, ['피로 있음']);
    expectDescTags({}, 6, ['피로 있음']);
    expectDescTags({}, 7, ['꽤 피곤함']);
    expectDescTags({}, 9, ['꽤 피곤함']);
    expectDescTags({}, 10, ['매우 피곤함']);
    expectDescTags({}, -1, ['피로 회복']);
    expectDescTags({}, -4, ['피로 회복']);
    expectDescTags({}, -5, ['많이 쉴 수 있음']);
    expectDescTags({}, -11, ['많이 쉴 수 있음']);
    expectDescTags({}, -12, ['완전 회복']);
  });
});

describe('ActivityPicker 비용 표기', () => {
  it('cost>0은 (N만)/(N만/주), cost<0은 (+N만)으로 표기한다', () => {
    const paid = pickActivity(a => a.id === 'hang-out', 'hang-out');
    const cost = getActivityCost(paid, 1);
    renderPicker({
      activities: [paid],
      state: makeState({ money: 999, year: 1 }),
      availableMoney: 999,
    });
    expect(within(activityButton(paid)).getByText(`(${cost}만)`)).toBeInTheDocument();

    cleanup();
    renderPicker({
      activities: [paid],
      compact: true,
      state: makeState({ money: 999, year: 1 }),
      availableMoney: 999,
    });
    expect(within(activityButton(paid)).getByText(`(${cost}만/주)`)).toBeInTheDocument();

    cleanup();
    const wage = pickActivity(a => a.id === 'part-time', 'part-time');
    const wageCost = getActivityCost(wage, 4);
    expect(wageCost).toBeLessThan(0);
    renderPicker({
      activities: [wage],
      state: makeState({ money: 999, year: 4 }),
      availableMoney: 999,
    });
    expect(within(activityButton(wage)).getByText(`(+${-wageCost}만)`)).toBeInTheDocument();
  });
});

describe('ActivityPicker 학교급 배지', () => {
  it('unlockYear===year이면 NEW를 띄운다', () => {
    const act = pickActivity(a => a.unlockYear === 4 && a.id === 'part-time', 'part-time unlockYear');
    renderPicker({
      activities: [act],
      state: makeState({ year: 4, money: 999 }),
      availableMoney: 999,
    });
    expect(within(activityButton(act)).getByText('NEW')).toBeInTheDocument();

    cleanup();
    renderPicker({
      activities: [act],
      state: makeState({ year: 5, money: 999 }),
      availableMoney: 999,
    });
    expect(within(activityButton(act)).queryByText('NEW')).not.toBeInTheDocument();
  });

  it('진학 첫 학기 week≤8에서 비용 인상·시급 배지를 띄우고 week 9에서는 끈다', () => {
    // academy: elementary 2 → middle 3 (year 2)
    const academy = pickActivity(a => a.id === 'academy', 'academy');
    const costY2 = getActivityCost(academy, 2);
    expect(costY2).toBeGreaterThan(academy.yearlyCost!.elementary!);

    renderPicker({
      activities: [academy],
      state: makeState({ year: 2, week: 8, money: 999 }),
      availableMoney: 999,
    });
    expect(within(activityButton(academy)).getByText('⬆ 인상')).toBeInTheDocument();

    cleanup();
    renderPicker({
      activities: [academy],
      state: makeState({ year: 2, week: 9, money: 999 }),
      availableMoney: 999,
    });
    expect(within(activityButton(academy)).queryByText('⬆ 인상')).not.toBeInTheDocument();

    cleanup();
    // part-time: middle -3 → high -4 (year 5) — 시급 인상
    const job = pickActivity(a => a.id === 'part-time', 'part-time');
    const costY5 = getActivityCost(job, 5);
    expect(costY5).toBeLessThan(job.yearlyCost!.middle!);
    renderPicker({
      activities: [job],
      state: makeState({ year: 5, week: 8, money: 999 }),
      availableMoney: 999,
    });
    expect(within(activityButton(job)).getByText('⬆ 시급')).toBeInTheDocument();

    cleanup();
    renderPicker({
      activities: [job],
      state: makeState({ year: 5, week: 9, money: 999 }),
      availableMoney: 999,
    });
    expect(within(activityButton(job)).queryByText('⬆ 시급')).not.toBeInTheDocument();
  });
});

describe('ActivityPicker 방학·슬롯 배지', () => {
  it('vacation-only는 🏖 방학, slots>1은 N칸 사용을 띄운다', () => {
    const vac = pickActivity(a => a.id === 'vacation-library', 'vacation-library');
    expect(vac.seasonGate).toBe('vacation-only');
    expect(vac.slots).toBeGreaterThan(1);
    renderPicker({
      activities: [vac],
      state: makeState({ isVacation: true, money: 999 }),
      availableMoney: 999,
      maxSlots: 10,
    });
    const btn = activityButton(vac);
    expect(within(btn).getByText('🏖 방학')).toBeInTheDocument();
    expect(within(btn).getByText(`${vac.slots}칸 사용`)).toBeInTheDocument();

    cleanup();
    const single = pickActivity(a => a.slots === 1 && !a.seasonGate && a.id === 'self-study', 'self-study');
    renderPicker({ activities: [single], availableMoney: 999 });
    const btn2 = activityButton(single);
    expect(within(btn2).queryByText('🏖 방학')).not.toBeInTheDocument();
    expect(within(btn2).queryByText(/칸 사용/)).not.toBeInTheDocument();
  });
});

describe('ActivityPicker 동행·flavor', () => {
  it('npcChoices가 있으면 NPC 이름을 (이름)으로 띄운다', () => {
    const act = pickActivity(a => a.id === 'hang-out', 'hang-out');
    const state = makeState({ money: 999 });
    const npc = state.npcs.find(n => n.id === 'jihun');
    if (!npc) throw new Error('jihun 없음');
    renderPicker({
      activities: [act],
      state,
      availableMoney: 999,
      npcChoices: { [act.id]: npc.id },
    });
    expect(within(activityButton(act)).getByText(`(${npc.name})`)).toBeInTheDocument();
  });

  it('compact면 flavor 미표시, 방학+vacationDescription이면 그것이, 없으면 flavor', () => {
    const withVacDesc = pickActivity(a => a.id === 'academy', 'academy');
    expect(withVacDesc.vacationDescription).toBeTruthy();
    renderPicker({
      activities: [withVacDesc],
      compact: true,
      state: makeState({ isVacation: true, money: 999 }),
      availableMoney: 999,
    });
    expect(screen.queryByText(withVacDesc.flavor)).not.toBeInTheDocument();
    expect(screen.queryByText(withVacDesc.vacationDescription!)).not.toBeInTheDocument();

    cleanup();
    renderPicker({
      activities: [withVacDesc],
      compact: false,
      state: makeState({ isVacation: true, money: 999 }),
      availableMoney: 999,
    });
    expect(within(activityButton(withVacDesc)).getByText(withVacDesc.vacationDescription!)).toBeInTheDocument();
    expect(screen.queryByText(withVacDesc.flavor)).not.toBeInTheDocument();

    cleanup();
    const noVacDesc = pickActivity(a => a.id === 'self-study', 'self-study');
    expect(noVacDesc.vacationDescription).toBeUndefined();
    renderPicker({
      activities: [noVacDesc],
      state: makeState({ isVacation: true, money: 999 }),
      availableMoney: 999,
    });
    expect(within(activityButton(noVacDesc)).getByText(noVacDesc.flavor)).toBeInTheDocument();
  });
});

describe('ActivityPicker 전략 태그', () => {
  it('표시 태그가 activityHints 결과와 일치하고, companionEligible=false면 관계 유지가 사라지며 최대 2개다', () => {
    const companionId = NPC_COMPANION_ACTIVITIES[0];
    const act = pickActivity(a => a.id === companionId, `동행 ${companionId}`);
    const state = makeState({ money: 999, fatigue: 0, mentalState: 'normal' });

    renderPicker({
      activities: [act],
      state,
      availableMoney: 999,
      companionEligible: true,
      maxSlots: 10,
    });
    const expectedOn = activityHints(act, state, true);
    const btn = activityButton(act);
    for (const h of expectedOn) {
      expect(within(btn).getByText(h.text)).toBeInTheDocument();
    }
    expect(expectedOn.some(h => h.text === '💛 관계 유지')).toBe(true);

    cleanup();
    renderPicker({
      activities: [act],
      state,
      availableMoney: 999,
      companionEligible: false,
      maxSlots: 10,
    });
    const expectedOff = activityHints(act, state, false);
    const btnOff = activityButton(act);
    expect(expectedOff.some(h => h.text === '💛 관계 유지')).toBe(false);
    for (const h of expectedOff) {
      expect(within(btnOff).getByText(h.text)).toBeInTheDocument();
    }
    expect(within(btnOff).queryByText('💛 관계 유지')).not.toBeInTheDocument();

    cleanup();
    // 최대 2개 — 다수 힌트 유발 리터럴
    const heavy = testActivity({
      id: companionId,
      name: '전략태그폭주',
      category: 'rest',
      fatigue: 10,
      moneyCost: 100,
      effects: { mental: 1 },
    });
    const heavyState = {
      ...makeState({
        fatigue: 40,
        mentalState: 'tired' as const,
        parents: ['info', 'emotional'] as GameState['parents'],
        money: 0,
      }),
      stats: { ...makeState().stats, mental: 30 },
    };
    renderPicker({
      activities: [heavy],
      state: heavyState,
      availableMoney: 999,
      companionEligible: true,
      maxSlots: 10,
    });
    const hints = activityHints(heavy, heavyState, true);
    expect(hints).toHaveLength(2);
    const heavyBtn = activityButton(heavy);
    for (const h of hints) {
      expect(within(heavyBtn).getByText(h.text)).toBeInTheDocument();
    }
  });
});
