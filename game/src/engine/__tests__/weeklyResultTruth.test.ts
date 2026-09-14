// @vitest-environment jsdom
// 주간 결산이 **말하는 것과 일어난 것이 같은가**. (#442)
//
// 이 축은 통째로 비어 있었다 — 결산 화면의 숫자를 잡는 테스트가 0건이었고,
// 그래서 "현재값은 이벤트 포함, 변화량은 이벤트 제외"가 오래 살아남았다.
// 실측된 증상: 이벤트로 체력 +2를 받은 주에 화면이 "체력 42, 이번 주 **-0.4**"라고 적었다.
// 42는 이벤트 포함값인데 -0.4는 일과만이라, 주 시작값이 42.8이었다고 주장하는 셈이었다(실제 40.8).
// 인기는 +0.2가 **-1.8**로 부호까지 뒤집혔다.
//
// 이 게임은 수치를 거의 안 보여주므로(hide-numbers) 이 다섯 줄이 사실상 유일한 수치 피드백이다.
// 그래서 "표시가 예쁜가"가 아니라 **"거짓말을 하지 않는가"**를 잠근다.
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store';
import { createInitialState, processWeek, getWeekLabelAt, getWeekLabel } from '../gameEngine';
import type { GameState, GameEvent, StatKey } from '../types';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** 그 주의 로그 변화량을 주 시작값에 더하면 화면의 현재값이 나와야 한다. */
function logAgreesWithStats(before: GameState, after: GameState): { key: StatKey; expected: number; actual: number }[] {
  const bad: { key: StatKey; expected: number; actual: number }[] = [];
  for (const key of Object.keys(after.stats) as StatKey[]) {
    const expected = round1(before.stats[key] + (after.weekLog?.statChanges[key] ?? 0));
    const actual = round1(after.stats[key]);
    if (Math.abs(expected - actual) > 0.05) bad.push({ key, expected, actual });
  }
  return bad;
}

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

