// @vitest-environment jsdom
// 부팅 first-week 장면(튜토리얼 지연) 계약:
// ① startGame이 phase='event' + first-week로 부팅한다 (시스템 설명보다 장면이 먼저)
// ② 장면 종료 후 결산(result) 대신 계획 화면(weekday)으로 복귀하고 주차가 유지된다
// ③ 첫 주 결산의 fixed 선택에서 first-week가 중복 발동하지 않는다
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store';

// 부팅 장면 뒤에 chain(followup/conditional)이 붙을 수 있어 event phase가 끝날 때까지 소비
function resolveUntilIdle(): void {
  let guard = 0;
  while (useGameStore.getState().state?.phase === 'event' && guard++ < 20) {
    useGameStore.getState().resolveEvent(0);
  }
}

describe('startGame 부팅 first-week 장면', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
    useGameStore.getState().startGame('male', ['emotional', 'wealth']);
    // 체인 롤 결정론 고정 (createInitialState는 Date.now 시딩)
    useGameStore.setState({ state: { ...useGameStore.getState().state!, rngSeed: 42 } });
  });

  it('phase=event + first-week로 부팅한다', () => {
    const s = useGameStore.getState().state!;
    expect(s.phase).toBe('event');
    expect(s.currentEvent?.id).toBe('first-week');
    expect(s.week).toBe(1);
    expect(s.weekLog).toBeNull();
  });

  it('장면 종료 후 결산 없이 계획 화면으로 복귀하고 주차가 유지된다', () => {
    resolveUntilIdle();
    const s = useGameStore.getState().state!;
    expect(s.phase).toBe('weekday'); // weekLog 없음 → result 대신 weekday 복귀
    expect(s.week).toBe(1);
    expect(s.events.some(e => e.id === 'first-week')).toBe(true);
  });

  it('첫 주 결산에서 first-week가 중복 발동하지 않는다', () => {
    resolveUntilIdle();
    const api = useGameStore.getState();
    api.setRoutine('self-study', 'light-exercise');
    api.setWeekendChoices(['self-study', 'club']);
    api.advanceWeek();
    resolveUntilIdle(); // 결산 주간 이벤트가 떠 있으면 소비
    const s = useGameStore.getState().state!;
    expect(s.events.filter(e => e.id === 'first-week')).toHaveLength(1);
  });
});
