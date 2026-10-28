// @vitest-environment jsdom
// 월 단위 계획이 기본값이 되면서 새 판의 첫 계획 화면이 월 계획 화면이다 — 주간 화면 튜토리얼(STEPS)은 뜰 자리가 없다.
// 그래서 월 계획 화면에 같은 코치마크(Tutorial)를 MONTH_PLAN_STEPS로 띄우고, 재생이 멈춰 주간 화면이 처음 뜰 때
// 화면 읽는 법(MAIN_INFO_STEPS)만 마저 보인다. 여기서 잠그는 것:
//   · 앵커 — 스텝이 가리키는 data-tutorial이 화면에 실제로 있다(없으면 가운데 카드로 조용히 강등된다)
//   · 화면에 없는 칸(초대·방과후)의 스텝은 빠진다
//   · 영속 키 — 한 번 보면 다시 안 뜨고, 주간 판 튜토리얼을 본 적 없는 사람만 주간 화면 몫이 남는다
//   · 배선 — 키가 하나도 없는 새 판(플래그 기본값)이 월 계획 화면 + 그 튜토리얼로 열린다
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p, cgThumbSrc: (p: string) => p }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));

import { GameScreen } from '../GameScreen';
import { MonthPlanScreen } from '../screens/main/MonthPlanScreen';
import { MainWeekScreen } from '../screens/main/MainWeekScreen';
import { MAIN_INFO_STEPS, MONTH_PLAN_STEPS, STEPS, TUTORIAL_KEYS, monthPlanSteps } from '../tutorialSteps';
import { useGameStore } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { MONTHLY_PLANNING_DEFAULT, MONTHLY_PLANNING_KEY, isMonthlyPlanningEnabled } from '../../engine/featureFlags';
import { generateMonthInvites } from '../../engine/monthInvites';
import { getBackground } from '../../engine/backgrounds';
import { getWeekInfo } from '../../engine/weekMath';
import type { GameState } from '../../engine/types';


beforeEach(() => {
  cleanup();
  localStorage.clear();
  localStorage.setItem('lifetrack_rest_ack', '1');
  useGameStore.setState({ state: null, npcActivityMap: {} });
});

/** 3월 첫 주, 방과후 루틴 없음 — 새 판이 부팅 장면을 지난 자리. */
function marchStart(patch: Partial<GameState> = {}, seed = 42): GameState {
  const s = createInitialState('male', ['emotional', 'info'], { rngSeed: seed });
  return Object.assign(s, { phase: 'weekday' as const, currentEvent: null, routineSlot2: null, routineSlot3: null }, patch);
}

/** 초대가 하나 이상 뜨는 3월 — 친밀도 40 친구 둘을 두고 시드를 넘겨 가며 찾는다(전제를 단언한다). */
function marchWithInvites(): GameState {
  for (let seed = 1; seed < 200; seed++) {
    const s = marchStart({}, seed);
    for (const n of s.npcs.filter(x => x.met).slice(0, 2)) n.intimacy = 40;
    if (generateMonthInvites(s).length > 0) return s;
  }
  throw new Error('전제: 초대가 뜨는 시드가 200 안에 없다');
}

const noop = () => {};
const renderPlan = (s: GameState, existing = null as Parameters<typeof MonthPlanScreen>[0]['existing']) =>
  render(<MonthPlanScreen state={s} onSetRoutine={noop} onStart={vi.fn(() => null)} existing={existing} />);
/** 말풍선 제목 — 카드의 둘째 자식(첫째는 진행 막대 줄). */
const tutorialTitle = () => document.querySelector('[data-tutorial-card] > div:nth-child(2)')?.textContent ?? null;

