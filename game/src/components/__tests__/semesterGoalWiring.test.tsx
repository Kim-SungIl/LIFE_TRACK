// @vitest-environment jsdom
// T68 학기 목표의 **배선** — 주간 화면 칩 → store → processWeek → 학기말 결산 → 학년말 회고.
//
// 판정은 engine/__tests__/semesterGoal.test.ts가 잠근다. 여기선 GameScreen을 진짜 store로 렌더해
// 그 판정이 실제로 화면까지 닿는지만 본다(#397: 훅을 잠가도 App이 부르는지는 별개 /
// #431: prop을 받는 층이 아니라 만드는 층에서 볼 것). 결산의 두 입구 — 사건 없이 곧장 오는 길과
// 사건을 해결하고 오는 길 — 를 각각 태운다.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p, cgThumbSrc: (p: string) => p }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));

import { GameScreen } from '../GameScreen';
import { useGameStore } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { absWeek } from '../../engine/weekMath';
import type { GameState } from '../../engine/types';

function weekdayState(patch: Partial<GameState> = {}): GameState {
  const s = createInitialState('male', ['emotional', 'info'], { rngSeed: 4242 });
  return Object.assign(s, {
    phase: 'weekday' as const, year: 1, week: 2, money: 10,
    routineSlot2: 'self-study', routineSlot3: 'self-study', currentEvent: null,
  }, patch);
}
const current = () => useGameStore.getState().state!;
const put = (s: GameState) => useGameStore.setState({ state: s, npcActivityMap: {} });

beforeEach(() => {
  cleanup();
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  localStorage.setItem('lifetrack_rest_ack', '1');
  useGameStore.setState({ state: null, npcActivityMap: {} });
});

describe('주간 화면 칩 → store', () => {
  it('창 안이면 칩이 뜨고, 고르면 store에 세워지며 칩이 목표와 단계 말을 보여 준다', () => {
    put(weekdayState());
    render(<GameScreen />);
    const chip = screen.getByTestId('semester-goal-chip');
    expect(chip.textContent).toContain('이번 학기 목표 정하기');
    fireEvent.click(chip);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByTestId('semester-goal-offer-exercise'));
    expect(current().semesterGoal).toEqual({ kind: 'exercise', year: 1, semester: 1, markedWeeks: [] });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('semester-goal-chip').textContent).toContain('주말엔 밖에서 뛰어놀기');
    expect(screen.getByTestId('semester-goal-stage').textContent).toBe('아직 시작 전');
    // 단계 말에 숫자가 없다
    expect(screen.getByTestId('semester-goal-chip').textContent).not.toMatch(/\d/);
  });

  it('창 밖(3주차 — 첫 2주가 지나면)이고 목표가 없으면 칩이 없다', () => {
    put(weekdayState({ week: 3 }));
    render(<GameScreen />);
    expect(screen.queryByTestId('semester-goal-chip')).toBeNull();
  });

  it('창 밖이어도 이번 학기 목표가 있으면 진행을 보여 준다 (다시 고르기 목록은 없다)', () => {
    put(weekdayState({ week: 12, semesterGoal: { kind: 'study', year: 1, semester: 1, markedWeeks: [absWeek(1, 3), absWeek(1, 4)] } }));
    render(<GameScreen />);
    expect(screen.getByTestId('semester-goal-stage').textContent).toBe('첫발을 뗐다');
    fireEvent.click(screen.getByTestId('semester-goal-chip'));
    expect(screen.queryByTestId('semester-goal-offer-study')).toBeNull();
  });
});

