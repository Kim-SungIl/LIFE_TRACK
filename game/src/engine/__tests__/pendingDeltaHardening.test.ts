// @vitest-environment jsdom
// 손상된 `pendingWeekDelta`가 결산을 조용히 뒤집거나 주 확정을 터뜨리지 못하게 한다.
//
// 이 구멍은 **두 PR을 합쳐야** 생겼다 — 한쪽이 `pendingWeekDelta`를 만들고(#453) 다른 쪽이
// 손상 세이브 검증기를 만들었는데(#454), 새 필드가 그 검증기 바깥에 있었다. 각 PR 단독 CI는
// 둘 다 초록이었다. 통합 브랜치에서 실제 store에 6종을 태워 보고 나서야 드러났다:
//
//   {fatigue: '3'}             → 결산 피로 -33   (정상 -3, 문자열 이어붙이기)
//   {money: '-8'}              → 결산 돈 NaN
//   {stats: {academic: '5'}}   → 학업 +0.2 — 5가 조용히 삼켜짐
//   {stats: null} · 'corrupt'  → advanceWeek이 TypeError로 터져 주 확정 불가
//   {money: NaN}               → 무해 (falsy 가드에 걸려 건너뜀)
//
// 여섯 건 전부 `loadSavedGame`이 true를 돌려줬고 손상 안내는 안 떴다.
//
// **정규화지 거부가 아니다.** 보류분은 한 주짜리 스크래치패드이고 실효과는 이미 state에 있다 —
// 이걸로 판을 거부하면 7년을 버리고 결산 한 줄을 얻는다. 그래서 세이브는 열리고, 보류분만 버린다.
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store';
import { createInitialState, foldPendingIntoLog } from '../gameEngine';
import { sanitizePendingWeekDelta } from '../stateMigration';
import type { GameState, WeekLog } from '../types';

const SAVE_KEY = 'lifetrack_save';

/** 손상된 보류분을 얹은 세이브를 디스크에 심는다. */
function seed(pending: unknown): void {
  const st = createInitialState('male', ['strict', 'emotional']) as unknown as Record<string, unknown>;
  st.phase = 'weekday';
  st.pendingWeekDelta = pending;
  localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, state: st }));
}

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState({ state: null });
});

describe('손상된 보류분 — 세이브는 열리고 결산은 오염되지 않는다', () => {
  const corrupt: [string, unknown][] = [
    ['stats 값이 문자열', { stats: { academic: '5' }, fatigue: 0, money: 0 }],
    ['fatigue가 문자열', { stats: {}, fatigue: '3', money: 0 }],
    ['money가 문자열', { stats: {}, fatigue: 0, money: '-8' }],
    ['stats가 null', { stats: null, fatigue: 0, money: 0 }],
    ['통째로 문자열', 'corrupt'],
    ['통째로 배열', [1, 2, 3]],
    ['money가 NaN 직렬화(null)', { stats: {}, fatigue: 0, money: NaN }],
    ['모르는 축', { stats: { wisdom: 3 }, fatigue: 0, money: 0 }],
  ];

  for (const [label, pending] of corrupt) {
    it(`${label} → 로드되고, 주 확정이 안 터지고, 보류분은 버려진다`, () => {
      seed(pending);

      expect(useGameStore.getState().loadSavedGame(),
        '보류분 손상은 판을 못 쓰게 만들지 않는다 — 거부하면 7년을 버린다').toBe(true);

      // 로드 시점에 이미 정규화돼 있어야 한다(터지는 건 이 다음 주 확정이었다).
      const loaded = useGameStore.getState().state!.pendingWeekDelta;
      expect(loaded, '손상 보류분이 살아 있으면 fold가 문자열을 이어붙인다').toBeUndefined();

      // 주 확정이 던지면 onClick 밖으로 새어 화면이 침묵한다.
      expect(() => useGameStore.getState().advanceWeek()).not.toThrow();

      const log = useGameStore.getState().state!.weekLog!;
      for (const [k, v] of Object.entries(log.statChanges)) {
        expect(Number.isFinite(v), `statChanges.${k}가 ${v}`).toBe(true);
      }
      expect(Number.isFinite(log.fatigueChange), `fatigueChange가 ${log.fatigueChange}`).toBe(true);
      expect(Number.isFinite(log.moneyChange), `moneyChange가 ${log.moneyChange}`).toBe(true);
      expect(log.statChanges).not.toHaveProperty('wisdom');
    });
  }

  // 손상 케이스가 "정상이라도 통과하는" 단언으로만 이뤄지면 공허하다.
  // 정규화를 지웠을 때 실제로 틀린 값이 나오는지를 같은 경로로 못박는다.
  it('정규화가 없으면 문자열이 이어붙어 부호·자릿수가 바뀐다 (양성 대조군)', () => {
    expect(-3 + ('3' as unknown as number)).toBe('-33');
    expect(4 + ('-8' as unknown as number)).toBe('4-8');
    expect(Math.round(Number('4-8') * 10) / 10).toBeNaN();
  });
});

