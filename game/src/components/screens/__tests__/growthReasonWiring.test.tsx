// @vitest-environment jsdom
// T67 성장 둔화 한 줄 — **배선** 계약. 엔진 판정(growthDrag.test.ts)이 옳아도 결산 화면이 그 값을
// 안 읽으면 플레이어에겐 없는 기능이다(#397: 훅을 잠가도 App이 안 부르면 무음). 그래서 진짜
// processWeek 경로로 만든 상태를 GameScreen에 넣고 화면에 그 문장이 뜨는지 본다.
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
import { growthReasonLine, growthReasonLines } from '../../../engine/growthReasonText';
import { SCHOOL_LIFE_EVENTS } from '../../../engine/events/school-life';
import type { GameEvent, GameState } from '../../../engine/types';
import type { GrowthReason } from '../../../engine/growthDrag';

/** 지친 채로 한 주를 진짜로 처리한 결산 직전 상태 */
function resultAfter(over: Partial<GameState>): GameState {
  let s = createInitialState('male', ['emotional', 'freedom'], { rngSeed: 11 });
  s = {
    ...s, year: 4, week: 10, isVacation: false, money: 9999,
    stats: { academic: 20, social: 20, health: 20, talent: 20, mental: 50 },
    routineSlot2: 'self-study', routineSlot3: 'school-sports', weekendChoices: ['club', 'self-study'],
    ...over,
  };
  s = processWeek(s);
  return { ...s, currentEvent: null, phase: 'result' as GameState['phase'] };
}