describe('학기말 결산 — 두 입구', () => {
  // 실측(probe): W19엔 고정 사건 'summer-start'(종업식)가 **매 학년** 뜬다 — 1학기 결산은 실제로는
  // 늘 사건을 거쳐 온다(입구 2). W42는 사건 유무가 판마다 갈린다(입구 1이 실제로 쓰인다).
  it('입구 1: 사건 없이 곧장 (W42) — 확정 → 결산에 결과 카드', () => {
    const s = createInitialState('male', ['emotional', 'info'], { rngSeed: 1 });
    Object.assign(s, {
      phase: 'weekday', year: 1, week: 42, money: 10, isVacation: false, semester: 2,
      routineSlot2: 'self-study', routineSlot3: 'self-study', currentEvent: null,
      // W42의 후속 사건(jihun-basketball·haeun-meet)이 이미 지나간 판 — 이 주에 뜰 사건이 없다
      events: [
        { id: 'jihun-basketball', title: '', description: '', choices: [], year: 1, week: 30, resolvedChoice: 0 },
        { id: 'haeun-meet', title: '', description: '', choices: [], year: 1, week: 31, resolvedChoice: 0 },
      ],
      semesterGoal: { kind: 'exercise', year: 1, semester: 2, markedWeeks: [25, 26, 27, 28, 29].map(w => absWeek(1, w)) },
    });
    put(s);
    const st = useGameStore.getState();
    st.setWeekendChoices(['light-exercise']);
    st.advanceWeek();
    expect(current().phase, '사건이 떴다 — 입구 1의 전제가 깨졌다').toBe('result');
    render(<GameScreen />);
    const card = screen.getByTestId('semester-goal-result');
    expect(card.textContent).toContain('주말엔 밖에서 뛰어놀기');
    expect(card.textContent).toContain('해냈다');
    expect(card.textContent).toContain('계단을 오를 때');
  });

  it('입구 2: 사건(종업식)을 해결하고 결산으로 (W19) — 같은 카드가 뜬다', () => {
    put(weekdayState({
      week: 19,
      semesterGoal: { kind: 'exercise', year: 1, semester: 1, markedWeeks: [1, 2, 3, 4, 5].map(w => absWeek(1, w)) },
    }));
    const st = useGameStore.getState();
    st.setWeekendChoices(['light-exercise']);
    st.advanceWeek();
    expect(current().phase).toBe('event');
    expect(current().currentEvent?.id).toBe('summer-start');
    // 판정은 사건 전에 이미 끝났다 — 사건 화면 중엔 카드가 없다
    expect(current().semesterGoalLog?.[0]?.outcome).toBe('achieved');
    render(<GameScreen />);
    expect(screen.queryByTestId('semester-goal-result')).toBeNull();
    let guard = 0;
    while (current().phase === 'event' && guard++ < 5) useGameStore.getState().resolveEvent(0);
    expect(current().phase).toBe('result');
    cleanup();
    render(<GameScreen />);
    // 이벤트 결과 연출은 GameScreen 로컬 상태라 새 렌더에선 곧장 결산이다
    const card = screen.getByTestId('semester-goal-result');
    expect(card.textContent).toContain('해냈다');
  });

  it('학기 중간 결산엔 카드가 없다', () => {
    put(weekdayState({ week: 10, semesterGoal: { kind: 'exercise', year: 1, semester: 1, markedWeeks: [] } }));
    useGameStore.getState().setWeekendChoices(['light-exercise']);
    useGameStore.getState().advanceWeek();
    if (current().phase === 'event') useGameStore.getState().resolveEvent(0);
    render(<GameScreen />);
    expect(screen.queryByTestId('semester-goal-result')).toBeNull();
  });
});

describe('학년말 회고', () => {
  it('그 해의 두 학기 목표가 학기 순으로 한 줄씩', async () => {
    put(weekdayState({
      phase: 'year-end', week: 49,
      semesterGoalLog: [
        { kind: 'friend', year: 1, semester: 2, npcId: 'jihun', outcome: 'partial' },
        { kind: 'study', year: 1, semester: 1, outcome: 'achieved' },
        { kind: 'craft', year: 2, semester: 1, outcome: 'missed' },
      ],
    }));
    render(<GameScreen />);
    const block = await screen.findByTestId('year-end-goals');
    const text = block.textContent ?? '';
    expect(text).toContain("1학기 '주말에 혼자 공부해 보기'");
    expect(text).toContain("2학기 '지훈과 주말 보내기'");
    expect(text.indexOf('1학기')).toBeLessThan(text.indexOf('2학기'));
    expect(text).toContain('해냈다');
    expect(text).toContain('몇 번은 했다');
    expect(text).not.toContain('내 것 만들기');   // 다른 학년 기록은 안 나온다
  });
});

describe('3자 검수 반영 — 잠금', () => {
  it('A. 기록장(지난 학년 열람)도 그 해 목표를 보여 준다 — HUD 버튼 → albumOverlay 배선', async () => {
    put(weekdayState({
      year: 2, week: 5,
      semesterGoalLog: [
        { kind: 'study', year: 1, semester: 1, outcome: 'achieved' },
        { kind: 'exercise', year: 2, semester: 1, outcome: 'missed' },
      ],
    }));
    render(<GameScreen />);
    expect(screen.queryByTestId('year-end-goals')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /기록장/ }));
    const block = await screen.findByTestId('year-end-goals');
    expect(block.textContent).toContain("1학기 '주말에 혼자 공부해 보기'");
    expect(block.textContent).toContain('해냈다');
    expect(block.textContent).not.toContain('땀 흘리기');   // 지금 학년(Y2) 기록은 지난 학년 장에 안 나온다
  });

  it('B. 고른 직후 세이브(localStorage)에 목표가 실린다 — 자동저장 구독은 state 참조가 바뀌어야 돈다', () => {
    put(weekdayState());
    render(<GameScreen />);
    fireEvent.click(screen.getByTestId('semester-goal-chip'));
    fireEvent.click(within(screen.getByRole('dialog')).getByTestId('semester-goal-offer-craft'));
    const saved = JSON.parse(localStorage.getItem('lifetrack_save')!);
    expect(saved.state.semesterGoal).toEqual({ kind: 'craft', year: 1, semester: 1, markedWeeks: [] });
  });
});