describe('정상 보류분은 반드시 살아남는다', () => {
  // migrateLoadedState는 **매주 processWeek 첫머리에서도** 돈다. 여기서 정상값을 버리면
  // #453이 통째로 죽는다 — 상점·말걸기 효과가 결산에서 다시 사라진다.
  it('유효한 보류분은 값 그대로 통과한다', () => {
    const ok = { stats: { academic: 1.5, mental: -1 }, fatigue: 3, money: -15 };
    expect(sanitizePendingWeekDelta(ok)).toEqual(ok);
  });

  it('멱등이다 (매주 돌아도 값이 안 변한다)', () => {
    const ok = { stats: { social: 2 }, fatigue: -1, money: 0.5 };
    const once = sanitizePendingWeekDelta(ok);
    expect(sanitizePendingWeekDelta(once)).toEqual(once);
  });

  it('부분 손상은 성한 축만 남긴다 (통째로 버리지 않는다)', () => {
    const mixed = { stats: { academic: 2, social: '9', mental: NaN }, fatigue: 4, money: 'x' };
    expect(sanitizePendingWeekDelta(mixed)).toEqual({ stats: { academic: 2 }, fatigue: 4, money: 0 });
  });

  it('전부 0이면 undefined로 접는다 (보류분 없음과 같다)', () => {
    expect(sanitizePendingWeekDelta({ stats: {}, fatigue: 0, money: 0 })).toBeUndefined();
    expect(sanitizePendingWeekDelta({ stats: { academic: 0 }, fatigue: 0, money: 0 })).toBeUndefined();
  });

  it('구세이브(필드 없음)는 undefined 그대로', () => {
    expect(sanitizePendingWeekDelta(undefined)).toBeUndefined();
    expect(sanitizePendingWeekDelta(null)).toBeUndefined();
  });

  // 실경로: 상점 구매 → 저장 → 로드 → 주 확정. 정규화를 끼운 뒤에도 한 번만 접혀야 한다.
  it('구매 → 저장 → 로드 → 주 확정에서 보류분이 정확히 1회 접힌다', () => {
    const st = createInitialState('male', ['strict', 'emotional']) as unknown as Record<string, unknown>;
    st.phase = 'weekday';
    st.pendingWeekDelta = { stats: {}, fatigue: 0, money: -15 };
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, state: st }));

    expect(useGameStore.getState().loadSavedGame()).toBe(true);
    const beforeMoney = (useGameStore.getState().state as GameState).money;
    expect(useGameStore.getState().state!.pendingWeekDelta,
      '정상 보류분이 로드에서 사라지면 결산이 지출을 다시 못 본다').toEqual({ stats: {}, fatigue: 0, money: -15 });

    useGameStore.getState().advanceWeek();
    const s = useGameStore.getState().state!;

    // 보류분 -15는 **저장 전에 이미 state.money에서 빠져 나갔다** — 그게 이 설계의 요점이다.
    // 그래서 이번 주 잔액 차분(용돈만)에는 안 잡히고, 결산 숫자에만 더해져야 한다.
    const walletDelta = Math.round((s.money - beforeMoney) * 10) / 10;
    expect(s.weekLog!.moneyChange,
      '결산은 잔액 차분에 보류분을 더한 값이어야 한다 — 이게 안 맞으면 지출이 결산에서 사라진다')
      .toBe(Math.round((walletDelta - 15) * 10) / 10);
    expect(s.pendingWeekDelta, '접고 나서 안 비우면 다음 주가 같은 값을 또 센다').toBeUndefined();

    // 대조군: 보류분이 없으면 같은 주가 잔액 차분 그대로여야 한다(위 -15가 진짜 fold의 몫임을 못박는다).
    localStorage.clear();
    useGameStore.setState({ state: null });
    const plain = createInitialState('male', ['strict', 'emotional']) as unknown as Record<string, unknown>;
    plain.phase = 'weekday';
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, state: plain }));
    useGameStore.getState().loadSavedGame();
    const ctlBefore = useGameStore.getState().state!.money;
    useGameStore.getState().advanceWeek();
    const ctl = useGameStore.getState().state!;
    expect(ctl.weekLog!.moneyChange).toBe(Math.round((ctl.money - ctlBefore) * 10) / 10);
    expect(ctl.weekLog!.moneyChange - s.weekLog!.moneyChange,
      '두 판의 차이가 정확히 보류분 15여야 한다').toBe(15);
  });
});

