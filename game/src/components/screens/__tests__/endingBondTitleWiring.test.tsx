// @vitest-environment jsdom
// **관계 타이틀이 화면에 실제로 그려지는가.**
//
// #436의 교훈을 그대로 따른다: `calculateEnding`이 내는 값은 엔진 테스트가 양방향으로 잠그는데
// EndingScreen이 그걸 그리는지는 아무도 안 봤던 전례가 있다(부서진 축 문장, PR #435 — 렌더
// 블록을 통째로 지워도 1042개가 전부 통과했다). 실측으로 확인했다: 이 파일을 넣기 전까지
// **엔딩 타이틀·설명을 그리는 두 줄을 잠그는 테스트가 리포에 한 개도 없었다**
// (`rg 'ending-title|ending\.title' --glob '*.test.*'` → 0건). 즉 타이틀 분기를 아무리 잘
// 잠가도 화면에서 통째로 사라지는 회귀는 초록이었다.
//
// 값이 아니라 **배선**을 잠그는 게 목적이라 `ending`은 손으로 만들지 않고 `calculateEnding(state)`
// 에서 뽑는다 — 필드 이름이 갈라지면(title→headline 등) 여기서 걸린다.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EndingScreen } from '../EndingScreen';
import { BOND_MIN_FRIENDS, BOND_TITLE, calculateEnding, closeFriends } from '../../../engine/ending';
import { BEST_TIER, DEPARTED_NPC_ID } from '../../../engine/endingNpc';
import { getBackground } from '../../../engine/backgrounds';
import { createInitialState } from '../../../engine/gameEngine';
import type { GameState, ParentStrength, Stats } from '../../../engine/types';

vi.mock('../../../engine/assetWebp', () => ({ webpSrc: (p: string) => p }));
vi.mock('../../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
vi.mock('../../../audio/sfx', () => ({ playSfx: vi.fn() }));

const PARENTS: [ParentStrength, ParentStrength] = ['emotional', 'freedom'];
// 관계형 빌드 실측 모양(6시드: acad 69.3 / tal 86.1 / soc 97.2 / men 91.6 / hea 77.5) 반올림.
const RELATIONAL_STATS: Stats = { academic: 70, talent: 86, social: 97, mental: 92, health: 80 };

function bondState(friendCount: number): GameState {
  const st = createInitialState('female', PARENTS, { rngSeed: 42 });
  const targets = st.npcs.filter(n => n.id !== DEPARTED_NPC_ID).slice(0, friendCount).map(n => n.id);
  st.npcs = st.npcs.map(n => (targets.includes(n.id)
    ? { ...n, met: true, intimacy: BEST_TIER }
    : { ...n, met: true, intimacy: 0 }));
  st.stats = { ...RELATIONAL_STATS };
  return st;
}

function renderEnding(st: GameState) {
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

describe('EndingScreen — 관계 타이틀 배선', () => {
  it('절친을 남긴 판은 그 타이틀과 설명이 화면에 뜬다', () => {
    const st = bondState(BOND_MIN_FRIENDS);
    const ending = renderEnding(st);

    expect(ending.title, '엔진이 이 타이틀을 냈다는 전제').toContain(BOND_TITLE);
    // 화면에 뜬 텍스트가 곧 엔진이 낸 문자열이어야 한다(요약·자름·다른 필드 참조 금지).
    expect(screen.getByText(ending.title)).toBeTruthy();
    expect(screen.getByText(ending.description)).toBeTruthy();
    // 가장 가까운 친구의 이름이 실제로 화면에 닿는다 — 설명 배선이 살아 있다는 최종 증거.
    expect(screen.getByText(ending.description).textContent)
      .toContain(closeFriends(st)[0].name);
  });

  it('음성: 절친이 모자란 판엔 이 타이틀이 화면에 없다', () => {
    const ending = renderEnding(bondState(BOND_MIN_FRIENDS - 1));
    expect(ending.title).not.toContain(BOND_TITLE);
    expect(screen.queryByText(new RegExp(BOND_TITLE))).toBeNull();
    // 화면이 통째로 안 그려진 걸 통과로 오독하지 않게 — 진로 타이틀은 여전히 떠 있다.
    expect(screen.getByText(ending.title)).toBeTruthy();
  });
});
