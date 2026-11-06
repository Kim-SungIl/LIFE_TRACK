// @vitest-environment jsdom
// 주간 화면의 초대 판정 메모(inviteUnaffordable)가 **로컬 상태만 바뀐 렌더에서 미리보기를 다시 돌리지 않는다.**
//
// 결함의 모양: weekInviteFor는 부를 때마다 새 객체를 내서, 그걸 deps로 받는 메모가 매 렌더 깨졌다.
// 답하지 않은 초대가 있는 주에는 패널 열기·말풍선 같은 화면 안 상태가 바뀔 때마다 한 주 시뮬레이션
// (predictWeekOutcome)이 돌았다. 화면은 그대로라 눈에 안 보이고, 비용만 판 후반으로 갈수록 커진다.
//
// **초대 판정의 호출만 센다**(초대 칸·동행이 고정된 인자). 같은 화면의 주간 미리보기(weekPreview)도 같은
// 함수를 불러, 전부 세면 초대 판정을 통째로 지워도 양성 대조가 채워졌다(3자 검수).
// 양성 대조 둘: store 상태가 바뀌면 다시 판정하고, 돈이 모자라면 [좋아]가 실제로 잠긴다(판정 결과가 화면에 닿는다).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p, cgThumbSrc: (p: string) => p }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
const predictArgs = vi.hoisted(() => ({ calls: [] as { planned: string[]; npc: Record<string, string> | undefined }[] }));
vi.mock('../../engine/gameEngine', async importOriginal => {
  const real = await importOriginal<typeof import('../../engine/gameEngine')>();
  return {
    ...real,
    predictWeekOutcome: (...a: Parameters<typeof real.predictWeekOutcome>) => {
      predictArgs.calls.push({ planned: [...a[1]], npc: a[2] ? { ...a[2] } : undefined });
      return real.predictWeekOutcome(...a);
    },
  };
});

import { GameScreen } from '../GameScreen';
import { useGameStore } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { MONTHLY_PLANNING_KEY } from '../../engine/featureFlags';
import { generateMonthInvites } from '../../engine/monthInvites';
import { ACTIVITIES, getActivityCost } from '../../engine/activities';
import { getWeekInfo } from '../../engine/weekMath';
import type { GameState, MonthInvite } from '../../engine/types';

/** Y2 4월 첫 주, 이번 주(W5)에 초대가 잡힌 판 — weekInviteScreen.test와 같은 픽스처. `paid`면 돈 드는 초대만. */
function withInviteThisWeek(paid = false): { s: GameState; inv: MonthInvite } {
  for (let seed = 0; seed < 4000; seed++) {
    const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 3 });
    Object.assign(s, { year: 2, week: 5, rngSeed: seed, phase: 'weekday' as const, currentEvent: null, isVacation: getWeekInfo(5).isVacation, routineSlot2: 'self-study', routineSlot3: null, money: 50, monthlyMoney: true });
    for (const [id, v] of [['jihun', 40], ['subin', 35], ['minjae', 32]] as const) {
      const n = s.npcs.find(x => x.id === id)!;
      n.met = true;
      n.intimacy = v;
    }
    const inv = generateMonthInvites(s).find(i => i.week === 5);
    if (inv && (!paid || getActivityCost(ACTIVITIES.find(a => a.id === inv.activityId)!, s.year) > 0)) return { s, inv };
  }
  throw new Error(`W5 초대가 있는 시드가 없다(paid=${paid})`);
}

/** 초대 판정의 호출 — 초대 칸에 초대 활동, 그 칸 동행이 초대한 친구. */
const inviteCalls = (inv: MonthInvite) => predictArgs.calls.filter(c =>
  c.planned[inv.slotIdx] === inv.activityId && c.npc?.[`${inv.activityId}:${inv.slotIdx}`] === inv.npcId).length;

beforeEach(() => {
  cleanup();
  localStorage.clear();
  localStorage.setItem(MONTHLY_PLANNING_KEY, '1');
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  localStorage.setItem('lifetrack_month_tutorial_seen', '1');
  localStorage.setItem('lifetrack_rest_ack', '1');
  useGameStore.setState({ state: null, npcActivityMap: {} });
  predictArgs.calls = [];
});

describe('초대 판정 메모', () => {
  it('invite_memo_local_rerender: 화면 안 상태만 바뀐 렌더는 초대 판정을 다시 돌리지 않는다', () => {
    const { s, inv } = withInviteThisWeek();
    useGameStore.setState({ state: s, npcActivityMap: {} });
    render(<GameScreen />);
    expect(screen.getByTestId('week-invite'), '전제: 답하지 않은 초대 카드가 떠 있다').toBeTruthy();
    expect(inviteCalls(inv), '전제: 첫 렌더에서 초대 판정이 돌았다').toBeGreaterThan(0);

    const settled = inviteCalls(inv);
    const npcButton = document.querySelector('[data-tutorial="npc"]');
    if (!npcButton) throw new Error('관계 버튼이 없다 — 픽스처가 화면과 어긋났다');
    fireEvent.click(npcButton);   // 관계 패널 열기 — MainWeekScreen 로컬 상태(showRelations)만 바뀐다
    expect(inviteCalls(inv), '로컬 상태 렌더에서 초대 판정이 다시 돌았다').toBe(settled);

    // 양성 대조 — store 상태가 바뀌면 다시 판정한다.
    act(() => { useGameStore.setState({ state: { ...useGameStore.getState().state!, money: 49 } }); });
    expect(inviteCalls(inv), 'store 상태가 바뀌면 초대 판정을 다시 돌려야 한다').toBeGreaterThan(settled);
  });

  it('invite_memo_reaches_screen: 돈이 모자라게 바뀌면 [좋아]가 잠기고, 돌아오면 풀린다', () => {
    const { s, inv } = withInviteThisWeek(true);
    const cost = getActivityCost(ACTIVITIES.find(a => a.id === inv.activityId)!, s.year);
    useGameStore.setState({ state: { ...s, money: 500 }, npcActivityMap: {} });
    render(<GameScreen />);
    const accept = () => within(screen.getByTestId('week-invite')).getByRole('button', { name: /^좋아/ }) as HTMLButtonElement;
    expect(accept().disabled, `전제: 돈이 넉넉하면(500, 비용 ${cost}) 수락할 수 있다`).toBe(false);

    act(() => { useGameStore.setState({ state: { ...useGameStore.getState().state!, money: 0 } }); });
    expect(screen.queryByTestId('invite-accept-blocked'), '돈 0 — 잠금 안내가 떠야 한다').not.toBeNull();
    expect(accept().disabled, '돈 0 — [좋아]가 잠겨야 한다').toBe(true);

    act(() => { useGameStore.setState({ state: { ...useGameStore.getState().state!, money: 500 } }); });
    expect(accept().disabled, '돈이 돌아오면 다시 풀려야 한다(메모가 낡지 않는다)').toBe(false);
  });
});
