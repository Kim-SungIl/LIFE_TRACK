// @vitest-environment jsdom
// 주간 화면이 메인일 때 계획 화면을 오가는 길(3자 검수 후속, 2026-10-29) — 주간 화면의 로컬 칸이 사라지거나 버려지지 않는가.
//   · 계획 화면을 열었다 [닫기]로 돌아오면 고르던 이번 주 칸이 그대로다(열면 주간 화면이 언마운트된다)
//   · [▶ 남은 주 자동 진행]은 화면에서 손본 이번 주 칸으로 확정한다(저장된 계획 칸이 아니라)
//   · 첫 판 주간 튜토리얼 도중 계획 화면을 열었다 돌아와도 주간 튜토리얼이 다시 뜬다(계획 화면 튜토리얼이 그 키를 안 쓴다)
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p, cgThumbSrc: (p: string) => p }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));

import { GameScreen } from '../GameScreen';
import { useGameStore } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { ACTIVITIES } from '../../engine/activities';
import { MONTHLY_PLANNING_KEY } from '../../engine/featureFlags';
import { getMonthBlock, getWeekInfo } from '../../engine/weekMath';
import { MONTHLY_MAIN_STEPS } from '../tutorialSteps';
import type { GameState, MonthPlan } from '../../engine/types';

const CAT_LABEL: Record<string, string> = { study: '공부', exercise: '운동', social: '관계', talent: '자기계발', rest: '휴식', parent: '가족', work: '알바' };
const NAME = (id: string) => ACTIVITIES.find(a => a.id === id)!.name;
const now = () => useGameStore.getState().state!;

/** 슬롯을 열어 활동을 고른다 — 실제 플레이 경로(슬롯 탭 → 편집 팝업 → 활동 버튼). weekendRepeatWiring과 같은 길. */
function pickActivity(id: string, slotLabel: string): void {
  const act = ACTIVITIES.find(a => a.id === id)!;
  fireEvent.click(screen.getByText(slotLabel).closest('button')!);
  const header = screen.getAllByRole('button').find(el => el.getAttribute('aria-expanded') !== null && (el.textContent ?? '').includes(CAT_LABEL[act.category]));
  if (!header) throw new Error(`카테고리 헤더 없음: ${act.category}`);
  if (header.getAttribute('aria-expanded') === 'false') fireEvent.click(header);
  const btn = screen.getAllByRole('button').find(el => el.getAttribute('aria-pressed') != null && !(el.textContent ?? '').includes('수치') && (el.textContent ?? '').includes(act.name));
  if (!btn) throw new Error(`활동 버튼 없음: ${act.name}`);
  fireEvent.click(btn);
}

/** Y2 4월 첫 주, 루틴 있음, 초대 없음(친밀도를 낮춰 둔다 — 초대가 뜨면 저장이 답을 기다린다). */
function april(): GameState {
  const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 21 });
  Object.assign(s, { year: 2, week: 5, phase: 'weekday' as const, currentEvent: null, isVacation: getWeekInfo(5).isVacation, routineSlot2: 'self-study', routineSlot3: null, money: 30, monthlyMoney: true });
  for (const n of s.npcs) n.intimacy = Math.min(n.intimacy, 10);
  return s;
}
function planOf(s: GameState, activities: string[]): MonthPlan {
  const b = getMonthBlock(s.week);
  return { year: s.year, month: b.index, invites: [], weeks: Array.from({ length: b.endWeek - s.week + 1 }, (_, i) => ({ week: s.week + i, activities: [...activities], npcChoices: {} })) };
}

beforeEach(() => {
  cleanup();
  localStorage.clear();
  localStorage.setItem(MONTHLY_PLANNING_KEY, '1');
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  localStorage.setItem('lifetrack_month_tutorial_seen', '1');
  localStorage.setItem('lifetrack_rest_ack', '1');
  useGameStore.setState({ state: null, npcActivityMap: {} });
});

