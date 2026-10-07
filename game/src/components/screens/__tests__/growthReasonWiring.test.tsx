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
import type { GameState } from '../../../engine/types';

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
    const line = growthReasonLine(reason!, s.weekLog!.year!);
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
});
