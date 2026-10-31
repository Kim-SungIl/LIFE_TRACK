// @vitest-environment jsdom
// UX 재확인 U5 — 루틴 없이도 한 달 계획이 저장됐고, 자동 진행을 누르면 그제서야 "방과후 루틴이 비어 있어요"로 멈췄다.
// ▶를 다시 눌러도 같은 문구가 그대로라 눌렸는지조차 알 수 없었다.
// 잠그는 것:
//   · 학기 주가 남은 달은 루틴이 없으면 저장이 잠기고 이유를 말한다 — 방학 주만 남았으면 잠그지 않는다(확정 잠금과 같은 근거)
//   · 같은 이유로 또 막히면 알림이 새로 뜬다(다시 그려지고 흔들리고, 무엇을 할지 덧붙는다)
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MonthPlanScreen } from '../screens/main/MonthPlanScreen';
import { MainWeekScreen } from '../screens/main/MainWeekScreen';
import { TUTORIAL_KEYS } from '../tutorialSteps';
import { createInitialState, predictWeekOutcome } from '../../engine/gameEngine';
import { getBackground } from '../../engine/backgrounds';
import { getWeekInfo } from '../../engine/weekMath';
import { getConfirmGate } from '../../engine/weekendPlan';
import type { GameState, MonthPlan } from '../../engine/types';

afterEach(cleanup);

function at(week: number, routineSlot2: string | null): GameState {
  const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 21 });
  Object.assign(s, { year: 2, week, phase: 'weekday' as const, currentEvent: null, isVacation: getWeekInfo(week).isVacation, routineSlot2, routineSlot3: null, money: 30 });
  for (const n of s.npcs) n.intimacy = Math.min(n.intimacy, 10); // 초대 없는 달 — 답하기 잠금이 끼지 않게
  return s;
}
const saveButton = () => screen.getByRole('button', { name: /계획 저장|루틴을 골라/ });

describe('한 달 계획 — 루틴이 없으면 저장 전에 막는다', () => {
  it('plan_needs_routine: 학기 달에 루틴이 비면 저장이 잠기고 이유를 말한다', () => {
    const onStart = vi.fn<(p: MonthPlan) => string | null>(() => null);
    render(<MonthPlanScreen state={at(5, null)} onSetRoutine={vi.fn()} onStart={onStart} />);
    expect(saveButton().textContent, 'plan_needs_routine').toContain('방과후 루틴을 골라 주세요');
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(saveButton());
    expect(onStart).not.toHaveBeenCalled();
  });

  it('routine_set_saves: 루틴이 있으면 그대로 저장된다(양성 짝)', () => {
    const onStart = vi.fn<(p: MonthPlan) => string | null>(() => null);
    render(<MonthPlanScreen state={at(5, 'self-study')} onSetRoutine={vi.fn()} onStart={onStart} />);
    expect(saveButton().textContent).toBe('계획 저장');
    fireEvent.click(saveButton());
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  // 섞인 달(7월 W17~20)은 학기 주가 남아 있는 동안만 잠근다. W20부터는 방학 주뿐이라 루틴이 필요 없다.
  it.each([
    [21, false, '방학 달'],
    [20, false, '섞인 달의 방학 주만 남음'],
    [17, true, '섞인 달의 학기 주가 남음'],
  ])('vacation_ok: W%i 루틴 없음 → 잠김 %s (%s)', (week, locked) => {
    render(<MonthPlanScreen state={at(week, null)} onSetRoutine={vi.fn()} onStart={vi.fn(() => null)} />);
    expect((saveButton() as HTMLButtonElement).disabled).toBe(locked);
  });

  // 화면 판정이 엔진의 확정 잠금과 갈리면 저장은 되는데 재생이 멈추는 구멍이 다시 열린다 — 그 주 기준으로 같은지 본다.
  it.each([5, 17, 20, 21])('matches_gate: W%i 첫 주 — 저장 잠금 ⇔ 확정 잠금의 missingRoutine', week => {
    const s = at(week, null);
    const gate = getConfirmGate(s, predictWeekOutcome(s, [], {}));
    render(<MonthPlanScreen state={s} onSetRoutine={vi.fn()} onStart={vi.fn(() => null)} />);
    expect((saveButton() as HTMLButtonElement).disabled, 'matches_gate').toBe(gate.missingRoutine);
  });
});

describe('▶ 자동 진행 — 같은 이유로 또 막혀도 반응한다', () => {
  function renderStrip(onAutoPlay: () => string | null) {
    localStorage.setItem(TUTORIAL_KEYS.everSeen, '1');
    localStorage.setItem(TUTORIAL_KEYS.done, '1');
    const noop = () => {};
    return render(
      <MainWeekScreen
        state={at(5, 'self-study')}
        bgProps={{ bg: getBackground(1, false, 'good', 1), bgImgError: true, onImgError: noop }}
        onSetRoutine={noop} onTalkNpc={vi.fn() as never} onTalkHome={vi.fn() as never}
        onResolveParentChoice={noop} onBuyItem={noop} onConfirmWeek={noop}
        monthly={{ hasPlan: true, stopLine: null, talkBank: 0, onOpenPlan: noop, onAutoPlay }}
      />,
    );
  }

  it('repeat_feedback: 두 번째부터는 새 알림으로 다시 그려지고, 무엇을 할지 덧붙는다', () => {
    renderStrip(() => '방과후 루틴이 비어 있어요');
    fireEvent.click(screen.getByTestId('playback-resume'));
    const first = screen.getByTestId('playback-error');
    expect(first.textContent).toBe('방과후 루틴이 비어 있어요');
    expect(first.className).toBe('');
    fireEvent.click(screen.getByTestId('playback-resume'));
    const second = screen.getByTestId('playback-error');
    expect(second, 'repeat_feedback: 같은 노드면 스크린 리더가 다시 안 읽는다').not.toBe(first);
    expect(second.getAttribute('data-repeat')).toBe('2');
    expect(second.className).toBe('nudge');
    expect(second.textContent).toContain('고친 뒤 다시 눌러 주세요');
  });

  it('repeat_clears: 막힘이 풀리면 알림이 사라진다', () => {
    let why: string | null = '이번 주 활동비가 모자라요';
    renderStrip(() => why);
    fireEvent.click(screen.getByTestId('playback-resume'));
    expect(screen.getByTestId('playback-error')).toBeTruthy();
    why = null;
    fireEvent.click(screen.getByTestId('playback-resume'));
    expect(screen.queryByTestId('playback-error')).toBeNull();
  });
});
