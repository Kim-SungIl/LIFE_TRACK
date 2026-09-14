// @vitest-environment jsdom
// 320px에서 **화면 밖으로 나가지 않는가**. (#443 · #444)
//
// 이 축은 비어 있었다. 성별 선택 카드는 고정 폭 200 × 2 + gap 24 = 424px였고, .screen의
// 좌우 패딩 20을 빼면 320px 기기의 가용 폭은 280px이라 좌우 각 52px이 잘렸다 —
// **왼쪽은 scrollX 하한이 0이라 스크롤로도 볼 수 없었다**(게임의 첫 필수 선택 화면).
// HUD 우측 블록은 min-content(34px)까지 눌려 한글이 음절 단위로 찢어졌다.
//
// **jsdom은 레이아웃을 계산하지 않는다.** 그래서 "몇 px인가"는 여기서 못 잡고
// 실브라우저 측정이 본체다(PR 본문에 320/360/390/414/600 수치). 여기서는 그 수치를 만들어 낸
// **선언**이 사라지지 않았는지를 잡는다 — 고정 폭이 되돌아오거나 flexShrink가 빠지는 회귀.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => `WEBP::${p}` }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
vi.mock('../../engine/assetPrefetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../engine/assetPrefetch')>()),
  runWhenIdle: () => () => {},
}));

import { TitleScreen } from '../TitleScreen';
import { Portrait } from '../Portrait';
import { HudPanel } from '../screens/main/HudPanel';
import { clearArchive } from '../../engine/archive';
import { fireEvent } from '@testing-library/react';

beforeEach(() => {
  clearArchive();
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
});

describe('#443 성별 선택 — 카드가 고정 폭으로 되돌아가지 않는다', () => {
  function genderCards(): HTMLElement[] {
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('새 게임'));
    return [
      screen.getByLabelText('남자 주인공으로 시작'),
      screen.getByLabelText('여자 주인공으로 시작'),
    ];
  }

  it('카드는 유동이고 상한만 200이다 (고정 폭 아님)', () => {
    for (const card of genderCards()) {
      expect(card.style.width, '고정 width가 돌아오면 424px 행이 되살아난다').toBe('');
      expect(card.style.flexGrow, '유동이어야 좁은 화면에서 줄어든다').toBe('1');
      expect(card.style.flexShrink).toBe('1');
      expect(card.style.flexBasis).toBe('0px');
      expect(card.style.minWidth, 'flex 자식의 기본 min-width:auto는 축소를 막는다').toBe('0px');
      expect(card.style.maxWidth, '넓은 화면에서는 예전 크기를 유지한다').toBe('200px');
    }
  });

  // 320px 가용 폭 280 → 카드 134 → 좌우 12씩 빼면 초상 자리가 110 남는다.
  // 예전 20이면 94만 남아 140짜리 초상이 다시 넘친다.
  it('카드 좌우 패딩이 초상 자리를 남긴다', () => {
    for (const card of genderCards()) {
      expect(card.style.paddingLeft, '좌우 패딩이 커지면 320px에서 초상이 다시 잘린다').toBe('12px');
      expect(card.style.paddingRight).toBe('12px');
    }
  });

  it('행의 gap도 유동이고 폭이 100%다', () => {
    const [card] = genderCards();
    const row = card.parentElement!;
    expect(row.style.gap).toContain('clamp(');
    expect(row.style.width, '래퍼가 내용(424px)에 맞춰 늘어나면 카드를 줄여도 소용없다').toBe('100%');
    // 래퍼도 100%여야 부모의 중앙정렬이 화면 밖으로 밀지 않는다.
    expect(row.parentElement!.style.width).toBe('100%');
  });
});

describe('#443 Portrait — 컨테이너보다 커지지 않는다', () => {
  it('maxWidth 100% + 비율 유지 (height 고정이 아니다)', () => {
    const { container } = render(<Portrait characterId="player_m" size={140} expression="neutral" year={1} />);
    const img = container.querySelector('img')!;
    expect(img.style.maxWidth, '픽셀 고정이면 카드만 줄어들고 초상은 그대로 넘친다').toBe('100%');
    expect(img.style.height, 'height를 고정한 채 width만 줄면 objectFit:cover가 좌우를 잘라낸다').toBe('auto');
    expect(img.style.aspectRatio, '비율 선언이 없으면 height:auto가 0이 된다').toBe('1 / 1.25');
  });

  it('기본 크기는 그대로다 (넓은 화면 회귀 방지)', () => {
    const { container } = render(<Portrait characterId="player_m" size={140} expression="neutral" year={1} />);
    const img = container.querySelector('img')!;
    expect(img.style.width, '기준 폭이 바뀌면 넓은 화면의 레이아웃이 전부 움직인다').toBe('140px');
  });
});

describe('#444 HUD — 우측 블록이 찌그러지지 않는다', () => {
  function renderHud() {
    return render(
      <HudPanel
        gender="male" mood="☀️" weekInfo="중2 1학기 12주차" month="5월"
        isVacation={false} fatigue={0} fatigueColor="var(--green)" fatigueLabel="좋음"
        money={4} parents={['strict', 'emotional']} year={3}
        mentalStat={60} mentalState="normal" weeklyActivityCost={0} weeklyOverBudget={false}
        onOpenHome={() => {}} onOpenAlbum={() => {}}
      />,
    );
  }

  it('우측 블록은 줄어들지도 줄바꿈하지도 않는다', () => {
    const { container } = renderHud();
    const hud = container.querySelector('[data-tutorial="hud"]') as HTMLElement;
    const right = hud.children[hud.children.length - 1] as HTMLElement;
    expect(right.style.flexShrink, '0이 아니면 min-content(34px)까지 눌린다').toBe('0');
    expect(right.style.whiteSpace, 'nowrap이 없으면 한글이 음절 단위로 끊긴다').toBe('nowrap');
  });

  it('가운데 블록이 축소를 받는다 (min-width:auto가 아니라)', () => {
    const { container } = renderHud();
    const hud = container.querySelector('[data-tutorial="hud"]') as HTMLElement;
    const mid = hud.children[1] as HTMLElement;
    expect(mid.style.minWidth, '0이 아니면 축소 압력이 전부 우측으로 간다').toBe('0px');
    expect(mid.style.flexGrow).toBe('1');
  });

  it('HUD gap이 좁은 화면에서 줄어든다', () => {
    const { container } = renderHud();
    const hud = container.querySelector('[data-tutorial="hud"]') as HTMLElement;
    expect(hud.style.gap).toContain('clamp(');
  });

  // 우측 글자 크기는 **줄이지 않기로 한 결정**이다 — 320px에서 5px을 벌지만
  // 가장 작은 화면의 글자가 10.2px가 된다. 되돌린 이유를 잠가 둔다.
  it('우측 글자 크기는 고정이다 (가독성 우선)', () => {
    const { container } = renderHud();
    const hud = container.querySelector('[data-tutorial="hud"]') as HTMLElement;
    const right = hud.children[hud.children.length - 1] as HTMLElement;
    expect(right.style.fontSize).toBe('0.72rem');
  });
});
