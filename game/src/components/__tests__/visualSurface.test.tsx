// @vitest-environment jsdom
// 그림이 실제로 화면에 드러나는지에 대한 계약.
//
// 이 리포의 전례를 둘 따른다:
//  · **값을 읽어 단언한다** — "배경 img가 있다"는 0.25로 되돌아가도 통과한다(#438: 존재만
//    세는 게이트가 128px 축소본을 놓쳤다). 임계값은 위아래 양쪽을 막는다.
//  · **prop을 받는 층이 아니라 만드는 층에서 본다** — GameScreen을 진짜 스토어로 렌더해
//    BgWrapper/HudPanel/Portrait까지 실제 경로로 지난다(#431).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({
  webpSrc: (p: string) => `WEBP::${p}`,
  cgThumbSrc: (p: string) => `THUMB::${p}`,
}));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
vi.mock('../../engine/assetPrefetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../engine/assetPrefetch')>()),
  runWhenIdle: () => () => {},
}));

import { GameScreen } from '../GameScreen';
import { TitleScreen } from '../TitleScreen';
import { BG_IMAGE_OPACITY } from '../screens/BgWrapper';
import { useGameStore } from '../../engine/store';
import { createInitialState, processWeek } from '../../engine/gameEngine';
import { clearArchive } from '../../engine/archive';
import type { GameState } from '../../engine/types';

const CSS_PATH = resolve(process.cwd(), 'src/styles/game.css');

/** rgba(...)/rgb(...)의 알파. 불투명(rgb, hex)은 1. 못 읽으면 null. */
function alphaOf(css: string): number | null {
  if (!css) return null;
  const m = /rgba?\(([^)]+)\)/.exec(css);
  if (!m) return /^#|^[a-z]+$/i.test(css.trim()) ? 1 : null;
  const parts = m[1].split(',').map(v => v.trim());
  return parts.length < 4 ? 1 : Number(parts[3]);
}

function weekdayState(): GameState {
  return createInitialState('male', ['strict', 'emotional'], { rngSeed: 11 });
}

function resultState(): GameState {
  let s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 11 });
  s = { ...s, year: 1, week: 4, routineSlot2: 'self-study', routineSlot3: 'light-exercise' };
  s = processWeek(s);
  return { ...s, currentEvent: null, phase: 'result' as GameState['phase'] };
}

