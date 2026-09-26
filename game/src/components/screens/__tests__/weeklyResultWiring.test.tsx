// @vitest-environment jsdom
// 주간 결산 **배선** 계약 — 엔진이 옳아도 화면이 딴 값을 읽으면 소용없다. (#442)
//
// weeklyResultTruth.test.ts가 weekLog의 값을 잠그지만, 그것만으로는 GameScreen이
// `getWeekLabel(state)`(= 다음 주)를 계속 쓰는 상태가 통과한다. prop을 만드는 층의 누락은
// prop을 받는 테스트가 원리상 못 잡는다는 이 리포의 전례(#431)와 정확히 같은 구조다.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../engine/assetWebp', () => ({ webpSrc: (p: string) => `WEBP::${p}` }));
vi.mock('../../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
vi.mock('../../../engine/assetPrefetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../engine/assetPrefetch')>()),
  runWhenIdle: () => () => {},
}));

import { GameScreen } from '../../GameScreen';
import { useGameStore } from '../../../engine/store';
import { createInitialState, processWeek } from '../../../engine/gameEngine';
import { clearArchive } from '../../../engine/archive';
import { SHOP_ITEMS, canBuyItem } from '../../../engine/shopSystem';
import { STAT_LABELS, type GameState, type StatKey } from '../../../engine/types';

/** N주차를 실제로 처리해 결산 직전 상태를 만든다(로그·스탬프 전부 진짜 경로로). */
function stateAfterResolving(week: number, year = 1): GameState {
  let s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 11 });
  // 활동은 인자가 아니라 state의 루틴 슬롯에서 온다(processWeek의 2번째 인자는 NPC 맵이다).
  s = { ...s, year, week, routineSlot2: 'self-study', routineSlot3: 'light-exercise' };
  s = processWeek(s);
  // 이벤트가 걸렸으면 결산 화면이 아니라 이벤트 화면이 뜬다 — 결산만 보고 싶으므로 비운다.
  return { ...s, currentEvent: null, phase: 'result' as GameState['phase'] };
}

