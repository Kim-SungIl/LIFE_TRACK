// @vitest-environment jsdom
// 한 달 자동 진행 화면 — 재생 카드 · 멈춘 주간 화면의 띠 · 월말 결산 · 남은 주 다시 짜기(설계안 §5·§7).
// 엔진 쪽 멈춤 규칙·장부는 monthPlayback.test.ts, 재생 = 손 진행 동등성은 monthPlaybackEquivalence.test.ts가 잠근다.
// 여기서는 GameScreen이 어느 상태에서 어느 화면을 고르는지와, 버튼이 store 액션까지 닿는지를 본다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p, cgThumbSrc: (p: string) => p }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));

import { GameScreen } from '../GameScreen';
import { PlaybackCard } from '../screens/main/PlaybackCard';
import { CARD_DWELL_FAST_MS, CARD_DWELL_MAX_MS, CARD_DWELL_MIN_MS } from '../screens/main/playbackPace';
import { useGameStore } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { firstPickableChoice } from '../../engine/eventPresentation';
import { generateMonthInvites } from '../../engine/monthInvites';
import { MONTHLY_PLANNING_KEY } from '../../engine/featureFlags';
import { getWeekInfo } from '../../engine/weekMath';
import { isMonthEndWeek } from '../../engine/monthPlayback';
import { CHOICE_LINES, ROUTINE_LINES } from '../../engine/talkData/playbackLines';
import type { GameState, MonthPlan, WeekLog } from '../../engine/types';

const api = () => useGameStore.getState();
const now = () => api().state!;

function at(week: number, patch: Partial<GameState> = {}): GameState {
  const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 11 });
  return Object.assign(s, {
    year: 2, week, phase: 'weekday' as const, currentEvent: null, isVacation: getWeekInfo(week).isVacation,
    semester: getWeekInfo(week).semester, routineSlot2: 'self-study', routineSlot3: null, money: 30, monthlyMoney: true,
  }, patch);
}

function planFor(s: GameState): MonthPlan {
  const end = Math.ceil(s.week / 4) * 4;
  return {
    year: s.year, month: Math.ceil(s.week / 4), invites: generateMonthInvites(s).map(i => ({ ...i, accepted: false })),
    weeks: Array.from({ length: end - s.week + 1 }, (_, i) => s.week + i).map(week => ({ week, activities: ['reading', 'rest'], npcChoices: {} })),
  };
}

function settle() {
  for (let i = 0; i < 20 && now().phase === 'event'; i++) {
    const s = now();
    const e = s.currentEvent!;
    api().resolveEvent(firstPickableChoice(s, s.gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices));
  }
}

/** 그 주에서 재생을 시작해 첫 카드(phase result)에 선 상태. */
function playingFrom(week: number, patch: Partial<GameState> = {}) {
  const s = at(week, patch);
  useGameStore.setState({ state: s, npcActivityMap: {} });
  expect(api().setMonthPlan(planFor(s))).toBeNull();
  api().startMonthPlayback();
  settle();
  expect(now().phase).toBe('result');
}

