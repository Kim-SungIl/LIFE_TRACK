// @vitest-environment jsdom
// 재생 카드의 속도 — ⏸를 누를 틈(2026-10-29 사용자 지적 "멈춤이 너무 긴박하고 누르기 어렵다").
// 잠그는 것:
//   · 머무는 시간은 카드의 글자 수에 비례하고 하한·상한 안이다(cardDwellMs) — 긴 카드는 실제로 더 오래 머문다
//   · 누르고 있는 동안은 넘어가지 않고, 떼면 **남은 시간만큼** 더 기다린다(처음부터도, 즉시도 아니다)
//   · 누른 채 ⏸를 눌러도 멈춤만 부른다 · 새 카드는 누름 상태를 물려받지 않는다
//   · 남은 시간 막대가 그 시간으로 돌고, 누르면 멈춘다 · 조작 줄은 화면 아래 고정(.bottom-action)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p, cgThumbSrc: (p: string) => p }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
let reducedMotion = false;
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => reducedMotion }));

import { PlaybackCard } from '../screens/main/PlaybackCard';
import { CARD_DWELL_FAST_MS, CARD_DWELL_MAX_MS, CARD_DWELL_MIN_MS, CARD_DWELL_PER_CHAR_MS, cardDwellMs } from '../screens/main/playbackPace';
import { createInitialState } from '../../engine/gameEngine';
import type { GameState, WeekLog } from '../../engine/types';

function state(): GameState {
  const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 11 });
  return Object.assign(s, { year: 2, week: 7, phase: 'result' as const });
}
const SHORT: WeekLog = { statChanges: { academic: 1.2 }, fatigueChange: 0, moneyChange: 0, messages: ['📖 도서관이 조용했다.'], skipped: [], milestoneMessages: [], year: 2, week: 6 };
// 사건 주 카드 — 머리 줄이 길고 약속·결석 줄이 붙는다(실측 카드 글 100자 안팎).
const LONG_HERO = '방과후 교실에 남아 있던 지훈이 창밖을 보다가 갑자기 돌아보더니, 이번 주말에 같이 도서관에 가자고 했다. 나는 잠깐 망설이다가 고개를 끄덕였다.';
const LONG: WeekLog = { ...SHORT, week: 7, messages: [`📖 ${LONG_HERO}`, '📌 지훈과 한 약속 — 친구와 놀기. 지켰다.', '📅 학원 결석 — 사건으로 하루 빠졌다.'] };
const nonSpace = (...xs: string[]) => xs.join('').replace(/\s/g, '').length;

const props = (weekLog: WeekLog, over: Partial<Parameters<typeof PlaybackCard>[0]> = {}) => ({
  state: state(), weekLog, weekLabel: '중1 1학기 7주차', resultDialogue: '', fast: false, talkBadge: false,
  bgProps: { bg: { image: '', mood: 'calm' }, bgImgError: true, onImgError: () => {} } as never,
  onToggleFast: vi.fn(), onContinue: vi.fn(), onPause: vi.fn(), onTalk: vi.fn(), onShop: vi.fn(), ...over,
});
const card = () => screen.getByTestId('playback-card');
const bar = () => screen.getByTestId('playback-dwell');

