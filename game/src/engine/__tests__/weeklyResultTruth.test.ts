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

// startGame의 options 타입엔 rngSeed가 없지만 createInitialState는 받는다(이 파일 마지막 describe와
// 같은 우회). 시간 시드로 두면 "1주차에 이벤트가 뜨는 실행"에서만 빨개지는 플레이크가 있었다(T45).
const seeded = (rngSeed: number) => ({ rngSeed }) as unknown as { useReducedRecovery?: boolean };

describe('결산 변화량은 이벤트를 포함한다', () => {
  // 스토어를 거쳐야 하는 이유: 이벤트 효과는 processWeek이 아니라 resolveEvent(store)가 적용한다.
  // 엔진만 돌리면 이벤트가 대기 상태로 남아 이 결함 자체가 재현되지 않는다.
  // **weekLog가 null인 이벤트는 건너뛴다.** 부팅 이벤트(첫 주 진행 전)가 그렇고,
  // 그 경우 GameScreen.tsx:373의 `phase === 'result' && state.weekLog` 가드 때문에
  // 결산 화면이 아예 안 뜬다 — 접을 로그가 없다. 그 몫은 버려지지 않고 보류분으로
  // 1주차 로그에 접힌다(T45, 이 파일 마지막 describe).
  // 이 구간을 지나지 않으면 테스트가 "로그가 null이라 안 맞는다"를 결함으로 오판한다.
  function playUntilEvent(maxWeeks = 40): GameState | null {
    const api = useGameStore.getState();
    api.startGame('male', ['emotional', 'info'], seeded(11));
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
    api.startGame('male', ['emotional', 'info'], seeded(11));
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
      // 이 주의 시작값. **첫 주는 부팅 시점이다** — 도입 장면(first-week)은 week 1 사건이고 그 몫이
      // 보류분으로 1주차 로그에 접히므로(T45, 아래 describe), 도입 뒤 상태를 시작값으로 잡으면
      // 1주차에 이벤트가 뜨는 시드에서 도입 몫이 이중 계상처럼 보여 거짓 빨강이 난다(시드 5 실측).
      if (s.weekLog) before = s;
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
    api.startGame('male', ['emotional', 'info'], seeded(11));
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

  // **스탯만 잠그면 나머지 두 축은 열려 있다.** 실측으로 확인했다: `foldOutcomeIntoWeekLog`에서
  // 피로·돈 두 줄을 통째로 지워도 이 파일과 배선 테스트가 13/13 전부 통과했다.
  // 돈은 특히 나쁘다 — 결산이 `+`/`-`와 초록/빨강으로 방향을 **명시**하기 때문이다.
  //
  // 합성 이벤트를 쓰는 이유: 피로와 돈을 **함께** 움직이는 선택지를 실제 코퍼스에서 찾아
  // 거기까지 플레이로 도달하면, 그 이벤트가 개편될 때 이 계약이 조용히 사라진다.
  it('이벤트의 피로·돈도 그 주의 변화량에 들어간다', () => {
    const api = useGameStore.getState();
    api.startGame('male', ['emotional', 'info'], seeded(11));
    const s0 = useGameStore.getState().state!;

    const synthetic: GameEvent = {
      id: 'test_fold_fatigue_money',
      title: '테스트',
      description: '테스트',
      choices: [{ text: '고른다', effects: {}, fatigueEffect: 6, moneyEffect: -4 }],
    } as GameEvent;

    useGameStore.setState({
      state: {
        ...s0,
        phase: 'event' as GameState['phase'],
        fatigue: 20, money: 50,
        currentEvent: synthetic,
        weekLog: { statChanges: {}, fatigueChange: 1, moneyChange: 3, messages: [], skipped: [], milestoneMessages: [] },
      },
    });

    const applied = useGameStore.getState().resolveEvent(0)!;
    expect(applied.fatigue, '전제: 선택지가 실제로 피로를 올렸다').toBe(6);
    expect(applied.money, '전제: 선택지가 실제로 돈을 깎았다').toBe(-4);

    const log = useGameStore.getState().state!.weekLog!;
    expect(log.fatigueChange, '피로 접기를 지워도 통과하면 그 줄은 잠겨 있지 않다').toBe(7);
    expect(log.moneyChange, '돈 접기를 지워도 통과하면 결산이 지출을 초록 "+"로 그린다').toBe(-1);
  });

  // 부팅 이벤트가 안전한 **이유**를 잠근다 — "그냥 null이니까 건너뛴다"로 두면
  // 나중에 결산 화면의 weekLog 가드가 사라져도 아무도 모른다.
  it('weekLog가 없는 이벤트는 결산이 없다 (부팅 이벤트)', () => {
    useGameStore.getState().startGame('male', ['emotional', 'info'], seeded(11));
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
    // 활동은 인자가 아니라 state의 루틴 슬롯에서 온다(processWeek의 2번째 인자는 NPC 맵이다).
    s = { ...s, routineSlot2: 'self-study', routineSlot3: 'light-exercise' };
    for (let i = 0; i < 4; i++) {
      const resolved = s.week;
      s = processWeek(s);
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
    s = { ...s, week: 48, year: 2, routineSlot2: 'self-study', routineSlot3: 'light-exercise' };
    s = processWeek(s);
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

// 부팅 도입 장면(first-week)은 첫 processWeek **이전**에 풀린다 — 이번 주 로그가 아직 없다.
// 장부(state.events)는 이 사건을 week 1로 적는데, 결산은 그 몫을 못 봤다: applyChoiceOutcome이
// weekLog(null)에 접으려다 건너뛰고, 보류분(#453 pendingWeekDelta)에도 안 적었다.
// 실측(시드 11): 도입 선택지 인기 +2 → 시작 25, 1주차 끝 26.4(+1.4)인데 결산은 **-0.6**에
// "잃은 것" 칩까지 띄웠다 — 이벤트 결과 화면에서 "인기 +2"를 본 직후에, 같은 "1주차" 제목으로.
// #448("결산은 그 주 모든 것")·#453("주 확정 전 효과도 그 주 것")의 규칙에서 이 경로만 빠져 있었다.
describe('첫 주 결산은 부팅 도입 장면을 포함한다', () => {
  const SAVE_KEY = 'lifetrack_save';

  function bootAndResolveIntro(seed: number) {
    useGameStore.getState().startGame('male', ['emotional', 'info'],
      { rngSeed: seed } as unknown as { useReducedRecovery?: boolean });
    const boot = useGameStore.getState().state!;
    expect(boot.phase, '전제: 부팅은 도입 장면(event)으로 시작한다').toBe('event');
    expect(boot.weekLog, '전제: 첫 주 진행 전이라 로그가 없다 — 이 결함의 조건이다').toBeNull();
    const applied = useGameStore.getState().resolveEvent(0)!;
    expect(applied, '전제: 도입 장면이 적용값을 돌려준다').toBeTruthy();
    return { boot, introId: boot.currentEvent!.id, applied };
  }

  function playFirstWeek(): GameState {
    const s = useGameStore.getState().state!;
    expect(s.phase, '전제: 도입 장면 뒤엔 결산 없이 계획 화면이다(bootFirstScene)').toBe('weekday');
    useGameStore.getState().setRoutine('self-study', 'light-exercise');
    useGameStore.getState().setWeekendChoices(['self-study']);
    useGameStore.getState().advanceWeek();
    return useGameStore.getState().state!;
  }

  it('도입 장면이 준 것이 1주차 결산에 들어간다 (시작값 + 로그 = 1주차 끝값)', () => {
    const { boot, introId, applied } = bootAndResolveIntro(11);
    const moved = (Object.keys(applied.stats) as StatKey[]).filter(k => Math.abs(applied.stats[k] ?? 0) >= 0.5);
    expect(moved.length, '전제: 도입 선택지가 스탯을 실제로 움직였다 — 아니면 이 테스트는 아무것도 못 본다')
      .toBeGreaterThan(0);

    // 피로도 같은 통로를 탄다 — 보류분에 실제 적용값 그대로.
    // (예전엔 "로그의 fatigueChange를 시작값 대비 실제 차이와 직접 비교하지는 않는다 — 도입 장면이
    //  없는 엔진 경로에서도 그 둘은 원래 다르다(실측 0→7인데 로그 2)"고 적혀 있었다. 그 '별건'이
    //  T53이다: 이제 processWeek이 클램프 뒤 실제 차이를 한 번에 적으므로 아래에서 직접 비교한다.
    //  피로 축 본체는 fatigueLogTruth.test.ts가 잠근다.)
    const pending = useGameStore.getState().state!.pendingWeekDelta;
    expect(pending?.fatigue, '도입 장면의 피로가 보류분에 안 실리면 결산이 덜 피곤했다고 말한다')
      .toBe(applied.fatigue ?? 0);

    const w1 = playFirstWeek();
    // 장부와 결산이 같은 주를 가리킨다 — 도입 장면은 1주차 사건이고, 방금 확정된 로그도 1주차 것이다.
    const ledger = w1.events.find(e => e.id === introId);
    expect(ledger?.week, '전제: 장부는 도입 장면을 첫 주로 적는다').toBe(boot.week);
    expect(w1.weekLog?.week, '전제: 방금 확정된 로그는 그 주 것이다').toBe(ledger?.week);

    // 본체: 부팅 시점 스탯 + 로그 = 1주차 끝 스탯. 도입 장면 몫이 빠지면 여기서 어긋난다
    // (실측: social 로그 -0.6, 실제 +1.4).
    expect(logAgreesWithStats(boot, w1), '1주차 결산이 도입 장면 몫을 빼고 말한다').toEqual([]);
    // 피로도 같은 계약이다(T53): 부팅 시점 피로 + 로그 = 1주차 끝 피로.
    // 새 줄이 foldPendingIntoLog **뒤**로 가면 도입 장면 몫이 지워져 여기서 어긋난다.
    expect(round1(w1.weekLog!.fatigueChange),
      '1주차 결산의 피로가 도입 장면 몫을 빼거나 클램프 전 원값을 말한다')
      .toBe(round1(w1.fatigue - boot.fatigue));
    for (const k of moved) {
      const actual = round1(w1.stats[k] - boot.stats[k]);
      expect(round1(w1.weekLog!.statChanges[k] ?? 0),
        `${k}: 도입 장면 ${applied.stats[k]}가 빠지면 결산이 얻은 것을 손실로 그린다`).toBe(actual);
    }
    expect(w1.pendingWeekDelta, '접고 나서 안 비우면 2주차가 같은 값을 또 센다').toBeUndefined();
  });

  // 부팅과 1주차 사이에 새로고침하면 보류분은 세이브에서 돌아온다 — 정화(sanitizePendingWeekDelta)가
  // 정상값을 버리면 새로고침 한 번에 결산이 도로 거짓말한다. 디스크에 쓰인 것과 읽힌 것을 둘 다 본다.
  it('부팅과 1주차 사이의 새로고침에도 도입 장면 몫이 살아남는다 (세이브 왕복)', () => {
    const { boot } = bootAndResolveIntro(11);
    const inMemory = useGameStore.getState().state!.pendingWeekDelta;
    expect(inMemory, '전제: 도입 장면 몫이 보류분에 적혔다').toBeTruthy();
    expect(Object.keys(inMemory!.stats).length, '전제: 보류분에 스탯 축이 있다').toBeGreaterThan(0);

    const onDisk = JSON.parse(localStorage.getItem(SAVE_KEY)!).state.pendingWeekDelta;
    expect(onDisk, '자동저장이 보류분을 안 쓰면 새로고침이 그 몫을 지운다').toEqual(inMemory);

    // 새로고침 — 메모리를 비우고 세이브에서 다시 연다.
    useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
    expect(useGameStore.getState().loadSavedGame()).toBe(true);
    const reloaded = useGameStore.getState().state!;
    expect(reloaded.weekLog, '전제: 여전히 첫 주 진행 전이다').toBeNull();
    expect(reloaded.pendingWeekDelta, '정화가 정상 보류분을 버리면 결산이 도로 거짓말한다').toEqual(inMemory);

    const w1 = playFirstWeek();
    expect(logAgreesWithStats(boot, w1), '새로고침 뒤 1주차 결산이 도입 장면 몫을 잃었다').toEqual([]);
  });

  // 음성 대조 ① — 도입 장면이 없는 경로(엔진만)는 보류분 없이도 원래 맞았다.
  // 없으면 "항상 뭔가를 더하는" 구현도 위 테스트를 통과한다.
  it('도입 장면이 없는 첫 주는 보류분 없이 그대로 맞는다 (엔진 경로)', () => {
    const s0 = createInitialState('male', ['emotional', 'info'], { rngSeed: 11 });
    expect(s0.pendingWeekDelta, '전제: 도입 장면을 안 거친 초기 상태엔 보류분이 없다').toBeUndefined();
    const s1 = processWeek({ ...s0, routineSlot2: 'self-study', routineSlot3: 'light-exercise' });
    expect(logAgreesWithStats(s0, s1)).toEqual([]);
    expect(s1.pendingWeekDelta).toBeUndefined();
  });

  // 음성 대조 ② — 로그가 있는 주의 이벤트는 예전처럼 그 주 로그에 바로 접고, 보류분을 만들지 않는다.
  // 둘 다 하면(접고 + 적고) 다음 주 결산이 같은 값을 또 센다.
  it('로그가 있는 주의 이벤트는 보류분을 만들지 않는다 (#448 경로 불변)', () => {
    bootAndResolveIntro(11);
    for (let i = 0; i < 40; i++) {
      const s = useGameStore.getState().state!;
      if (s.currentEvent && s.phase === 'event') {
        expect(s.weekLog, '전제: 첫 주를 지났으니 로그가 있다').toBeTruthy();
        const before = s;
        const applied = useGameStore.getState().resolveEvent(0)!;
        const after = useGameStore.getState().state!;
        expect(after.pendingWeekDelta, '로그가 있는데 보류분에도 적으면 다음 주가 이중 계상한다').toBeUndefined();
        for (const k of Object.keys(applied.stats) as StatKey[]) {
          expect(round1(after.weekLog!.statChanges[k] ?? 0))
            .toBe(round1((before.weekLog!.statChanges[k] ?? 0) + (applied.stats[k] ?? 0)));
        }
        return;
      }
      if (s.phase === 'result') { useGameStore.getState().setPhase('weekday'); continue; }
      if (s.phase === 'year-end') { useGameStore.getState().advanceFromYearEnd(); continue; }
      useGameStore.getState().setRoutine('self-study', 'light-exercise');
      useGameStore.getState().setWeekendChoices(['self-study']);
      useGameStore.getState().advanceWeek();
    }
    throw new Error('40주 안에 이벤트 주에 도달하지 못했다 — 하네스 문제이지 제품 통과가 아니다');
  });
});