describe('계획 화면을 열었다 닫아도 고르던 이번 주 칸이 남는다', () => {
  it('계획이 없는 달 — 토요일에 고른 칸이 [📅 이번 달 계획] → [닫기] 뒤에도 있고, 확정하면 그 칸으로 간다', async () => {
    useGameStore.setState({ state: april(), npcActivityMap: {} });
    render(<GameScreen />);
    pickActivity('reading', '토요일');
    expect(screen.getByText(NAME('reading'))).toBeTruthy();
    fireEvent.click(screen.getByTestId('month-plan-open'));
    await waitFor(() => screen.getByTestId('month-plan'));
    fireEvent.click(screen.getByTestId('month-plan-cancel'));
    await waitFor(() => screen.getByTestId('month-plan-entry'));
    fireEvent.click(screen.getByTestId('week-confirm'));
    expect(now().lastWeekendPlan?.activities[0], '닫고 돌아왔더니 고르던 칸이 사라졌다').toBe('reading');
  });

  it('저장하면 새 계획의 칸이 이긴다 — 고르던 칸은 되살리지 않는다', async () => {
    useGameStore.setState({ state: april(), npcActivityMap: {} });
    render(<GameScreen />);
    pickActivity('reading', '토요일');
    fireEvent.click(screen.getByTestId('month-plan-open'));
    await waitFor(() => screen.getByTestId('month-plan'));
    // 계획 화면에서 아무것도 안 고르고 저장 — 이번 주 칸은 비어 있다.
    fireEvent.click(screen.getByRole('button', { name: '계획 저장' }));
    await waitFor(() => screen.getByTestId('month-plan-strip'));
    fireEvent.click(screen.getByTestId('week-confirm'));
    expect(now().lastWeekendPlan?.activities[0] ?? '').toBe('');
  });
});

describe('[▶ 남은 주 자동 진행]은 화면에서 손본 이번 주 칸으로 간다', () => {
  it('계획엔 휴식, 화면에서 토요일을 독서로 바꾸고 자동 진행 → 이번 주는 독서로 확정되고 계획도 그 칸이 된다', async () => {
    const s = april();
    useGameStore.setState({ state: s, npcActivityMap: {} });
    expect(useGameStore.getState().setMonthPlan(planOf(s, ['rest', 'rest']))).toBeNull();
    render(<GameScreen />);
    await waitFor(() => screen.getByTestId('month-plan-strip'));
    pickActivity('reading', '토요일');
    act(() => { fireEvent.click(screen.getByTestId('playback-resume')); });
    expect(now().monthRun!.log.map(w => [w.week, w.auto])).toEqual([[5, true]]);
    expect(now().lastWeekendPlan?.activities[0], '화면에서 고친 칸을 버리고 저장된 계획대로 확정했다').toBe('reading');
    // 다음 주들은 원래 계획 그대로다.
    expect(now().monthPlan!.weeks.find(w => w.week === 6)!.activities).toEqual(['rest', 'rest']);
  });

  it('화면에서 안 건드렸으면 계획 그대로 간다(음성 짝)', async () => {
    const s = april();
    useGameStore.setState({ state: s, npcActivityMap: {} });
    expect(useGameStore.getState().setMonthPlan(planOf(s, ['reading', 'rest']))).toBeNull();
    render(<GameScreen />);
    await waitFor(() => screen.getByTestId('month-plan-strip'));
    act(() => { fireEvent.click(screen.getByTestId('playback-resume')); });
    expect(now().lastWeekendPlan?.activities).toEqual(['reading', 'rest']);
  });
});

describe('주간 튜토리얼 도중 계획 화면을 열었다 돌아와도 주간 튜토리얼이 남는다', () => {
  it('계획 화면 튜토리얼을 건너뛰고 닫으면 주간 튜토리얼이 처음부터 다시 뜬다', async () => {
    localStorage.removeItem('lifetrack_tutorial_ever_seen');
    localStorage.removeItem('lifetrack_month_tutorial_seen');
    useGameStore.setState({ state: april(), npcActivityMap: {} });
    render(<GameScreen />);
    const title = () => document.querySelector('[data-tutorial-card] > div:nth-child(2)')?.textContent ?? null;
    expect(title()).toBe(MONTHLY_MAIN_STEPS[0].title);
    fireEvent.click(screen.getByTestId('month-plan-open'));
    await waitFor(() => screen.getByTestId('month-plan'));
    fireEvent.click(screen.getByRole('button', { name: '건너뛰기' }));
    fireEvent.click(screen.getByTestId('month-plan-cancel'));
    await waitFor(() => screen.getByTestId('month-plan-entry'));
    expect(title(), '계획 화면 튜토리얼이 주간 튜토리얼 키까지 써서 나머지 스텝이 사라졌다').toBe(MONTHLY_MAIN_STEPS[0].title);
  });
});
