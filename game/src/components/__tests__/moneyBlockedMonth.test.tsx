// @vitest-environment jsdom
// 돈 회고(설계안 §9) — 월 단위 판에서 "돈에 막힌 주"가 살아 있는가.
//
// 주 단위 판은 주간 화면의 확정 잠금을 셌다(store.markMoneyBlockedWeek). 월 단위 판(기본값)에선 그 잠금이
// 월 계획 화면의 [이번 달 시작]에서 일어나고, 주간 화면의 확정은 재생이 대신 누른다 — 주 단위로만 세면 원리상 0이라
// strapped/tight 결말 줄이 죽는다. 그래서 막힌 달은 그 달 남은 주를 한꺼번에 센다(store.markMoneyBlockedMonth).
//   ① store — 남은 주 수만큼, 달마다 한 번, 이미 센 주와 겹치지 않게, 구세이브는 침묵
//   ② 배선 — 월 계획 화면이 돈 때문에 잠기면 실제로 센다(안 잠기면 안 센다)
//   ③ 도달 — 그렇게 센 값으로 학년말·7년 판정이 tight/strapped에 닿는다
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p, cgThumbSrc: (p: string) => p }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));

import { GameScreen } from '../GameScreen';
import { useGameStore } from '../../engine/store';
import { MONTHLY_PLANNING_KEY } from '../../engine/featureFlags';
import { getMonthBlock } from '../../engine/weekMath';
import { emptyMoneyYears, moneyPatternForYear, moneyPatternLifetime, moneyTrajectoryForYear, moneyTrajectoryLifetime } from '../../engine/moneyTrajectory';
import type { GameState } from '../../engine/types';

const api = () => useGameStore.getState();
const now = () => api().state!;
const blocked = (year: number) => now().moneyBlockedWeeksByYear![year - 1];

beforeEach(() => {
  cleanup();
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  localStorage.setItem('lifetrack_month_tutorial_seen', '1');
  localStorage.setItem('lifetrack_rest_ack', '1');
  useGameStore.setState({ state: null, npcActivityMap: {} });
});

function boot(patch: Partial<GameState> = {}) {
  api().startGame('male', ['emotional', 'info']);
  useGameStore.setState({ state: { ...now(), phase: 'weekday', currentEvent: null, ...patch } });
}

describe('① store.markMoneyBlockedMonth', () => {
  it('그 달 남은 주 수만큼 센다 — 달 첫 주면 그 달 전부, 달 중간이면 남은 주만', () => {
    boot({ year: 2, week: 5 });
    const block = getMonthBlock(5);
    api().markMoneyBlockedMonth();
    expect(blocked(2)).toBe(block.endWeek - 5 + 1);
    boot({ year: 2, week: 11 });
    const mid = getMonthBlock(11);
    expect(mid.endWeek, '전제: 11주는 달 중간').toBeGreaterThan(11);
    api().markMoneyBlockedMonth();
    expect(blocked(2)).toBe(mid.endWeek - 11 + 1);
  });

  it('같은 달은 한 번만 — 화면이 매 렌더 알려와도', () => {
    boot({ year: 1, week: 1 });
    for (let i = 0; i < 10; i++) api().markMoneyBlockedMonth();
    expect(blocked(1)).toBe(getMonthBlock(1).endWeek);
  });

  it('다음 달은 따로 센다', () => {
    boot({ year: 1, week: 1 });
    api().markMoneyBlockedMonth();
    const first = blocked(1);
    const next = getMonthBlock(1).endWeek + 1;
    useGameStore.setState({ state: { ...now(), week: next } });
    api().markMoneyBlockedMonth();
    expect(blocked(1)).toBe(first + getMonthBlock(next).endWeek - next + 1);
  });

  it('이미 센 주와 겹치지 않는다 — 이번 주를 주간 화면이 셌으면 빼고, 막힌 달 안의 주간 화면 알림은 안 센다', () => {
    boot({ year: 1, week: 1 });
    api().markMoneyBlockedWeek();
    expect(blocked(1)).toBe(1);
    api().markMoneyBlockedMonth();
    expect(blocked(1), '이번 주는 이미 1이다 — 달 전체(4주)가 돼야 한다').toBe(getMonthBlock(1).endWeek);
    // 재생이 멈춰 같은 달의 다음 주 주간 화면이 또 잠겨도 그 주는 이미 셌다.
    useGameStore.setState({ state: { ...now(), week: 2 } });
    api().markMoneyBlockedWeek();
    expect(blocked(1)).toBe(getMonthBlock(1).endWeek);
    // 다음 달 주간 화면 잠김은 센다(막힌 달 밖).
    useGameStore.setState({ state: { ...now(), week: getMonthBlock(1).endWeek + 1 } });
    api().markMoneyBlockedWeek();
    expect(blocked(1)).toBe(getMonthBlock(1).endWeek + 1);
  });

  it('이전 상태의 배열을 건드리지 않는다(새 배열에 쓴다)', () => {
    boot({ year: 1, week: 1 });
    const before = now().moneyBlockedWeeksByYear!;
    api().markMoneyBlockedMonth();
    expect(before[0]).toBe(0);
    expect(now().moneyBlockedWeeksByYear).not.toBe(before);
  });

  it('구세이브(돈 궤적 배열 없음)는 조용히 아무것도 안 쌓는다', () => {
    boot({ year: 1, week: 1, moneySpentByYear: undefined, moneyBlockedWeeksByYear: undefined });
    api().markMoneyBlockedMonth();
    expect(now().moneyBlockedWeeksByYear).toBeUndefined();
  });

  it('학년 전환 대기(W49)에서는 안 센다', () => {
    boot({ year: 1, week: 49 });
    api().markMoneyBlockedMonth();
    expect(now().moneyBlockedWeeksByYear).toEqual(emptyMoneyYears());
    expect(now().moneyBlockedMonth, '달 표시도 안 남긴다 — 학년 전환 중엔 "이번 달"이 없다').toBeUndefined();
  });
});

