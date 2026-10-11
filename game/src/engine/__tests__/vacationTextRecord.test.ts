// @vitest-environment jsdom
// 해결 기록에 vacationText가 남지 않는다 — schoolVariants와 같은 세이브 위생(store.recordResolvedEvent).
// 문장 표는 카탈로그가 갖고 있다. 기록에 복제하면 발동 횟수만큼 세이브가 불어난다(실측 판당 +1.1KB).
import { beforeEach, describe, expect, it } from 'vitest';
import { GAME_EVENTS } from '../events';
import { assignCurrentEvent } from '../eventPresentation';
import { useGameStore } from '../store';
import { getWeekInfo } from '../weekMath';
import type { GameState } from '../types';

describe('vacationText — 해결 기록', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().resetGame();
    useGameStore.getState().startGame('male', ['emotional', 'wealth']);
  });

  it('방학 주에 해결한 방학 판본 사건의 기록에 vacationText가 없다', () => {
    const catalog = GAME_EVENTS.find(e => e.id === 'jihun-new-shoes')!;
    expect(catalog.vacationText, '전제: 카탈로그엔 방학 판본이 있다').toBeDefined();
    const s: GameState = structuredClone({ ...useGameStore.getState().state!, currentEvent: null });
    s.year = 3;
    s.week = 22;
    const info = getWeekInfo(22);
    s.semester = info.semester;
    s.isVacation = info.isVacation;
    assignCurrentEvent(s, catalog, 22);
    // 양성 대조 — 해결 직전의 currentEvent는 vacationText를 들고 있다(지우는 줄이 없으면 그대로 기록된다).
    expect(s.currentEvent!.vacationText, '전제: 표시용 사건은 vacationText를 든 채 store에 들어간다').toBeDefined();
    useGameStore.setState({ state: s });
    useGameStore.getState().resolveEvent(0);
    const rec = useGameStore.getState().state!.events.find(e => e.id === 'jihun-new-shoes');
    expect(rec, '해결 기록이 남았다').toBeDefined();
    expect('vacationText' in rec!, 'vacationText 키').toBe(false);
  });
});
