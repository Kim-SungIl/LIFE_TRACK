// sim 하네스 = 제품 store — 사건 해결·말걸기가 같은 상태를 낸다. (2026-10-27 하네스 교정)
//
// 결함의 모양: scripts/lib/y1-sim-resolve.ts는 store.resolveEvent/talkToNpc를 손으로 베낀 사본이었고 스스로
// "store와 동일"이라고 적었다. 실제로는 W48 사건 뒤 학년 전환을 빠뜨려 판당 337~340주를 돌았고(제품 336주),
// 사건 효과를 주간 로그에 안 접었고, 말걸기는 지난달 적립 대화를 몰랐다. 사본을 맞춰 줄 때마다 다음 드리프트가 생겼다.
// 처방은 사본을 없애는 것이다 — 둘 다 eventResolution의 같은 함수를 탄다. 이 파일은 그 배선을 행위로 잠근다:
// 7년 완주 중 **모든 사건·말걸기 시점**에서 같은 입력 상태를 두 길에 넣고 결과 상태가 깊은 동등인지 본다.
// 다른 점은 store가 얹는 기록실 적립(브라우저 저장소)뿐이고, 그건 상태를 바꾸지 않는다.
import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import { useGameStore } from '../store';
import { clearArchive } from '../archive';
import { cloneGameState } from '../stateClone';
import { resolveEventLikeStore, talkToNpcLikeStore } from '../../../scripts/lib/y1-sim-resolve';
import { resolveCurrentEvent, talkToNpcOutcome } from '../eventResolution';
import type { Gender, GameState } from '../types';

/** 같은 입력 상태로 store 액션을 부르고, 결과 상태와 **액션의 반환값**을 함께 돌려준다. */
function viaStore<R>(s: GameState, act: (api: ReturnType<typeof useGameStore.getState>) => R): [GameState, R] {
  useGameStore.setState({ state: cloneGameState(s), runDelta: null, npcActivityMap: {} });
  const ret = act(useGameStore.getState());
  return [useGameStore.getState().state!, ret];
}

// 시드별 착지값 — W48에 사건이 걸린 학년 수. 0이면 사건 입구 갈래를 안 지난 것이라 이 파일의 핵심이 공허해진다.
const EXPECTED_EVENT_TRANSITIONS: Record<string, number> = { 'male/1': 2, 'female/7': 1 };

describe('sim 하네스와 store가 같은 상태를 낸다', () => {
  beforeEach(() => {
    clearArchive();
    useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
  });

  for (const [gender, seed] of [['male', 1], ['female', 7]] as [Gender, number][]) {
    it(`${gender}/seed${seed} — 7년 완주의 모든 사건·말걸기`, { timeout: 60_000 }, () => {
      let s = createInitialState(gender, ['wealth', 'freedom'], { rngSeed: seed });
      s.routineSlot2 = 'self-study';
      s.routineSlot3 = 'light-exercise';
      // weeks = processWeek 호출 수. 옛 사본은 W48 사건 뒤 학년 전환을 빼먹어 337~340주를 돌았다(제품은 336주).
      // 학년 전환은 두 입구로 온다 — 사건 없는 W48의 processWeek, 또는 W48 사건을 닫는 해결. 둘을 따로 센다.
      let events = 0, talks = 0, weeks = 0, transitionsByWeek = 0, transitionsByEvent = 0;
      const crossedYear = (p: GameState['phase']) => p === 'year-end' || p === 'ending';
      const mismatches: string[] = [];
      for (let w = 0; w < 420; w++) {
        s.weekendChoices = ['self-study', 'club'];
        s.vacationChoices = ['self-study', 'creative', 'rest'];
        // 말걸기 — 이번 주 기회가 있으면 친밀도 높은 친구에게. 미니 이벤트와 잡담 두 갈래를 다 지난다.
        const target = [...s.npcs].filter(n => n.met).sort((a, b) => b.intimacy - a.intimacy)[0];
        if (target && s.phase !== 'ending') {
          const sim = talkToNpcLikeStore(cloneGameState(s), target.id);
          const [real, realResult] = viaStore(s, api => api.talkToNpc(target.id));
          talks++;
          if (JSON.stringify(sim) !== JSON.stringify(real)) mismatches.push(`talk Y${s.year}W${s.week} ${target.id}`);
          // 액션의 반환값(화면이 그리는 미니 이벤트·잡담 한 줄)도 엔진 결과와 같아야 한다.
          if (JSON.stringify(realResult) !== JSON.stringify(talkToNpcOutcome(cloneGameState(s), target.id).result)) {
            mismatches.push(`talk-result Y${s.year}W${s.week} ${target.id}`);
          }
          s = sim;
        }
        s = processWeek(s, undefined);
        weeks++;
        if (crossedYear(s.phase)) transitionsByWeek++;
        let guard = 0;
        while (s.currentEvent && guard++ < 20) {
          const before = s;
          const sim = resolveEventLikeStore(cloneGameState(before), 0);
          const [real, applied] = viaStore(before, api => api.resolveEvent(0));
          events++;
          if (crossedYear(sim.phase)) transitionsByEvent++;
          if (JSON.stringify(sim) !== JSON.stringify(real)) mismatches.push(`event ${before.currentEvent!.id} Y${before.year}W${before.week}`);
          // 결과 화면의 칩이 읽는 실제 적용값 — store 껍데기가 엔진 반환을 그대로 넘기는가.
          if (JSON.stringify(applied) !== JSON.stringify(resolveCurrentEvent(cloneGameState(before), 0)?.applied)) {
            mismatches.push(`event-applied ${before.currentEvent!.id} Y${before.year}W${before.week}`);
          }
          s = sim;
        }
        if (s.phase === 'year-end') { s.week = 1; s.year++; s.phase = 'weekday'; }
        if (s.phase === 'ending') break;
      }
      expect(mismatches).toEqual([]);
      expect(s.phase, '완주').toBe('ending');
      // 제품과 같은 달력 — 7학년 × 48주. 유령 주가 끼면 여기서 운다.
      expect(weeks, 'processWeek 호출 수').toBe(336);
      // 학년 전환은 정확히 7번(Y1~Y6 학년말 + Y7 엔딩)이고, 그중 일부는 W48 사건을 닫는 입구로 온다 —
      // 옛 사본이 빠뜨린 그 갈래를 실제로 지났다. 착지값은 시드별로 박는다(아래 표).
      expect(transitionsByWeek + transitionsByEvent, '학년 전환 총수').toBe(7);
      expect(transitionsByEvent, '사건 입구로 온 학년 전환').toBe(EXPECTED_EVENT_TRANSITIONS[`${gender}/${seed}`]);
      // 공허하지 않다 — 사건·말걸기가 실제로 많이 비교됐다.
      expect(events).toBeGreaterThan(200);
      expect(talks).toBeGreaterThan(300);
    });
  }
});
