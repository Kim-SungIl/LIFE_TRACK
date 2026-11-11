// @vitest-environment jsdom
// 연애 순간 다시 보기의 **배선** — 순수함수(romanceMoments.ts·npcAlbum.ts)가 옳아도 화면이 그걸
// 부르는지는 별개다(#397·#431). 학년말 회고·기록장은 GameScreen을 진짜 store로 렌더해 보고,
// 앨범은 '함께한 순간' 보기와 확대 화면의 추억 한 줄을 본다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p, cgThumbSrc: (p: string) => p }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
import { GameScreen } from '../GameScreen';
import { NpcAlbumScreen } from '../screens/NpcAlbumScreen';
import { useGameStore } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { GAME_EVENTS } from '../../engine/events';
import { assignCurrentEvent } from '../../engine/eventPresentation';
import { clearArchive } from '../../engine/archive';
import { yearToPhaseTag } from '../../engine/memorySystem';
import { romanceSlotsFor, slotPath } from '../../engine/npcAlbum';
import type { GameState, MemorySlot } from '../../engine/types';

const RECALL = '연습을 마친 수빈이와 서로 좋아한다고 말한 날.';

beforeEach(() => {
  cleanup(); localStorage.clear(); clearArchive();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  localStorage.setItem('lifetrack_month_tutorial_seen', '1');
  localStorage.setItem('lifetrack_monthly_planning', '0');
  localStorage.setItem('lifetrack_rest_ack', '1');
  useGameStore.setState({ state: null, npcActivityMap: {}, runDelta: null });
});

/** 고2에 수빈 고백을 받아들였지만 growth 두 칸이 앞 학년 기억으로 차 있어 고백 기억이 밀린 판. */
function confessedState(): GameState {
  const s = createInitialState('male', ['emotional', 'info'], { rngSeed: 42 });
  Object.assign(s, { year: 6, week: 30, isVacation: false, phase: 'weekday', currentEvent: null, money: 100,
    routineSlot2: 'self-study', routineSlot3: 'self-study' });
  s.npcs.forEach(n => { n.met = n.id === 'subin'; n.intimacy = n.id === 'subin' ? 95 : 0; });
  const old = (id: string, year: number): MemorySlot => ({ id: `growth_${year}_${id}`, category: 'growth', week: 10, year,
    sourceEventId: id, choiceIndex: 0, recallText: `앞 학년 기억 ${id}`, npcIds: ['subin'], importance: 7,
    phaseTag: yearToPhaseTag(year), toneTag: 'warm' });
  s.memorySlots = [old('old-a', 2), old('old-b', 4)];
  assignCurrentEvent(s, GAME_EVENTS.find(e => e.id === 'subin-hs-studyboard')!, 30);
  useGameStore.setState({ state: s });
  useGameStore.getState().resolveEvent(3);
  useGameStore.getState().resolveEvent(0);
  const out = useGameStore.getState().state!;
  expect(out.relationship?.status, '전제: 사귀기 시작했다').toBe('dating');
  expect(out.memorySlots.some(m => m.sourceEventId === 'subin-hs-confess'), '전제: 기억 칸에서 밀렸다').toBe(false);
  return out;
}

describe('학년말 회고·기록장', () => {
  it('진행 중 학년말 회고(고2)에 밀린 고백 장면이 나온다', async () => {
    useGameStore.setState({ state: { ...confessedState(), phase: 'year-end', week: 49, currentEvent: null } });
    render(<GameScreen />);
    expect(await screen.findByText(RECALL)).toBeTruthy();
  });

  it('기록장에서 지난 학년(고2)을 열어도 나온다', async () => {
    useGameStore.setState({ state: { ...confessedState(), year: 7, week: 3, phase: 'weekday', currentEvent: null } });
    render(<GameScreen />);
    fireEvent.click(screen.getByRole('button', { name: /기록장/ }));
    fireEvent.click(await screen.findByRole('button', { name: '고등학교 2학년' }));
    expect(await screen.findByText(RECALL)).toBeTruthy();
  });

  it('관계가 없는 판엔 연애 장면을 지어내지 않는다', async () => {
    useGameStore.setState({ state: { ...confessedState(), relationship: undefined, phase: 'year-end', week: 49, currentEvent: null } });
    render(<GameScreen />);
    await screen.findByText(/끝났다/);
    expect(screen.queryByText(RECALL)).toBeNull();
  });
});