// 상류 정규화를 통과한 값만 여기 닿으므로 제품 경로로는 이 가드를 잠글 수 없다.
// 그래서 fold를 직접 태운다 — 안 그러면 가드를 지워도 전부 초록이다(실측).
describe('fold의 유한수 불변식 (직접 호출)', () => {
  const emptyLog = () => ({ statChanges: {}, fatigueChange: -3, moneyChange: 4 }) as unknown as WeekLog;

  it('문자열 피로를 이어붙이지 않는다', () => {
    const st = { pendingWeekDelta: { stats: {}, fatigue: '3', money: 0 } } as unknown as GameState;
    const log = emptyLog();
    foldPendingIntoLog(st, log);
    expect(log.fatigueChange, "-3 + '3'은 -33이 된다").toBe(-3);
  });

  it('문자열 돈으로 NaN을 만들지 않는다', () => {
    const st = { pendingWeekDelta: { stats: {}, fatigue: 0, money: '-8' } } as unknown as GameState;
    const log = emptyLog();
    foldPendingIntoLog(st, log);
    expect(log.moneyChange).toBe(4);
    expect(Number.isFinite(log.moneyChange)).toBe(true);
  });

  it('문자열 스탯을 삼키지 않는다', () => {
    const st = { pendingWeekDelta: { stats: { academic: '5' }, fatigue: 0, money: 0 } } as unknown as GameState;
    const log = emptyLog();
    log.statChanges.academic = 0.2;
    foldPendingIntoLog(st, log);
    expect(log.statChanges.academic, "0.2 + '5'는 0.2로 뭉개진다").toBe(0.2);
  });

  it('정상값은 그대로 접는다 (가드가 과잉거부하지 않는다)', () => {
    const st = { pendingWeekDelta: { stats: { academic: 1.5 }, fatigue: 2, money: -15 } } as unknown as GameState;
    const log = emptyLog();
    foldPendingIntoLog(st, log);
    expect(log.statChanges.academic).toBe(1.5);
    expect(log.fatigueChange).toBe(-1);
    expect(log.moneyChange).toBe(-11);
    expect(st.pendingWeekDelta, '접었으면 비운다').toBeUndefined();
  });
});
