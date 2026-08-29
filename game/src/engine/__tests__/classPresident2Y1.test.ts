// @vitest-environment jsdom
// Y1 2학기 반장선거 유실 잠금 — 고정주차 경합에서 elementary-semester2-start가
// class-president-2를 삼키던 결함. 체인은 DIRECT_SEQUEL이라 같은 주에 이어진다.
import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../gameEngine';
import { GAME_EVENTS } from '../events';
import { useGameStore } from '../store';
import type { ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['emotional', 'wealth'];
const SEED = 1;

function resolveUntilIdle(max = 40): void {
  let guard = 0;
  while (useGameStore.getState().state?.phase === 'event' && guard++ < max) {
    useGameStore.getState().resolveEvent(0);
  }
}

function playToEnding(maxSteps = 50000): void {
  let guard = 0;
  while (guard++ < maxSteps) {
    const st = useGameStore.getState().state!;
    if (st.phase === 'ending') return;
    const api = useGameStore.getState();
    if (st.phase === 'weekday') {
      api.setWeekendChoices(['self-study', 'club']);
      api.setVacationChoices(['self-study', 'creative', 'rest']);
      api.advanceWeek();
    } else if (st.phase === 'event') {
      api.resolveEvent(0);
    } else if (st.phase === 'result') {
      api.setPhase('weekday');
    } else if (st.phase === 'year-end') {
      api.advanceFromYearEnd();
    } else {
      break;
    }
  }
  throw new Error(`엔딩 미도달 phase=${useGameStore.getState().state?.phase}`);
}

describe('class-president-2 Y1 유실 복구', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
  });

  it('catalog: class-president-2는 25주, elementary-semester2-start는 26주다', () => {
    expect(GAME_EVENTS.find(e => e.id === 'class-president-2')?.week, 'class_president_2_y2_to_y7_week_25_unchanged')
      .toBe(25);
    expect(GAME_EVENTS.find(e => e.id === 'elementary-semester2-start')?.week, 'elementary_semester2_start_survives_on_y1_w26')
      .toBe(26);
    expect(GAME_EVENTS.some(e => e.id === 'elementary-semester2-start'), 'elementary_semester2_start_survives_on_y1_w26')
      .toBe(true);
  });

  it('class_president_2_y1_chain_completes: Y1 25주에 선거→연설→승패가 이어진다', () => {
    useGameStore.getState().startGame('male', PARENTS);
    const s = createInitialState('male', PARENTS, { rngSeed: SEED });
    s.year = 1;
    s.week = 25;
    s.phase = 'weekday';
    s.currentEvent = null;
    s.isVacation = false;
    s.weekendChoices = ['self-study'];
    s.routineSlot2 = 'self-study';
    s.routineSlot3 = 'light-exercise';
    useGameStore.setState({ state: s, runDelta: null, npcActivityMap: {} });

    useGameStore.getState().advanceWeek();
    expect(useGameStore.getState().state!.currentEvent?.id, 'class_president_2_fires_y1_week_25')
      .toBe('class-president-2');

    useGameStore.getState().resolveEvent(0);
    expect(useGameStore.getState().state!.currentEvent?.id, 'class_president_2_y1_chain_completes')
      .toBe('class-president-2-speech');

    useGameStore.getState().resolveEvent(0);
    const afterSpeech = useGameStore.getState().state!.currentEvent?.id;
    expect(['class-president-2-win', 'class-president-2-lose'], 'class_president_2_y1_chain_completes')
      .toContain(afterSpeech);

    const occurrenceWeek = 25;
    useGameStore.getState().resolveEvent(0);
    const fired = useGameStore.getState().state!.events.filter(e => e.year === 1 && e.week === occurrenceWeek).map(e => e.id);
    expect(fired, 'class_president_2_y1_chain_completes').toContain('class-president-2');
    expect(fired).toContain('class-president-2-speech');
    expect(fired.some(id => id === 'class-president-2-win' || id === 'class-president-2-lose')).toBe(true);
  });

  it('class_president_2_fires_y1_to_y7: 헤드리스 완주에서 7회 발동한다', () => {
    useGameStore.getState().startGame('male', PARENTS);
    useGameStore.setState({ state: { ...useGameStore.getState().state!, rngSeed: SEED >>> 0 || 1 } });
    useGameStore.getState().setRoutine('self-study', 'light-exercise');
    resolveUntilIdle();
    playToEnding();

    const evs = useGameStore.getState().state!.events;
    const elections = evs.filter(e => e.id === 'class-president-2');
    const years = elections.map(e => e.year ?? 0).sort((a, b) => a - b);
    expect(elections, 'class_president_2_fires_y1_to_y7').toHaveLength(7);
    expect(years).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(elections.every(e => e.week === 25), 'class_president_2_y2_to_y7_week_25_unchanged').toBe(true);

    const y1 = evs.filter(e => e.year === 1 && e.week === 25).map(e => e.id);
    expect(y1).toContain('class-president-2-speech');
    expect(y1.some(id => id === 'class-president-2-win' || id === 'class-president-2-lose')).toBe(true);

    expect(evs.some(e => e.id === 'elementary-semester2-start' && e.year === 1), 'elementary_semester2_start_survives_on_y1_w26')
      .toBe(true);

    // 검수 지적: 선거만 세면 Y2~Y7에서 연설/결과 체인이 끊겨도 통과한다.
    const speeches = evs.filter(e => e.id === 'class-president-2-speech');
    const outcomes = evs.filter(e => e.id === 'class-president-2-win' || e.id === 'class-president-2-lose');
    expect(speeches.map(e => e.year).sort((a, b) => (a ?? 0) - (b ?? 0)),
      'class_president_2_speech_fires_every_year').toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(outcomes, 'class_president_2_outcome_fires_every_year').toHaveLength(7);

    // 매 해 연설이 결과보다 먼저다 — 아래 우선순위 계약의 실경로 확인.
    for (let y = 1; y <= 7; y++) {
      const order = evs.filter(e => e.year === y && e.week === 25).map(e => e.id);
      expect(order.indexOf('class-president-2-speech'),
        `Y${y}: 연설이 결과보다 먼저`).toBeLessThan(
        Math.max(order.indexOf('class-president-2-win'), order.indexOf('class-president-2-lose')));
    }

    // 세이브 위생: 변이 테이블은 카탈로그 소유다. 기록에 복제되면 세이브가 44% 불어난다.
    const chores = evs.filter(e => (e.id as string).startsWith('president-'));
    expect(chores.length, '이 단언이 의미를 가지려면 잡무가 실제로 발동해야 한다').toBeGreaterThan(10);
    expect(evs.filter(e => e.schoolVariants), 'recorded_events_carry_no_schoolVariants').toHaveLength(0);
    expect(evs.filter(e => e.presentedFemale !== undefined), 'presentedFemale은 기록에 남지 않는다').toHaveLength(0);
  }, 60_000);

  it('speech_outranks_outcome_by_priority: 배열 순서가 아니라 데이터로 갈린다', () => {
    // 셋 다 20이던 시절엔 pickByPriority가 동점 → GAME_EVENTS 배열 순서로만 갈렸다.
    // speech가 win보다 앞이라 우연히 맞았을 뿐이라, 파일 순서를 바꾸면 조용히 깨졌다.
    const pri = (id: string) => GAME_EVENTS.find(e => e.id === id)?.selectionPriority ?? 0;
    expect(pri('class-president-2-speech'), 'speech_outranks_outcome_by_priority')
      .toBeGreaterThan(pri('class-president-2-win'));
    expect(pri('class-president-2-speech')).toBeGreaterThan(pri('class-president-2-lose'));
    // 결과 쪽도 0보다는 높아야 jihun-basketball 같은 무우선순위 followup에 안 밀린다.
    expect(pri('class-president-2-win')).toBeGreaterThan(0);
    expect(pri('class-president-2-lose')).toBeGreaterThan(0);
  });
});