beforeEach(() => {
  localStorage.clear(); localStorage.setItem(MONTHLY_PLANNING_KEY, '1'); localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  localStorage.setItem('lifetrack_month_tutorial_seen', '1'); // 월 계획 화면 튜토리얼은 monthTutorial.test가 본다
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('재생 카드 — 저절로 한 번만 넘어간다', () => {
  const log: WeekLog = { statChanges: { academic: 1.2 }, fatigueChange: 0, moneyChange: 0, messages: ['📖 도서관이 조용했다.', '📌 지훈과 한 약속 — 친구와 놀기. 지켰다.'], skipped: [], milestoneMessages: [], year: 2, week: 6 };
  const base = { state: at(7), weekLog: log, weekLabel: '중1 1학기 6주차', resultDialogue: '', bgProps: { bg: { image: '', mood: 'calm' }, bgImgError: true, onImgError: () => {} } as never, talkBadge: false, onToggleFast: vi.fn(), onPause: vi.fn(), onTalk: vi.fn(), onShop: vi.fn() };

  // 이 카드는 글이 짧아(머리 줄 + 약속 줄) 보통 속도면 하한에 머문다 — 글자 수 비례는 playbackCardPace.test가 본다.
  it.each([[false, CARD_DWELL_MIN_MS], [true, CARD_DWELL_FAST_MS]])('빨리=%s — %ims 직전엔 안 넘어가고 그때 한 번 넘어간다', (fast, ms) => {
    vi.useFakeTimers();
    const onContinue = vi.fn();
    render(<PlaybackCard {...base} fast={fast} onContinue={onContinue} />);
    act(() => { vi.advanceTimersByTime(ms - 1); });
    expect(onContinue).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onContinue).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(ms * 3); });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('탭하면 바로 넘어가고, 그 뒤 타이머가 또 넘기지 않는다 · 사건 문장·약속 줄·변화 배지를 보인다', () => {
    vi.useFakeTimers();
    const onContinue = vi.fn();
    render(<PlaybackCard {...base} fast={false} onContinue={onContinue} />);
    expect(screen.getByTestId('playback-hero').textContent).toBe('도서관이 조용했다.');
    expect(screen.getByText(/지훈과 한 약속/)).toBeTruthy();
    expect(screen.getByText(/학업 ▲/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다음 주로' }));
    act(() => { vi.advanceTimersByTime(CARD_DWELL_MAX_MS * 2); });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('⏸ 를 누르면 멈춤만 부르고 다음 주로 넘기지 않는다', () => {
    vi.useFakeTimers();
    const onContinue = vi.fn();
    const onPause = vi.fn();
    render(<PlaybackCard {...base} fast={false} onContinue={onContinue} onPause={onPause} />);
    fireEvent.click(screen.getByRole('button', { name: '⏸ 멈춤' }));
    act(() => { vi.advanceTimersByTime(CARD_DWELL_MAX_MS * 2); });
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('사건이 없는 주는 그 주에 실제로 한 활동의 한 줄 — 결산 독백이 아니라(설계안 §11)', () => {
    const quiet: WeekLog = { ...log, messages: [], played: { routines: [{ id: 'self-study', stage: 1, reached: false }], choices: ['reading'] } };
    render(<PlaybackCard {...base} weekLog={quiet} resultDialogue="괜찮은 한 주였다." fast={false} onContinue={vi.fn()} />);
    expect(CHOICE_LINES.reading).toContain(screen.getByTestId('playback-hero').textContent);
  });

  it('지친 상태면 배지로 또렷이 보인다(멈추지는 않는다)', () => {
    render(<PlaybackCard {...base} state={at(7, { mentalState: 'tired' })} fast={false} onContinue={vi.fn()} />);
    expect(screen.getByTestId('playback-tired')).toBeTruthy();
  });
});

describe('GameScreen 라우팅', () => {
  it('재생한 주의 카드는 엔진이 적은 그 주의 활동(played)으로 한 줄을 고른다', () => {
    playingFrom(5);
    // 이 픽스처(Y2 새 판)는 첫 만남 사건이 매주 뜬다 — 사건 주의 머리 줄은 위 테스트가 본다. 여기선 엔진이 적은
    // played는 그대로 두고 사건 문장·마일스톤만 걷어, 사건 없는 주의 카드가 무엇을 고르는지 본다.
    const w = now().weekLog!;
    expect(w.played?.choices.length, '전제: 계획의 주말 칸이 실제로 돌았다').toBeGreaterThan(0);
    for (const id of w.played!.choices) expect(['reading', 'rest']).toContain(id);
    useGameStore.setState({ state: { ...now(), weekLog: { ...w, messages: w.messages.filter(m => !m.startsWith('📖')), milestoneMessages: [], examResult: undefined } } });
    render(<GameScreen />);
    expect(screen.getByTestId('playback-card')).toBeTruthy();
    expect([...CHOICE_LINES.reading, ...CHOICE_LINES.rest, ...ROUTINE_LINES['self-study'].flat()]).toContain(screen.getByTestId('playback-hero').textContent);
  });

  it('재생이 처리한 주의 결산은 카드로, ⏸ 하면 멈춘 주간 화면(띠)으로 간다', async () => {
    playingFrom(5);
    render(<GameScreen />);
    expect(screen.getByTestId('playback-card')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '⏸ 멈춤' }));
    expect(now().phase).toBe('weekday');
    expect(now().week).toBe(6);
    await waitFor(() => expect(screen.getByTestId('playback-paused').textContent).toContain('일시정지했어요'));
  });

  it('띠가 어떤 상태든 확정 버튼은 주 행동 그대로다 — 계획 없음 / 짜 둠 / 멈춤 · 주 단위 판엔 띠가 없다', async () => {
    // 주간 화면이 메인이다(2026-10-29) — 예전엔 띠가 뜨면 확정을 보조로 낮췄다(재생이 주 행동이던 때).
    playingFrom(5);
    api().pausePlayback('player');
    api().continuePlayback();
    const { unmount } = render(<GameScreen />);
    await waitFor(() => screen.getByTestId('playback-paused'));
    expect(screen.getByTestId('playback-resume').textContent).toContain('이어서 자동 진행');
    expect(screen.getByTestId('week-confirm').className).toBe('btn btn-primary');
    unmount();
    // 계획만 짜고 자동 진행 전인 주 — 띠는 계획대로 채웠다고 말하고 [▶ 남은 주 자동 진행]·[계획 고치기]를 준다
    const s = at(6);
    useGameStore.setState({ state: s, npcActivityMap: {} });
    expect(api().setMonthPlan(planFor(s))).toBeNull();
    expect([now().monthRun?.status, now().monthRun?.stop]).toEqual(['paused', undefined]);
    const second = render(<GameScreen />);
    await waitFor(() => expect(screen.getByTestId('month-plan-strip').textContent).toContain('계획대로 칸을 채워'));
    expect(screen.getByTestId('playback-resume').textContent).toContain('남은 주 자동 진행');
    expect(screen.getByTestId('playback-replan').textContent).toContain('계획 고치기');
    expect(screen.queryByTestId('playback-paused')).toBeNull();
    expect(screen.getByTestId('week-confirm').className).toBe('btn btn-primary');
    second.unmount();
    // 계획이 없는 달 — 띠는 계획 화면을 여는 버튼 하나다
    useGameStore.setState({ state: at(6), npcActivityMap: {} });
    const third = render(<GameScreen />);
    await waitFor(() => screen.getByTestId('month-plan-entry'));
    expect(screen.queryByTestId('month-plan-strip')).toBeNull();
    expect(screen.getByTestId('week-confirm').className).toBe('btn btn-primary');
    third.unmount();
    localStorage.setItem(MONTHLY_PLANNING_KEY, '0');
    render(<GameScreen />);
    await waitFor(() => screen.getByTestId('week-confirm'));
    expect(screen.queryByTestId('playback-paused')).toBeNull();
    expect(screen.queryByTestId('month-plan-entry')).toBeNull();
    expect(screen.getByTestId('week-confirm').className).toBe('btn btn-primary');
  });

  it('멈춘 화면의 ▶ 이어서 재생은 다음 주를 처리한다', async () => {
    playingFrom(5);
    api().pausePlayback('player');
    api().continuePlayback();
    render(<GameScreen />);
    await waitFor(() => screen.getByTestId('playback-resume'));
    fireEvent.click(screen.getByTestId('playback-resume'));
    expect(now().monthRun!.log.map(w => w.week)).toEqual([5, 6]);
  });

  it('번아웃으로 멈췄으면 그 이유를 말한다', async () => {
    playingFrom(5, { stats: { ...at(5).stats, mental: 5 }, fatigue: 95, mentalState: 'tired', burnoutCooldown: 0 });
    api().continuePlayback();
    render(<GameScreen />);
    await waitFor(() => expect(screen.getByTestId('playback-paused').textContent).toContain('한계였다'));
  });

  it('남은 주 다시 짜기 → 계획 화면(다시 짜기 모드) → 그대로 → 멈춘 화면', async () => {
    playingFrom(5);
    api().pausePlayback('player');
    api().continuePlayback();
    render(<GameScreen />);
    await waitFor(() => screen.getByTestId('playback-replan'));
    fireEvent.click(screen.getByTestId('playback-replan'));
    await waitFor(() => expect(screen.getByTestId('month-plan').textContent).toContain('남은 주 다시 짜기'));
    // 짜 둔 칸이 그대로 채워져 있다
    expect(screen.getByTestId('week-summary-6').textContent).toContain('독서');
    fireEvent.click(screen.getByRole('button', { name: '그대로' }));
    await waitFor(() => screen.getByTestId('playback-paused'));
  });

  it('다시 짜고 "이대로 저장"이면 저장하고 주간 화면으로 돌아온다 — 낡은 멈춤 이유는 지우고, 재생은 띠에서 다시 누를 때만', async () => {
    playingFrom(5);
    api().pausePlayback('player');
    api().continuePlayback();
    render(<GameScreen />);
    await waitFor(() => screen.getByTestId('playback-replan'));
    fireEvent.click(screen.getByTestId('playback-replan'));
    await waitFor(() => screen.getByTestId('month-plan'));
    fireEvent.click(screen.getByRole('button', { name: '이대로 저장' }));
    expect(now().monthRun!.log.map(w => w.week)).toEqual([5]);
    expect([now().monthRun!.status, now().monthRun!.stop]).toEqual(['paused', undefined]);
    await waitFor(() => screen.getByTestId('month-plan-strip'));
    expect(screen.queryByTestId('playback-paused'), '다시 짰는데 예전 멈춤 이유가 남았다').toBeNull();
    fireEvent.click(screen.getByTestId('playback-resume'));
    expect(now().monthRun!.log.map(w => w.week)).toEqual([5, 6]);
  });

  it('손으로 확정한 주의 결산은 예전 결산 화면이다(카드 아님)', () => {
    playingFrom(5);
    api().pausePlayback('player');
    api().continuePlayback();
    api().confirmWeek(['rest', ''], {});
    settle();
    render(<GameScreen />);
    expect(screen.queryByTestId('playback-card')).toBeNull();
    expect(now().monthRun!.log[1].auto).toBe(false);
  });

  it('💬로 멈춘 뒤 손으로 확정하면 멈춘 이유가 지워진다 — 다음 주 띠가 같은 말을 안 하고, 대화 창도 저절로 안 열린다', async () => {
    playingFrom(5);
    api().pausePlayback('talk');
    api().continuePlayback();
    expect(now().monthRun!.stop, '전제: 💬 멈춤').toBe('talk');
    api().confirmWeek(['rest', ''], {});
    settle();
    expect([now().monthRun!.status, now().monthRun!.stop]).toEqual(['paused', undefined]);
    api().setPhase('weekday');
    render(<GameScreen />);
    await waitFor(() => screen.getByTestId('month-plan-strip'));
    expect(screen.queryByTestId('playback-paused')).toBeNull();
    expect(screen.queryByRole('dialog', { name: '친구 관계' }), '지난주 💬 멈춤이 이번 주에도 대화 창을 열었다').toBeNull();
  });

  it('계획을 저장한 주부터 장부가 열린다 — 손으로 두 주 한 뒤 자동 진행을 켜도 월말 결산이 그 두 주를 담는다', () => {
    const s = at(5);
    useGameStore.setState({ state: s, npcActivityMap: {} });
    expect(api().setMonthPlan(planFor(s))).toBeNull();
    const startStats = { ...now().stats };
    for (const w of [5, 6]) {
      expect(now().week, '전제: 손으로 진행하는 주').toBe(w);
      api().confirmWeek(['reading', 'rest'], {});
      settle();
      api().setPhase('weekday');
    }
    api().startMonthPlayback();
    settle();
    const run = now().monthRun!;
    expect(run.log.map(w => [w.week, w.auto])).toEqual([[5, false], [6, false], [7, true]]);
    expect(run.startStats, '결산의 출발점이 자동 진행을 켠 주가 아니라 계획을 저장한 주다').toEqual(startStats);
  });

  it('달의 마지막 주 뒤엔 월말 결산 한 장 → 다음 달로 → 다음 달 주간 화면(계획은 띠에서)', async () => {
    playingFrom(12); // Y2 W12 — 시험 없는 5월 마지막 주
    render(<GameScreen />);
    expect(screen.getByTestId('month-summary')).toBeTruthy();
    expect(screen.getByRole('heading').textContent).toBe('5월의 나');
    fireEvent.click(screen.getByRole('button', { name: '6월로 ▶' }));
    expect(now().monthRun).toBeUndefined();
    await waitFor(() => screen.getByTestId('month-plan-entry'));
    expect(screen.queryByTestId('month-plan')).toBeNull();
  });

  it('시험 결과가 있는 마지막 주(Y2 W8 중간고사)는 결산 화면을 먼저 보이고, 다음에 월말 결산', async () => {
    playingFrom(8);
    expect(now().weekLog?.examResult, '전제: W8 중간고사 결과').toBeTruthy();
    render(<GameScreen />);
    expect(screen.queryByTestId('month-summary')).toBeNull();
    expect(screen.queryByTestId('playback-card')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '다음 주로 →' }));
    await waitFor(() => expect(screen.getByTestId('month-summary')).toBeTruthy());
    expect(now().monthRun, '결산 화면을 넘겼다고 달을 닫으면 안 된다').toBeTruthy();
  });

  it('달 **중간**의 시험 주(Y2 W30 중간고사)도 카드가 아니라 결산 화면 — 넘기면 재생이 이어진다', async () => {
    // 시험 주 픽스처가 달 마지막 주(W8)뿐이면 "시험 주는 카드 제외(bigWeek)" 조건을 지워도 통과했다(3자 검수 뮤테이션 L2).
    playingFrom(30);
    expect(now().weekLog?.examResult, '전제: W30 중간고사 결과').toBeTruthy();
    expect(isMonthEndWeek(30), '전제: 달 중간 주').toBe(false);
    render(<GameScreen />);
    expect(screen.queryByTestId('playback-card')).toBeNull();
    expect(screen.queryByTestId('month-summary')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '다음 주로 →' }));
    expect(now().monthRun!.status).toBe('playing');
    await waitFor(() => expect(now().monthRun!.log.map(w => w.week)).toContain(31));
  });

  it('플래그가 꺼져 있으면 재생 기록이 있어도 예전 결산 화면이다', () => {
    playingFrom(5);
    localStorage.setItem(MONTHLY_PLANNING_KEY, '0');
    render(<GameScreen />);
    expect(screen.queryByTestId('playback-card')).toBeNull();
  });
});
