// @vitest-environment jsdom
// 주간 화면의 초대 판정 메모(inviteUnaffordable)가 **로컬 상태만 바뀐 렌더에서 미리보기를 다시 돌리지 않는다.**
//
// 결함의 모양: weekInviteFor는 부를 때마다 새 객체를 내서, 그걸 deps로 받는 메모가 매 렌더 깨졌다.
// 답하지 않은 초대가 있는 주에는 패널 열기·말풍선 같은 화면 안 상태가 바뀔 때마다 한 주 시뮬레이션
// (predictWeekOutcome)이 돌았다. 화면은 그대로라 눈에 안 보이고, 비용만 판 후반으로 갈수록 커진다.
//
// 양성 대조: 같은 화면에서 store 상태를 바꾸면 다시 판정해야 한다(메모가 아예 안 도는 상태와 구분).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p, cgThumbSrc: (p: string) => p }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
const predictCalls = vi.hoisted(() => ({ n: 0 }));
vi.mock('../../engine/gameEngine', async importOriginal => {
  const real = await importOriginal<typeof import('../../engine/gameEngine')>();
  return { ...real, predictWeekOutcome: (...a: Parameters<typeof real.predictWeekOutcome>) => { predictCalls.n++; return real.predictWeekOutcome(...a); } };
});

import { GameScreen } from '../GameScreen';
import { useGameStore } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { MONTHLY_PLANNING_KEY } from '../../engine/featureFlags';
import { generateMonthInvites } from '../../engine/monthInvites';
import { getWeekInfo } from '../../engine/weekMath';
import type { GameState } from '../../engine/types';

/** Y2 4월 첫 주, 이번 주(W5)에 초대가 잡힌 판 — weekInviteScreen.test와 같은 픽스처. */
function withInviteThisWeek(): GameState {
  for (let seed = 0; seed < 2000; seed++) {
    const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 3 });
    Object.assign(s, { year: 2, week: 5, rngSeed: seed, phase: 'weekday' as const, currentEvent: null, isVacation: getWeekInfo(5).isVacation, routineSlot2: 'self-study', routineSlot3: null, money: 50, monthlyMoney: true });
    for (const [id, v] of [['jihun', 40], ['subin', 35], ['minjae', 32]] as const) {
      const n = s.npcs.find(x => x.id === id)!;
      n.met = true;
      n.intimacy = v;
    }
    if (generateMonthInvites(s).some(i => i.week === 5)) return s;
  }
  throw new Error('W5 초대가 있는 시드가 없다');
}

beforeEach(() => {
  cleanup();
  localStorage.clear();
  localStorage.setItem(MONTHLY_PLANNING_KEY, '1');
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  localStorage.setItem('lifetrack_month_tutorial_seen', '1');
  localStorage.setItem('lifetrack_rest_ack', '1');
  useGameStore.setState({ state: null, npcActivityMap: {} });
  predictCalls.n = 0;
});

describe('초대 판정 메모', () => {
  it('invite_memo_local_rerender: 화면 안 상태만 바뀐 렌더는 미리보기를 다시 돌리지 않는다', () => {
    useGameStore.setState({ state: withInviteThisWeek(), npcActivityMap: {} });
    render(<GameScreen />);
    expect(screen.getByTestId('week-invite'), '전제: 답하지 않은 초대 카드가 떠 있다').toBeTruthy();
    expect(predictCalls.n, '전제: 첫 렌더에서 판정이 돌았다').toBeGreaterThan(0);

    const settled = predictCalls.n;
    const npcButton = document.querySelector('[data-tutorial="npc"]');
    if (!npcButton) throw new Error('관계 버튼이 없다 — 픽스처가 화면과 어긋났다');
    fireEvent.click(npcButton);   // 관계 패널 열기 — MainWeekScreen 로컬 상태(showRelations)만 바뀐다
    expect(predictCalls.n, '로컬 상태 렌더에서 미리보기가 다시 돌았다').toBe(settled);

    // 양성 대조 — store 상태가 바뀌면 다시 판정한다.
    act(() => { useGameStore.setState({ state: { ...useGameStore.getState().state!, money: 49 } }); });
    expect(predictCalls.n, 'store 상태가 바뀌면 다시 판정해야 한다').toBeGreaterThan(settled);
  });
});