describe('결산 변화량은 이벤트를 포함한다', () => {
  // 스토어를 거쳐야 하는 이유: 이벤트 효과는 processWeek이 아니라 resolveEvent(store)가 적용한다.
  // 엔진만 돌리면 이벤트가 대기 상태로 남아 이 결함 자체가 재현되지 않는다.
  // **weekLog가 null인 이벤트는 건너뛴다.** 부팅 이벤트(첫 주 진행 전)가 그렇고,
  // 그 경우 GameScreen.tsx:373의 `phase === 'result' && state.weekLog` 가드 때문에
  // 결산 화면이 아예 안 뜬다 — 접을 로그도 없고 거짓말할 자리도 없다.
  // 이 구간을 지나지 않으면 테스트가 "로그가 null이라 안 맞는다"를 결함으로 오판한다.
  function playUntilEvent(maxWeeks = 40): GameState | null {
    const api = useGameStore.getState();
    api.startGame('male', ['emotional', 'info'], {});
    for (let i = 0; i < maxWeeks; i++) {
      const s = useGameStore.getState().state!;
      if (s.currentEvent && s.phase === 'event') {
        if (s.weekLog) return s;
        useGameStore.getState().resolveEvent(0);   // 부팅 이벤트 — 소진하고 계속
        continue;
      }
      if (s.phase === 'result') { useGameStore.getState().setPhase('weekday'); continue; }
      if (s.phase === 'year-end') { useGameStore.getState().advanceFromYearEnd(); continue; }
      useGameStore.getState().setRoutine('self-study', 'light-exercise');
      useGameStore.getState().setWeekendChoices(['self-study']);
      useGameStore.getState().advanceWeek();
    }
    return null;
  }

  it('이벤트가 준 스탯이 그 주의 변화량에 들어간다', () => {
    const atEvent = playUntilEvent();
    expect(atEvent, '40주 안에 이벤트가 하나도 안 떴다면 하네스가 게이트에 못 닿은 것이다').not.toBeNull();

    const beforeStats = { ...atEvent!.stats };
    const beforeLog = { ...(atEvent!.weekLog?.statChanges ?? {}) };
    const applied = useGameStore.getState().resolveEvent(0);
    expect(applied, 'resolveEvent가 적용값을 안 돌려주면 이 테스트는 아무것도 못 본다').toBeTruthy();

    const after = useGameStore.getState().state!;
    for (const [key, delta] of Object.entries(applied!.stats)) {
      const k = key as StatKey;
      expect(round1(after.weekLog!.statChanges[k] ?? 0),
        `${k}: 이벤트 ${delta}가 로그에 안 들어가면 화면이 얻은 것을 손실로 보여준다`)
        .toBe(round1((beforeLog[k] ?? 0) + (delta as number)));
      // 상태 자체도 함께 움직였는지 — 로그만 고치고 엔진이 안 움직이면 반대 거짓말이 된다.
      expect(round1(after.stats[k])).toBe(round1(beforeStats[k] + (delta as number)));
    }
  });

  // 이 판정이 본체다: 주 시작값 + 로그 = 화면 현재값.
  it('주 시작값 + 로그 변화량 = 현재값 (한 행에서 두 계층을 섞지 않는다)', () => {
    const api = useGameStore.getState();
    api.startGame('male', ['emotional', 'info'], {});
    let before = useGameStore.getState().state!;

    for (let i = 0; i < 40; i++) {
      const s = useGameStore.getState().state!;
      if (s.currentEvent && s.phase === 'event') {
        if (!s.weekLog) { useGameStore.getState().resolveEvent(0); continue; }   // 부팅 이벤트
        useGameStore.getState().resolveEvent(0);
        const after = useGameStore.getState().state!;
        const bad = logAgreesWithStats(before, after);
        expect(bad, `이벤트 주에 로그와 스탯이 어긋난다: ${JSON.stringify(bad)}`).toEqual([]);
        return;
      }
      if (s.phase === 'result') { useGameStore.getState().setPhase('weekday'); continue; }
      if (s.phase === 'year-end') { useGameStore.getState().advanceFromYearEnd(); continue; }
      before = s;   // 이 주의 시작값
      useGameStore.getState().setRoutine('self-study', 'light-exercise');
      useGameStore.getState().setWeekendChoices(['self-study']);
      useGameStore.getState().advanceWeek();
    }
    throw new Error('이벤트 주에 도달하지 못했다 — 하네스 문제이지 제품 통과가 아니다');
  });

  // 원본이 아니라 **적용값**을 접어야 한다. 고스탯 구간에서 감쇠가 걸리므로
  // choice.effects를 그대로 더하면 로그가 또 다른 거짓말을 한다.
  it('구간 감쇠가 걸린 뒤의 실제 적용값을 접는다 (원본 수치가 아니라)', () => {
    const api = useGameStore.getState();
    api.startGame('male', ['emotional', 'info'], {});
    // 고스탯으로 올려 감쇠 구간에 넣는다
    const s0 = useGameStore.getState().state!;
    useGameStore.setState({ state: { ...s0, stats: { ...s0.stats, academic: 95, social: 95, talent: 95, mental: 95, health: 95 } } });

    for (let i = 0; i < 40; i++) {
      const s = useGameStore.getState().state!;
      if (s.currentEvent && s.phase === 'event') {
        if (!s.weekLog) { useGameStore.getState().resolveEvent(0); continue; }   // 부팅 이벤트
        const evt: GameEvent = s.currentEvent;
        const choices = (s.gender === 'female' && evt.femaleChoices) ? evt.femaleChoices : evt.choices;
        const rawAcademic = choices[0]?.effects?.academic ?? 0;
        const beforeLog = s.weekLog?.statChanges.academic ?? 0;
        const applied = useGameStore.getState().resolveEvent(0)!;
        const after = useGameStore.getState().state!;
        const folded = round1((after.weekLog!.statChanges.academic ?? 0) - beforeLog);
        expect(folded, '적용값과 로그 증분이 다르면 원본을 접은 것이다').toBe(round1(applied.stats.academic ?? 0));
        if (rawAcademic > 0 && (applied.stats.academic ?? 0) !== rawAcademic) {
          expect(folded, '감쇠가 걸린 주에 원본 수치가 그대로 들어갔다').not.toBe(rawAcademic);
        }
        return;
      }
      if (s.phase === 'result') { useGameStore.getState().setPhase('weekday'); continue; }
      if (s.phase === 'year-end') { useGameStore.getState().advanceFromYearEnd(); continue; }
      useGameStore.getState().setRoutine('self-study', 'light-exercise');
      useGameStore.getState().setWeekendChoices(['self-study']);
      useGameStore.getState().advanceWeek();
    }
    throw new Error('이벤트 주에 도달하지 못했다');
  });

  // 부팅 이벤트가 안전한 **이유**를 잠근다 — "그냥 null이니까 건너뛴다"로 두면
  // 나중에 결산 화면의 weekLog 가드가 사라져도 아무도 모른다.
  it('weekLog가 없는 이벤트는 결산이 없다 (부팅 이벤트)', () => {
    useGameStore.getState().startGame('male', ['emotional', 'info'], {});
    const s = useGameStore.getState().state!;
    if (s.currentEvent && s.phase === 'event' && !s.weekLog) {
      useGameStore.getState().resolveEvent(0);
      const after = useGameStore.getState().state!;
      expect(after.weekLog, '결산 화면은 weekLog가 있어야만 뜬다(GameScreen.tsx:373)').toBeNull();
    } else {
      // 부팅 이벤트가 없는 빌드면 이 계약은 무의미하다 — 조용히 통과시키지 않는다.
      expect(s.weekLog, '부팅 이벤트가 없다면 첫 상태에 weekLog도 없어야 한다').toBeNull();
    }
  });
});

