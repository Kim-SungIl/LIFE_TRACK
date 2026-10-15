// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p, cgThumbSrc: (p: string) => p }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
import { GameScreen } from '../GameScreen';
import { useGameStore } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { GAME_EVENTS } from '../../engine/events';
import { ACTIVITIES } from '../../engine/activities';
import { assignCurrentEvent } from '../../engine/eventPresentation';

beforeEach(() => {
  cleanup(); localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  localStorage.setItem('lifetrack_rest_ack', '1');
  useGameStore.setState({ state: null, npcActivityMap: {}, runDelta: null });
});

it.each([false, true])('재대화 왕복/새로고침(%s) 후 계획과 연인 표시를 보존한다', async reload => {
  const s = createInitialState('female', ['emotional', 'info'], { rngSeed: 42 });
  Object.assign(s, { year: 6, week: 30, phase: 'weekday', isVacation: false, money: 100,
    routineSlot2: 'self-study', routineSlot3: 'self-study' });
  s.npcs.forEach(n => { n.met = n.id === 'jihun'; n.intimacy = n.id === 'jihun' ? 95 : 0; });
  assignCurrentEvent(s, GAME_EVENTS.find(e => e.id === 'jihun-hs-unsaid')!, 30);
  useGameStore.setState({ state: s });
  useGameStore.getState().resolveEvent(1);
  const after = useGameStore.getState().state!;
  useGameStore.setState({ state: { ...after, week: 34, phase: 'weekday', currentEvent: null,
    lastWeekendPlan: { activities: ['reading', 'library'], npcChoices: {}, isVacation: false } } });
  let view = render(<GameScreen />);
  fireEvent.click(screen.getByRole('button', { name: /지난주처럼/ }));
  fireEvent.click(screen.getByRole('button', { name: /친구 1명/ }));
  fireEvent.click(screen.getByRole('button', { name: '지훈 상세 보기' }));
  fireEvent.click(screen.getByRole('button', { name: '그때 이야기 꺼내기' }));
  if (reload) {
    view.unmount();
    expect(useGameStore.getState().loadSavedGame()).toBe(true);
    view = render(<GameScreen />);
  }
  await waitFor(() => expect(screen.queryByRole('button', { name: /지난주처럼/ })).toBeNull());
  // 실제 EventScene 페이지를 넘겨 선택지에 도달한다.
  await screen.findByRole('button', { name: /다음 페이지|사귀|좋아/ });
  for (let i = 0; i < 12; i++) {
    const next = screen.queryByRole('button', { name: '다음 페이지' });
    if (!next) break;
    fireEvent.click(next);
  }
  const accept = screen.getAllByRole('button').find(b => /사귈/.test(b.textContent ?? ''));
  expect(accept).toBeTruthy();
  fireEvent.click(accept!);
  fireEvent.click(await screen.findByRole('button', { name: '계속 →' }));
  await screen.findByRole('button', { name: /확정/ });
  expect(useGameStore.getState().state!.week).toBe(34);
  expect(useGameStore.getState().state!.relationship?.status).toBe('dating');
  fireEvent.click(screen.getByRole('button', { name: /친구 1명/ }));
  expect(screen.getByRole('button', { name: '지훈 상세 보기' })).toHaveTextContent('연인');
  // 관계 시트는 바깥 닫기 대신 상세로 들어간 뒤 닫는다.
  fireEvent.click(screen.getByRole('button', { name: '지훈 상세 보기' }));
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  for (const id of ['reading', 'library']) {
    expect(screen.getAllByText(ACTIVITIES.find(a => a.id === id)!.name).length).toBeGreaterThan(0);
  }
  fireEvent.click(screen.getByRole('button', { name: /확정/ }));
  expect(useGameStore.getState().state!.week).toBe(35);
  expect(useGameStore.getState().state!.lastWeekendPlan?.activities).toEqual(['reading', 'library']);
});