beforeEach(() => {
  clearArchive();
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

describe('결산 제목 배선', () => {
  it('방금 끝난 주를 제목에 쓴다 (다음 주가 아니라)', () => {
    const s = stateAfterResolving(4);
    expect(s.week, '전제: state.week은 이미 5다 — 아니면 이 테스트가 아무것도 구별 못 한다').toBe(5);
    useGameStore.setState({ state: s });
    render(<GameScreen />);
    expect(screen.getByText(/1학기 4주차/), '결산은 처리한 주(4)를 말해야 한다').toBeTruthy();
    expect(screen.queryByText(/1학기 5주차/), '5주차는 아직 시작도 안 한 주다').toBeNull();
  });

  it('학년 마지막 주도 그 학년으로 쓴다', () => {
    const s = stateAfterResolving(48, 2);
    useGameStore.setState({ state: s });
    render(<GameScreen />);
    expect(screen.getByText(/중1/), '해가 넘어가도 결산은 끝난 해를 말한다').toBeTruthy();
  });

  // 반쪽만 박힌 로그(주는 있고 학년이 없음)도 폴백으로 보낸다 — 쓰면 "undefined 1학기 4주차"가 된다.
  // 이 케이스가 없으면 `year ?? state.year` 같은 부분 복구를 넣어도 아무도 못 잡는다(실측 SURVIVED).
  it('스탬프가 반쪽만 있으면 쓰지 않는다 (부분 복구 금지)', () => {
    const s = stateAfterResolving(4);
    useGameStore.setState({ state: { ...s, weekLog: { ...s.weekLog!, year: undefined } } });
    render(<GameScreen />);
    expect(screen.queryByText(/undefined/), '학년이 빠진 라벨을 그대로 그리면 안 된다').toBeNull();
    expect(screen.getByText(/주차/)).toBeTruthy();
  });

  // 구세이브 폴백 — 스탬프가 없는 로그는 예전 동작으로 떨어지되 **크래시하지 않는다**.
  it('스탬프 없는 구세이브도 제목이 뜬다 (빈칸/에러가 아니다)', () => {
    const s = stateAfterResolving(4);
    const legacy = { ...s, weekLog: { ...s.weekLog!, year: undefined, week: undefined } };
    useGameStore.setState({ state: legacy });
    render(<GameScreen />);
    expect(screen.getByText(/주차/), '폴백 경로가 죽으면 제목 자리가 비어 버린다').toBeTruthy();
  });
});

// 돈은 결산에서 **방향을 명시**하는 유일한 줄이다 — `+`/`-`와 초록/빨강을 직접 쓴다
// (WeeklyResultScreen:219-227). 그래서 부호가 틀리면 다른 축보다 더 크게 틀린다.
describe('돈 표기는 그 주에 실제로 오간 액수를 말한다', () => {
  // **전 구간 배선.** 상점에서 진짜로 사고, 진짜로 주를 넘기고, 화면을 그린다.
  // 엔진 단언만 두면 화면이 `weekLog.moneyChange` 대신 딴 값을 읽어도 통과한다.
  it('산 주에는 빨간 (-) 표기가 뜬다 (초록 (+)가 아니라)', () => {
    const s0 = createInitialState('male', ['wealth', 'info'], { rngSeed: 5 });
    const start: GameState = {
      ...s0, year: 5, week: 10, money: 1569,
      phase: 'weekday' as GameState['phase'],
      routineSlot2: 'self-study', routineSlot3: 'rest',
    };
    useGameStore.setState({ state: start });

    const item = SHOP_ITEMS.find(i => i.price >= 15 && canBuyItem(i, start, {}).ok);
    expect(item, '15만원 이상 살 수 있는 아이템이 없으면 부호 역전을 재현할 수 없다').toBeTruthy();
    useGameStore.getState().buyItem(item!);
    expect(useGameStore.getState().state!.money, '전제: 구매가 실제로 돈을 깎았다').toBe(1569 - item!.price);

    useGameStore.getState().advanceWeek();
    const after = useGameStore.getState().state!;
    useGameStore.setState({ state: { ...after, currentEvent: null, phase: 'result' as GameState['phase'] } });
    render(<GameScreen />);

    // 실측 증상: 이 자리에 "(+7)"이 초록으로 떴다 — 15만원을 쓴 주에.
    expect(screen.getByText(/^\(-[\d.]+\)$/),
      '지출이 큰 주에 (-)가 없으면 화면이 아직 주간 용돈만 세고 있다').toBeTruthy();
    expect(screen.queryByText(/^\(\+[\d.]+\)$/),
      '같은 주에 (+)가 뜨면 부호가 뒤집힌 것이다').toBeNull();
  });

  // 음성 짝 — 안 산 주는 예전처럼 초록 (+)여야 한다. 없으면 "항상 (-)"도 통과한다.
  it('아무것도 안 산 주에는 초록 (+) 표기가 뜬다', () => {
    const s0 = createInitialState('male', ['wealth', 'info'], { rngSeed: 5 });
    const start: GameState = {
      ...s0, year: 5, week: 10, money: 1569,
      phase: 'weekday' as GameState['phase'],
      routineSlot2: 'self-study', routineSlot3: 'rest',
    };
    useGameStore.setState({ state: start });
    useGameStore.getState().advanceWeek();
    const after = useGameStore.getState().state!;
    useGameStore.setState({ state: { ...after, currentEvent: null, phase: 'result' as GameState['phase'] } });
    render(<GameScreen />);

    expect(screen.getByText(/^\(\+[\d.]+\)$/),
      '용돈만 들어온 주에 (+)가 없으면 반대로 지어낸 것이다').toBeTruthy();
  });
});

describe('손실 칩은 실제로 내려간 축만 가리킨다', () => {
  // 원래 증상: 이벤트로 **얻은** 인기·멘탈이 로그에는 음수로 남아 손실 칩에 올라갔다.
  // 칩 조건은 `statChanges[k] <= -0.5`(WeeklyResultScreen:69)이므로, 로그가 정확해야만
  // 칩도 정확해진다 — 여기서는 그 연결을 화면에서 확인한다.
  const chip = (label: string) => screen.queryByText(new RegExp(`${label}\\s-`));

  it('전부 오른 주에는 손실 칩이 하나도 없다', () => {
    const s = stateAfterResolving(4);
    useGameStore.setState({ state: {
      ...s,
      weekLog: {
        ...s.weekLog!,
        statChanges: { academic: 1.2, social: 2.0, talent: 0.5, mental: 1.5, health: 1.6 },
        fatigueChange: 0,
      },
    } });
    render(<GameScreen />);
    for (const label of ['학업', '인기', '특기', '멘탈', '체력']) {
      expect(chip(label), `${label}: 전부 양수인데 손실 칩이 뜨면 화면이 거짓말한다`).toBeNull();
    }
    expect(screen.queryByText('피로 누적')).toBeNull();
  });

  // 음성 짝 — 없으면 위 테스트는 "칩이 아예 안 뜨는 화면"에서도 통과하는 장식이 된다.
  it('내려간 축은 손실 칩에 뜬다', () => {
    const s = stateAfterResolving(4);
    useGameStore.setState({ state: {
      ...s,
      weekLog: { ...s.weekLog!, statChanges: { academic: 1.2, mental: -2.4 }, fatigueChange: 0 },
    } });
    render(<GameScreen />);
    expect(chip('멘탈'), '손실 칩 자체가 안 뜨면 위 테스트가 무의미해진다').toBeTruthy();
    expect(chip('학업'), '오른 축은 손실 칩에 없어야 한다').toBeNull();
  });
});

// 부팅 도입 장면(first-week)은 첫 주 진행 **전**에 풀린다. 실측: 이벤트 결과 화면에서 "인기 +2"를
// 본 직후, 같은 "1학기 1주차" 제목의 결산이 "인기 26, -0.6"에 **잃은 것 칩 "인기 -0.6"**을 띄웠다
// (시작 25 → 26.4, 실제 +1.4). 엔진 단언(weeklyResultTruth)만 두면 화면이 딴 값을 읽어도 통과하므로
// 진짜 부팅 → 도입 해결 → 진짜 주 확정 → 렌더까지 전 구간을 잇는다.
describe('첫 주 결산 배선 — 도입 장면이 준 것을 잃은 것으로 그리지 않는다', () => {
  const chip = (label: string) => screen.queryByText(new RegExp(`${label}\\s-`));
  /** 스탯 행의 변화량 셀(행의 마지막 칸) 텍스트. 라벨이 다른 곳에도 있을 수 있어 행 구조로 고른다. */
  function changeCellOf(label: string): string {
    const cells = screen.getAllByText(label)
      .map(el => el.parentElement!.lastElementChild!.textContent ?? '')
      .filter(t => /^[+-]?\d/.test(t));
    expect(cells.length, `${label} 행의 변화량 셀이 정확히 하나여야 한다`).toBe(1);
    return cells[0];
  }

  it('도입 장면으로 오른 축은 손실 칩에 없고 변화량이 +로 뜬다', () => {
    useGameStore.getState().startGame('male', ['emotional', 'info'],
      { rngSeed: 11 } as unknown as { useReducedRecovery?: boolean });
    const boot = useGameStore.getState().state!;
    expect(boot.weekLog, '전제: 부팅 도입 장면은 첫 주 진행 전이다').toBeNull();
    const applied = useGameStore.getState().resolveEvent(0)!;
    expect(useGameStore.getState().state!.phase, '전제: 도입 장면 뒤는 계획 화면이다').toBe('weekday');

    useGameStore.getState().setRoutine('self-study', 'light-exercise');
    useGameStore.getState().setWeekendChoices(['self-study']);
    useGameStore.getState().advanceWeek();
    const after = useGameStore.getState().state!;
    expect(after.weekLog?.week, '전제: 방금 확정된 로그는 1주차 것이다').toBe(boot.week);

    // 도입 장면이 올렸고, 1주차 끝에도 시작값보다 위인 축 — 화면에서 반드시 "얻은 것"이어야 한다.
    const risen = (Object.keys(after.stats) as StatKey[])
      .filter(k => (applied.stats[k] ?? 0) >= 0.5 && after.stats[k] - boot.stats[k] >= 0.5);
    expect(risen.length, '전제: 도입 장면이 올린 축이 하나도 없으면 이 테스트는 아무것도 못 본다')
      .toBeGreaterThan(0);

    useGameStore.setState({ state: { ...after, currentEvent: null, phase: 'result' as GameState['phase'] } });
    render(<GameScreen />);
    expect(screen.getByText(/1학기 1주차/), '결산 제목은 도입 장면과 같은 1주차다').toBeTruthy();
    for (const k of risen) {
      const label = STAT_LABELS[k];
      expect(chip(label), `${label}: 도입 장면으로 얻은 축이 손실 칩에 올라갔다(실측 "인기 -0.6")`).toBeNull();
      const cell = changeCellOf(label);
      expect(cell.startsWith('+'), `${label}: 변화량 "${cell}" — 시작값보다 올랐는데 +가 아니다`).toBe(true);
      expect(Number(cell), `${label}: 변화량은 시작값 대비 실제 차이다`)
        .toBe(Math.round((after.stats[k] - boot.stats[k]) * 10) / 10);
    }
  });
});

// 피로 누적 칩은 결산에서 피로 축을 **유일하게** 읽는 자리다(WeeklyResultScreen:76,
// `weekLog.fatigueChange >= 25`). 그래서 로그가 거짓이면 칩이 그대로 거짓말을 한다.
//
// 실측된 증상(T53 이전): 피로 97에서 방학 자유 슬롯을 갈아넣은 주는 회복·클램프·tired 자동
// 회복까지 지나 **실제로는 피로가 내려갔는데**, 로그는 원값 합산이라 +29였고 결산이
// "피로 누적"을 그렸다. 천장(100)에 잘려 실제로는 들어가지 못한 피로까지 세고 있었다.
describe('피로 누적 칩은 실제로 피로가 쌓인 주만 가리킨다', () => {
  const GRIND_SLOTS = 6;
  /** 방학 자유 슬롯을 갈아넣는 한 주를 **진짜 엔진으로** 돌려 결산 직전 상태를 만든다. */
  function grindWeek(fatigue: number): GameState {
    const s0 = createInitialState('male', ['strict', 'emotional'], { rngSeed: 11 });
    const before: GameState = {
      ...s0, year: 6, week: 22, isVacation: true, fatigue, money: 100000,
      routineSlot2: null, routineSlot3: null,
      vacationChoices: Array.from({ length: GRIND_SLOTS }, () => 'school-sports'),
    };
    const after = processWeek(before);
    expect(after.weekLog!.skipped, '전제: 계획한 칸이 전부 실제로 돌았다').toEqual([]);
    return { ...after, currentEvent: null, phase: 'result' as GameState['phase'] };
  }

  it('천장에 잘린 주에는 안 뜬다 — 실제로는 피로가 내려갔다', () => {
    const s = grindWeek(97);
    expect(s.fatigue, '전제: 주 시작(97)보다 낮게 끝났다').toBeLessThan(97);
    useGameStore.setState({ state: s });
    render(<GameScreen />);
    expect(screen.queryByText('피로 누적'),
      '원값을 더하면 +29가 된다 — 피로가 내려간 주에 "피로 누적"이 뜬다').toBeNull();
  });

  // 양성 짝 — 없으면 위 테스트는 "칩이 아예 안 뜨는 화면"에서도 통과한다.
  it('여유가 있던 주에 같은 계획을 하면 뜬다 (칩 자체는 살아 있다)', () => {
    const s = grindWeek(20);
    expect(s.fatigue, '전제: 이번엔 실제로 크게 쌓였다').toBeGreaterThan(20);
    useGameStore.setState({ state: s });
    render(<GameScreen />);
    expect(screen.getByText('피로 누적'),
      '실제로 쌓인 주에 칩이 없으면 이 축은 아무것도 구별 못 한다').toBeTruthy();
  });
});