describe('결산 제목은 방금 끝난 주를 말한다', () => {
  // 증상: 1주차를 처리한 결산이 "2주차"라고 적혔고, 바로 다음 계획 화면과 **같은 라벨**을 달아
  // 서로 다른 두 주가 구분되지 않았다. 이벤트 유무와 무관한 매주 버그였다.
  it('처리한 주가 로그에 박힌다 (state.week은 이미 다음 주다)', () => {
    let s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 11 });
    for (let i = 0; i < 4; i++) {
      const resolved = s.week;
      s = processWeek(s, ['study-self'], {});
      expect(s.weekLog!.week, '로그가 처리한 주를 가리켜야 한다').toBe(resolved);
      expect(s.week, '전제: state.week은 이미 다음 주다 — 아니면 이 버그가 존재할 수 없다').toBe(resolved + 1);
      expect(getWeekLabelAt(s.weekLog!.year!, s.weekLog!.week!))
        .not.toBe(getWeekLabel(s));   // 결산 라벨 ≠ 다음 계획 화면 라벨
      if (s.phase === 'result') s = { ...s, phase: 'week' as GameState['phase'] };
    }
  });

  // 학년 경계에서 `state.week - 1`로 빼는 근사가 깨지는 지점 — 좌표를 직접 박아야 하는 이유.
  it('학년 마지막 주도 그 학년의 주로 남는다', () => {
    let s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 3 });
    s = { ...s, week: 48, year: 2 };
    s = processWeek(s, ['study-self'], {});
    expect(s.weekLog!.week).toBe(48);
    expect(s.weekLog!.year, '해가 넘어가도 로그는 끝난 해를 가리킨다').toBe(2);
    expect(getWeekLabelAt(s.weekLog!.year!, s.weekLog!.week!)).toContain('중1');
  });

  it('좌표 라벨이 학년 이름을 제대로 고른다', () => {
    expect(getWeekLabelAt(1, 1)).toContain('초6');
    expect(getWeekLabelAt(7, 48)).toContain('고3');
    expect(getWeekLabelAt(3, 22)).toContain('여름방학');
  });
});
