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
import { BG_IMAGE_OPACITY, BG_IMAGE_OPACITY_UNTREATED, GLASS_BASE, tintedGlass } from '../screens/surface';
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

/** React가 쓴 **원시 style 속성**에서 background를 뽑는다.
 *  jsdom CSSOM은 `linear-gradient(...), rgba(...)` 같은 레이어드 단축을 통째로 버려서
 *  `el.style.background`가 빈 문자열이 된다 — 이 리포가 clamp에서 이미 겪은 함정과 같은 층이다.
 *  (실측: tintedGlass를 먹인 배너가 CSSOM에선 아예 안 보였다.) */
function rawBackground(el: Element): string {
  const m = /(?:^|;)\s*background:\s*([^;]+)/.exec(el.getAttribute('style') || '');
  // 공백을 걷는다 — jsdom은 `rgba(224,138,91,0.15)`를 `rgba(224, 138, 91, 0.15)`로 정규화해서
  // 소스 그대로의 문자열로 찾으면 못 찾는다(실측: 배너가 렌더돼 있는데 undefined였다).
  return m ? m[1].replace(/\s+/g, '') : '';
}

/** 레이어드 값이면 **마지막 레이어**(바닥)의 알파를 본다. */
function baseAlpha(css: string): number | null {
  if (!css) return null;
  const last = /(rgba?\([^)]*\))\s*$/.exec(css);
  return alphaOf(last ? last[1] : css);
}

function weekdayState(): GameState {
  return createInitialState('male', ['strict', 'emotional'], { rngSeed: 11 });
}

// ⚠️ tsconfig.app.json이 `src/**/__tests__/**`를 제외해서 **테스트 파일은 tsc를 안 거친다.**
// 인자 개수가 안 맞아도 조용히 통과하니(이 함수에서 실제로 겪었다) 시그니처 변경에 주의.
function resultState(year = 1, week = 4): GameState {
  let s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 11 });
  s = { ...s, year, week, routineSlot2: 'self-study', routineSlot3: 'light-exercise' };
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
    // `> 0.4`는 0.41을 통과시켰다(3자 검수 실측). 0.41은 0.55와 눈에 띄게 다르다.
    expect(BG_IMAGE_OPACITY, '0.5 미만이면 사진이 다시 텍스처가 된다').toBeGreaterThanOrEqual(0.5);
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
    // `[aria-live="polite"]` 첫 매칭에 기대면 안 된다 — 예상 피로 프리뷰도 polite라
    // DOM 순서가 바뀌면 엉뚱한 요소를 잰다(3자 검수 지적). 글자로 찾는다.
    const pill = [...container.querySelectorAll<HTMLElement>('[aria-live="polite"]')]
      .find(el => el.textContent?.includes('자동 저장됨'));
    expect(pill, '전제: 자동저장 표시가 떠 있다').toBeTruthy();
    // 0.7로 뒀다가 실측 3.14:1이었다 — muted 0.66rem이라 카드와 같은 0.85가 필요하다.
    expect(baseAlpha(rawBackground(pill!))!, 'muted 0.66rem에 얇은 바닥을 주면 사진이 비친다')
      .toBeGreaterThanOrEqual(0.85);
    expect(pill!.style.backdropFilter, 'blur가 국소 극단을 뭉갠다').toContain('blur');
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