describe('인물 앨범', () => {
  const subinPaths = romanceSlotsFor('subin', 'male').map(s => slotPath(s, 'male')!);
  const renderAlbum = (seen: string[]) => render(
    <NpcAlbumScreen npcId="subin" story={{ seen: 1, total: 10 }} seenCgFiles={seen} onBack={() => {}} />);

  it("'함께한 순간'은 연인 칸만 겪은 순서로 모으고, 전체 보기로 돌아올 수 있다", () => {
    expect(subinPaths, '전제: 고백·첫 만남·두 번째 만남·졸업 네 칸').toEqual([
      'high/subin-hs-confess_c0_m.png', 'high/subin-romance-outing_m.png', 'high/subin-romance-outing2_m.png',
      'high/subin-farewell_c2_m.png']);
    renderAlbum([subinPaths[0], subinPaths[3]]);
    const total = document.querySelectorAll('section').length;
    fireEvent.click(screen.getByRole('button', { name: '💞 함께한 순간' }));
    const sections = document.querySelectorAll('section');
    expect(sections).toHaveLength(1);
    expect(within(sections[0] as HTMLElement).getByText('함께한 순간')).toBeTruthy();
    expect(within(sections[0] as HTMLElement).getByText('2 / 4')).toBeTruthy();
    const cells = Array.from(sections[0].querySelectorAll('img')).map(i => i.getAttribute('src'));
    expect(cells.map(c => c!.split('images/events/')[1])).toEqual([subinPaths[0], subinPaths[3]]);
    fireEvent.click(screen.getByRole('button', { name: '전체' }));
    expect(document.querySelectorAll('section').length).toBe(total);
  });

  it('여주판엔 수빈 연애 칸이 없으니 보기 버튼도 없다', () => {
    renderAlbum(subinPaths);
    fireEvent.click(screen.getByRole('tab', { name: /여자 주인공/ }));
    expect(screen.queryByRole('button', { name: '💞 함께한 순간' })).toBeNull();
  });

  it("판본 탭을 오가면 전체 보기로 돌아온다 — '함께한 순간'이 저절로 다시 켜지지 않는다", () => {
    renderAlbum(subinPaths);
    const total = document.querySelectorAll('section').length;
    fireEvent.click(screen.getByRole('button', { name: '💞 함께한 순간' }));
    expect(document.querySelectorAll('section')).toHaveLength(1);
    fireEvent.click(screen.getByRole('tab', { name: /여자 주인공/ }));
    fireEvent.click(screen.getByRole('tab', { name: /남자 주인공/ }));
    expect(screen.getByRole('button', { name: '전체' }).getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelectorAll('section').length).toBe(total);
  });

  it('지훈 여주판 확대 화면 — 졸업 칸은 여주 문장, 고백 칸은 제목만', () => {
    const paths = romanceSlotsFor('jihun', 'female').map(s => slotPath(s, 'female')!);
    render(<NpcAlbumScreen npcId="jihun" story={{ seen: 1, total: 10 }} seenCgFiles={paths} onBack={() => {}} />);
    expect(screen.getByRole('tab', { name: /여자 주인공/ }).getAttribute('aria-selected'), '전제: 여주판으로 열린다').toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '💞 함께한 순간' }));
    fireEvent.click(screen.getByTitle('다음 사진도 너와'));
    expect(screen.getByTestId('album-recall').textContent).toBe('지훈이와 사진을 찍으며 졸업 뒤의 만남을 약속했다.');
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    fireEvent.click(screen.getByTitle('지훈과 마음이 통한 순간'));
    expect(screen.queryByTestId('album-recall')).toBeNull();
  });

  it('확대 화면 — 선택지 하나뿐인 졸업 칸은 추억 한 줄, 재고백과 그림을 나눠 쓰는 고백 칸은 제목만', () => {
    renderAlbum(subinPaths);
    fireEvent.click(screen.getByRole('button', { name: '💞 함께한 순간' }));
    fireEvent.click(screen.getByTitle('각자의 하늘, 이어지는 우리'));
    expect(screen.getByTestId('album-recall').textContent).toBe('수빈이와 각자의 꿈을 응원하며 계속 만나기로 했다.');
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    fireEvent.click(screen.getByTitle('수빈과 마음이 통한 순간'));
    expect(screen.queryByTestId('album-recall')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    fireEvent.click(screen.getByTitle('단어장을 덮은 뒤'));
    expect(screen.queryByTestId('album-recall'), '만남은 두 선택이 한 그림').toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    fireEvent.click(screen.getByTitle('이번에는 내가 들어줄게'));
    expect(screen.queryByTestId('album-recall'), '두 번째 만남도 두 선택이 한 그림').toBeNull();
  });
});