beforeEach(() => { vi.useFakeTimers(); reducedMotion = false; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('cardDwellMs — 글자 수에 비례, 하한·상한', () => {
  it('짧으면 하한, 길면 상한, 그 사이는 글자당 시간 — 구간 전체에서 줄지 않는다', () => {
    expect(cardDwellMs(0)).toBe(CARD_DWELL_MIN_MS);
    expect(cardDwellMs(1000)).toBe(CARD_DWELL_MAX_MS);
    const mid = Math.ceil(CARD_DWELL_MIN_MS / CARD_DWELL_PER_CHAR_MS) + 10;
    expect(cardDwellMs(mid)).toBe(mid * CARD_DWELL_PER_CHAR_MS);
    for (let n = 1; n <= 300; n++) expect(cardDwellMs(n)).toBeGreaterThanOrEqual(cardDwellMs(n - 1));
    // 예전 고정값(2.2초)보다 짧은 카드는 없다 — 하한이 그 위다.
    expect(CARD_DWELL_MIN_MS).toBeGreaterThan(2200);
  });
});

describe('카드가 머무는 시간', () => {
  it('글이 긴 카드는 그 글자 수만큼 더 머문다 — 직전엔 안 넘어가고 그때 한 번', () => {
    const onContinue = vi.fn();
    render(<PlaybackCard {...props(LONG, { onContinue })} />);
    const want = cardDwellMs(nonSpace(LONG_HERO, '📌 지훈과 한 약속 — 친구와 놀기. 지켰다.', '📅 학원 결석 — 사건으로 하루 빠졌다.'));
    expect(want, '전제: 이 카드는 하한보다 오래 머문다').toBeGreaterThan(CARD_DWELL_MIN_MS);
    act(() => { vi.advanceTimersByTime(want - 1); });
    expect(onContinue).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('[⏭ 다음 멈춤까지]는 글 길이와 상관없이 짧다', () => {
    const onContinue = vi.fn();
    render(<PlaybackCard {...props(LONG, { onContinue, fast: true })} />);
    act(() => { vi.advanceTimersByTime(CARD_DWELL_FAST_MS); });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

describe('누르고 있으면 멈춘다', () => {
  it.each(['pointerUp', 'pointerCancel', 'pointerLeave'] as const)('누른 동안은 안 넘어가고, %s 뒤엔 남은 시간만큼만 더 기다린다', (releaseWith) => {
    const onContinue = vi.fn();
    render(<PlaybackCard {...props(SHORT, { onContinue })} />);
    act(() => { vi.advanceTimersByTime(1000); });
    fireEvent.pointerDown(card());
    act(() => { vi.advanceTimersByTime(CARD_DWELL_MAX_MS * 3); });
    expect(onContinue, '누르고 있는데 넘어갔다').not.toHaveBeenCalled();
    fireEvent[releaseWith](card());
    // 남은 시간 = 하한 − 이미 지난 1초. 처음부터 다시 세면 이 시점에 안 넘어가고, 즉시 넘기면 직전에 넘어간다.
    act(() => { vi.advanceTimersByTime(CARD_DWELL_MIN_MS - 1000 - 1); });
    expect(onContinue).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('⏸를 누르는 손가락도 시간을 멈춘다 — 타이머가 다 된 순간에 눌러도 멈춤만 부르고 넘어가지 않는다', () => {
    const onContinue = vi.fn();
    const onPause = vi.fn();
    render(<PlaybackCard {...props(SHORT, { onContinue, onPause })} />);
    act(() => { vi.advanceTimersByTime(CARD_DWELL_MIN_MS - 1); });
    const pause = screen.getByRole('button', { name: '⏸ 멈춤' });
    fireEvent.pointerDown(pause);
    act(() => { vi.advanceTimersByTime(500); }); // 누르고 떼는 사이
    fireEvent.pointerUp(pause);
    fireEvent.click(pause);
    act(() => { vi.advanceTimersByTime(CARD_DWELL_MAX_MS * 3); });
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('다음 카드는 누름을 물려받지 않는다 — 제 시간 그대로 돈다', () => {
    const onContinue = vi.fn();
    const view = render(<PlaybackCard {...props(SHORT, { onContinue })} />);
    fireEvent.pointerDown(card());
    view.rerender(<PlaybackCard {...props({ ...SHORT, week: 8 }, { onContinue })} />);
    expect(bar().style.animationPlayState).toBe('running');
    act(() => { vi.advanceTimersByTime(CARD_DWELL_MIN_MS); });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

describe('남은 시간 막대 · 조작 줄', () => {
  it('막대는 그 카드의 시간으로 돌고, 누르면 멈췄다가 떼면 다시 돈다', () => {
    render(<PlaybackCard {...props(LONG)} />);
    const want = cardDwellMs(nonSpace(LONG_HERO, '📌 지훈과 한 약속 — 친구와 놀기. 지켰다.', '📅 학원 결석 — 사건으로 하루 빠졌다.'));
    expect(bar().style.animation).toContain(`${want}ms`);
    expect(bar().style.animationPlayState).toBe('running');
    fireEvent.pointerDown(card());
    expect(bar().style.animationPlayState).toBe('paused');
    fireEvent.pointerUp(card());
    expect(bar().style.animationPlayState).toBe('running');
  });

  it('애니메이션 줄이기면 막대를 안 그린다(시간과 누름 정지는 그대로)', () => {
    reducedMotion = true;
    const onContinue = vi.fn();
    render(<PlaybackCard {...props(SHORT, { onContinue })} />);
    expect(screen.queryByTestId('playback-dwell')).toBeNull();
    fireEvent.pointerDown(card());
    act(() => { vi.advanceTimersByTime(CARD_DWELL_MAX_MS * 2); });
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('조작 줄은 화면 아래 고정이고 카드 안에 있다(배포 E2E가 카드 안에서 ⏸를 찾는다)', () => {
    render(<PlaybackCard {...props(LONG)} />);
    const group = screen.getByRole('group', { name: '재생 조작' });
    expect(group.classList.contains('bottom-action')).toBe(true);
    expect(card().contains(group)).toBe(true);
    expect(group.contains(screen.getByRole('button', { name: '⏸ 멈춤' }))).toBe(true);
  });
});
