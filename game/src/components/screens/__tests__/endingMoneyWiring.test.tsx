// @vitest-environment jsdom
// 스토어 → 화면 전 구간 배선. 컴포넌트만 잠그면 "props는 완벽한데 state가 비어 있는" 상태가 통과한다.
// 실제 플레이 경로(새 판 진행 / 구세이브 이어하기)를 그대로 밟아 엔딩 줄의 유무를 확인한다.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EndingScreen } from '../EndingScreen';
import { calculateEnding } from '../../../engine/ending';
import { getBackground } from '../../../engine/backgrounds';
import { useGameStore } from '../../../engine/store';
import { moneyLifeLine, moneyTrajectoryLifetime } from '../../../engine/moneyTrajectory';
import type { GameState } from '../../../engine/types';

vi.mock('../../../engine/assetWebp', () => ({ webpSrc: (p: string) => p }));
vi.mock('../../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
vi.mock('../../../audio/sfx', () => ({ playSfx: vi.fn() }));

/** GameScreen이 넘기는 것과 같은 props로 그린다(배선을 테스트가 대신하지 않게 state에서 직접 뽑는다). */
function renderFromStore() {
  const st = useGameStore.getState().state!;
  return render(
    <EndingScreen
      ending={calculateEnding(st)} track={st.track} stats={st.stats} parents={st.parents}
      burnoutCount={st.burnoutCount}
      money={st.money}
      moneySpentByYear={st.moneySpentByYear}
      moneyTightWeeksByYear={st.moneyTightWeeksByYear}
      bgProps={{ bg: getBackground(48, false, 'normal', 7), bgImgError: true, onImgError: vi.fn() }}
      runDelta={null} gender={st.gender}
    />,
  );
}

/** 부팅 이벤트를 치우고 N주를 실제로 굴린다 — 하네스가 이벤트에 막혀 0주를 도는 함정 방지. */
function playWeeks(n: number) {
  useGameStore.setState({ state: { ...useGameStore.getState().state!, phase: 'weekday', currentEvent: null } });
  let guard = 0;
  for (let done = 0; done < n && guard++ < n * 5; ) {
    if (useGameStore.getState().state!.currentEvent) { useGameStore.getState().resolveEvent(0); continue; }
    useGameStore.getState().advanceWeek();
    done++;
  }
}

beforeEach(() => {
  localStorage.clear();
  useGameStore.getState().resetGame();
});

describe('엔딩 돈 줄 — 스토어에서 화면까지', () => {
  it('새 판을 굴리고 엔딩으로 가면 줄이 뜬다', () => {
    useGameStore.getState().startGame('male', ['emotional', 'info']);
    playWeeks(6);
    // 주가 실제로 돌았는지 먼저 확인 — 0주면 아래 단언이 무엇도 잠그지 않는다.
    expect(useGameStore.getState().state!.totalWeeksPlayed).toBeGreaterThan(0);

    useGameStore.getState().debugSkipToEnding();
    const st = useGameStore.getState().state!;
    const traj = moneyTrajectoryLifetime(st);
    expect(traj).not.toBeNull();

    renderFromStore();
    expect(screen.getByText(moneyLifeLine(traj!, st.money).title)).toBeTruthy();
  });

  // 0으로 백필하면 구세이브가 "지갑을 안 연 7년"으로 오독된다 — 그래서 침묵이 정답이다.
  it('구세이브를 이어하면 줄이 없다 (백필 대신 침묵)', () => {
    useGameStore.getState().startGame('male', ['emotional', 'info']);
    playWeeks(3);
    const legacy = JSON.parse(JSON.stringify(useGameStore.getState().state)) as Partial<GameState>;
    delete legacy.moneySpentByYear;
    delete legacy.moneyTightWeeksByYear;

    useGameStore.getState().resetGame();
    localStorage.setItem('lifetrack_save', JSON.stringify({ version: 1, state: legacy, savedAt: new Date().toISOString() }));
    expect(useGameStore.getState().loadSavedGame()).toBe(true);
    expect(useGameStore.getState().state!.moneySpentByYear).toBeUndefined();

    useGameStore.getState().debugSkipToEnding();
    expect(moneyTrajectoryLifetime(useGameStore.getState().state!)).toBeNull();

    renderFromStore();
    // 네 문안 중 어느 것도 화면에 없다.
    for (const t of [[0, 0], [1400, 0], [0, 147], [1400, 33]] as [number, number][]) {
      expect(screen.queryByText(moneyLifeLine({ spent: t[0], tightWeeks: t[1], years: 7 }, 1569).title)).toBeNull();
    }
  });
});