// 3자 검수(cursor 정적 지적 + codex 합성 계산)를 렌더 픽셀로 재현한 결과다.
// 사진을 올리는 일은 **그 화면의 맨몸 요소에 바닥을 까는 일과 한 쌍**이다.
// 짝을 안 맞춘 채 0.55를 먹이면 대비가 내려간다 — 실측(글자 숨김, dsf 2, 95퍼센타일 배경):
//   결산 "이번 주의 기록"  6.54:1 → 3.54:1  (AA 이탈)
//   엔딩 AA 미달           21건  → 24건
//   학년말 AA 미달          1건  → 2건
// 손본 화면(주간·결산)은 맨몸 요소가 0이 됐고, 안 손본 화면은 옛 값으로 되돌렸다.
describe('사진을 올린 화면만 올린다 — 짝을 안 맞춘 화면은 옛 값', () => {
  it('아직 손보지 않은 화면의 값은 옛 값 그대로다', () => {
    expect(BG_IMAGE_OPACITY_UNTREATED).toBe(0.25);
    expect(BG_IMAGE_OPACITY).toBeGreaterThan(BG_IMAGE_OPACITY_UNTREATED);
  });

  it('학년말·엔딩은 그 값을 실제로 쓴다 (사진만 올라가지 않는다)', () => {
    const src = ['screens/YearEndScreen', 'screens/EndingScreen'].map(
      f => readFileSync(resolve(process.cwd(), `src/components/${f}.tsx`), 'utf8'),
    );
    for (const s of src) {
      const tags = s.match(/<BgWrapper[^>]*>/g) ?? [];
      expect(tags.length, '전제: BgWrapper를 쓴다').toBeGreaterThan(0);
      for (const t of tags) {
        expect(t, '손보지 않은 화면에 사진만 올리면 맨몸 글자가 먼저 죽는다')
          .toContain('bgOpacity={BG_IMAGE_OPACITY_UNTREATED}');
      }
    }
  });

  // `rgba(224,138,91,0.15)`류는 색을 입힐 뿐 바닥이 아니다. 색조를 유지한 채 바닥만 깐다.
  it('색조 패널은 색을 지키면서 불투명 바닥을 갖는다', () => {
    const out = tintedGlass('rgba(224,138,91,0.15)');
    expect(out).toContain('rgba(224,138,91,0.15)');
    expect(out.endsWith(GLASS_BASE), `바닥이 마지막 레이어여야 한다: ${out}`).toBe(true);
    expect(alphaOf(GLASS_BASE)!).toBeGreaterThanOrEqual(0.7);
  });

  it('결산 화면의 맨몸 세 곳이 바닥을 갖는다', () => {
    // Y1은 4주 안에 시험이 없어 '다가오는 이벤트'가 안 뜬다 — 세 패널이 다 뜨는 Y5로 본다.
    useGameStore.setState({ state: resultState(5, 4) });
    const { container } = render(<GameScreen />);
    const header = [...container.querySelectorAll('div')]
      .find(el => el.textContent?.trim().endsWith('이번 주의 기록') && rawBackground(el));
    expect(header, '헤더 블록이 바닥을 잃었다 — 실측 3.54:1로 AA 아래다').toBeTruthy();
    expect(baseAlpha(rawBackground(header!))!).toBeGreaterThanOrEqual(0.7);

    // 손실 행 · 다가오는 이벤트 — 색조 패널 둘도 바닥을 갖는다(각각 0.06 / 0.1이었다).
    for (const [tint, label] of [['217,100,88', '손실 행'], ['224,138,91', '다가오는 이벤트']] as const) {
      const panel = [...container.querySelectorAll('div')]
        .find(el => rawBackground(el).includes(tint));
      expect(panel, `전제: ${label} 패널이 렌더된다`).toBeTruthy();
      expect(baseAlpha(rawBackground(panel!))!, `${label}에 바닥이 없다`).toBeGreaterThanOrEqual(0.7);
    }
  });

  // 조건부 렌더라 기본 상태 스캔에 안 잡혔던 둘. 루틴 슬롯을 채우면 둘 다 뜬다.
  // 실측(classroom_middle_afternoon, muted): 0.25에서도 2.06:1이었고 0.55에서 1.00:1이 됐다.
  it('조건부로만 뜨는 맨몸 둘도 바닥을 갖는다', () => {
    useGameStore.setState({ state: { ...weekdayState(), year: 5, week: 4,
      routineSlot2: 'self-study', routineSlot3: 'light-exercise' } as GameState });
    const { container } = render(<GameScreen />);
    expect(container.textContent, '전제: 예상 피로 프리뷰가 뜬다').toContain('예상 피로');

    for (const [tint, label] of [
      ['255,255,255,0.08', '선택 안내'],
      ['255,255,255,0.05', '예상 피로 프리뷰'],
    ] as const) {
      const el = [...container.querySelectorAll('div')]
        .find(e => rawBackground(e).startsWith(`linear-gradient(rgba(${tint})`));
      expect(el, `${label}에 바닥이 없다 — 사진 위 맨몸이면 1.00:1까지 떨어진다`).toBeTruthy();
      expect(baseAlpha(rawBackground(el!))!).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('주간 화면의 다가오는 이벤트 배너도 바닥을 갖는다', () => {
    useGameStore.setState({ state: { ...weekdayState(), year: 5, week: 4 } });
    const { container } = render(<GameScreen />);
    const banner = [...container.querySelectorAll('div')]
      .find(el => rawBackground(el).includes('224,138,91'));
    // `if (banner)`로 감싸면 배너가 안 뜨는 상태에서 공허하게 통과한다 — 존재부터 단언한다.
    expect(banner, '전제: 고1 4주차엔 다가오는 이벤트 배너가 뜬다').toBeTruthy();
    expect(baseAlpha(rawBackground(banner!))!, '색조만 있으면 사진 위에서 1.60:1까지 떨어진다')
      .toBeGreaterThanOrEqual(0.7);
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
    // `position: absolute` 한 줄을 지우면 z-index가 안 먹고 빈 div가 flex 자식으로 0×0이 된다
    // — 셋업 배경 3장이 전부 사라지는데 이 파일 전체가 그린이었다(3자 검수 실측).
    expect(c, 'static이면 z-index가 안 먹고 배경이 0×0으로 붕괴한다')
      .toMatch(/\.setup-screen__bg\s*\{[^}]*position:\s*absolute/);
    expect(c, 'inset:0이 없으면 크기가 0이다').toMatch(/\.setup-screen__bg\s*\{[^}]*inset:\s*0/);
    // F1 — overflow:hidden은 scrollport를 만들어 sticky 푸터를 죽인다(320px에서 CTA가 299px 아래).
    expect(c, 'overflow:hidden이 돌아오면 좁은 기기에서 CTA가 첫 화면 밖으로 나간다')
      .not.toMatch(/\.setup-screen\s*\{[^}]*overflow:\s*hidden/);
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
