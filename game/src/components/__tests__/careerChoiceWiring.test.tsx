// @vitest-environment jsdom
// **T66 배선 — 진로 갈림길이 실제 화면에 뜨고, 고른 갈래가 엔딩 화면의 진로로 그려지는가.
// 회복 문장이 실제 엔딩 화면에 그려지는가.**
//
// 순수함수(careerBranchesOf·recoveryClaimOf)만 잠그면 화면에 안 붙어도 초록이다 — 이 리포에서
// 실제로 있었던 사고다(#435 achievementNote 렌더 블록 삭제가 전부 통과, #397 훅 호출 삭제가 전부 통과).
// 그래서 여기는 실제 GameScreen을 그리고 선택지를 눌러 엔딩 화면까지 간다.
// `ending` prop은 손으로 만들지 않는다 — GameScreen이 calculateEnding(state)로 만드는 그대로 본다(#431).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../engine/assetWebp', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../engine/assetWebp')>()),
  webpSrc: (p: string) => `WEBP::${p}`,
}));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
vi.mock('../../engine/assetPrefetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../engine/assetPrefetch')>()),
  runWhenIdle: () => () => {},
}));

import { GameScreen } from '../GameScreen';
import { clearArchive } from '../../engine/archive';
import { useGameStore } from '../../engine/store';
import { applyYearTransition, createInitialState } from '../../engine/gameEngine';
import { CAREER_CHOICE_EVENT_ID } from '../../engine/careerChoice';
import { RECOVERY_NOTE } from '../../engine/ending';
import type { ExamResult, GameState, ParentStrength, Stats, WeekLog } from '../../engine/types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];

function suneung(mockGrade: number): ExamResult {
  const blank = { score: 0, grade: 'C' as const, delta: 0 };
  return {
    subjects: { korean: blank, english: blank, math: blank, socialScience: blank, artsPhysical: blank },
    average: 0, rank: null, prevRank: null, comment: '', parentReaction: '', teacherReaction: '',
    examType: 'suneung', schoolLevel: 'high', year: 7, semester: 2, mockGrade,
  };
}

const log48 = (): WeekLog => ({
  statChanges: {}, fatigueChange: 0, moneyChange: 0, messages: [], skipped: [],
  milestoneMessages: [], year: 7, week: 48,
});

/** Y7 W48 직후 — 엔진이 엔딩 전환을 시도한 상태(applyYearTransition). 갈림길이면 phase 'event'. */
function lastWeek(stats: Partial<Stats>, traj?: { low: number[] }): GameState {
  const s = createInitialState('male', PARENTS, { rngSeed: 11 });
  s.year = 7;
  s.week = 49;
  s.stats = { academic: 92, talent: 95, social: 70, mental: 80, health: 70, ...stats };
  s.track = 'science';
  s.examResults = [suneung(1)];
  s.weekLog = log48();
  if (traj) s.lowMentalWeeksByYear = traj.low;
  applyYearTransition(s);
  return s;
}

function advanceToChoices() {
  for (let i = 0; i < 10; i++) {
    const next = screen.queryByRole('button', { name: '다음 페이지' }) as HTMLButtonElement | null;
    if (!next || next.disabled) return;
    fireEvent.click(next);
  }
}

beforeEach(() => {
  clearArchive();
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

describe('진로 갈림길 — 화면 배선 (T66)', () => {
  it('두 갈래 판: 장면이 뜨고, 특기를 누르면 엔딩 화면 진로가 특기자로 그려진다', async () => {
    const s = lastWeek({});
    expect(s.currentEvent?.id, '전제: 엔진이 갈림길을 열었다').toBe(CAREER_CHOICE_EVENT_ID);
    const specialist = s.currentEvent!.choices.find(c => c.careerSelect === 'specialist')!;
    const general = s.currentEvent!.choices.find(c => c.careerSelect === 'general')!;
    useGameStore.setState({ state: s });
    render(<GameScreen />);

    // 두 선택지가 실제로 그려진다 — 각 문장에 그 판의 진로 이름이 들어 있다.
    await screen.findByText(specialist.text);
    advanceToChoices();
    expect(screen.getByText(general.text)).toBeTruthy();
    expect(specialist.text).toContain('예술/체육 특기자');
    expect(general.text).toContain('의대 합격');

    fireEvent.click(screen.getByText(specialist.text).closest('button')!);
    fireEvent.click(await screen.findByRole('button', { name: '계속 →' }));

    // 엔딩 화면 — 수능 카드의 진로 칸과 타이틀이 고른 갈래를 말한다.
    expect((await screen.findAllByText(/예술\/체육 특기자/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/의대 합격/), '고르지 않은 갈래가 엔딩에 남았다').toBeNull();
  });

  it('두 갈래 판에서 일반을 누르면 엔딩 화면 진로는 자동 판정(의대) 그대로', async () => {
    const s = lastWeek({});
    const general = s.currentEvent!.choices.find(c => c.careerSelect === 'general')!;
    useGameStore.setState({ state: s });
    render(<GameScreen />);
    await screen.findByText(general.text);
    advanceToChoices();
    fireEvent.click(screen.getByText(general.text).closest('button')!);
    fireEvent.click(await screen.findByRole('button', { name: '계속 →' }));
    expect((await screen.findAllByText(/의대 합격/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/예술\/체육 특기자/)).toBeNull();
  });

  it('갈림 없는 판: 장면 없이 곧장 엔딩 화면', async () => {
    const s = lastWeek({ talent: 60 });
    expect(s.phase).toBe('ending');
    useGameStore.setState({ state: s });
    render(<GameScreen />);
    expect((await screen.findAllByText(/의대 합격/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/좋아하는 일로 가는 길/)).toBeNull();
  });
});

describe('회복 문장 — 엔딩 화면 배선 (T66)', () => {
  it('무너졌다가 회복한 판은 엔딩 화면에 회복 문장이 그려진다', async () => {
    const s = lastWeek({ talent: 60 }, { low: [0, 0, 20, 0, 0, 0, 0] });
    useGameStore.setState({ state: s });
    render(<GameScreen />);
    expect(await screen.findByText(RECOVERY_NOTE)).toBeTruthy();
  });

  it('회복 근거가 없는 판(끝까지 무너졌던 판)은 그리지 않는다', async () => {
    const s = lastWeek({ talent: 60 }, { low: [0, 0, 20, 20, 20, 20, 20] });
    useGameStore.setState({ state: s });
    render(<GameScreen />);
    await screen.findAllByText(/의대 합격/);
    expect(screen.queryByText(RECOVERY_NOTE)).toBeNull();
  });
});
