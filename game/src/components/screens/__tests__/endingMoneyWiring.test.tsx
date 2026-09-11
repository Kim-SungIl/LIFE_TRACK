// @vitest-environment jsdom
// 스토어 → 화면 전 구간 배선. 컴포넌트만 잠그면 "props는 완벽한데 state가 비어 있는" 상태가 통과한다.
//
// ⚠️ 이 파일의 첫 판은 **허위 잠금이었다.** 루틴을 설정하지 않고 6주를 굴려 지출이 0이었고,
// 궤적이 non-null인 건 오직 createInitialState가 빈 배열을 넣기 때문이었다 — 적립 호출 5곳을
// 전부 지워도 초록이었다. 그래서 지금은 **유료 루틴을 깔고 착지값을 toBe로 먼저 못박는다.**
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EndingScreen } from '../EndingScreen';
import { calculateEnding } from '../../../engine/ending';
import { getBackground } from '../../../engine/backgrounds';
import { useGameStore } from '../../../engine/store';
import { ACTIVITIES, getActivityCost } from '../../../engine/activities';
import { moneyLifeLine, moneyTrajectoryLifetime } from '../../../engine/moneyTrajectory';
import type { GameState } from '../../../engine/types';

vi.mock('../../../engine/assetWebp', () => ({ webpSrc: (p: string) => p }));
vi.mock('../../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
vi.mock('../../../audio/sfx', () => ({ playSfx: vi.fn() }));

const cost = (id: string, year = 1) => getActivityCost(ACTIVITIES.find(a => a.id === id)!, year);

/** GameScreen이 넘기는 것과 같은 props로 그린다(배선을 테스트가 대신하지 않게 state에서 직접 뽑는다). */
function renderFromStore() {
  const st = useGameStore.getState().state!;
  return render(
    <EndingScreen
      ending={calculateEnding(st)} track={st.track} stats={st.stats} parents={st.parents}
      burnoutCount={st.burnoutCount}
      money={st.money}
      moneySpentByYear={st.moneySpentByYear}
      moneyBlockedWeeksByYear={st.moneyBlockedWeeksByYear}
      bgProps={{ bg: getBackground(48, false, 'normal', 7), bgImgError: true, onImgError: vi.fn() }}
      runDelta={null} gender={st.gender}
      onRestartSameHome={null}
      onExitToTitle={() => {}}
    />,
  );
}

/** 부팅 이벤트를 치우고 유료 루틴을 깐 뒤 N주를 실제로 굴린다. */
function playPaidWeeks(n: number) {
  useGameStore.setState({
    state: {
      ...useGameStore.getState().state!,
      phase: 'weekday', currentEvent: null, week: 3, isVacation: false, money: 200,
      routineSlot2: 'academy', routineSlot3: 'gym',
    },
  });
  let guard = 0;
  for (let done = 0; done < n && guard++ < n * 8; ) {
    const st = useGameStore.getState().state!;
    // ⚠️ 하네스 세 걸음이 전부 필요하다. 이벤트를 해결하지 않으면 phase가 'event'에 머물고,
    // 주간 결산(phase='result')에서는 advanceWeek이 **early-return**해(store.ts:396) 주차가
    // 4에서 고착된다. 첫 판이 5주를 굴렸다고 믿고 실제로는 1주만 돌아 지출이 4에 멈춰 있었다.
    if (st.currentEvent) { useGameStore.getState().resolveEvent(0); continue; }
    if (st.phase === 'result') { useGameStore.getState().setPhase('weekday'); continue; }
    useGameStore.getState().advanceWeek();
    done++;
  }
}

beforeEach(() => {
  localStorage.clear();
  useGameStore.getState().resetGame();
});

describe('엔딩 돈 줄 — 스토어에서 화면까지', () => {
  it('유료 루틴 한 주가 그 해 지출로 정확히 적립된다', () => {
    // 착지값을 먼저 못박는다 — 이게 없으면 적립을 지워도 뒤 단언이 통과한다(첫 판의 실패).
    expect(cost('academy')).toBe(2);
    expect(cost('gym')).toBe(2);

    useGameStore.getState().startGame('male', ['emotional', 'info']);
    playPaidWeeks(1);
    expect(useGameStore.getState().state!.totalWeeksPlayed).toBe(1);
    expect(useGameStore.getState().state!.moneySpentByYear![0]).toBe(4);
  });

  it('여러 주를 굴리면 지출이 누적되고, 엔딩에 줄이 뜬다', () => {
    useGameStore.getState().startGame('male', ['emotional', 'info']);
    playPaidWeeks(5);
    const spent = useGameStore.getState().state!.moneySpentByYear![0];
    expect(spent).toBeGreaterThanOrEqual(4 * 5);      // 이벤트 timeCost로 더 적을 수는 없다(잔액 충분)

    useGameStore.getState().debugSkipToEnding();
    const st = useGameStore.getState().state!;
    const traj = moneyTrajectoryLifetime(st);
    expect(traj).not.toBeNull();
    expect(traj!.spent).toBe(spent);                   // 궤적이 실제 적립값을 그대로 읽는다

    renderFromStore();
    expect(screen.getByText(moneyLifeLine(traj!, st.money).title)).toBeTruthy();
  });

  it('돈에 막힌 주가 엔딩 판정까지 이어진다', () => {
    useGameStore.getState().startGame('male', ['emotional', 'info']);
    useGameStore.setState({
      state: { ...useGameStore.getState().state!, phase: 'weekday', currentEvent: null, year: 5, week: 3 },
    });
    // 한 해 안에서 strapped 문턱(12주)을 넘긴 해를 셋 만든다 → 7년 판정이 strapped여야 한다.
    for (const [year, weeks] of [[5, 13], [6, 13], [7, 13]] as const) {
      for (let w = 1; w <= weeks; w++) {
        useGameStore.setState({ state: { ...useGameStore.getState().state!, year, week: w } });
        useGameStore.getState().markMoneyBlockedWeek();
      }
    }
    const arr = useGameStore.getState().state!.moneyBlockedWeeksByYear!;
    expect(arr.slice(4)).toEqual([13, 13, 13]);
    const traj = moneyTrajectoryLifetime(useGameStore.getState().state!)!;
    expect(traj.strappedYears).toBe(3);

    useGameStore.getState().debugSkipToEnding();
    renderFromStore();
    expect(screen.getByText(moneyLifeLine(traj, 0).title)).toBeTruthy();
  });

  // 0으로 백필하면 구세이브가 "지갑을 안 연 7년"으로 오독된다 — 그래서 침묵이 정답이다.
  it('구세이브를 이어하면 줄이 없다 (백필 대신 침묵)', () => {
    useGameStore.getState().startGame('male', ['emotional', 'info']);
    playPaidWeeks(3);
    const legacy = JSON.parse(JSON.stringify(useGameStore.getState().state)) as Partial<GameState>;
    delete legacy.moneySpentByYear;
    delete legacy.moneyBlockedWeeksByYear;

    useGameStore.getState().resetGame();
    localStorage.setItem('lifetrack_save', JSON.stringify({ version: 1, state: legacy, savedAt: new Date().toISOString() }));
    expect(useGameStore.getState().loadSavedGame()).toBe(true);
    expect(useGameStore.getState().state!.moneySpentByYear).toBeUndefined();

    // 이어한 판을 더 굴려도(지출 발생) 배열은 생기지 않는다 — 부분 데이터로 7년을 주장하지 않는다.
    playPaidWeeks(3);
    expect(useGameStore.getState().state!.moneySpentByYear).toBeUndefined();
    useGameStore.getState().markMoneyBlockedWeek();
    expect(useGameStore.getState().state!.moneyBlockedWeeksByYear).toBeUndefined();

    useGameStore.getState().debugSkipToEnding();
    expect(moneyTrajectoryLifetime(useGameStore.getState().state!)).toBeNull();

    renderFromStore();
    for (const t of [[0, 0], [1400, 0], [0, 147], [1400, 33]] as [number, number][]) {
      expect(screen.queryByText(
        moneyLifeLine({ spent: t[0], blockedWeeks: t[1], strappedYears: t[1] > 0 ? 3 : 0, years: 7 }, 1569).title,
      )).toBeNull();
    }
  });
});
