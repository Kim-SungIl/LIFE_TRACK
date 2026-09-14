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
import type { GameState } from '../../../engine/types';

/** N주차를 실제로 처리해 결산 직전 상태를 만든다(로그·스탬프 전부 진짜 경로로). */
function stateAfterResolving(week: number, year = 1): GameState {
  let s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 11 });
  s = { ...s, year, week };
  s = processWeek(s, ['study-self'], {});
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