describe('월 계획 튜토리얼 — 스텝과 앵커', () => {
  it('스텝이 가리키는 data-tutorial이 전부 화면에 있다(초대 있는 3월)', () => {
    localStorage.setItem(TUTORIAL_KEYS.monthSeen, '1'); // 오버레이 억제 — 앵커만 본다
    const s = marchWithInvites();
    renderPlan(s);
    const steps = monthPlanSteps({ hasInvites: true, hasRoutine: true });
    expect(steps.map(x => x.target)).toEqual(MONTH_PLAN_STEPS.map(x => x.target));
    for (const step of steps) {
      expect(document.querySelector(`[data-tutorial="${step.target}"]`), `앵커 누락: ${step.target}`).not.toBeNull();
    }
  });

  it('화면에 없는 칸의 스텝은 뺀다 — 초대 없는 달, 방학 달', () => {
    expect(monthPlanSteps({ hasInvites: false, hasRoutine: true }).map(x => x.target)).not.toContain('month-invite');
    expect(monthPlanSteps({ hasInvites: true, hasRoutine: false }).map(x => x.target)).not.toContain('month-routine');
    // 실제 화면도 그 칸을 안 그린다(스텝을 빼는 근거).
    localStorage.setItem(TUTORIAL_KEYS.monthSeen, '1');
    const vac = marchStart({ week: 21, isVacation: getWeekInfo(21).isVacation });
    expect(vac.isVacation, '전제: 8월은 방학').toBe(true);
    renderPlan(vac);
    expect(document.querySelector('[data-tutorial="month-routine"]')).toBeNull();
    cleanup();
    // 새 판 3월엔 지훈이 이미 초대 문턱(30) 위라 초대가 뜬다 — 친밀도를 내려 초대 없는 달을 만든다.
    const plain = marchStart();
    for (const n of plain.npcs) n.intimacy = 10;
    expect(generateMonthInvites(plain), '전제: 초대 없는 달').toHaveLength(0);
    renderPlan(plain);
    expect(document.querySelector('[data-tutorial="month-invite"]')).toBeNull();
  });

  it('주간 화면 몫은 화면 읽는 스텝뿐이다 — 계획 스텝(루틴·주말·확정)은 월 계획 화면이 가르쳤다', () => {
    expect(MAIN_INFO_STEPS.map(x => x.target)).toEqual(['hud', 'home', 'stats', 'npc']);
    // 같은 문장을 쓴다(주간 판 STEPS에서 고르기만 한다).
    for (const st of MAIN_INFO_STEPS) expect(STEPS).toContain(st);
  });
});