describe('② 배선 — 월 계획 화면', () => {
  // 학원 한 달치(주 2만 × 4주)를 못 내는 잔액 — 계획 화면의 쓸 수 있는 돈이 음수라 [이번 달 시작]이 잠긴다.
  const broke = (): Partial<GameState> => ({ year: 2, week: 5, money: 1, routineSlot2: 'academy', routineSlot3: null, monthPlan: undefined });

  it('[이번 달 시작]이 돈 때문에 잠기면 그 달을 센다', () => {
    localStorage.setItem(MONTHLY_PLANNING_KEY, '1');
    boot(broke());
    render(<GameScreen />);
    expect(screen.getByTestId('month-plan')).toBeTruthy();
    expect(screen.getByRole('button', { name: /돈이 부족해요/ })).toBeTruthy();
    expect(blocked(2)).toBe(getMonthBlock(5).endWeek - 5 + 1);
  });

  it('잠기지 않으면 안 센다(음성 짝)', () => {
    localStorage.setItem(MONTHLY_PLANNING_KEY, '1');
    boot({ ...broke(), money: 200 });
    render(<GameScreen />);
    expect(screen.queryByRole('button', { name: /돈이 부족해요/ })).toBeNull();
    expect(blocked(2)).toBe(0);
  });
});

describe('③ 도달 — 센 값으로 회고 판정이 닿는다', () => {
  it('막힌 달 하나면 그 해는 tight, 석 달이면 strapped — 7년은 strapped 해가 세 해면 strapped', () => {
    boot({ year: 1, week: 1 });
    api().markMoneyBlockedMonth();
    expect(moneyPatternForYear(moneyTrajectoryForYear(now(), 1)!)).toBe('tight');
    for (const w of [5, 9]) {
      useGameStore.setState({ state: { ...now(), week: w } });
      api().markMoneyBlockedMonth();
    }
    expect(blocked(1), '전제: 석 달 = 12주').toBe(12);
    expect(moneyPatternForYear(moneyTrajectoryForYear(now(), 1)!)).toBe('strapped');
    for (const y of [2, 3]) {
      for (const w of [1, 5, 9]) {
        useGameStore.setState({ state: { ...now(), year: y, week: w } });
        api().markMoneyBlockedMonth();
      }
    }
    expect(moneyPatternLifetime(moneyTrajectoryLifetime(now())!)).toBe('strapped');
  });
});
