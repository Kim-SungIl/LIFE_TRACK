// @vitest-environment jsdom
// 약속 칸 경고 — 수락한 친구 초대의 칸이나 동행을 바꾸면 확정 전에 "약속을 못 지킨다"를 보이고 되돌릴 길을 준다.
// 예전엔 아무 말 없이 확정되고 결산에서 💔 −2만 나왔다(#550 검수 백로그). 판정은 엔진 미리보기(WeekPreview.promises).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p, cgThumbSrc: (p: string) => p }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));

import { GameScreen } from '../GameScreen';
import { useGameStore } from '../../engine/store';
import { createInitialState, predictWeekOutcome } from '../../engine/gameEngine';
import { MONTHLY_PLANNING_KEY } from '../../engine/featureFlags';
import { generateMonthInvites } from '../../engine/monthInvites';
import { ACTIVITIES, getActivityCost } from '../../engine/activities';
import { getMonthBlock, getWeekInfo } from '../../engine/weekMath';
import type { GameState, MonthInvite } from '../../engine/types';

const now = () => useGameStore.getState().state!;

/** Y2 4월 첫 주 — 지훈 40·수빈 35·민재 32(초대 후보). weekInviteScreen.test와 같은 판. */
function april(rngSeed: number): GameState {
  const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 3 });
  Object.assign(s, { year: 2, week: 5, rngSeed, phase: 'weekday' as const, currentEvent: null, isVacation: getWeekInfo(5).isVacation, routineSlot2: 'self-study', routineSlot3: null, money: 50, monthlyMoney: true });
  for (const [id, v] of [['jihun', 40], ['subin', 35], ['minjae', 32]] as const) {
    const n = s.npcs.find(x => x.id === id)!;
    n.met = true;
    n.intimacy = v;
  }
  return s;
}
/** 이번 주(W5)에 초대가 잡힌 판 — 칸을 고를 수 있다(0=토, 1=일). */
function withInvite(slotIdx?: number): { s: GameState; inv: MonthInvite } {
  for (let seed = 0; seed < 4000; seed++) {
    const s = april(seed);
    const inv = generateMonthInvites(s).find(i => i.week === 5 && (slotIdx === undefined || i.slotIdx === slotIdx));
    if (inv) return { s, inv };
  }
  throw new Error('W5 초대가 있는 시드가 없다');
}
const CAT_LABEL: Record<string, string> = { study: '공부', exercise: '운동', social: '관계', talent: '자기계발', rest: '휴식', parent: '가족', work: '알바' };
/** 주간 화면 주말 칸에 활동 하나 넣기 — 칸 → 편집 팝업 → 카테고리 → 활동. */
function pickWeekend(slotIdx: number, id: string) {
  const day = slotIdx === 0 ? '토요일' : '일요일';
  const slot = screen.getAllByRole('button').find(el => (el.textContent ?? '').includes(day) && !el.closest('[data-testid="week-invite"]'));
  if (!slot) throw new Error(`칸 없음: ${day}`);
  fireEvent.click(slot);
  const act = ACTIVITIES.find(a => a.id === id)!;
  const header = screen.getAllByRole('button').find(el => el.getAttribute('aria-expanded') !== null && (el.textContent ?? '').includes(CAT_LABEL[act.category]));
  if (!header) throw new Error(`카테고리 헤더 없음: ${act.category}`);
  if (header.getAttribute('aria-expanded') === 'false') fireEvent.click(header);
  const btn = screen.getAllByRole('button').find(el => el.getAttribute('aria-pressed') != null && !(el.textContent ?? '').includes('수치') && (el.textContent ?? '').includes(act.name));
  if (!btn) throw new Error(`활동 버튼 없음: ${act.name}`);
  fireEvent.click(btn);
}
const accept = () => fireEvent.click(within(screen.getByTestId('week-invite')).getByRole('button', { name: /^좋아/ }));
const npcName = (id: string) => now().npcs.find(n => n.id === id)!.name;

beforeEach(() => {
  cleanup();
  localStorage.clear();
  localStorage.setItem(MONTHLY_PLANNING_KEY, '1');
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  localStorage.setItem('lifetrack_month_tutorial_seen', '1');
  localStorage.setItem('lifetrack_rest_ack', '1');
  useGameStore.setState({ state: null, npcActivityMap: {} });
});

