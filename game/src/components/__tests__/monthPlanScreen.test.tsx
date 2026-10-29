// @vitest-environment jsdom
// 한 달 계획 화면 — 화면 → store.setMonthPlan → 주간 화면 미리 채우기까지 한 줄로 잇는다(배선).
//
// 엔진 쪽(검증·예약)은 monthPlan.test.ts가 잠근다. 여기서는 플레이어가 실제로 누르는 길(칸 → 활동 팝업 → 활동)로
// 계획을 짜서, 예산이 움직이고, 시작하면 계획이 저장되고, 그 주 주간 화면이 그 칸으로 채워지는지를 본다.
// 기능 플래그(featureFlags.ts)가 꺼져 있으면 예전처럼 주간 화면이 먼저 뜬다는 짝도 둔다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

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
import { generateMonthInvites, validateInviteAnswers } from '../../engine/monthInvites';
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
  // 초대 없는 달로 둔다 — 초대가 뜨면 답하기 전까지 저장이 잠긴다. 예전엔 시드가 우연히 0개를 냈다(초대를 달 단위로
  // 고정하며 시드가 바뀌자 깨졌다). 초대를 보는 테스트는 withInvites가 친밀도를 다시 올린다.
  for (const n of s.npcs) n.intimacy = Math.min(n.intimacy, 10);
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
  localStorage.setItem('lifetrack_month_tutorial_seen', '1'); // 월 계획 화면 튜토리얼은 monthTutorial.test가 본다
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

    fireEvent.click(screen.getByRole('button', { name: '계획 저장' }));
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
    fireEvent.click(screen.getByRole('button', { name: '계획 저장' }));
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
    localStorage.setItem(MONTHLY_PLANNING_KEY, '0');
    useGameStore.setState({ state: aprilStart() });
    render(<GameScreen />);
    expect(screen.queryByTestId('month-plan')).toBeNull();
  });

  it('플래그를 켜도 메인은 주간 화면이다 — 띠에서 계획을 열어 저장하면 주간 화면으로 돌아와 칸이 채워지고, 재생은 안 돈다', async () => {
    localStorage.setItem(MONTHLY_PLANNING_KEY, '1');
    useGameStore.setState({ state: aprilStart() });
    render(<GameScreen />);
    expect(screen.queryByTestId('month-plan'), '계획 화면이 주간 화면을 대신했다').toBeNull();
    expect(screen.getByTestId('week-confirm')).toBeTruthy();

    fireEvent.click(screen.getByTestId('month-plan-open'));
    pickInto('slot-5-0', 'reading');
    fireEvent.click(screen.getByRole('button', { name: '모든 주 똑같이' }));
    fireEvent.click(screen.getByRole('button', { name: '계획 저장' }));

    const after = useGameStore.getState().state!;
    expect(after.monthPlan?.weeks).toHaveLength(4);
    expect(after.monthPlan?.weeks[2].activities[0]).toBe('reading');
    // 저장만 했다 — 장부는 멈춘 채 열리고(월말 결산이 손으로 한 주도 담게), 처리된 주는 없다(주는 그대로 W5, 아직 계획 단계).
    expect([after.monthRun?.status, after.monthRun?.log.length, after.monthRun?.stop]).toEqual(['paused', 0, undefined]);
    expect([after.week, after.phase]).toEqual([5, 'weekday']);
    await waitFor(() => expect(screen.queryByTestId('month-plan')).toBeNull());
    expect(screen.getByTestId('month-plan-strip')).toBeTruthy();
    // 주간 화면의 이번 주 칸이 계획대로 채워져 있다 — 확정은 이 화면의 버튼이 한다(손으로 한 주, 재생 장부 없이).
    fireEvent.click(screen.getByTestId('week-confirm'));
    const confirmed = useGameStore.getState().state!;
    expect(confirmed.lastWeekendPlan?.activities[0]).toBe('reading');
    expect(confirmed.monthRun?.log.map(w => [w.week, w.auto]), '손으로 한 주도 장부에 적힌다').toEqual([[5, false]]);
    expect(confirmed.monthRun?.status).toBe('paused');
  });

  it('띠의 [▶ 남은 주 자동 진행]을 눌러야 재생이 돈다 — 첫 주가 계획한 칸으로 확정된다', () => {
    localStorage.setItem(MONTHLY_PLANNING_KEY, '1');
    useGameStore.setState({ state: aprilStart() });
    render(<GameScreen />);
    fireEvent.click(screen.getByTestId('month-plan-open'));
    pickInto('slot-5-0', 'reading');
    fireEvent.click(screen.getByRole('button', { name: '모든 주 똑같이' }));
    fireEvent.click(screen.getByRole('button', { name: '계획 저장' }));
    expect(useGameStore.getState().state!.monthRun?.status).toBe('paused');
    fireEvent.click(screen.getByTestId('playback-resume'));
    const after = useGameStore.getState().state!;
    expect(after.monthRun?.log.map(w => [w.week, w.auto])).toEqual([[5, true]]);
    expect(after.lastWeekendPlan?.activities[0]).toBe('reading');
  });

  it('계획 화면은 저장하지 않고 닫을 수 있다 — 아무것도 남지 않는다', () => {
    localStorage.setItem(MONTHLY_PLANNING_KEY, '1');
    useGameStore.setState({ state: aprilStart() });
    render(<GameScreen />);
    fireEvent.click(screen.getByTestId('month-plan-open'));
    fireEvent.click(screen.getByTestId('month-plan-cancel'));
    expect(useGameStore.getState().state!.monthPlan).toBeUndefined();
    expect(screen.getByTestId('month-plan-entry')).toBeTruthy();
  });
});