beforeEach(() => {
  clearArchive();
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

describe('성장 둔화 한 줄 배선', () => {
  it('엔진이 원인을 박은 주에는 결산에 그 문장이 뜬다', () => {
    const s = resultAfter({ fatigue: 92 });
    const reason = s.weekLog!.growthReason;
    expect(reason?.factor, '전제: 진짜 경로가 피로 원인을 판정했다').toBe('fatigue');
    useGameStore.setState({ state: s });
    render(<GameScreen />);
    const box = screen.getByTestId('growth-reason');
    const line = growthReasonLine(reason!, s.weekLog!.year!)!;
    // breakSentences가 문장 사이 공백을 줄바꿈으로 바꾸므로 공백 정규화 후 비교한다.
    expect(box.textContent!.replace(/\s+/g, ' ')).toContain(line.replace(/\s+/g, ' '));
  });

  it('원인이 없는 주에는 줄 자체가 없다 (장부가 있어도)', () => {
    const s = resultAfter({ fatigue: 0, routineSlot3: 'light-exercise', weekendChoices: [] });
    expect(s.weekLog!.growthLedger, '전제: 장부는 있다').toBeDefined();
    expect(s.weekLog!.growthReason, '전제: 판정은 없음').toBeUndefined();
    useGameStore.setState({ state: s });
    render(<GameScreen />);
    expect(screen.queryByTestId('growth-reason')).toBeNull();
  });

  it('학교급은 로그가 박은 학년으로 고른다 (초등 판 문장)', () => {
    const s = resultAfter({ fatigue: 92, year: 1 });
    const reason = s.weekLog!.growthReason!;
    expect(reason.factor).toBe('fatigue');
    useGameStore.setState({ state: { ...s, year: 2 } });   // 결산 시점 state.year가 달라도
    render(<GameScreen />);
    const text = screen.getByTestId('growth-reason').textContent!.replace(/\s+/g, ' ');
    const elementary = growthReasonLines('fatigue', reason.axis, 1).map(l => l.replace(/\s+/g, ' '));
    expect(elementary.some(l => text.includes(l)), '로그 학년(Y1) 기준 초등 문장이어야 한다').toBe(true);
  });

  it('구세이브 로그(장부·판정 없음)도 결산이 그대로 뜬다', () => {
    const s = resultAfter({ fatigue: 92 });
    const legacy = { ...s, weekLog: { ...s.weekLog!, growthLedger: undefined, growthReason: undefined } };
    useGameStore.setState({ state: legacy });
    render(<GameScreen />);
    expect(screen.getByText('이번 주의 기록')).toBeTruthy();
    expect(screen.queryByTestId('growth-reason')).toBeNull();
  });

  // 3자 검수 G: 화면이 variant를 0으로 고정해도 위 단언은 초록이다(첫 판정은 variant 0이니까).
  it('회전 위치(variant)를 화면이 그대로 쓴다 — 두 번째 문장', () => {
    const s = resultAfter({ fatigue: 92 });
    const reason = s.weekLog!.growthReason!;
    const lines = growthReasonLines(reason.factor, reason.axis, s.weekLog!.year!);
    expect(lines.length, '전제: 칸에 문장이 둘 이상').toBeGreaterThan(1);
    useGameStore.setState({ state: { ...s, weekLog: { ...s.weekLog!, growthReason: { ...reason, variant: 1 } } } });
    render(<GameScreen />);
    const text = screen.getByTestId('growth-reason').textContent!.replace(/\s+/g, ' ');
    expect(text).toContain(lines[1].replace(/\s+/g, ' '));
    expect(text).not.toContain(lines[0].replace(/\s+/g, ' '));
  });

  // 3자 검수 D: 손상된 판정이 결산을 터뜨리면 안 된다.
  it('손상된 판정(모르는 요인·축)이면 줄 없이 결산이 뜬다', () => {
    const s = resultAfter({ fatigue: 92 });
    const broken = { factor: 'nope', axis: 'mental', variant: 'x' } as unknown as GrowthReason;
    useGameStore.setState({ state: { ...s, weekLog: { ...s.weekLog!, growthReason: broken } } });
    render(<GameScreen />);
    expect(screen.getByText('이번 주의 기록')).toBeTruthy();
    expect(screen.queryByTestId('growth-reason')).toBeNull();
  });
});

// 3자 검수 B: 판정은 processWeek에서 박히는데, 같은 주의 이벤트 몫은 그 **뒤에** resolveEvent가
// 로그에 접는다. 변화량 표가 큰 상승을 보여 주는 주에 "피곤해서 집중 못 했다"가 남으면 안 된다.
describe('이벤트가 접힌 뒤의 결산 (store 경로)', () => {
  function withBoostEvent(s: GameState, academic: number): GameState {
    const base = SCHOOL_LIFE_EVENTS[0];
    const ev: GameEvent = {
      ...base, week: 10, femaleChoices: undefined,
      choices: [{ text: '해 본다', effects: { academic }, message: '생각보다 잘 풀렸다.' }],
    };
    return { ...s, currentEvent: ev, phase: 'event' as GameState['phase'] };
  }

  it('이벤트로 축이 크게 오른 주에는 둔화 줄이 물러선다', () => {
    const s = resultAfter({ fatigue: 92 });
    expect(s.weekLog!.growthReason?.factor, '전제: 엔진은 피로 원인을 박았다').toBe('fatigue');
    useGameStore.setState({ state: withBoostEvent(s, 6) });
    useGameStore.getState().resolveEvent(0);
    const after = useGameStore.getState().state!;
    expect(after.weekLog!.statChanges.academic ?? 0, '전제: 이벤트 몫이 접혀 잘 는 주가 됐다').toBeGreaterThanOrEqual(1.5);
    expect(after.weekLog!.growthReason, '엔진 판정 자체는 남아 있다 — 화면이 최종값으로 다시 묻는다').toBeDefined();
    useGameStore.setState({ state: { ...after, currentEvent: null, phase: 'result' as GameState['phase'] } });
    render(<GameScreen />);
    expect(screen.getByText('이번 주의 기록')).toBeTruthy();
    expect(screen.queryByTestId('growth-reason')).toBeNull();
  });

  it('이벤트 몫이 작으면 줄은 그대로 뜬다 (양성 대조)', () => {
    const s = resultAfter({ fatigue: 92 });
    useGameStore.setState({ state: withBoostEvent(s, 0) });
    useGameStore.getState().resolveEvent(0);
    const after = useGameStore.getState().state!;
    useGameStore.setState({ state: { ...after, currentEvent: null, phase: 'result' as GameState['phase'] } });
    render(<GameScreen />);
    expect(screen.getByTestId('growth-reason')).toBeTruthy();
  });
});