describe('월 계획 튜토리얼 — 한 번만, 영속 키', () => {
  it('처음 보는 플레이어에겐 뜨고, 건너뛰면 키를 남겨 다시 안 뜬다 — 주간 판을 안 본 사람은 주간 화면 몫이 남는다', () => {
    const s = marchStart();
    const first = renderPlan(s);
    expect(tutorialTitle()).toBe('이번 달 용돈');
    fireEvent.click(screen.getByRole('button', { name: '건너뛰기' }));
    expect(document.querySelector('[data-tutorial-card]')).toBeNull();
    expect(localStorage.getItem(TUTORIAL_KEYS.monthSeen)).toBe('1');
    expect(localStorage.getItem(TUTORIAL_KEYS.infoPending)).toBe('1');
    expect(localStorage.getItem(TUTORIAL_KEYS.everSeen)).toBe('1');
    expect(localStorage.getItem(TUTORIAL_KEYS.done)).toBe('1');
    first.unmount();
    renderPlan(s);
    expect(document.querySelector('[data-tutorial-card]')).toBeNull();
  });

  it('주간 판 튜토리얼을 본 사람에게도 월 계획 화면은 처음이라 뜬다 — 대신 주간 화면 몫은 안 남긴다', () => {
    localStorage.setItem(TUTORIAL_KEYS.everSeen, '1');
    renderPlan(marchStart());
    expect(tutorialTitle()).toBe('이번 달 용돈');
    fireEvent.click(screen.getByRole('button', { name: '건너뛰기' }));
    expect(localStorage.getItem(TUTORIAL_KEYS.monthSeen)).toBe('1');
    expect(localStorage.getItem(TUTORIAL_KEYS.infoPending)).toBeNull();
  });

  it('다시 짜기(남은 주)에서는 안 띄운다 — 이 화면을 이미 지나왔다', () => {
    const s = marchStart({ routineSlot2: 'self-study' });
    renderPlan(s, { year: s.year, month: 1, weeks: [], invites: [] });
    expect(document.querySelector('[data-tutorial-card]')).toBeNull();
  });

  it('방과후 스텝은 루틴을 고르면 저절로 넘어간다(routine-done)', () => {
    vi.useFakeTimers();
    try {
      const s = marchStart();
      const view = renderPlan(s);
      fireEvent.click(screen.getByRole('button', { name: '다음' }));
      expect(tutorialTitle()).toBe('방과후 일과');
      view.rerender(<MonthPlanScreen state={{ ...s, routineSlot2: 'self-study' }} onSetRoutine={noop} onStart={vi.fn(() => null)} />);
      act(() => { vi.advanceTimersByTime(1600); });
      // 다음 스텝은 화면에 따라 초대(새 판 3월엔 지훈 초대가 뜬다) 또는 주말이다 — 화면과 같은 함수로 고른다.
      const steps = monthPlanSteps({ hasInvites: generateMonthInvites(s).length > 0, hasRoutine: true });
      expect(steps[1].target, '전제: 둘째 스텝이 방과후').toBe('month-routine');
      expect(tutorialTitle()).toBe(steps[2].title);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('주간 화면 — 월 단위 판에선 화면 읽는 법만', () => {
  const renderMain = (playback: boolean) => {
    const s = marchStart({ routineSlot2: 'self-study' });
    return render(
      <MainWeekScreen
        state={s}
        bgProps={{ bg: getBackground(1, false, 'good', 1), bgImgError: true, onImgError: noop }}
        onSetRoutine={noop}
        onTalkNpc={vi.fn(() => ({ kind: 'smalltalk', line: '' }) as never)}
        onTalkHome={vi.fn(() => ({ kind: 'smalltalk', line: '' }) as never)}
        onResolveParentChoice={noop}
        onBuyItem={noop}
        onConfirmWeek={noop}
        playback={playback ? { line: '잠깐 멈췄어요.', talkBank: 0, onResume: noop, onReplan: noop } : undefined}
      />,
    );
  };

  it('남은 몫이 있으면 화면 읽는 스텝 4개만 보이고, 마치면 지운다', () => {
    localStorage.setItem(TUTORIAL_KEYS.infoPending, '1');
    localStorage.setItem(TUTORIAL_KEYS.everSeen, '1'); // 주간 판 게이트로는 안 뜨는 사람 — 남은 몫 키 하나로 뜬다
    renderMain(true);
    expect(tutorialTitle()).toBe('내 상태');
    expect(document.querySelectorAll('[data-tutorial-card] > div:first-child > div')).toHaveLength(MAIN_INFO_STEPS.length);
    fireEvent.click(screen.getByRole('button', { name: '건너뛰기' }));
    expect(localStorage.getItem(TUTORIAL_KEYS.infoPending)).toBeNull();
  });

  it('남은 몫이 없으면 안 뜬다 — 주간 판 게이트(ever_seen 없음)를 보지 않는다', () => {
    renderMain(true);
    expect(document.querySelector('[data-tutorial-card]')).toBeNull();
  });

  it('주 단위 판(플래그 꺼짐, 띠 없음)은 예전 그대로 계획 스텝부터다', () => {
    renderMain(false);
    expect(tutorialTitle()).toBe(STEPS[0].title);
    expect(document.querySelectorAll('[data-tutorial-card] > div:first-child > div')).toHaveLength(STEPS.length);
  });
});

describe('배선 — 플래그 기본값', () => {
  it('기본값은 켜짐이다(저장소에 키가 없으면 월 단위)', () => {
    expect(MONTHLY_PLANNING_DEFAULT).toBe(true);
    expect(localStorage.getItem(MONTHLY_PLANNING_KEY)).toBeNull();
    expect(isMonthlyPlanningEnabled()).toBe(true);
    localStorage.setItem(MONTHLY_PLANNING_KEY, '0');
    expect(isMonthlyPlanningEnabled(), "'0'이면 주 단위로 되돌릴 수 있다").toBe(false);
  });

  it('키가 하나도 없는 새 판은 월 계획 화면과 그 튜토리얼로 열린다', () => {
    act(() => { useGameStore.getState().startGame('male', ['emotional', 'wealth']); });
    // 부팅 장면(first-week)을 지나 첫 계획 자리로.
    act(() => { useGameStore.setState(st => ({ state: { ...st.state!, phase: 'weekday', currentEvent: null } })); });
    render(<GameScreen />);
    expect(screen.getByTestId('month-plan')).toBeTruthy();
    expect(screen.queryByTestId('week-confirm')).toBeNull();
    expect(tutorialTitle()).toBe(MONTH_PLAN_STEPS[0].title);
  });
});
