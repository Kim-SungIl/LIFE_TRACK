// @vitest-environment jsdom
// 한 달 계획 화면 — 화면 → store.setMonthPlan → 주간 화면 미리 채우기까지 한 줄로 잇는다(배선).
//
// 엔진 쪽(검증·예약)은 monthPlan.test.ts가 잠근다. 여기서는 플레이어가 실제로 누르는 길(칸 → 활동 팝업 → 활동)로
// 계획을 짜서, 예산이 움직이고, 시작하면 계획이 저장되고, 그 주 주간 화면이 그 칸으로 채워지는지를 본다.
// 기능 플래그(featureFlags.ts)가 꺼져 있으면 예전처럼 주간 화면이 먼저 뜬다는 짝도 둔다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p, cgThumbSrc: (p: string) => p }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));

import { GameScreen } from '../GameScreen';
import { MonthPlanScreen } from '../screens/main/MonthPlanScreen';
import { useGameStore } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { ACTIVITIES } from '../../engine/activities';
import { payMonthStart } from '../../engine/monthlyMoney';
import { MONTHLY_PLANNING_KEY } from '../../engine/featureFlags';
import { validateMonthPlan } from '../../engine/monthPlan';
import type { GameState, MonthPlan } from '../../engine/types';

const CAT_LABEL: Record<string, string> = {
  study: '공부', exercise: '운동', social: '관계', talent: '자기계발', rest: '휴식', parent: '가족', work: '알바',
};

/** Y2 4월 첫 주(W5), 학원+독학 선불 완료 — 잔액 = 앞서 남은 4 + 용돈 20 − 학원 12 = 12. */
function aprilStart(patch: Partial<GameState> = {}): GameState {
  const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 21 });
  Object.assign(s, {
    year: 2, week: 5, phase: 'weekday' as const, currentEvent: null, isVacation: false,
    routineSlot2: 'academy', routineSlot3: 'self-study', money: 4,
  }, patch);
  payMonthStart(s);
  return s;
}

/** 칸을 열어 활동을 고른다 — 실제 플레이 경로(칸 → 편집 팝업 → 카테고리 → 활동). */
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

beforeEach(() => {
  cleanup();
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  localStorage.setItem('lifetrack_rest_ack', '1');
  useGameStore.setState({ state: null, npcActivityMap: {} });
});

