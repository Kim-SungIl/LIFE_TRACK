// @vitest-environment jsdom
// 루틴 콤보 배지의 **배선** 계약 — MainWeekScreen(문턱) → WeekPlanner(접두·"최대") 한 줄.
//
// WeekPlanner 단위 테스트는 콤보 주차를 prop 으로 받으므로, 그 prop 을 만드는 쪽이 부모 보정을
// 빠뜨려도 전부 통과한다. 실제로 그 공백에서 결함이 났다: 엔진은 `getRoutineBonus(weeks + boost)`로
// 계산해 strict 부모 판의 상한이 생주차 7인데, 화면 문턱은 보정 없는 생주차를 3과 비교했다.
// 그래서 여기서는 화면 전체를 실제 GameState 로 렌더해 두 층이 같은 기준을 쓰는지 본다.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MainWeekScreen } from '../MainWeekScreen';
import { makeState } from '../../../../test/fixtures';
import { getBackground } from '../../../../engine/backgrounds';
import { ACTIVITIES, getActivityCost } from '../../../../engine/activities';
import { ROUTINE_BONUS_PLATEAU_WEEKS, ROUTINE_TIER_WEEKS } from '../../../../engine/gameEngine';
import type { GameState } from '../../../../engine/types';

function freeRoutineActivityId(): string {
  const a = ACTIVITIES.find(x => x.slots === 1 && getActivityCost(x, 1) === 0 && x.category !== 'rest' && !x.seasonGate);
  if (!a) throw new Error('무료 1칸 학기 활동이 없습니다');
  return a.id;
}

function renderScreen(patch: Partial<GameState> = {}) {
  const routine = freeRoutineActivityId();
  const state = makeState({
    isVacation: false, week: 3,
    routineSlot2: routine, routineSlot3: routine,
    ...patch,
  });
  render(
    <MainWeekScreen
      state={state}
      bgProps={{
        bg: getBackground(state.week, state.isVacation, state.mentalState, state.year),
        bgImgError: true, onImgError: () => {},
      }}
      onSetRoutine={() => {}}
      onTalkNpc={() => ({ kind: 'smalltalk', line: '' })}
      onTalkHome={() => ({ kind: 'smalltalk', line: '' })}
      onResolveParentChoice={() => {}}
      onBuyItem={() => {}}
      onConfirmWeek={() => {}}
    />,
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
});

const PLATEAU = ROUTINE_BONUS_PLATEAU_WEEKS;   // 8 (보정 전 기준)
const FIRST_TIER = ROUTINE_TIER_WEEKS[0];      // 3 (보정 전 기준)

describe('루틴 콤보 배지 배선 — 문턱과 판정이 같은 기준을 쓴다', () => {
  it('보정 없는 부모: 상한 주차에 "· 최대", 한 주 전엔 아직 아니다', () => {
    renderScreen({ parents: ['emotional', 'info'], routineSlot2Weeks: PLATEAU, routineSlot3Weeks: 0 });
    expect(screen.getByText(new RegExp(`${PLATEAU}주 연속 · 최대`))).toBeInTheDocument();
    expect(screen.getByText(/루틴 보너스 최대/)).toBeInTheDocument();
  });

  it('보정 없는 부모: 상한 한 주 전은 "활성"까지만', () => {
    renderScreen({ parents: ['emotional', 'info'], routineSlot2Weeks: PLATEAU - 1, routineSlot3Weeks: 0 });
    expect(screen.getByText(new RegExp(`${PLATEAU - 1}주 연속$`))).toBeInTheDocument();
    expect(screen.getByText(/루틴 보너스 활성/)).toBeInTheDocument();
    expect(screen.queryByText(/루틴 보너스 최대/)).not.toBeInTheDocument();
  });

  it('strict 부모: 같은 주차가 이미 상한이다 (엔진이 weeks+1로 계산한다)', () => {
    renderScreen({ parents: ['strict', 'info'], routineSlot2Weeks: PLATEAU - 1, routineSlot3Weeks: 0 });
    expect(screen.getByText(new RegExp(`${PLATEAU - 1}주 연속 · 최대`))).toBeInTheDocument();
    expect(screen.getByText(/루틴 보너스 최대/)).toBeInTheDocument();
  });

  it('strict 부모: 첫 티어 문턱도 1주 내려간다 — 보너스가 붙은 주에 배지가 빠지지 않는다', () => {
    // 이 케이스가 MainWeekScreen 쪽 문턱을 잠근다. 문턱이 보정을 무시하면 배지 자체가 안 뜬다.
    renderScreen({ parents: ['strict', 'info'], routineSlot2Weeks: FIRST_TIER - 1, routineSlot3Weeks: 0 });
    expect(screen.getByText(new RegExp(`${FIRST_TIER - 1}주 연속$`))).toBeInTheDocument();
    expect(screen.getByText(/루틴 보너스 활성/)).toBeInTheDocument();
  });

  it('보정 없는 부모: 같은 주차엔 아직 보너스가 없어 배지도 없다', () => {
    renderScreen({ parents: ['emotional', 'info'], routineSlot2Weeks: FIRST_TIER - 1, routineSlot3Weeks: 0 });
    expect(screen.queryByText(new RegExp(`${FIRST_TIER - 1}주 연속`))).not.toBeInTheDocument();
    expect(screen.queryByText(/루틴 보너스/)).not.toBeInTheDocument();
  });
});