describe('엔진 — 미리보기가 약속 판정을 돌려준다', () => {
  it('preview_promises: 약속 칸 그대로면 kept, 칸을 바꾸면 못 지킨다', () => {
    const { s, inv } = withInvite();
    useGameStore.setState({ state: s });
    useGameStore.getState().answerWeekInvite(true);
    const st = now();
    const kept = Array.from({ length: inv.slotIdx + 1 }, (_, i) => (i === inv.slotIdx ? inv.activityId : ''));
    expect(predictWeekOutcome(st, kept, { [`${inv.activityId}:${inv.slotIdx}`]: inv.npcId }).promises).toEqual([{ npcId: inv.npcId, kept: true }]);
    expect(predictWeekOutcome(st, kept.map((a, i) => (i === inv.slotIdx ? 'rest' : a)), {}).promises).toEqual([{ npcId: inv.npcId, kept: false }]);
    expect(predictWeekOutcome(s, [], {}).promises, '약속이 없는 판은 빈 배열').toEqual([]);
    expect(st.npcs.find(n => n.id === inv.npcId)!.intimacy, '미리보기는 판을 건드리지 않는다').toBe(s.npcs.find(n => n.id === inv.npcId)!.intimacy);
  });
});

describe('주간 화면 — 약속 칸을 바꾸면 경고와 되돌리기', () => {
  it('promise_kept_quiet: 수락한 그대로면 경고가 없다', () => {
    const { s } = withInvite();
    useGameStore.setState({ state: s, npcActivityMap: {} });
    render(<GameScreen />);
    accept();
    expect(screen.queryByTestId('promise-warning')).toBeNull();
  });

  it('promise_moved_warns: 약속 칸을 다른 활동으로 바꾸면 경고, [되돌리기]면 칸이 돌아와 약속을 지킨다', () => {
    const { s, inv } = withInvite();
    useGameStore.setState({ state: s, npcActivityMap: {} });
    render(<GameScreen />);
    accept();
    pickWeekend(inv.slotIdx, 'rest');
    const warn = screen.getByTestId('promise-warning');
    expect(warn.textContent, 'promise_moved_warns').toContain(`${npcName(inv.npcId)}`);
    expect(warn.textContent).toContain('약속을 못 지킨다');
    expect(warn.textContent, '숫자는 내지 않는다(hide-numbers)').not.toMatch(/\d/);
    fireEvent.click(within(warn).getByTestId(`promise-restore-${inv.npcId}`));
    expect(screen.queryByTestId('promise-warning'), '되돌리면 경고가 내려간다').toBeNull();
    fireEvent.click(screen.getByTestId('week-confirm'));
    expect(now().weekLog?.messages.some(m => m.startsWith('📌')), '약속을 지켰다').toBe(true);
  });

  it('promise_moved_confirm_allowed: 경고가 떠도 확정은 막지 않는다 — 어기는 것도 선택이다', () => {
    const { s, inv } = withInvite();
    useGameStore.setState({ state: s, npcActivityMap: {} });
    render(<GameScreen />);
    accept();
    pickWeekend(inv.slotIdx, 'rest');
    expect(screen.getByTestId('promise-warning')).toBeTruthy();
    const confirm = screen.getByTestId('week-confirm') as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(now().weekLog?.messages.some(m => m.startsWith('💔')), '경고대로 됐다').toBe(true);
  });

  it('promise_plan_companion: 계획이 있는 달에도 — 약속 칸의 동행만 바뀌어 있어도 경고하고 되돌린다', () => {
    const { s, inv } = withInvite();
    const other = ['jihun', 'subin', 'minjae'].find(id => id !== inv.npcId)!;
    const activities = Array.from({ length: 2 }, (_, i) => (i === inv.slotIdx ? inv.activityId : ''));
    const block = getMonthBlock(5);
    s.monthPlan = {
      year: 2, month: block.index,
      weeks: Array.from({ length: block.endWeek - 5 + 1 }, (_, i) => ({ week: 5 + i, activities: i === 0 ? activities : ['', ''], npcChoices: i === 0 ? { [`${inv.activityId}:${inv.slotIdx}`]: other } : {} })),
      invites: [{ ...inv, accepted: true }],
    } as GameState['monthPlan'];
    useGameStore.setState({ state: s, npcActivityMap: {} });
    render(<GameScreen />);
    const warn = screen.getByTestId('promise-warning');
    expect(warn.textContent, 'promise_plan_companion').toContain(npcName(inv.npcId));
    fireEvent.click(within(warn).getByTestId(`promise-restore-${inv.npcId}`));
    expect(screen.queryByTestId('promise-warning')).toBeNull();
  });

  it('promise_cut_no_restore: 칸은 그대로인데 이번 주 사건으로 빠지면 이유만 말하고 되돌리기는 없다', () => {
    // 사건의 시간 소모는 **일요일부터** 지운다 — 일요일 약속이 잘리는 판.
    const { s, inv } = withInvite(1);
    s.eventTimeCost = 1;
    useGameStore.setState({ state: s, npcActivityMap: {} });
    render(<GameScreen />);
    accept();
    const warn = screen.getByTestId('promise-warning');
    expect(warn.textContent, 'promise_cut_no_restore').toContain('일정에 밀려');
    expect(warn.textContent, '숫자는 내지 않는다(hide-numbers)').not.toMatch(/\d/);
    expect(within(warn).queryByTestId(`promise-restore-${inv.npcId}`), '되돌릴 칸이 없다').toBeNull();
  });

  it('promise_saturday_survives_cut: 일요일을 비운 주에 시간 소모 1이면 빈 일요일이 빠지고 토요일 약속은 지킨다', () => {
    // 예전엔 엔진이 배열 길이로 잘라 `['hang-out']`(토요일만)의 토요일을 지웠다 — 일요일을 채우면 지켜지는데
    // 화면은 "일정에 밀려 못 지킨다, 되돌릴 칸 없음"이라 말했다(3자 검수 MED).
    const { s, inv } = withInvite(0);
    s.eventTimeCost = 1;
    useGameStore.setState({ state: s, npcActivityMap: {} });
    render(<GameScreen />);
    accept();
    expect(screen.queryByTestId('promise-warning'), 'promise_saturday_survives_cut').toBeNull();
    const pinned = Array.from({ length: inv.slotIdx + 1 }, (_, i) => (i === inv.slotIdx ? inv.activityId : ''));
    expect(predictWeekOutcome(now(), pinned, { [`${inv.activityId}:${inv.slotIdx}`]: inv.npcId }).promises, '저장 모양(길이 1)과 무관').toEqual([{ npcId: inv.npcId, kept: true }]);
    expect(predictWeekOutcome(now(), [...pinned, ''], { [`${inv.activityId}:${inv.slotIdx}`]: inv.npcId }).promises).toEqual([{ npcId: inv.npcId, kept: true }]);
  });

  it('promise_money_reason: 돈이 모자라 빠지면 "일정에 밀려"가 아니라 돈 때문이라고 말한다', () => {
    let found: { s: GameState; inv: MonthInvite } | null = null;
    for (let seed = 0; seed < 4000 && !found; seed++) {
      const s = april(seed);
      const inv = generateMonthInvites(s).find(i => i.week === 5);
      if (inv && getActivityCost(ACTIVITIES.find(a => a.id === inv.activityId)!, s.year) > 0) found = { s, inv };
    }
    if (!found) throw new Error('W5에 유료 초대가 있는 시드가 없다');
    useGameStore.setState({ state: found.s, npcActivityMap: {} });
    render(<GameScreen />);
    accept();
    expect(screen.queryByTestId('promise-warning'), '돈이 있으면 지킨다').toBeNull();
    act(() => { useGameStore.setState({ state: { ...now(), money: 0 } }); });
    const warn = screen.getByTestId('promise-warning');
    expect(warn.textContent, 'promise_money_reason').toContain('돈이 모자라');
    expect(warn.textContent).not.toContain('일정에 밀려');
    expect(warn.textContent, '숫자는 내지 않는다(hide-numbers)').not.toMatch(/\d/);
  });
});
