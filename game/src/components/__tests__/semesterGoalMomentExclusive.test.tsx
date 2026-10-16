// @vitest-environment jsdom
// 학기말 회고와 목표 장면은 한 결산에 같이 뜨지 않는다 — 화면 층의 계약.
//
// 지금은 processWeek가 학기말에 목표를 먼저 정산해 지우므로 goalMomentForWeekLog가 어차피 null이다.
// 그 순서에 기대면 화면의 `!goalRecord`는 지워도 초록이다(3자 검수 실측). 그래서 장면 함수를
// 늘 값을 내도록 바꿔 끼우고, 진짜 학기말 결산(회고가 뜨는 W19)을 그린다.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => `WEBP::${p}` }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
vi.mock('../../engine/assetPrefetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../engine/assetPrefetch')>()),
  runWhenIdle: () => () => {},
}));
vi.mock('../../engine/semesterGoalMoments', () => ({
  goalMomentForWeekLog: () => ({ title: '운동하기', stage: 'achieved', label: '나와 한 약속을 지켰다', text: '장면 문장' }),
}));

import { GameScreen } from '../GameScreen';
import { useGameStore } from '../../engine/store';
import { createInitialState, processWeek } from '../../engine/gameEngine';
import { clearArchive } from '../../engine/archive';
import { absWeek } from '../../engine/weekMath';
import type { GameState } from '../../engine/types';

function semesterEndResult(): GameState {
  const s = createInitialState('male', ['emotional', 'info'], { rngSeed: 4242 });
  Object.assign(s, {
    phase: 'weekday', currentEvent: null, week: 19, money: 100,
    routineSlot2: 'reading', routineSlot3: 'light-exercise', weekendChoices: ['light-exercise'],
    semesterGoal: { kind: 'exercise', year: 1, semester: 1, markedWeeks: [2, 3, 4, 5, 6].map(w => absWeek(1, w)) },
  });
  return { ...processWeek(s), currentEvent: null, phase: 'result' as GameState['phase'] };
}

beforeEach(() => {
  clearArchive();
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

describe('학기말 결산', () => {
  it('장면 값이 와도 회고만 그린다', () => {
    useGameStore.setState({ state: semesterEndResult() });
    render(<GameScreen />);
    expect(screen.getByTestId('semester-goal-result'), '전제: 학기말 회고가 뜬다').toBeTruthy();
    expect(screen.queryByTestId('semester-goal-moment')).toBeNull();
  });
});