describe('한 달 계획 화면 — 짜고, 예산이 움직이고, 시작하면 저장된다', () => {
  it('유료 활동을 넣으면 쓸 수 있는 돈이 그만큼 줄고, "모든 주 똑같이"가 4주에 복사된다', () => {
    const s = aprilStart();
    const onStart = vi.fn<(p: MonthPlan) => string | null>(() => null);
    render(<MonthPlanScreen state={s} onSetRoutine={vi.fn()} onStart={onStart} />);
    expect(screen.getByTestId('month-spendable').textContent).toContain(`${s.money}만`);

    pickInto('slot-5-0', 'art-lesson'); // 예체능 레슨 2만
    expect(screen.getByTestId('month-spendable').textContent).toContain(`${s.money - 2}만`);

    fireEvent.click(screen.getByRole('button', { name: '모든 주 똑같이' }));
    expect(screen.getByTestId('month-spendable').textContent, '4주 × 2만이 예약돼야 한다').toContain(`${s.money - 8}만`);
    for (const w of [6, 7, 8]) expect(screen.getByTestId(`week-summary-${w}`).textContent).toContain('예체능 레슨');

    fireEvent.click(screen.getByRole('button', { name: '이번 달 시작' }));
    const plan = onStart.mock.calls[0][0];
    expect(plan.year).toBe(2);
    expect(plan.month).toBe(2);
    expect(plan.weeks.map(w => w.week)).toEqual([5, 6, 7, 8]);
    expect(plan.weeks.every(w => w.activities[0] === 'art-lesson')).toBe(true);
  });

  it('동행 활동을 다른 활동으로 바꾸면 그 칸의 동행도 지운다 — 엔진 검증이 계획을 받아 준다', () => {
    const s = aprilStart();
    const onStart = vi.fn((p: MonthPlan) => validateMonthPlan(s, p));
    render(<MonthPlanScreen state={s} onSetRoutine={vi.fn()} onStart={onStart} />);
    pickInto('slot-5-0', 'hang-out'); // 동행 활동 → 친구 고르기 창
    fireEvent.click(screen.getByRole('button', { name: /지훈/ }));
    expect(screen.getByTestId('week-summary-5').textContent).toContain('지훈');
    pickInto('slot-5-0', 'reading'); // 같은 칸을 동행 없는 활동으로
    fireEvent.click(screen.getByRole('button', { name: '이번 달 시작' }));
    expect(onStart.mock.calls[0][0].weeks[0].npcChoices, '바뀐 칸의 동행이 남았다').toEqual({});
    expect(onStart.mock.results[0].value, '엔진 검증이 계획을 거부했다').toBeNull();
  });

  it('계획이 잔액을 넘으면 시작을 막고 이유를 말한다', () => {
    const s = aprilStart();
    s.money = 3;
    render(<MonthPlanScreen state={s} onSetRoutine={vi.fn()} onStart={vi.fn(() => null)} />);
    pickInto('slot-5-0', 'art-lesson');
    fireEvent.click(screen.getByRole('button', { name: '모든 주 똑같이' })); // 8 > 3
    const cta = screen.getByRole('button', { name: /돈이 부족해요/ });
    expect(cta.hasAttribute('disabled')).toBe(true);
  });

  it('섞인 달(7월)은 방학 부분이 따로 있고, 방학 주는 칸이 5개다', () => {
    const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 21 });
    Object.assign(s, { year: 2, week: 17, phase: 'weekday' as const, currentEvent: null, isVacation: false, routineSlot2: 'self-study', money: 30 });
    render(<MonthPlanScreen state={s} onSetRoutine={vi.fn()} onStart={vi.fn(() => null)} />);
    expect(screen.getByText(/방학 부분 · 하루 5칸/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { expanded: false }).find(b => b.textContent?.startsWith('4주'))!);
    expect(within(screen.getByTestId('month-plan')).getByTestId('slot-20-4')).toBeTruthy();
    expect(screen.queryByTestId('slot-17-2'), '학기 주는 2칸').toBeNull();
    expect(screen.getByText(/기말고사 주/)).toBeTruthy();
  });

  it('다음 달 첫 주 시험을 미리 말한다(6월 → 7월 기말)', () => {
    const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 21 });
    Object.assign(s, { year: 2, week: 13, phase: 'weekday' as const, currentEvent: null, isVacation: false, routineSlot2: 'self-study', money: 30 });
    render(<MonthPlanScreen state={s} onSetRoutine={vi.fn()} onStart={vi.fn(() => null)} />);
    expect(screen.getByRole('note').textContent).toContain('기말고사');
  });
});

describe('GameScreen 배선 — 플래그·저장·미리 채우기', () => {
  it('플래그가 꺼져 있으면 예전처럼 주간 화면이 먼저 뜬다', () => {
    useGameStore.setState({ state: aprilStart() });
    render(<GameScreen />);
    expect(screen.queryByTestId('month-plan')).toBeNull();
  });

  it('플래그를 켜면 계획 없는 달은 월 계획 화면 → 시작하면 store에 저장되고 그 주 주간 화면이 계획한 칸으로 뜬다', () => {
    localStorage.setItem(MONTHLY_PLANNING_KEY, '1');
    useGameStore.setState({ state: aprilStart() });
    const { rerender } = render(<GameScreen />);
    expect(screen.getByTestId('month-plan')).toBeTruthy();

    pickInto('slot-5-0', 'reading');
    fireEvent.click(screen.getByRole('button', { name: '모든 주 똑같이' }));
    fireEvent.click(screen.getByRole('button', { name: '이번 달 시작' }));

    const saved = useGameStore.getState().state!.monthPlan;
    expect(saved?.weeks).toHaveLength(4);
    expect(saved?.weeks[2].activities[0]).toBe('reading');
    rerender(<GameScreen />);
    expect(screen.queryByTestId('month-plan'), '저장했는데 계획 화면이 또 뜬다').toBeNull();
    // 주간 화면 토요일 칸이 계획한 활동으로 채워져 있다
    expect(screen.getAllByText('독서').length).toBeGreaterThan(0);
  });
});