describe('친구 초대 카드 — 답해야 시작하고, 수락한 칸은 약속으로 고정된다', () => {
  /** 지훈(40)·수빈(35)을 만난 4월 첫 주, 초대가 n개 나오는 첫 시드. */
  function withInvites(n: number): GameState {
    for (let seed = 0; seed < 2000; seed++) {
      const s = aprilStart({ rngSeed: seed });
      for (const [id, v] of [['jihun', 40], ['subin', 35]] as const) {
        const npc = s.npcs.find(x => x.id === id)!;
        npc.met = true;
        npc.intimacy = v;
      }
      if (generateMonthInvites(s).length === n) return s;
    }
    throw new Error('시드 없음');
  }

  it('초대에 답하기 전엔 시작이 잠기고, 수락하면 그 주가 약속 칸으로 채워지며 복사해도 지워지지 않는다', () => {
    const s = withInvites(2);
    // 복사 원본(첫 주)이 아닌 주의 초대를 수락해야 "복사가 약속을 덮는가"를 겨눌 수 있다(두 초대는 주가 다르다).
    const both = generateMonthInvites(s);
    const first = both.find(i => i.week !== 5)!;
    const second = both.find(i => i !== first)!;
    const onStart = vi.fn<(p: MonthPlan) => string | null>(() => null);
    render(<MonthPlanScreen state={s} onSetRoutine={vi.fn()} onStart={onStart} />);
    expect(screen.getByRole('button', { name: /친구 초대에 답해 주세요/ }).hasAttribute('disabled')).toBe(true);

    const card = screen.getByTestId(`invite-${first.npcId}`);
    fireEvent.click(within(card).getByRole('button', { name: /좋아/ }));
    const name = s.npcs.find(n => n.id === first.npcId)!.name;
    expect(screen.getByTestId(`week-summary-${first.week}`).textContent).toContain(name);

    fireEvent.click(screen.getByRole('button', { name: '모든 주 똑같이' }));
    expect(screen.getByTestId(`week-summary-${first.week}`).textContent, '복사가 약속 칸을 덮었다').toContain(name);

    fireEvent.click(within(screen.getByTestId(`invite-${second.npcId}`)).getByRole('button', { name: '다음에' }));
    fireEvent.click(screen.getByRole('button', { name: '계획 저장' }));
    const plan = onStart.mock.calls[0][0];
    expect(plan.invites?.find(i => i.npcId === first.npcId)?.accepted).toBe(true);
    expect(plan.invites?.find(i => i.npcId === second.npcId)?.accepted).toBe(false);
    expect(validateMonthPlan(s, plan), '화면이 만든 계획을 엔진이 거부했다').toBeNull();
    expect(validateInviteAnswers(s, plan)).toBeNull();
  });

  it('약속한 칸은 펼쳐도 고를 수 없다(초대에서만 바꾼다)', () => {
    const s = withInvites(1);
    const [inv] = generateMonthInvites(s);
    render(<MonthPlanScreen state={s} onSetRoutine={vi.fn()} onStart={vi.fn(() => null)} />);
    fireEvent.click(within(screen.getByTestId(`invite-${inv.npcId}`)).getByRole('button', { name: /좋아/ }));
    if (inv.week !== 5) fireEvent.click(screen.getAllByRole('button', { expanded: false }).find(b => b.textContent?.startsWith(`${inv.week - 4}주`))!);
    expect(screen.getByTestId(`slot-${inv.week}-${inv.slotIdx}`).hasAttribute('disabled')).toBe(true);
  });
});
