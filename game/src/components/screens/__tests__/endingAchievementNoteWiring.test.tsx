// @vitest-environment jsdom
// **부서진 축 문장이 화면에 실제로 그려지는가.**
//
// ⚠️ 이 락이 없던 판이 머지됐다(PR #435). `calculateEnding`이 내는 `achievementNote` 값은
// ending.test.ts·achievementReach.test.ts가 양방향으로 잠갔는데, **EndingScreen이 그걸 그리는지는
// 아무도 안 봤다** — 화면의 렌더 블록을 통째로 지워도 1042개가 전부 통과했다(뮤테이션 실측).
// 성취 등급에서 강등을 빼면서 "부서진 축"을 말하는 유일한 자리가 이 문장이 됐으므로,
// 이 블록이 사라지면 그 정보가 제품에서 통째로 소실된다. 같은 계열 선례가 #397이다.
//
// 값이 아니라 **배선**을 잠그는 게 목적이라 `ending`은 손으로 만들지 않고
// `calculateEnding(state)`에서 뽑는다 — 필드 이름이 갈라지면 여기서 걸린다.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EndingScreen } from '../EndingScreen';
import { ACHIEVEMENT_NOTE, calculateEnding } from '../../../engine/ending';
import { getBackground } from '../../../engine/backgrounds';
import { createInitialState } from '../../../engine/gameEngine';
import type { GameState, ParentStrength, Stats } from '../../../engine/types';

vi.mock('../../../engine/assetWebp', () => ({ webpSrc: (p: string) => p }));
vi.mock('../../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
vi.mock('../../../audio/sfx', () => ({ playSfx: vi.fn() }));

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];

function renderEnding(stats: Stats) {
  const st: GameState = Object.assign(
    createInitialState('male', PARENTS, { rngSeed: 42 }),
    { stats: { ...stats } },
  );
  const ending = calculateEnding(st);
  render(
    <EndingScreen
      ending={ending} track={st.track} stats={st.stats} parents={st.parents}
      burnoutCount={st.burnoutCount}
      money={st.money}
      moneySpentByYear={st.moneySpentByYear}
      moneyBlockedWeeksByYear={st.moneyBlockedWeeksByYear}
      bgProps={{ bg: getBackground(48, false, 'normal', 7), bgImgError: true, onImgError: vi.fn() }}
      runDelta={null} gender={st.gender}
    />,
  );
  return ending;
}

describe('EndingScreen — 부서진 축 문장 배선', () => {
  it('붕괴 축이 있으면 그 문장이 화면에 그려진다', () => {
    // 특기 5(<10) = 붕괴. bestAxis는 학업 92라 등급은 S로 남는다(강등 없음).
    const ending = renderEnding({ academic: 92, talent: 5, mental: 30, health: 30, social: 30 });
    expect(ending.achievement, '등급은 단조 — 전제 확인').toBe('S');
    expect(ending.achievementNote, '엔진이 문장을 냈다는 전제').toBe(ACHIEVEMENT_NOTE.collapse);
    expect(screen.getByText(ACHIEVEMENT_NOTE.collapse)).toBeTruthy();
  });

  it('약점만 있으면 약점 문장이 그려진다 (붕괴 문장이 아니다)', () => {
    const ending = renderEnding({ academic: 92, talent: 15, mental: 30, health: 30, social: 30 });
    expect(ending.achievementNote).toBe(ACHIEVEMENT_NOTE.weakness);
    expect(screen.getByText(ACHIEVEMENT_NOTE.weakness)).toBeTruthy();
    expect(screen.queryByText(ACHIEVEMENT_NOTE.collapse)).toBeNull();
  });

  it('부서진 축이 없으면 두 문장 다 안 그려진다 (음성 짝)', () => {
    const ending = renderEnding({ academic: 92, talent: 30, mental: 30, health: 30, social: 30 });
    expect(ending.achievementNote).toBeNull();
    expect(screen.queryByText(ACHIEVEMENT_NOTE.collapse)).toBeNull();
    expect(screen.queryByText(ACHIEVEMENT_NOTE.weakness)).toBeNull();
    // 등급 자체는 여전히 그려진다 — 화면이 통째로 안 그려진 걸 통과로 오독하지 않게.
    expect(screen.getByText('성취 지수')).toBeTruthy();
  });
});