beforeEach(() => {
  clearArchive();
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

describe('주간 화면 — 배경 사진이 텍스처가 아니라 무대다', () => {
  // 0.25였다. 같은 교실 그림이 EventScene에선 1.0인데 여기선 4배 옅었고,
  // 플레이 시간의 대부분이 이 화면이다.
  it('상수가 옛 값(0.25)으로 돌아가지 않는다', () => {
    expect(BG_IMAGE_OPACITY, '0.4 이하면 사진이 다시 텍스처가 된다').toBeGreaterThan(0.4);
  });

  // 위쪽도 막는다 — 1.0에 가까우면 유리 카드의 blur 뒤가 요란해지고,
  // 초상의 파스텔 바닥이 사진과 직접 싸운다. 한쪽만 잠그면 반대 방향 회귀가 통과한다.
  it('상수가 UI를 덮을 만큼 높지도 않다', () => {
    expect(BG_IMAGE_OPACITY, '0.8 초과면 카드 뒤가 요란해진다').toBeLessThanOrEqual(0.8);
  });

  it('주간 화면의 배경 img가 그 상수를 실제로 쓴다 (하드코딩 복귀 차단)', () => {
    useGameStore.setState({ state: weekdayState() });
    const { container } = render(<GameScreen />);
    const bgImg = container.querySelector<HTMLImageElement>('img[alt=""]');
    expect(bgImg, '전제: 주간 화면에 배경 img가 깔린다 — 없으면 이 테스트는 아무것도 못 본다').toBeTruthy();
    expect(bgImg!.getAttribute('src')).toMatch(/^WEBP::/);
    expect(Number(bgImg!.style.opacity)).toBe(BG_IMAGE_OPACITY);
  });
});

describe('배경을 올리면 카드 밖 요소는 자기 바닥을 가져야 한다', () => {
  // 이 화면에서 카드 밖 맨몸이던 건 둘뿐이다 — HUD와 자동저장 표시.
  // 나머지(StatsPanel·ExamTimeline·독백)는 이미 rgba(42,34,48,0.85)+blur를 갖고 있었다.
  it('HUD가 불투명한 유리 바닥을 갖는다', () => {
    useGameStore.setState({ state: weekdayState() });
    const { container } = render(<GameScreen />);
    const hud = container.querySelector<HTMLElement>('[data-tutorial="hud"]');
    expect(hud).toBeTruthy();
    const a = alphaOf(hud!.style.background);
    expect(a, 'HUD 바닥이 없으면 글자가 사진 위에 맨몸으로 놓인다').not.toBeNull();
    expect(a!, '0.7 미만이면 사진이 글자 사이로 비친다').toBeGreaterThanOrEqual(0.7);
    expect(hud!.style.backdropFilter).toContain('blur');
  });

  it('자동 저장 표시도 바닥을 갖는다 (text-muted라 가장 먼저 묻힌다)', () => {
    localStorage.setItem('lifetrack_save_at', String(Date.now()));
    useGameStore.setState({ state: weekdayState() });
    const { container } = render(<GameScreen />);
    const pill = container.querySelector<HTMLElement>('[aria-live="polite"]');
    expect(pill, '전제: 자동저장 표시가 떠 있다').toBeTruthy();
    const a = alphaOf(pill!.style.background);
    expect(a).not.toBeNull();
    expect(a!).toBeGreaterThanOrEqual(0.6);
  });

  // 주간 결산의 초상만 카드 밖에 맨몸으로 선다(옆 말풍선은 제 바닥이 있다).
  // neutral 초상은 **투명 누끼가 아니라 불투명 파스텔**이 규약이라 액자가 필요하다.
  it('주간 결산 초상에 액자가 걸린다', () => {
    useGameStore.setState({ state: resultState() });
    const { container } = render(<GameScreen />);
    const portrait = container.querySelector<HTMLImageElement>('img[alt^="player_m"]');
    expect(portrait, '전제: 결산 화면에 주인공 초상이 있다').toBeTruthy();
    expect(portrait!.style.outline, '액자가 없으면 파스텔 사각형이 사진 위에 뜬다').toContain('solid');
    expect(portrait!.style.boxShadow).toBeTruthy();
  });
});

describe('셋업 화면 — 이미 있는 배경을 쓴다 (새 그림 0장)', () => {
  /** 타이틀에서 각 단계로 실제 클릭해 들어간다. */
  function goto(phase: 'gender' | 'intro' | 'select') {
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('새 게임'));
    if (phase === 'gender') return;
    fireEvent.click(screen.getByLabelText('남자 주인공으로 시작'));
    if (phase === 'intro') return;
    fireEvent.click(screen.getByText('기억을 더듬어본다'));
  }

  // 단계 ↔ 배경은 문장이 정한다 — 인트로가 "저녁 식탁의 냄새"라고 말하고,
  // 기억 선택이 "우리 집은..."이라고 묻는다. 둘 다 파일이 이미 있었다.
  it.each([
    ['gender', 'school_gate_elementary'],
    ['intro', 'dinner_table'],
    ['select', 'home_evening'],
  ] as const)('%s 단계에 %s 배경이 깔린다', (phase, file) => {
    goto(phase);
    const bg = document.querySelector<HTMLElement>('.setup-screen__bg');
    expect(bg, `${phase} 단계에 배경 레이어가 없다`).toBeTruthy();
    const injected = bg!.style.getPropertyValue('--setup-bg-image');
    expect(injected, '릴리즈에서 png가 지워지므로 webpSrc를 경유해야 한다').toContain('WEBP::');
    expect(injected).toContain(`images/backgrounds/${file}.png`);
  });

  it('인트로는 카드가 없으므로 더 강한 스크림을 쓴다', () => {
    goto('intro');
    const root = document.querySelector('.setup-screen');
    expect(root!.className, '텍스트 전용 화면인데 일반 스크림이면 본문이 사진에 직접 닿는다')
      .toContain('setup-screen--text');
  });

  it('성별·기억 단계는 일반 스크림이다 (카드가 제 바닥을 갖는다)', () => {
    goto('gender');
    expect(document.querySelector('.setup-screen')!.className).not.toContain('setup-screen--text');
  });
});

describe('셋업 배경의 쌓임 순서', () => {
  // 주석을 먼저 걷는다 — 이 규칙들의 주석에 `{ position: relative }` 같은 예시가 들어 있어서
  // 원문 그대로 훑으면 [^}]*가 주석의 }에서 끊기고, 부정 단언은 예시 문구에 걸린다.
  // (실제로 이 테스트를 그렇게 처음 썼다가 자기 주석 때문에 실패했다.)
  const css = () => readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  // 타이틀이 쓰는 `> :not(...) { position: relative }` 방식을 여기서 쓰면 부모 기억 화면의
  // sticky 푸터를 relative로 덮는다. isolate + z-index:-1은 자식에게 아무 규칙도 안 건다.
  it('자식의 position을 덮지 않고 배경을 바닥에 깐다', () => {
    const c = css();
    expect(c, '전제: 규칙 자체가 있어야 한다').toContain('.setup-screen__bg');
    expect(c).toMatch(/\.setup-screen\s*\{[^}]*isolation:\s*isolate/);
    expect(c).toMatch(/\.setup-screen__bg\s*\{[^}]*z-index:\s*-1/);
    expect(c, 'position을 강제하면 sticky 푸터가 죽는다')
      .not.toMatch(/\.setup-screen\s*>\s*:not\([^)]*\)\s*\{[^}]*position:/);
  });

  // 사진 위 글자의 대비는 정적으로 계산할 수 없다(사진마다 다르다). 대신 **스크림의 바닥**을
  // 잠근다 — 실측으로 정한 값이라 이걸 낮추면 대비가 같이 내려간다.
  // 렌더 실측(deviceScaleFactor 2, 글자를 숨기고 배경 픽셀만): 단색 기준선이 muted 6.33:1인데
  // 방사형만 쓰던 판은 기억 선택 헤딩이 4.87:1이었다. 상단 띠를 더해 6.05:1로 올렸고
  // 여섯 지점 최악이 5.27:1이다(AA 4.5).
  it('스크림 바닥이 실측으로 정한 값 아래로 내려가지 않는다', () => {
    const c = css();
    const blocks = /\.setup-screen__bg\s*\{([^}]*)\}/.exec(c);
    expect(blocks, '전제: 배경 규칙을 찾았다').toBeTruthy();
    const std = blocks![1];

    const topBand = /linear-gradient\(180deg,\s*rgba\([^)]*?,\s*([0-9.]+)\)/.exec(std);
    expect(topBand, '상단 띠가 없으면 최상단 헤딩이 사진에 직접 닿는다').toBeTruthy();
    expect(Number(topBand![1]), '상단 띠가 얇아지면 기억 선택 헤딩이 4.5:1 아래로 간다')
      .toBeGreaterThanOrEqual(0.8);

    // 방사형의 **마지막** 스톱 = 가장 열린 지점. 여기가 바닥을 정한다.
    const outer = [...std.matchAll(/rgba\(23,\s*21,\s*28,\s*([0-9.]+)\)\s*100%/g)].map(m => Number(m[1]));
    expect(outer.length, '방사형 바깥 스톱을 못 찾았다').toBeGreaterThan(0);
    expect(Math.min(...outer), '가장자리가 열리면 화면 밖 글자가 먼저 죽는다').toBeGreaterThanOrEqual(0.6);

    // 인트로는 카드가 없어 중앙이 더 눌려야 한다.
    const textBlock = /\.setup-screen--text\s+\.setup-screen__bg\s*\{([^}]*)\}/.exec(c);
    expect(textBlock).toBeTruthy();
    const center = /radial-gradient\([^)]*?rgba\(23,\s*21,\s*28,\s*([0-9.]+)\)/.exec(textBlock![1]);
    expect(Number(center![1]), '텍스트 전용 화면의 중앙 스크림').toBeGreaterThanOrEqual(0.9);
  });

  it('기억 선택의 푸터는 여전히 sticky다', () => {
    render(<TitleScreen />);
    fireEvent.click(screen.getByText('새 게임'));
    fireEvent.click(screen.getByLabelText('남자 주인공으로 시작'));
    fireEvent.click(screen.getByText('기억을 더듬어본다'));
    const root = document.querySelector('.setup-screen')!;
    const sticky = Array.from(root.children).find(
      (el) => (el as HTMLElement).style.position === 'sticky',
    );
    expect(sticky, '푸터가 sticky를 잃으면 "시작하기"가 스크롤 밖으로 나간다').toBeTruthy();
  });
});
