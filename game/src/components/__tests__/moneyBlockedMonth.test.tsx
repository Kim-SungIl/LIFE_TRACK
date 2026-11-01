// @vitest-environment jsdom
// 돈 회고(설계안 §9) — 월 단위 판에서 "돈에 막힌 주"가 살아 있는가.
//
// 주 단위 판은 주간 화면의 확정 잠금을 셌다(store.markMoneyBlockedWeek). 월 계획을 쓰는 판에선 돈 때문에 계획을
// 바꾸는 일이 월 계획 화면에서 일어나고, 예산 안으로 저장한 계획은 주간 확정에서 거의 안 잠긴다 — 주 단위로만 세면 원리상 0이라
// strapped/tight 결말 줄이 죽는다. 그래서 줄여서 저장한 달은 그 달 남은 주를 한꺼번에 센다(store.markMoneyBlockedMonth).
//   ① store — 남은 주 수만큼, 달마다 한 번, 이미 센 주와 겹치지 않게, 구세이브는 침묵
//   ② 배선 — 월 계획 화면에서 예산을 넘겨 본 뒤 줄여서 저장하면 센다(보기만·되돌리고 닫기·넘긴 적 없음은 안 센다)
//   ③ 도달 — 그렇게 센 값으로 학년말·7년 판정이 tight/strapped에 닿는다
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p, cgThumbSrc: (p: string) => p }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));

import { GameScreen } from '../GameScreen';
import { ACTIVITIES } from '../../engine/activities';
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

const CAT_LABEL: Record<string, string> = {
  study: '공부', exercise: '운동', social: '관계', talent: '자기계발', rest: '휴식', parent: '가족', work: '알바',
};
/** 칸을 열어 활동을 고른다 — 실제 플레이 경로(칸 → 편집 팝업 → 카테고리 → 활동). monthPlanScreen.test와 같다. */
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
  // 세는 건 "돈 때문에 계획을 바꾼 달"이다 — 예산을 넘겨 본 뒤 줄여서 저장했을 때. 열어 보기만 하거나 되돌리고 닫으면 안 센다.
  // 학원 한 달치(12만)를 못 내는 잔액 — 무엇을 골라도 쓸 수 있는 돈이 음수라 저장이 아예 안 된다.
  const broke = (): Partial<GameState> => ({ year: 2, week: 5, money: 1, routineSlot2: 'academy', routineSlot3: null, monthPlan: undefined });
  // 학원비(12만)를 내고 3만이 남는다. 고르기 창은 못 사는 활동을 막으니 예체능 레슨(2만) 한 주는 들어가고,
  // [모든 주 똑같이]로 네 주에 복사하면 8만이라 넘친다 — 넘기는 실제 경로. 휴식으로 바꿔 다시 복사하면 들어온다.
  const tight = (): Partial<GameState> => ({ ...broke(), money: 15 });
  const overspend = () => {
    pickInto('slot-5-0', 'art-lesson');
    fireEvent.click(screen.getByRole('button', { name: '모든 주 똑같이' }));
    expect(screen.getByRole('button', { name: /돈이 부족해요/ }), '전제: 넘겼다').toBeTruthy();
  };
  const reduce = () => {
    pickInto('slot-5-0', 'rest');
    fireEvent.click(screen.getByRole('button', { name: '모든 주 똑같이' }));
  };
  const open = () => {
    localStorage.setItem(MONTHLY_PLANNING_KEY, '1');
    // 초대 없는 달로 둔다 — 초대가 뜨면 답하기 전까지 저장이 잠긴다(monthPlanScreen.test의 aprilStart와 같은 처리).
    useGameStore.setState({ state: { ...now(), npcs: now().npcs.map(n => ({ ...n, intimacy: Math.min(n.intimacy, 10) })) } });
    render(<GameScreen />);
    fireEvent.click(screen.getByTestId('month-plan-open'));
    expect(screen.getByTestId('month-plan')).toBeTruthy();
  };

  it('넘겼다가 줄여서 저장하면 그 달 남은 주를 센다', () => {
    boot(tight());
    open();
    expect(screen.getByRole('button', { name: '계획 저장' }), '전제: 처음엔 예산 안').toBeTruthy();
    expect(blocked(2), '전제: 주간 화면도 안 막혔다').toBe(0);
    overspend();
    expect(now().moneyBlockedMonth, '넘긴 순간엔 아직 안 센다').toBeUndefined();
    reduce();
    fireEvent.click(screen.getByRole('button', { name: '계획 저장' }));
    expect(now().monthPlan, '전제: 저장됐다').toBeTruthy();
    expect(blocked(2)).toBe(getMonthBlock(5).endWeek - 5 + 1);
    expect(now().moneyBlockedMonth?.month).toBe(getMonthBlock(5).index);
  });

  it('넘겼다가 되돌리고 닫으면 안 센다 — 고르다 만 것은 계획을 바꾼 게 아니다', () => {
    boot(tight());
    open();
    overspend();
    reduce();
    fireEvent.click(screen.getByTestId('month-plan-cancel'));
    expect(now().moneyBlockedMonth).toBeUndefined();
    expect(blocked(2)).toBe(0);
  });

  it('저장이 아예 안 되는 달은 열어 보고 닫아도 달로 세지 않는다 — 주간 화면의 확정 잠금이 그 주를 센다', () => {
    boot(broke());
    open();
    expect(screen.getByRole('button', { name: /돈이 부족해요/ })).toBeTruthy();
    fireEvent.click(screen.getByTestId('month-plan-cancel'));
    expect(now().moneyBlockedMonth, '달로는 안 센다').toBeUndefined();
    expect(blocked(2), '주간 화면이 이번 주 하나를 센다').toBe(1);
  });

  it('넘긴 적 없이 저장하면 안 센다(음성 짝)', () => {
    boot({ ...broke(), money: 200 });
    open();
    pickInto('slot-5-0', 'art-lesson');
    fireEvent.click(screen.getByRole('button', { name: '모든 주 똑같이' }));
    fireEvent.click(screen.getByRole('button', { name: '계획 저장' }));
    expect(now().monthPlan, '전제: 저장됐다').toBeTruthy();
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
