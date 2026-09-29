// @vitest-environment jsdom
// **성장 모양 문장이 화면에 실제로 그려지는가 (T58).**
//
// ⚠️ 순수함수만 잠그면 화면에 안 붙어도 초록이다 — 이 리포에서 실제로 있었던 사고다(PR #435:
// `achievementNote` 값은 양방향으로 잠겨 있었는데 EndingScreen의 렌더 블록을 통째로 지워도
// 1042개가 전부 통과했다). 성장 모양은 등급이 뭉뚱그리는 차이를 말하는 **유일한 자리**라,
// 이 블록이 사라지면 T58이 한 일이 제품에서 통째로 소실된다.
//
// 값이 아니라 **배선**을 잠그는 게 목적이라 `ending`은 손으로 만들지 않고
// `calculateEnding(state)`에서 뽑는다 — 엔진이 안 내보내거나 필드 이름이 갈라지면 여기서 걸린다
// (prop을 손으로 만들면 그 prop을 만드는 층의 누락을 원리상 못 잡는다 — #431).
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EndingScreen } from '../EndingScreen';
import { ACHIEVEMENT_NOTE, calculateEnding, GROWTH_NOTE, GROWTH_SHAPES } from '../../../engine/ending';
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
      onRestartSameHome={null}
      onExitToTitle={() => {}}
    />,
  );
  return ending;
}

/** 이 문장 하나만 화면에 있고 나머지 모양의 문장은 없다. */
function expectOnlyNote(shown: string) {
  expect(screen.getByText(shown)).toBeTruthy();
  for (const shape of GROWTH_SHAPES) {
    const other = GROWTH_NOTE[shape];
    if (other === shown) continue;
    expect(screen.queryByText(other), `다른 모양의 문장이 같이 떴다: ${shape}`).toBeNull();
  }
}

describe('EndingScreen — 성장 모양 문장 배선', () => {
  it('전문화 판은 전문화 문장이 그려진다', () => {
    // 학업 90 / 특기 20 / 생활 20 — 한 갈래만 남은 판. 등급은 S다(강등 없음).
    const ending = renderEnding({ academic: 90, talent: 20, mental: 20, health: 20, social: 20 });
    expect(ending.achievement, '전제: 등급은 S').toBe('S');
    expect(ending.growthShape, '전제: 엔진이 전문화로 분류했다').toBe('singular');
    expectOnlyNote(GROWTH_NOTE.singular);
  });

  it('두 갈래 판은 두 갈래 문장이 그려진다 (같은 S인데 다른 문장)', () => {
    // 학업 91 / 특기 9 / 생활 87 — 실측 유료루틴 빌드의 모양.
    const ending = renderEnding({ academic: 91, talent: 9, mental: 90, health: 88, social: 83 });
    expect(ending.achievement, '전제: 위 판과 같은 등급').toBe('S');
    expect(ending.growthShape).toBe('twin');
    expectOnlyNote(GROWTH_NOTE.twin);
    // 부서진 축 문장과 **함께** 뜬다 — 두 줄은 서로를 밀어내지 않는다.
    expect(screen.getByText(ACHIEVEMENT_NOTE.collapse)).toBeTruthy();
  });

  it('균형 판은 균형 문장이 그려진다 (같은 S인데 또 다른 문장)', () => {
    const ending = renderEnding({ academic: 82, talent: 81, mental: 88, health: 85, social: 86 });
    expect(ending.achievement, '전제: 위 두 판과 같은 등급').toBe('S');
    expect(ending.growthShape).toBe('even');
    expectOnlyNote(GROWTH_NOTE.even);
    // 이 판엔 부서진 축이 없다 — 성장 모양 줄이 그 줄에 얹혀 나오는 게 아니라는 확인.
    expect(ending.achievementNote).toBeNull();
    expect(screen.queryByText(ACHIEVEMENT_NOTE.weakness)).toBeNull();
  });

  it('등급 칸 아래, 회상 층 위에 놓인다 — 화면 끝으로 밀려나면 등급 옆 한 줄이 아니다', () => {
    // 특기 9(<10)라 부서진 축 문장도 함께 뜬다 — 두 줄의 **순서**까지 본다.
    renderEnding({ academic: 91, talent: 9, mental: 90, health: 88, social: 83 });
    const grade = screen.getByText('성취 지수');
    const broken = screen.getByText(ACHIEVEMENT_NOTE.collapse);
    const growth = screen.getByText(GROWTH_NOTE.twin);
    const parents = screen.getByText('부모가 남긴 것');
    const after = (a: Element, b: Element) =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(after(grade, growth), '등급 칸보다 뒤').toBe(true);
    expect(after(broken, growth), '부서진 축 문장 바로 뒤').toBe(true);
    expect(after(growth, parents), '부모 에필로그보다 앞').toBe(true);
  });

  it('모양이 없는 판은 세 문장 다 안 그려진다 (음성 짝)', () => {
    const ending = renderEnding({ academic: 35, talent: 5, mental: 20, health: 20, social: 22 });
    expect(ending.growthNote, '전제: 엔진이 null을 냈다').toBeNull();
    for (const shape of GROWTH_SHAPES) {
      expect(screen.queryByText(GROWTH_NOTE[shape]), `없어야 할 문장: ${shape}`).toBeNull();
    }
    // 화면이 통째로 안 그려진 걸 통과로 오독하지 않게 — 등급 칸은 여전히 있다.
    expect(screen.getByText('성취 지수')).toBeTruthy();
    expect(screen.getByText('행복 지수')).toBeTruthy();
  });
});
